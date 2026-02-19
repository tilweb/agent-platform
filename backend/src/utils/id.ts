/**
 * Centralized ID generation utility.
 * Format: {prefix}_{timestamp_base36}_{random_base36}
 */
export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}
