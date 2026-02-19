/**
 * Session Management - YAML-based session persistence
 */

import type { Session, User } from './types';
import { SESSION_CONFIG } from './types';
import { join } from 'path';
import { SESSIONS_DIR } from '../utils/paths';
import { createYamlStore, loadYaml, deleteYaml } from '../utils/yamlStorage';

const store = createYamlStore<Session>(SESSIONS_DIR);

// In-memory session cache for performance
const sessionCache = new Map<string, Session>();

/**
 * Generate a secure session ID
 */
function generateSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Create a new session for a user
 */
export async function createSession(user: User, userAgent?: string, ipAddress?: string): Promise<Session> {
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

  await store.save(session.id, session);
  sessionCache.set(session.id, session);

  return session;
}

/**
 * Get a session by ID
 */
export async function getSession(sessionId: string): Promise<Session | null> {
  // Check cache first
  if (sessionCache.has(sessionId)) {
    const cached = sessionCache.get(sessionId)!;
    if (new Date(cached.expiresAt) < new Date()) {
      await deleteSession(sessionId);
      return null;
    }
    return cached;
  }

  // Load from file
  const session = await store.load(sessionId);
  if (!session) return null;

  // Check if expired
  if (new Date(session.expiresAt) < new Date()) {
    await deleteSession(sessionId);
    return null;
  }

  // Cache it
  sessionCache.set(sessionId, session);
  return session;
}

/**
 * Validate a session and return associated user ID
 */
export async function validateSession(sessionId: string): Promise<string | null> {
  const session = await getSession(sessionId);
  return session?.userId || null;
}

/**
 * Delete a session
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  sessionCache.delete(sessionId);
  return store.delete(sessionId);
}

/**
 * Delete all sessions for a user
 */
export async function deleteUserSessions(userId: string): Promise<number> {
  const ids = await store.listIds();
  let deleted = 0;

  for (const id of ids) {
    const session = await store.load(id);
    if (session?.userId === userId) {
      sessionCache.delete(session.id);
      if (await store.delete(id)) deleted++;
    }
  }

  return deleted;
}

/**
 * Extend a session's expiration
 */
export async function extendSession(sessionId: string): Promise<Session | null> {
  const session = await getSession(sessionId);
  if (!session) return null;

  session.expiresAt = new Date(Date.now() + SESSION_CONFIG.expiresInMs).toISOString();

  await store.save(session.id, session);
  sessionCache.set(session.id, session);

  return session;
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const ids = await store.listIds();
  const now = new Date();
  let cleaned = 0;

  for (const id of ids) {
    const session = await store.load(id);
    if (session && new Date(session.expiresAt) < now) {
      sessionCache.delete(session.id);
      if (await store.delete(id)) cleaned++;
    }
  }

  return cleaned;
}

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(userId: string): Promise<Session[]> {
  const ids = await store.listIds();
  const sessions: Session[] = [];
  const now = new Date();

  for (const id of ids) {
    const session = await store.load(id);
    if (session?.userId === userId && new Date(session.expiresAt) > now) {
      sessions.push(session);
    }
  }

  return sessions;
}
