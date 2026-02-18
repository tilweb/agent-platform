/**
 * SSRF Protection Utility
 *
 * Provides URL validation to prevent Server-Side Request Forgery attacks.
 * Instead of whitelisting (which doesn't work for arbitrary customer APIs),
 * we use a blocklist approach for internal/private networks.
 */

import { lookup } from 'dns/promises';
import { isIPv4, isIPv6 } from 'net';

export interface SSRFValidationResult {
  allowed: boolean;
  reason?: string;
  resolvedIP?: string;
}

export interface SSRFProtectionOptions {
  /** Enable URLhaus malware domain check (default: false, requires network call) */
  checkMalwareDomains?: boolean;
  /** Cache TTL for URLhaus results in ms (default: 1 hour) */
  malwareCacheTTL?: number;
  /** Allow localhost for development (default: false) */
  allowLocalhost?: boolean;
}

// Private IPv4 ranges that should never be accessed via SSRF
const BLOCKED_IPV4_RANGES = [
  { start: '0.0.0.0', end: '0.255.255.255' },      // Current network
  { start: '10.0.0.0', end: '10.255.255.255' },    // Private Class A
  { start: '100.64.0.0', end: '100.127.255.255' }, // Carrier-grade NAT
  { start: '127.0.0.0', end: '127.255.255.255' },  // Localhost
  { start: '169.254.0.0', end: '169.254.255.255' },// Link-local (includes AWS metadata)
  { start: '172.16.0.0', end: '172.31.255.255' },  // Private Class B
  { start: '192.0.0.0', end: '192.0.0.255' },      // IETF Protocol Assignments
  { start: '192.0.2.0', end: '192.0.2.255' },      // TEST-NET-1
  { start: '192.88.99.0', end: '192.88.99.255' },  // 6to4 Relay
  { start: '192.168.0.0', end: '192.168.255.255' },// Private Class C
  { start: '198.18.0.0', end: '198.19.255.255' },  // Benchmark testing
  { start: '198.51.100.0', end: '198.51.100.255' },// TEST-NET-2
  { start: '203.0.113.0', end: '203.0.113.255' },  // TEST-NET-3
  { start: '224.0.0.0', end: '239.255.255.255' },  // Multicast
  { start: '240.0.0.0', end: '255.255.255.254' },  // Reserved
  { start: '255.255.255.255', end: '255.255.255.255' }, // Broadcast
];

// Specific IPs to always block (cloud metadata endpoints)
const BLOCKED_IPS = [
  '169.254.169.254',  // AWS/GCP/Azure metadata
  '169.254.170.2',    // AWS ECS metadata
  'fd00:ec2::254',    // AWS metadata IPv6
];

// Blocked hostnames
const BLOCKED_HOSTNAMES = [
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata.gke.internal',
  'kubernetes.default.svc',
  'kubernetes.default',
];

// Simple cache for URLhaus results
const malwareDomainCache = new Map<string, { blocked: boolean; timestamp: number }>();
const DEFAULT_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Convert IPv4 address to numeric value for range comparison
 */
function ipv4ToNumber(ip: string): number {
  const parts = ip.split('.').map(Number);
  return ((parts[0]! << 24) + (parts[1]! << 16) + (parts[2]! << 8) + parts[3]!) >>> 0;
}

/**
 * Check if an IPv4 address is in a blocked range
 */
function isIPv4Blocked(ip: string): boolean {
  const ipNum = ipv4ToNumber(ip);

  for (const range of BLOCKED_IPV4_RANGES) {
    const start = ipv4ToNumber(range.start);
    const end = ipv4ToNumber(range.end);
    if (ipNum >= start && ipNum <= end) {
      return true;
    }
  }

  return BLOCKED_IPS.includes(ip);
}

/**
 * Check if an IPv6 address is blocked (loopback, link-local, private)
 */
function isIPv6Blocked(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // Loopback
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') {
    return true;
  }

  // Link-local (fe80::/10)
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') ||
      normalized.startsWith('fea') || normalized.startsWith('feb')) {
    return true;
  }

  // Unique local addresses (fc00::/7)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
    return true;
  }

  // IPv4-mapped IPv6 addresses (::ffff:x.x.x.x)
  if (normalized.startsWith('::ffff:')) {
    const ipv4Part = normalized.slice(7);
    if (isIPv4(ipv4Part)) {
      return isIPv4Blocked(ipv4Part);
    }
  }

  return BLOCKED_IPS.includes(ip);
}

/**
 * Check if a hostname is blocked
 */
function isHostnameBlocked(hostname: string): boolean {
  const lower = hostname.toLowerCase();

  // Direct match
  if (BLOCKED_HOSTNAMES.includes(lower)) {
    return true;
  }

  // Check for suspicious patterns
  if (lower.includes('metadata') || lower.includes('169.254') || lower.includes('internal')) {
    return true;
  }

  // Block numeric IP-like hostnames that could bypass checks
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) && isIPv4Blocked(hostname)) {
    return true;
  }

  return false;
}

/**
 * Resolve hostname to IP and check if blocked
 */
