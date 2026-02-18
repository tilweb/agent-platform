/**
 * Client IP Address Utility
 *
 * Safely extracts client IP address, handling proxy headers only when configured.
 * Prevents IP spoofing by only trusting proxy headers in production environments
 * where a trusted reverse proxy is configured.
 */

import type { Context } from 'hono';

/**
 * Configuration for trusted proxy handling
 */
const TRUST_PROXY = process.env.TRUST_PROXY === 'true';

/**
 * Get the client's real IP address
 *
 * Security considerations:
 * - X-Forwarded-For and X-Real-IP headers can be spoofed by clients
 * - These headers should ONLY be trusted when behind a known reverse proxy
 * - Set TRUST_PROXY=true in .env when running behind nginx, cloudflare, etc.
 *
 * @param c - Hono context
 * @returns Client IP address or 'unknown'
 */
export function getClientIp(c: Context): string {
  // Only trust proxy headers if explicitly configured
  if (TRUST_PROXY) {
    // X-Forwarded-For can contain multiple IPs: "client, proxy1, proxy2"
    // The leftmost IP is the original client (if proxy is configured correctly)
    const forwardedFor = c.req.header('X-Forwarded-For');
    if (forwardedFor) {
      // Take only the first IP (original client)
      const firstIp = forwardedFor.split(',')[0]?.trim();
      if (firstIp && isValidIp(firstIp)) {
        return firstIp;
      }
    }

    // X-Real-IP is typically set by nginx
    const realIp = c.req.header('X-Real-IP');
    if (realIp && isValidIp(realIp)) {
      return realIp;
    }
  }

  // Fallback: Try to get IP from connection info
  // Note: This depends on the runtime (Bun, Node, etc.)
  // In Bun with Hono, we can try to access the raw request
  try {
    // @ts-ignore - Bun-specific API
    const connInfo = c.env?.connInfo || c.req.raw?.socket;
    if (connInfo?.remoteAddress) {
      return connInfo.remoteAddress;
    }
  } catch {
    // Ignore errors accessing connection info
  }

  // Last resort: return unknown
  return 'unknown';
}

/**
 * Validate IP address format (basic validation)
 */
function isValidIp(ip: string): boolean {
  // IPv4: x.x.x.x
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  // IPv6: simplified check
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

  if (ipv4Regex.test(ip)) {
    // Check each octet is 0-255
    const parts = ip.split('.');
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }

  return ipv6Regex.test(ip);
}

/**
 * Check if TRUST_PROXY is configured
 */
export function isTrustProxyEnabled(): boolean {
  return TRUST_PROXY;
}
