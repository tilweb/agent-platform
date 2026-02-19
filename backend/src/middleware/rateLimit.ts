/**
 * Rate Limiting Middleware for Hono
 *
 * Simple in-memory rate limiter using sliding window algorithm.
 * For production with multiple servers, use Redis-based solution.
 */

import type { Context, Next, MiddlewareHandler } from 'hono';
import { getClientIp } from '../utils/clientIp';

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

// Helper to read rate limit from env with default
function envInt(key: string, defaultVal: number): number {
  const val = process.env[key];
  return val ? parseInt(val, 10) || defaultVal : defaultVal;
}

// Preset configurations — all limits configurable via .env

/** Auth routes (login/register) */
export const authRateLimit = rateLimit({
  limit: envInt('RATE_LIMIT_AUTH', 5),
  windowMs: 60 * 1000,
  keyGenerator: (c) => `auth:${getClientIp(c)}`,
});

/** Global API fallback */
export const apiRateLimit = rateLimit({
  limit: envInt('RATE_LIMIT_API', 100),
  windowMs: 60 * 1000,
  keyGenerator: (c) => `api:${getClientIp(c)}`,
});

/** Uploads / expensive operations */
export const uploadRateLimit = rateLimit({
  limit: envInt('RATE_LIMIT_UPLOAD', 10),
  windowMs: 60 * 1000,
  keyGenerator: (c) => `upload:${getClientIp(c)}`,
});

/** Password reset / sensitive operations (per 5 min) */
export const sensitiveRateLimit = rateLimit({
  limit: envInt('RATE_LIMIT_SENSITIVE', 3),
  windowMs: 5 * 60 * 1000,
  keyGenerator: (c) => `sensitive:${getClientIp(c)}`,
});

/** Image generation (expensive API calls) */
export const imageGenRateLimit = rateLimit({
  limit: envInt('RATE_LIMIT_IMAGE_GEN', 5),
  windowMs: 60 * 1000,
  keyGenerator: (c) => `imagegen:${getClientIp(c)}`,
});

/** Chat/LLM requests */
export const chatRateLimit = rateLimit({
  limit: envInt('RATE_LIMIT_CHAT', 30),
  windowMs: 60 * 1000,
  keyGenerator: (c) => `chat:${getClientIp(c)}`,
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