async function resolveAndCheck(hostname: string): Promise<{ blocked: boolean; ip?: string; reason?: string }> {
  try {
    // First resolve the hostname
    const result = await lookup(hostname);
    const ip = result.address;

    // Check if resolved IP is blocked
    if (result.family === 4 && isIPv4Blocked(ip)) {
      return { blocked: true, ip, reason: `Resolved IP ${ip} is in a blocked private range` };
    }

    if (result.family === 6 && isIPv6Blocked(ip)) {
      return { blocked: true, ip, reason: `Resolved IPv6 ${ip} is in a blocked range` };
    }

    return { blocked: false, ip };
  } catch (error: any) {
    // DNS resolution failed - could be intentional (DNS rebinding), block it
    return { blocked: true, reason: `DNS resolution failed: ${error.message}` };
  }
}

/**
 * Check domain against URLhaus malware database (abuse.ch)
 * This is a free service with no API key required
 */
async function checkMalwareDomain(hostname: string, cacheTTL: number): Promise<{ blocked: boolean; reason?: string }> {
  // Check cache first
  const cached = malwareDomainCache.get(hostname);
  if (cached && (Date.now() - cached.timestamp) < cacheTTL) {
    return cached.blocked
      ? { blocked: true, reason: 'Domain found in URLhaus malware database (cached)' }
      : { blocked: false };
  }

  try {
    // URLhaus API - check if domain is in their malware database
    const response = await fetch('https://urlhaus-api.abuse.ch/v1/host/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `host=${encodeURIComponent(hostname)}`,
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      // API error - don't block, just log
      console.warn(`URLhaus API returned ${response.status}`);
      return { blocked: false };
    }

    const data = await response.json() as { query_status: string; urlhaus_reference?: string };

    // "ok" means domain was found in database (malicious)
    // "no_results" means domain is not in database (safe)
    const isBlocked = data.query_status === 'ok';

    // Cache the result
    malwareDomainCache.set(hostname, { blocked: isBlocked, timestamp: Date.now() });

    if (isBlocked) {
      return {
        blocked: true,
        reason: `Domain found in URLhaus malware database: ${data.urlhaus_reference || 'https://urlhaus.abuse.ch'}`
      };
    }

    return { blocked: false };
  } catch (error: any) {
    // Network error - don't block, fail open for availability
    console.warn(`URLhaus check failed: ${error.message}`);
    return { blocked: false };
  }
}

/**
 * Validate a URL for SSRF protection
 *
 * @param urlString - The URL to validate
 * @param options - Validation options
 * @returns Validation result with allowed status and reason
 */
export async function validateUrl(
  urlString: string,
  options: SSRFProtectionOptions = {}
): Promise<SSRFValidationResult> {
  const {
    checkMalwareDomains = false,
    malwareCacheTTL = DEFAULT_CACHE_TTL,
    allowLocalhost = false,
  } = options;

  let url: URL;

  // Parse URL
  try {
    url = new URL(urlString);
  } catch {
    return { allowed: false, reason: 'Invalid URL format' };
  }

  // Protocol check - only allow http/https
  if (!['http:', 'https:'].includes(url.protocol)) {
    return { allowed: false, reason: `Protocol ${url.protocol} not allowed. Only http/https permitted.` };
  }

  const hostname = url.hostname;

  // Check for blocked hostnames
  if (!allowLocalhost && isHostnameBlocked(hostname)) {
    return { allowed: false, reason: `Hostname ${hostname} is blocked` };
  }

  // If it's already an IP address, check directly
  if (isIPv4(hostname)) {
    if (!allowLocalhost && isIPv4Blocked(hostname)) {
      return { allowed: false, reason: `IP address ${hostname} is in a blocked range`, resolvedIP: hostname };
    }
    return { allowed: true, resolvedIP: hostname };
  }

  if (isIPv6(hostname)) {
    if (!allowLocalhost && isIPv6Blocked(hostname)) {
      return { allowed: false, reason: `IPv6 address ${hostname} is in a blocked range`, resolvedIP: hostname };
    }
    return { allowed: true, resolvedIP: hostname };
  }

  // Resolve hostname and check resolved IP
  const dnsResult = await resolveAndCheck(hostname);
  if (dnsResult.blocked) {
    return { allowed: false, reason: dnsResult.reason, resolvedIP: dnsResult.ip };
  }

  // Optional: Check against malware domain list
  if (checkMalwareDomains) {
    const malwareResult = await checkMalwareDomain(hostname, malwareCacheTTL);
    if (malwareResult.blocked) {
      return { allowed: false, reason: malwareResult.reason, resolvedIP: dnsResult.ip };
    }
  }

  return { allowed: true, resolvedIP: dnsResult.ip };
}

/**
 * Clear the malware domain cache (for testing or manual refresh)
 */
export function clearMalwareCache(): void {
  malwareDomainCache.clear();
}

/**
 * Get cache statistics (for monitoring)
 */
export function getCacheStats(): { size: number; entries: string[] } {
  return {
    size: malwareDomainCache.size,
    entries: Array.from(malwareDomainCache.keys()),
  };
}
