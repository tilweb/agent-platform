/**
 * Connection Storage — Postgres-backed.
 *
 * Encrypted token persistence: Stammdaten + verschluesselter Payload als Row in
 * `connections.user_connections`. Verschluesselung bleibt unveraendert
 * (CONNECTION_ENCRYPTION_KEY) — die DB sieht nur den Ciphertext.
 *
 * OAuth-States ebenfalls in DB (`auth.oauth_states`), mit TTL via expires_at.
 */

import { eq, and, lt } from 'drizzle-orm';
import { getDb } from '../db';
import { userConnections } from '../db/schema/connections';
import { oauthStates as oauthStatesTable } from '../db/schema/auth';
import type { StoredConnection, TokenSet, ConnectionStatus, EncryptedTokenSet, OAuthState } from './types';
import { encryptTokens, decryptTokens } from './crypto';

function connectionId(userId: string, providerId: string): string {
  return `conn_${userId}_${providerId}`;
}

function defaultStatus(): ConnectionStatus {
  return { status: 'connected', lastChecked: new Date().toISOString() };
}

function rowToConnection(row: typeof userConnections.$inferSelect): StoredConnection {
  const meta = (row.metadata ?? {}) as { status?: ConnectionStatus };
  const tokens = JSON.parse(row.encryptedPayload) as EncryptedTokenSet;
  return {
    providerId: row.provider,
    userId: row.userId,
    tokens,
    status: meta.status ?? defaultStatus(),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function saveConnection(
  userId: string,
  providerId: string,
  tokens: TokenSet,
  status: ConnectionStatus,
): Promise<StoredConnection> {
  const encryptedTokens = await encryptTokens(tokens);
  const encryptedPayload = JSON.stringify(encryptedTokens);
  const now = new Date().toISOString();
  const id = connectionId(userId, providerId);

  const db = getDb();
  await db.insert(userConnections).values({
    id,
    userId,
    provider: providerId,
    encryptedPayload,
    metadata: { status } as never,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: userConnections.id,
    set: {
      encryptedPayload,
      metadata: { status } as never,
      isActive: true,
      updatedAt: now,
    },
  });

  return {
    providerId,
    userId,
    tokens: encryptedTokens,
    status,
    createdAt: now,
    updatedAt: now,
  };
}

export async function loadConnection(
  userId: string,
  providerId: string,
): Promise<{ connection: StoredConnection; tokens: TokenSet } | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(userConnections)
    .where(and(eq(userConnections.userId, userId), eq(userConnections.provider, providerId)))
    .limit(1);
  if (!rows[0]) return null;
  const connection = rowToConnection(rows[0]);
  const tokens = await decryptTokens(connection.tokens);
  return { connection, tokens };
}

export async function loadConnectionRaw(
  userId: string,
  providerId: string,
): Promise<StoredConnection | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(userConnections)
    .where(and(eq(userConnections.userId, userId), eq(userConnections.provider, providerId)))
    .limit(1);
  return rows[0] ? rowToConnection(rows[0]) : null;
}

export async function updateConnectionStatus(
  userId: string,
  providerId: string,
  status: ConnectionStatus,
): Promise<boolean> {
  const db = getDb();
  const id = connectionId(userId, providerId);
  const rows = await db.select().from(userConnections).where(eq(userConnections.id, id)).limit(1);
  if (!rows[0]) return false;
  const meta = (rows[0].metadata ?? {}) as Record<string, unknown>;
  await db.update(userConnections)
    .set({ metadata: { ...meta, status } as never, updatedAt: new Date().toISOString() })
    .where(eq(userConnections.id, id));
  return true;
}

export async function updateConnectionTokens(
  userId: string,
  providerId: string,
  tokens: TokenSet,
): Promise<boolean> {
  const db = getDb();
  const id = connectionId(userId, providerId);
  const rows = await db.select().from(userConnections).where(eq(userConnections.id, id)).limit(1);
  if (!rows[0]) return false;
  const encryptedTokens = await encryptTokens(tokens);
  const encryptedPayload = JSON.stringify(encryptedTokens);
  await db.update(userConnections)
    .set({ encryptedPayload, updatedAt: new Date().toISOString() })
    .where(eq(userConnections.id, id));
  return true;
}

export async function deleteConnection(userId: string, providerId: string): Promise<boolean> {
  const db = getDb();
  const res = await db.delete(userConnections)
    .where(and(eq(userConnections.userId, userId), eq(userConnections.provider, providerId)))
    .returning({ id: userConnections.id });
  return res.length > 0;
}

export async function listUserConnections(userId: string): Promise<StoredConnection[]> {
  const db = getDb();
  const rows = await db.select().from(userConnections).where(eq(userConnections.userId, userId));
  return rows.map(rowToConnection);
}

export async function hasConnection(userId: string, providerId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ id: userConnections.id })
    .from(userConnections)
    .where(and(eq(userConnections.userId, userId), eq(userConnections.provider, providerId)))
    .limit(1);
  return rows.length > 0;
}

// ============================================
// OAuth State (DB)
// ============================================

export async function saveOAuthState(state: string, data: OAuthState): Promise<void> {
  const db = getDb();
  await db.insert(oauthStatesTable).values({
    id: state,
    userId: data.userId || null,
    provider: data.providerId,
    state,
    redirectUri: data.redirectUri ?? null,
    codeVerifier: data.codeVerifier ?? null,
    expiresAt: data.expiresAt,
    createdAt: data.createdAt ?? new Date().toISOString(),
  }).onConflictDoUpdate({
    target: oauthStatesTable.id,
    set: {
      provider: data.providerId,
      state,
      redirectUri: data.redirectUri ?? null,
      codeVerifier: data.codeVerifier ?? null,
      expiresAt: data.expiresAt,
      userId: data.userId || null,
    },
  });
}

export async function loadOAuthState(state: string): Promise<OAuthState | null> {
  const db = getDb();
  const rows = await db.select().from(oauthStatesTable).where(eq(oauthStatesTable.id, state)).limit(1);
  if (!rows[0]) return null;
  const row = rows[0];
  if (new Date(row.expiresAt) < new Date()) {
    await deleteOAuthState(state);
    return null;
  }
  return {
    providerId: row.provider,
    userId: row.userId ?? '',
    redirectUri: row.redirectUri ?? '',
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    codeVerifier: row.codeVerifier ?? undefined,
  };
}

export async function deleteOAuthState(state: string): Promise<void> {
  const db = getDb();
  await db.delete(oauthStatesTable).where(eq(oauthStatesTable.id, state));
}

export async function cleanupExpiredOAuthStates(): Promise<number> {
  const db = getDb();
  const nowIso = new Date().toISOString();
  const res = await db.delete(oauthStatesTable)
    .where(lt(oauthStatesTable.expiresAt, nowIso))
    .returning({ id: oauthStatesTable.id });
  return res.length;
}
