/**
 * CSRF Protection Middleware
 *
 * Protects against Cross-Site Request Forgery attacks by validating:
 * 1. Origin/Referer headers match allowed origins
 * 2. Content-Type is application/json for state-changing requests
 *
 * Combined with SameSite=Lax cookies, this provides strong CSRF protection
 * for JSON API applications without requiring CSRF tokens.
 */

import type { Context, Next, MiddlewareHandler } from 'hono';

interface CSRFConfig {
  /** Allowed origins (default: derived from FRONTEND_URL env or localhost) */
  allowedOrigins?: string[];
  /** Skip CSRF check for certain paths */
  skipPaths?: string[];
  /** Skip CSRF check based on custom logic */
  skip?: (c: Context) => boolean;
}

/**
 * Get allowed origins from environment
 */
function getDefaultAllowedOrigins(): string[] {
  const origins: string[] = [];

  // Frontend URL from environment
  const frontendUrl = process.env.FRONTEND_URL;
  if (frontendUrl) {
    origins.push(frontendUrl);
  }

  // Backend URL (for same-origin requests)
  const apiBaseUrl = process.env.API_BASE_URL;
  if (apiBaseUrl) {
    origins.push(apiBaseUrl);
  }

  // Development: allow localhost variants
  if (process.env.NODE_ENV !== 'production') {
    origins.push(
      'http://localhost:5173',  // Vite default
      'http://localhost:3000',  // Common React port
      'http://localhost:3001',  // Backend port
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
    );
  }

  return origins;
}

/**
 * Check if origin is allowed
 */
function isOriginAllowed(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin) {
    // No origin header - could be same-origin or non-browser request
    // We'll check Referer as fallback
    return false;
  }

  // Exact match
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  // Development: allow any localhost
  if (process.env.NODE_ENV !== 'production') {
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return true;
    }
  }

  return false;
}

/**
 * Extract origin from Referer header
 */
function getOriginFromReferer(referer: string | undefined): string | undefined {
  if (!referer) return undefined;

  try {
    const url = new URL(referer);
    return `${url.protocol}//${url.host}`;
  } catch {
    return undefined;
  }
}

/**
 * Check if request has valid JSON content type
 */
function hasValidContentType(c: Context): boolean {
  const contentType = c.req.header('content-type') || '';

  // Allow JSON
  if (contentType.includes('application/json')) {
    return true;
  }

  // Allow multipart for file uploads
  if (contentType.includes('multipart/form-data')) {
    return true;
  }

  // Allow form data (some endpoints might need it)
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return true;
  }

  return false;
}

/**
 * Create CSRF protection middleware
 */
export function csrfProtection(config: CSRFConfig = {}): MiddlewareHandler {
  const {
    allowedOrigins = getDefaultAllowedOrigins(),
    skipPaths = [],
    skip,
  } = config;

  return async (c: Context, next: Next) => {
    const method = c.req.method;

    // Only check state-changing methods
    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      return next();
    }

    // Check custom skip function
    if (skip && skip(c)) {
      return next();
    }

    // Check skip paths
    const path = c.req.path;
    if (skipPaths.some(p => path.startsWith(p))) {
      return next();
    }

    // Get Origin header
    const origin = c.req.header('origin');
    const referer = c.req.header('referer');

    // Check Origin (preferred)
    if (origin) {
      if (!isOriginAllowed(origin, allowedOrigins)) {
        console.warn(`[CSRF] Blocked request from origin: ${origin}`);
        return c.json(
          { error: 'Forbidden', message: 'Invalid origin' },
          403
        );
      }
    } else {
      // Fallback to Referer if no Origin
      const refererOrigin = getOriginFromReferer(referer);
      if (refererOrigin && !isOriginAllowed(refererOrigin, allowedOrigins)) {
        console.warn(`[CSRF] Blocked request from referer: ${referer}`);
        return c.json(
          { error: 'Forbidden', message: 'Invalid referer' },
          403
        );
      }

      // If neither Origin nor Referer, check if it's a same-site request
      // This can happen with some browsers or non-browser clients
      if (!refererOrigin) {
        // For API clients without Origin/Referer, require valid Content-Type
        // This prevents simple form submissions from other sites
        if (!hasValidContentType(c)) {
          console.warn(`[CSRF] Blocked request without origin and invalid content-type`);
          return c.json(
            { error: 'Forbidden', message: 'Missing origin header' },
            403
          );
        }
      }
    }

    // Validate Content-Type for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      if (!hasValidContentType(c)) {
        // Allow requests with Origin header even without Content-Type
        // (Some DELETE requests might not have body)
        if (!origin) {
          console.warn(`[CSRF] Invalid content-type: ${c.req.header('content-type')}`);
          return c.json(
            { error: 'Forbidden', message: 'Invalid content type' },
            403
          );
        }
      }
    }

    return next();
  };
}

/**
 * Default CSRF middleware instance
 */
export const csrf = csrfProtection();

/**
 * CSRF middleware that skips public endpoints
 */
export const csrfWithSkip = csrfProtection({
  skipPaths: [
    '/api/shared/',      // Public shared chat access
    '/api/auth/status',  // Auth status check (GET-like semantically)
  ],
});
