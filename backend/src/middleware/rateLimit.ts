/**
 * Rate Limiting Middleware for Hono
 *
 * Simple in-memory rate limiter using sliding window algorithm.
 * For production with multiple servers, use Redis-based solution.
 */

import type { Context, Next, MiddlewareHandler } from 'hono';
import { getClientIp } from '../utils/clientIp';
import { getCurrentUserId } from '../auth/middleware';

/** Liefert User-ID falls Auth bereits aktiv ist, sonst Client-IP. */
function userOrIpKey(c: Context, prefix: string): string {
  const userId = getCurrentUserId(c);
  return userId ? `${prefix}:user:${userId}` : `${prefix}:ip:${getClientIp(c)}`;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  /** Maximum requests per window */
  limit: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Custom key generator (default: IP-based) */
  keyGenerator?: (c: Context) => string;
  /** Custom handler when limit exceeded */
  handler?: (c: Context) => Response;
  /** Skip rate limiting for certain requests */
  skip?: (c: Context) => boolean;
}

// In-memory store for rate limit entries
const store = new Map<string, RateLimitEntry>();

// Cleanup interval (every minute)
const CLEANUP_INTERVAL = 60 * 1000;

// Periodic cleanup of expired entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

// Client IP is now handled by centralized utility (../utils/clientIp.ts)
// which respects TRUST_PROXY environment variable

/**
 * Create a rate limiting middleware
 */
export function rateLimit(config: RateLimitConfig): MiddlewareHandler {
  const {
    limit,
    windowMs,
    keyGenerator = (c) => getClientIp(c),
    handler,
    skip,
  } = config;

  return async (c: Context, next: Next) => {
    // Check if should skip
    if (skip && skip(c)) {
      return next();
    }

    const key = keyGenerator(c);
    const now = Date.now();

    // Get or create entry
    let entry = store.get(key);

    if (!entry || entry.resetAt < now) {
      // Create new window
      entry = {
        count: 0,
        resetAt: now + windowMs,
      };
      store.set(key, entry);
    }

    // Increment count
    entry.count++;

    // Set rate limit headers
    const remaining = Math.max(0, limit - entry.count);
    const resetSeconds = Math.ceil((entry.resetAt - now) / 1000);

    c.header('X-RateLimit-Limit', limit.toString());
    c.header('X-RateLimit-Remaining', remaining.toString());
    c.header('X-RateLimit-Reset', resetSeconds.toString());

    // Check if limit exceeded
    if (entry.count > limit) {
      c.header('Retry-After', resetSeconds.toString());

      if (handler) {
        return handler(c);
      }

      return c.json(
        {
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Try again in ${resetSeconds} seconds.`,
          retryAfter: resetSeconds,
        },
        429
      );
    }

    return next();
  };
}

// Preset configurations for common use cases

/**
 * Strict rate limit for authentication routes
 * 5 requests per minute
 */
export const authRateLimit = rateLimit({
  limit: 5,
  windowMs: 60 * 1000, // 1 minute
  keyGenerator: (c) => `auth:${getClientIp(c)}`,
});

/**
 * Standard rate limit for API routes
 * 100 requests per minute
 */
export const apiRateLimit = rateLimit({
  limit: 100,
  windowMs: 60 * 1000,
  keyGenerator: (c) => `api:${getClientIp(c)}`,
});

/**
 * Restrictive rate limit for uploads/expensive operations
 * 10 requests per minute
 */
export const uploadRateLimit = rateLimit({
  limit: 10,
  windowMs: 60 * 1000,
  keyGenerator: (c) => `upload:${getClientIp(c)}`,
});

/**
 * Very strict rate limit for password reset/sensitive operations
 * 3 requests per 5 minutes
 */
export const sensitiveRateLimit = rateLimit({
  limit: 3,
  windowMs: 5 * 60 * 1000, // 5 minutes
  keyGenerator: (c) => `sensitive:${getClientIp(c)}`,
});

/**
 * Chat/LLM rate limit
 * 30 requests per minute (to prevent API token abuse).
 * User-basiert wenn Auth-Cookie vorliegt, sonst IP-basiert (fuer Login-Pfad
 * und Public-Endpoints). Verhindert dass Botnets mit verschiedenen IPs das
 * Limit umgehen — bei eingeloggten Usern zaehlt der User selbst.
 */
export const chatRateLimit = rateLimit({
  limit: 30,
  windowMs: 60 * 1000,
  keyGenerator: (c) => userOrIpKey(c, 'chat'),
});

/**
 * Import rate limit fuer Document-Upload-Endpoints (PM, VM).
 * 20 Imports pro 10 Minuten — verhindert Markitdown-/LLM-Quota-Drain.
 */
export const importRateLimit = rateLimit({
  limit: 20,
  windowMs: 10 * 60 * 1000,
  keyGenerator: (c) => userOrIpKey(c, 'import'),
});

/**
 * Get current rate limit stats (for monitoring)
 */
export function getRateLimitStats(): { entries: number; keys: string[] } {
  return {
    entries: store.size,
    keys: Array.from(store.keys()),
  };
}

/**
 * Clear rate limit for a specific key (for testing/admin)
 */
export function clearRateLimit(key: string): boolean {
  return store.delete(key);
}

/**
 * Clear all rate limits (for testing)
 */
export function clearAllRateLimits(): void {
  store.clear();
}
