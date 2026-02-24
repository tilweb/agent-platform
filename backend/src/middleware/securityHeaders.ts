/**
 * Security Headers Middleware
 *
 * Adds security headers to all responses including:
 * - Content-Security-Policy (CSP)
 * - X-Frame-Options
 * - X-Content-Type-Options
 * - X-XSS-Protection
 * - Referrer-Policy
 * - Permissions-Policy
 */

import type { MiddlewareHandler } from 'hono';

interface SecurityHeadersConfig {
  /** Frontend URL for CSP connect-src */
  frontendUrl?: string;
  /** Additional allowed script sources */
  scriptSrc?: string[];
  /** Additional allowed style sources */
  styleSrc?: string[];
  /** Additional allowed connect sources (APIs) */
  connectSrc?: string[];
  /** Additional allowed image sources */
  imgSrc?: string[];
  /** Allow inline styles (needed for many React apps) */
  allowInlineStyles?: boolean;
  /** Allow inline scripts (not recommended) */
  allowInlineScripts?: boolean;
  /** Enable report-only mode (logs violations without blocking) */
  reportOnly?: boolean;
}

/**
 * Build Content-Security-Policy header value
 */
function buildCSP(config: SecurityHeadersConfig): string {
  const directives: string[] = [];

  // Default: only allow resources from same origin
  directives.push("default-src 'self'");

  // Scripts
  const scriptSources = ["'self'"];
  if (config.allowInlineScripts) {
    scriptSources.push("'unsafe-inline'");
  }
  if (config.scriptSrc) {
    scriptSources.push(...config.scriptSrc);
  }
  directives.push(`script-src ${scriptSources.join(' ')}`);

  // Styles - many React apps need unsafe-inline for styled-components, emotion, etc.
  const styleSources = ["'self'"];
  if (config.allowInlineStyles !== false) {
    styleSources.push("'unsafe-inline'");
  }
  if (config.styleSrc) {
    styleSources.push(...config.styleSrc);
  }
  directives.push(`style-src ${styleSources.join(' ')}`);

  // Images - allow data: for inline images, blob: for generated images
  const imgSources = ["'self'", 'data:', 'blob:'];
  if (config.imgSrc) {
    imgSources.push(...config.imgSrc);
  }
  directives.push(`img-src ${imgSources.join(' ')}`);

  // Fonts
  directives.push("font-src 'self' data:");

  // Connect (API calls, WebSocket)
  const connectSources = ["'self'"];
  if (config.frontendUrl) {
    connectSources.push(config.frontendUrl);
  }
  // Allow localhost in development
  if (process.env.NODE_ENV !== 'production') {
    connectSources.push('http://localhost:*', 'ws://localhost:*');
  }
  if (config.connectSrc) {
    connectSources.push(...config.connectSrc);
  }
  directives.push(`connect-src ${connectSources.join(' ')}`);

  // Media (audio/video)
  directives.push("media-src 'self' blob:");

  // Object/Embed - block plugins
  directives.push("object-src 'none'");

  // Base URI - prevent base tag injection
  directives.push("base-uri 'self'");

  // Form actions - only allow forms to submit to same origin
  directives.push("form-action 'self'");

  // Frame ancestors - prevent clickjacking (like X-Frame-Options)
  directives.push("frame-ancestors 'none'");

  // Upgrade insecure requests in production
  if (process.env.NODE_ENV === 'production') {
    directives.push('upgrade-insecure-requests');
  }

  return directives.join('; ');
}

/**
 * Create security headers middleware
 */
export function securityHeaders(config: SecurityHeadersConfig = {}): MiddlewareHandler {
  const csp = buildCSP(config);
  const cspHeader = config.reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';

  return async (c, next) => {
    await next();

    // Content-Security-Policy
    c.header(cspHeader, csp);

    // Prevent clickjacking
    c.header('X-Frame-Options', 'DENY');

    // Prevent MIME type sniffing
    c.header('X-Content-Type-Options', 'nosniff');

    // XSS Protection (legacy, but still useful for older browsers)
    c.header('X-XSS-Protection', '1; mode=block');

    // Control referrer information
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Disable potentially dangerous browser features
    c.header('Permissions-Policy', 'geolocation=(), microphone=(self), camera=()');

    // Prevent caching of sensitive responses (except static assets like provider logos and generated images)
    const isCacheableAsset =
      c.req.path.endsWith('/logo') ||
      c.req.path.startsWith('/api/images/generated/');
    if (c.req.path.startsWith('/api/') && !isCacheableAsset) {
      c.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      c.header('Pragma', 'no-cache');
      c.header('Expires', '0');
    }
  };
}

/**
 * Default security headers for API-only backend
 */
export const apiSecurityHeaders = securityHeaders({
  allowInlineStyles: true,
});

/**
 * Strict security headers for production
 */
export const strictSecurityHeaders = securityHeaders({
  allowInlineStyles: true,
  allowInlineScripts: false,
  connectSrc: [
    'https://api.adacor.ai',  // Adacor API
  ],
});
