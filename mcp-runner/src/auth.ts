/**
 * Bearer Token Auth Middleware
 */

import type { MiddlewareHandler } from 'hono';

export function bearerAuth(secret: string): MiddlewareHandler {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid Authorization header' }, 401);
    }

    const token = authHeader.slice(7);
    if (token !== secret) {
      return c.json({ error: 'Invalid token' }, 403);
    }

    await next();
  };
}
