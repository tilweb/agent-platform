/**
 * Connection Storage - Encrypted token persistence
 */

import type { StoredConnection, TokenSet, ConnectionStatus, OAuthState } from './types';
import { encryptTokens, decryptTokens } from './crypto';
import { join } from 'path';
import { CONNECTIONS_TOKENS_DIR, OAUTH_STATES_DIR } from '../utils/paths';
import { createYamlStore, ensureDir, loadYaml, saveYaml, deleteYaml, listYamlIds } from '../utils/yamlStorage';

const oauthStore = createYamlStore<OAuthState>(OAUTH_STATES_DIR);

// Per-connection mutex for read-modify-write operations
const connectionLocks = new Map<string, Promise<void>>();

async function withConnectionLock<T>(userId: string, providerId: string, fn: () => Promise<T>): Promise<T> {
  const key = `${userId}:${providerId}`;
  let release: () => void;
  const prev = connectionLocks.get(key) || Promise.resolve();
  connectionLocks.set(key, new Promise<void>((resolve) => { release = resolve; }));
  await prev;
  try {
    return await fn();
  } finally {
    release!();
  }
}

/**
 * Get the file path for a connection
 */
function getConnectionFilePath(userId: string, providerId: string): string {
  return join(CONNECTIONS_TOKENS_DIR, userId, `${providerId}.yaml`);
}

/**
 * Save a connection with encrypted tokens
 */
export async function saveConnection(
  userId: string,
  providerId: string,
  tokens: TokenSet,
  status: ConnectionStatus
): Promise<StoredConnection> {
  const userDir = join(CONNECTIONS_TOKENS_DIR, userId);
  await ensureDir(userDir);

  const encryptedTokens = await encryptTokens(tokens);
  const now = new Date().toISOString();

  const connection: StoredConnection = {
    providerId,
    userId,
    tokens: encryptedTokens,
    status,
    createdAt: now,
    updatedAt: now,
  };

  const filePath = getConnectionFilePath(userId, providerId);
  await saveYaml(filePath, connection);

  return connection;
}

/**
 * Load a connection and decrypt tokens
 */
export async function loadConnection(
  userId: string,
  providerId: string
): Promise<{ connection: StoredConnection; tokens: TokenSet } | null> {
  const filePath = getConnectionFilePath(userId, providerId);
  const connection = await loadYaml<StoredConnection>(filePath);

  if (!connection) return null;

  const tokens = await decryptTokens(connection.tokens);
  return { connection, tokens };
}

/**
 * Update connection status
 */
export async function updateConnectionStatus(
  userId: string,
  providerId: string,
  status: ConnectionStatus
): Promise<boolean> {
  return withConnectionLock(userId, providerId, async () => {
    const filePath = getConnectionFilePath(userId, providerId);
    const connection = await loadYaml<StoredConnection>(filePath);
    if (!connection) return false;

    connection.status = status;
    connection.updatedAt = new Date().toISOString();

    await saveYaml(filePath, connection);
    return true;
  });
}

/**
 * Update connection tokens (after refresh)
 */
export async function updateConnectionTokens(
  userId: string,
  providerId: string,
  tokens: TokenSet
): Promise<boolean> {
  return withConnectionLock(userId, providerId, async () => {
    const filePath = getConnectionFilePath(userId, providerId);
    const connection = await loadYaml<StoredConnection>(filePath);
    if (!connection) return false;

    connection.tokens = await encryptTokens(tokens);
    connection.updatedAt = new Date().toISOString();

    await saveYaml(filePath, connection);
    return true;
  });
}

/**
 * Delete a connection
 */
export async function deleteConnection(userId: string, providerId: string): Promise<boolean> {
  const filePath = getConnectionFilePath(userId, providerId);
  return deleteYaml(filePath);
}

/**
 * List all connections for a user
 */
export async function listUserConnections(userId: string): Promise<StoredConnection[]> {
  const userDir = join(CONNECTIONS_TOKENS_DIR, userId);
  const ids = await listYamlIds(userDir);
  const connections: StoredConnection[] = [];

  for (const id of ids) {
    const conn = await loadYaml<StoredConnection>(join(userDir, `${id}.yaml`));
    if (conn) connections.push(conn);
  }

  return connections;
}

/**
 * Check if a user has a connection
 */
export async function hasConnection(userId: string, providerId: string): Promise<boolean> {
  const filePath = getConnectionFilePath(userId, providerId);
  return await Bun.file(filePath).exists();
}

// ── OAuth State Management ───────────────────────────────────────────

/**
 * Save OAuth state for validation
 */
export async function saveOAuthState(state: string, data: OAuthState): Promise<void> {
  await oauthStore.save(state, data);
}

/**
 * Load and validate OAuth state
 */
export async function loadOAuthState(state: string): Promise<OAuthState | null> {
  const data = await oauthStore.load(state);
  if (!data) return null;

  // Check if expired
  if (new Date(data.expiresAt) < new Date()) {
    await deleteOAuthState(state);
    return null;
  }

  return data;
}

/**
 * Delete OAuth state after use
 */
export async function deleteOAuthState(state: string): Promise<void> {
  await oauthStore.delete(state);
}

/**
 * Clean up expired OAuth states
 */
export async function cleanupExpiredOAuthStates(): Promise<number> {
  const ids = await oauthStore.listIds();
  const now = new Date();
  let cleaned = 0;

  for (const id of ids) {
    const data = await oauthStore.load(id);
    if (data && new Date(data.expiresAt) < now) {
      if (await oauthStore.delete(id)) cleaned++;
    }
  }

  return cleaned;
}
