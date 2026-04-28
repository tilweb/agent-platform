/**
 * Session Management — Postgres-backed (Drizzle).
 *
 * In-memory cache (`sessionCache`) bleibt erhalten — beschleunigt Reads
 * deutlich (Login-Lookup hot path) und reduziert DB-Roundtrips. Cache wird
 * bei jedem Write-Path mitaktualisiert.
 */

import { eq, lt } from 'drizzle-orm';
import { getDb } from '../db';
import { sessions as sessionsTable } from '../db/schema/auth';
import type { Session, User } from './types';
import { SESSION_CONFIG } from './types';

const sessionCache = new Map<string, Session>();

function generateSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function rowToSession(row: typeof sessionsTable.$inferSelect): Session {
  return {
    id: row.id,
    userId: row.userId,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    userAgent: row.userAgent ?? undefined,
    ipAddress: row.ipAddress ?? undefined,
  };
}

export async function createSession(
  user: User,
  userAgent?: string,
  ipAddress?: string,
): Promise<Session> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_CONFIG.expiresInMs);

  const session: Session = {
    id: generateSessionId(),
    userId: user.id,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    userAgent,
    ipAddress,
  };

  const db = getDb();
  await db.insert(sessionsTable).values({
    id: session.id,
    userId: session.userId,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    userAgent: session.userAgent ?? null,
    ipAddress: session.ipAddress ?? null,
  });

  sessionCache.set(session.id, session);
  return session;
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const cached = sessionCache.get(sessionId);
  if (cached) {
    if (new Date(cached.expiresAt) < new Date()) {
      await deleteSession(sessionId);
      return null;
    }
    return cached;
  }

  const db = getDb();
  const rows = await db.select().from(sessionsTable).where(eq(sessionsTable.id, sessionId)).limit(1);
  const row = rows[0];
  if (!row) return null;

  const session = rowToSession(row);
  if (new Date(session.expiresAt) < new Date()) {
    await deleteSession(sessionId);
    return null;
  }

  sessionCache.set(session.id, session);
  return session;
}

export async function validateSession(sessionId: string): Promise<string | null> {
  const session = await getSession(sessionId);
  return session?.userId || null;
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  sessionCache.delete(sessionId);
  const db = getDb();
  const res = await db
    .delete(sessionsTable)
    .where(eq(sessionsTable.id, sessionId))
    .returning({ id: sessionsTable.id });
  return res.length > 0;
}

export async function deleteUserSessions(userId: string): Promise<number> {
  const db = getDb();
  const res = await db
    .delete(sessionsTable)
    .where(eq(sessionsTable.userId, userId))
    .returning({ id: sessionsTable.id });
  for (const row of res) sessionCache.delete(row.id);
  return res.length;
}

export async function extendSession(sessionId: string): Promise<Session | null> {
  const session = await getSession(sessionId);
  if (!session) return null;

  const expiresAt = new Date(Date.now() + SESSION_CONFIG.expiresInMs).toISOString();
  session.expiresAt = expiresAt;

  const db = getDb();
  await db.update(sessionsTable).set({ expiresAt }).where(eq(sessionsTable.id, sessionId));

  sessionCache.set(session.id, session);
  return session;
}

export async function cleanupExpiredSessions(): Promise<number> {
  const db = getDb();
  const nowIso = new Date().toISOString();
  const res = await db
    .delete(sessionsTable)
    .where(lt(sessionsTable.expiresAt, nowIso))
    .returning({ id: sessionsTable.id });
  for (const row of res) sessionCache.delete(row.id);
  return res.length;
}

export async function getUserSessions(userId: string): Promise<Session[]> {
  const db = getDb();
  const nowIso = new Date().toISOString();
  const rows = await db.select().from(sessionsTable).where(eq(sessionsTable.userId, userId));
  return rows.filter(r => r.expiresAt > nowIso).map(rowToSession);
}
