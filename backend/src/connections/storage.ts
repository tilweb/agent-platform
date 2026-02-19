/**
 * Connection Storage - Encrypted token persistence
 */

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { StoredConnection, TokenSet, ConnectionStatus, OAuthState } from './types';
import { encryptTokens, decryptTokens } from './crypto';
import { unlinkSync } from 'node:fs';
import { join } from 'path';

const DATA_DIR = join(import.meta.dir, '../../../data');
const CONNECTIONS_DIR = join(DATA_DIR, 'connections');
const OAUTH_STATE_DIR = join(DATA_DIR, 'auth/oauth-states');

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
 * Ensure the connections directory exists for a user
 */
async function ensureConnectionsDir(userId: string): Promise<string> {
  const userDir = join(CONNECTIONS_DIR, userId);
  try {
    await Bun.write(join(userDir, '.gitkeep'), '');
  } catch {
    // Directory might already exist
  }
  return userDir;
}

/**
 * Ensure the OAuth state directory exists
 */
async function ensureOAuthStateDir(): Promise<void> {
  try {
    await Bun.write(join(OAUTH_STATE_DIR, '.gitkeep'), '');
  } catch {
    // Directory might already exist
  }
}

/**
 * Get the file path for a connection
 */
function getConnectionFilePath(userId: string, providerId: string): string {
  return join(CONNECTIONS_DIR, userId, `${providerId}.yaml`);
}

/**
 * Get the file path for an OAuth state
 */
function getOAuthStateFilePath(state: string): string {
  return join(OAUTH_STATE_DIR, `${state}.yaml`);
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
  await ensureConnectionsDir(userId);

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
  await Bun.write(filePath, stringifyYaml(connection));

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
  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    return null;
  }

  const content = await file.text();
  const connection = parseYaml(content) as StoredConnection;
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
    const file = Bun.file(filePath);

    if (!(await file.exists())) {
      return false;
    }

    const content = await file.text();
    const connection = parseYaml(content) as StoredConnection;

    connection.status = status;
    connection.updatedAt = new Date().toISOString();

    await Bun.write(filePath, stringifyYaml(connection));
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
    const file = Bun.file(filePath);

    if (!(await file.exists())) {
      return false;
    }

    const content = await file.text();
    const connection = parseYaml(content) as StoredConnection;

    connection.tokens = await encryptTokens(tokens);
    connection.updatedAt = new Date().toISOString();

    await Bun.write(filePath, stringifyYaml(connection));
    return true;
  });
}

/**
 * Delete a connection
 */
export async function deleteConnection(userId: string, providerId: string): Promise<boolean> {
  const filePath = getConnectionFilePath(userId, providerId);
  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    return false;
  }

  try {
    unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * List all connections for a user
 */
export async function listUserConnections(userId: string): Promise<StoredConnection[]> {
  const userDir = join(CONNECTIONS_DIR, userId);
  const connections: StoredConnection[] = [];

  const glob = new Bun.Glob('*.yaml');
  try {
    for await (const file of glob.scan(userDir)) {
      if (file === '.gitkeep') continue;

      const filePath = join(userDir, file);
      const content = await Bun.file(filePath).text();
      const connection = parseYaml(content) as StoredConnection;
      connections.push(connection);
    }
  } catch {
    // Directory doesn't exist or is empty
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

// OAuth State Management

/**
 * Save OAuth state for validation
 */
export async function saveOAuthState(state: string, data: OAuthState): Promise<void> {
  await ensureOAuthStateDir();
  const filePath = getOAuthStateFilePath(state);
  await Bun.write(filePath, stringifyYaml(data));
}

/**
 * Load and validate OAuth state
 */
export async function loadOAuthState(state: string): Promise<OAuthState | null> {
  const filePath = getOAuthStateFilePath(state);
  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    return null;
  }

  const content = await file.text();
  const data = parseYaml(content) as OAuthState;

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
  const filePath = getOAuthStateFilePath(state);
  const file = Bun.file(filePath);

  if (await file.exists()) {
    try {
      unlinkSync(filePath);
    } catch {
      // Ignore errors
    }
  }
}

/**
 * Clean up expired OAuth states
 */
export async function cleanupExpiredOAuthStates(): Promise<number> {
  await ensureOAuthStateDir();

  let cleaned = 0;
  const now = new Date();
  const glob = new Bun.Glob('*.yaml');

  for await (const file of glob.scan(OAUTH_STATE_DIR)) {
    if (file === '.gitkeep') continue;

    const filePath = join(OAUTH_STATE_DIR, file);
    const content = await Bun.file(filePath).text();
    const data = parseYaml(content) as OAuthState;

    if (new Date(data.expiresAt) < now) {
      try {
        unlinkSync(filePath);
        cleaned++;
      } catch {
        // Ignore errors
      }
    }
  }

  return cleaned;
}
