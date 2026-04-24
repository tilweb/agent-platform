/**
 * Public-API Hono middleware stack.
 *
 * Applied under /api/public/v1/* — each function-dispatch route chains these
 * in order: apiKeyAuth → (scopeCheck via resolveAppFunction in router) →
 * apiKeyRateLimit → requestValidator.
 */

import type { Context, Next, MiddlewareHandler } from 'hono';
import { verifyRawKey, touchLastUsed } from './keys/service';
import type { ApiKey } from './types';

declare module 'hono' {
  interface ContextVariableMap {
    apiKey: ApiKey;
    requestId: string;
  }
}

function makeRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Authenticate via `Authorization: Bearer <raw-key>` header.
 * On success sets `c.set('apiKey', key)` and `c.set('requestId', ...)`.
 */
export const apiKeyAuth: MiddlewareHandler = async (c: Context, next: Next) => {
  const header = c.req.header('authorization') ?? c.req.header('Authorization');
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    return c.json({ error: 'Missing Authorization: Bearer <key>', code: 'unauthorized' }, 401);
  }
  const raw = header.slice(7).trim();
  const key = await verifyRawKey(raw);
  if (!key) {
    return c.json({ error: 'Invalid or expired API key', code: 'unauthorized' }, 401);
  }
  c.set('apiKey', key);
  c.set('requestId', makeRequestId());
  // fire-and-forget; touchLastUsed is debounced internally
  touchLastUsed(key.id).catch(err => console.error('[public-api] touchLastUsed:', err));
  await next();
};

/**
 * Per-key, per-function rate limit using the same sliding-window primitive as
 * middleware/rateLimit.ts but with a closure that reads the limit off the key
 * at request time (different keys can carry different limits).
 */
interface RateEntry { count: number; resetAt: number }
const rateStore = new Map<string, RateEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateStore.entries()) {
    if (v.resetAt < now) rateStore.delete(k);
  }
}, 60 * 1000);

export function apiKeyRateLimit(appId: string, functionId: string): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const key = c.get('apiKey');
    if (!key) return next(); // auth hasn't run — should not happen in practice
    const bucketKey = `${key.id}:${appId}:${functionId}`;
    const now = Date.now();
    const windowMs = key.rateLimit.windowSec * 1000;
    let entry = rateStore.get(bucketKey);
    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + windowMs };
      rateStore.set(bucketKey, entry);
    }
    entry.count++;
    c.header('X-RateLimit-Limit', String(key.rateLimit.requests));
    c.header('X-RateLimit-Remaining', String(Math.max(0, key.rateLimit.requests - entry.count)));
    c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
    if (entry.count > key.rateLimit.requests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      c.header('Retry-After', String(retryAfter));
      return c.json({ error: 'Rate limit exceeded', code: 'rate_limited', retryAfter }, 429);
    }
    await next();
  };
}
