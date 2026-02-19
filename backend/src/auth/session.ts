/**
 * Session Management - YAML-based session persistence
 */

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { Session, User } from './types';
import { SESSION_CONFIG } from './types';
import { unlinkSync } from 'node:fs';
import { join } from 'path';

const DATA_DIR = join(import.meta.dir, '../../../data');
const SESSIONS_DIR = join(DATA_DIR, 'auth/sessions');

// In-memory session cache for performance
const sessionCache = new Map<string, Session>();

/**
 * Ensure the sessions directory exists
 */
async function ensureSessionsDir(): Promise<void> {
  try {
    await Bun.write(join(SESSIONS_DIR, '.gitkeep'), '');
  } catch {
    // Directory might already exist
  }
}

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
 * Get the file path for a session
 */
function getSessionFilePath(sessionId: string): string {
  return join(SESSIONS_DIR, `${sessionId}.yaml`);
}

/**
 * Create a new session for a user
 */
export async function createSession(user: User, userAgent?: string, ipAddress?: string): Promise<Session> {
  await ensureSessionsDir();

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

  // Save to file
  const yaml = stringifyYaml(session);
  await Bun.write(getSessionFilePath(session.id), yaml);

  // Cache it
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

    // Check if expired
    if (new Date(cached.expiresAt) < new Date()) {
      await deleteSession(sessionId);
      return null;
    }

    return cached;
  }

  // Load from file
  const filePath = getSessionFilePath(sessionId);
  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    return null;
  }

  const content = await file.text();
  const session = parseYaml(content) as Session;

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
  // Remove from cache
  sessionCache.delete(sessionId);

  // Delete file
  const filePath = getSessionFilePath(sessionId);
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
 * Delete all sessions for a user
 */
export async function deleteUserSessions(userId: string): Promise<number> {
  await ensureSessionsDir();

  let deleted = 0;
  const glob = new Bun.Glob('*.yaml');

  for await (const file of glob.scan(SESSIONS_DIR)) {
    if (file === '.gitkeep') continue;

    const filePath = join(SESSIONS_DIR, file);
    const content = await Bun.file(filePath).text();
    const session = parseYaml(content) as Session;

    if (session.userId === userId) {
      sessionCache.delete(session.id);
      try {
        unlinkSync(filePath);
        deleted++;
      } catch {
        // Ignore errors
      }
    }
  }

  return deleted;
}

/**
 * Extend a session's expiration
 */
export async function extendSession(sessionId: string): Promise<Session | null> {
  const session = await getSession(sessionId);
  if (!session) {
    return null;
  }

  const now = new Date();
  session.expiresAt = new Date(now.getTime() + SESSION_CONFIG.expiresInMs).toISOString();

  // Update file
  const yaml = stringifyYaml(session);
  await Bun.write(getSessionFilePath(session.id), yaml);

  // Update cache
  sessionCache.set(session.id, session);

  return session;
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  await ensureSessionsDir();

  let cleaned = 0;
  const now = new Date();
  const glob = new Bun.Glob('*.yaml');

  for await (const file of glob.scan(SESSIONS_DIR)) {
    if (file === '.gitkeep') continue;

    const filePath = join(SESSIONS_DIR, file);
    const content = await Bun.file(filePath).text();
    const session = parseYaml(content) as Session;

    if (new Date(session.expiresAt) < now) {
      sessionCache.delete(session.id);
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

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(userId: string): Promise<Session[]> {
  await ensureSessionsDir();

  const sessions: Session[] = [];
  const now = new Date();
  const glob = new Bun.Glob('*.yaml');

  for await (const file of glob.scan(SESSIONS_DIR)) {
    if (file === '.gitkeep') continue;

    const filePath = join(SESSIONS_DIR, file);
    const content = await Bun.file(filePath).text();
    const session = parseYaml(content) as Session;

    if (session.userId === userId && new Date(session.expiresAt) > now) {
      sessions.push(session);
    }
  }

  return sessions;
}
