/**
 * Centralized ID generation utility.
 * Format: {prefix}_{timestamp_base36}_{random_hex}
 * Uses crypto.getRandomValues() for unpredictable random part.
 */
export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const random = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${timestamp}_${random}`;
}
