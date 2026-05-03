/**
 * Authentication Middleware for Hono
 */

import type { Context, Next, MiddlewareHandler } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { getSession, extendSession, deleteSession } from './session';
import { loadUser } from './storage';
import { SESSION_CONFIG, sanitizeUser } from './types';
import type { UserWithoutPassword } from './types';

// Extend Hono context with user info
declare module 'hono' {
  interface ContextVariableMap {
    userId: string;
    user: UserWithoutPassword;
  }
}

/**
 * Authentication middleware - requires valid session
 * Implements sliding sessions: extends session on each authenticated request
 */
export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  const sessionId = getCookie(c, SESSION_CONFIG.cookieName);

  if (!sessionId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const session = await getSession(sessionId);
  if (!session) {
    return c.json({ error: 'Invalid or expired session' }, 401);
  }

  // Check maximum absolute session lifetime (30 days from creation)
  const sessionAge = Date.now() - new Date(session.createdAt).getTime();
  if (sessionAge > SESSION_CONFIG.maxAbsoluteLifetimeMs) {
    await deleteSession(sessionId);
    return c.json({ error: 'Session expired. Please login again.' }, 401);
  }

  const user = await loadUser(session.userId);
  if (!user || !user.isActive) {
    return c.json({ error: 'User not found or inactive' }, 401);
  }

  // Sliding session: nur erweitern wenn die letzte Erweiterung > 1h her ist —
  // verhindert dass jeder Request einen DB-Write triggert. Da extendSession()
  // session.expiresAt auf (now + TTL) setzt, koennen wir den Zeitpunkt der
  // letzten Erweiterung aus expiresAt - TTL rekonstruieren.
  const ONE_HOUR_MS = 60 * 60 * 1000;
  const expiresAtMs = new Date(session.expiresAt).getTime();
  const lastExtendedAtMs = expiresAtMs - SESSION_CONFIG.expiresInMs;
  const sinceLastExtendMs = Date.now() - lastExtendedAtMs;
  if (sinceLastExtendMs > ONE_HOUR_MS) {
    await extendSession(sessionId);
    setCookie(c, SESSION_CONFIG.cookieName, sessionId, SESSION_CONFIG.cookieOptions);
  }

  // Set user info in context
  c.set('userId', user.id);
  c.set('user', sanitizeUser(user));

  await next();
}

/**
 * Optional authentication middleware - continues even without session
 * Sets userId and user if valid session exists
 */
export async function optionalAuthMiddleware(c: Context, next: Next): Promise<void> {
  const sessionId = getCookie(c, SESSION_CONFIG.cookieName);

  if (sessionId) {
    const session = await getSession(sessionId);
    if (session) {
      const user = await loadUser(session.userId);
      if (user && user.isActive) {
        c.set('userId', user.id);
        c.set('user', sanitizeUser(user));
      }
    }
  }

  await next();
}

/**
 * Check if request is authenticated
 */
export async function isAuthenticated(c: Context): Promise<boolean> {
  const sessionId = getCookie(c, SESSION_CONFIG.cookieName);
  if (!sessionId) return false;

  const session = await getSession(sessionId);
  if (!session) return false;

  const user = await loadUser(session.userId);
  return !!(user && user.isActive);
}

/**
 * Get current user from context (after authMiddleware)
 */
export function getCurrentUser(c: Context): UserWithoutPassword | undefined {
  return c.get('user');
}

/**
 * Get current user ID from context (after authMiddleware)
 */
export function getCurrentUserId(c: Context): string | undefined {
  return c.get('userId');
}

/**
 * Admin-Only Middleware. MUSS nach `authMiddleware` gehaengt werden
 * (z.B. `route.use('*', authMiddleware, adminMiddleware)`).
 */
export const adminMiddleware: MiddlewareHandler = async (c, next) => {
  const user = c.get('user');
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }
  await next();
};
