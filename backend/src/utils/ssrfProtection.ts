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
 * Expandiert einen IPv6-Adressstring zu einer 8-Group-Hex-Form ohne `::`.
 * Liefert null bei ungueltigen Eingaben. Strippt Zone-ID (%eth0) und
 * eckige Klammern. Siehe security-review L6.
 */
function expandIPv6(input: string): string | null {
  // Zone-ID abschneiden (RFC 6874): fe80::1%eth0 → fe80::1
  let s = input.split('%')[0]!;
  // Eckige Klammern entfernen (URL-Form [::1])
  s = s.replace(/^\[|\]$/g, '');
  s = s.toLowerCase();

  // IPv4-mapped: letzte Gruppe ist Dotted-Quad — wandeln in zwei Hex-Gruppen
  const dottedMatch = s.match(/^(.*:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (dottedMatch) {
    const prefix = dottedMatch[1]!;
    const ipv4 = dottedMatch[2]!;
    if (!isIPv4(ipv4)) return null;
    const parts = ipv4.split('.').map((n) => parseInt(n, 10));
    if (parts.some((n) => isNaN(n) || n < 0 || n > 255)) return null;
    const hi = ((parts[0]! << 8) | parts[1]!).toString(16);
    const lo = ((parts[2]! << 8) | parts[3]!).toString(16);
    s = `${prefix}${hi}:${lo}`;
  }

  // `::` darf maximal einmal vorkommen
  const dcCount = (s.match(/::/g) ?? []).length;
  if (dcCount > 1) return null;

  let groups: string[];
  if (dcCount === 1) {
    const [head, tail] = s.split('::');
    const headParts = head ? head.split(':').filter(Boolean) : [];
    const tailParts = tail ? tail.split(':').filter(Boolean) : [];
    const fillCount = 8 - headParts.length - tailParts.length;
    if (fillCount < 0) return null;
    groups = [...headParts, ...new Array(fillCount).fill('0'), ...tailParts];
  } else {
    groups = s.split(':');
  }
  if (groups.length !== 8) return null;
  // Jede Gruppe 0-4 hex chars
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
  }
  // Auf 4-Zeichen padden
  return groups.map((g) => g.padStart(4, '0')).join(':');
}

/**
 * Check if an IPv6 address is blocked (loopback, link-local, site-local, ULA, ...)
 */
function isIPv6Blocked(ip: string): boolean {
  const expanded = expandIPv6(ip);
  if (!expanded) {
    // Ungueltiges IPv6 — sicherheitshalber blockieren statt durchwinken
    return true;
  }

  const firstGroup = parseInt(expanded.slice(0, 4), 16);
  const secondGroup = parseInt(expanded.slice(5, 9), 16);

  // Loopback ::1
  if (expanded === '0000:0000:0000:0000:0000:0000:0000:0001') return true;
  // Unspecified ::
  if (expanded === '0000:0000:0000:0000:0000:0000:0000:0000') return true;

  // IPv4-mapped IPv6 (::ffff:0:0/96) — IPv4 dahinter pruefen
  if (expanded.startsWith('0000:0000:0000:0000:0000:ffff:')) {
    const last4 = expanded.slice(30); // "xxxx:xxxx"
    const [hiHex, loHex] = last4.split(':');
    const hi = parseInt(hiHex!, 16);
    const lo = parseInt(loHex!, 16);
    const ipv4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
    return isIPv4Blocked(ipv4);
  }

  // Link-local fe80::/10 (erste 10 Bits = 1111 1110 10) — also fe80 - febf
  if (firstGroup >= 0xfe80 && firstGroup <= 0xfebf) return true;
  // Site-local fec0::/10 (deprecated, RFC 3879 — aber noch in alten Setups)
  if (firstGroup >= 0xfec0 && firstGroup <= 0xfeff) return true;
  // Unique-Local fc00::/7 (fc00 - fdff)
  if (firstGroup >= 0xfc00 && firstGroup <= 0xfdff) return true;
  // Discard-only 100::/64
  if (firstGroup === 0x0100 && expanded.startsWith('0100:0000:0000:0000:')) return true;
  // 6to4 Relay 2002:: (oft missbraucht fuer SSRF zu RFC1918-Adressen ueber 2002:cb00:71xx)
  if (firstGroup === 0x2002) {
    // Nicht generell blockieren — aber Mapped-IPv4-Anteil pruefen
    const hi = parseInt(expanded.slice(5, 9), 16);
    const lo = parseInt(expanded.slice(10, 14), 16);
    const ipv4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
    if (isIPv4Blocked(ipv4)) return true;
  }
  // Multicast ff00::/8 — kein Unicast-Ziel, fuer SSRF ungeeignet
  if ((firstGroup & 0xff00) === 0xff00) return true;

  // Stored-Block-List
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
