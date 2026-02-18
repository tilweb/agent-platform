/**
 * Sanitization Utilities
 *
 * Functions to sanitize user-generated content and prevent XSS attacks.
 */

/**
 * Dangerous URL protocols that could execute JavaScript
 */
const DANGEROUS_PROTOCOLS = [
  'javascript:',
  'vbscript:',
  'data:text/html',
  'data:application/x-javascript',
];

/**
 * Check if a URL is safe to use in href
 *
 * @param {string} url - The URL to check
 * @returns {boolean} - True if URL is safe
 */
export function isSafeUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }

  const trimmed = url.trim().toLowerCase();

  // Check for dangerous protocols
  for (const protocol of DANGEROUS_PROTOCOLS) {
    if (trimmed.startsWith(protocol)) {
      return false;
    }
  }

  // Allow relative URLs
  if (trimmed.startsWith('/') || trimmed.startsWith('#') || trimmed.startsWith('?')) {
    return true;
  }

  // Allow safe protocols
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:')
  ) {
    return true;
  }

  // Allow protocol-relative URLs
  if (trimmed.startsWith('//')) {
    return true;
  }

  // Block everything else (could be javascript: with encoding tricks)
  // But allow simple text that looks like a domain (e.g., "example.com")
  if (!trimmed.includes(':')) {
    return true;
  }

  return false;
}

/**
 * Sanitize a URL for use in href attribute
 *
 * @param {string} url - The URL to sanitize
 * @returns {string} - Safe URL or '#' if dangerous
 */
export function sanitizeUrl(url) {
  if (isSafeUrl(url)) {
    return url;
  }

  console.warn('[Sanitize] Blocked dangerous URL:', url);
  return '#';
}

/**
 * Validate and sanitize a share URL
 *
 * Share URLs must:
 * - Start with /share/
 * - Contain only safe characters (alphanumeric, hyphen, underscore)
 * - Not contain path traversal attempts
 *
 * @param {string} shareUrl - The share URL from API
 * @returns {string | null} - Validated URL or null if invalid
 */
export function validateShareUrl(shareUrl) {
  if (!shareUrl || typeof shareUrl !== 'string') {
    return null;
  }

  // Must start with /share/
  if (!shareUrl.startsWith('/share/')) {
    console.warn('[Sanitize] Invalid share URL format:', shareUrl);
    return null;
  }

  // Check for path traversal attempts
  if (shareUrl.includes('..') || shareUrl.includes('//')) {
    console.warn('[Sanitize] Path traversal attempt in share URL:', shareUrl);
    return null;
  }

  // Validate token part (only alphanumeric, hyphen, underscore)
  const token = shareUrl.substring('/share/'.length);
  if (!/^[a-zA-Z0-9_-]+$/.test(token)) {
    console.warn('[Sanitize] Invalid characters in share token:', shareUrl);
    return null;
  }

  // Token should be reasonable length (8-128 chars)
  if (token.length < 8 || token.length > 128) {
    console.warn('[Sanitize] Invalid share token length:', shareUrl);
    return null;
  }

  return shareUrl;
}
