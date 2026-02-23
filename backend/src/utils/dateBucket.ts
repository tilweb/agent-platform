/**
 * Date-based bucket utilities for file sharding.
 *
 * Extracts YYYY/MM date buckets from ID timestamps to distribute files
 * across subdirectories and avoid flat-directory performance degradation.
 */

/**
 * Extract a YYYY/MM date bucket from an entity ID.
 *
 * Supported formats:
 * - `{prefix}_{base36_timestamp}_{hex}` (e.g. task_m1abc23_deadbeef) — base36 ms
 * - `session_{decimal_timestamp}_{random}` (e.g. session_1708000000000_abc123) — decimal ms
 *
 * Returns null if the timestamp cannot be parsed or is out of reasonable range.
 */
export function dateBucketFromId(id: string): string | null {
  const parts = id.split('_');
  if (parts.length < 3) return null;

  const prefix = parts[0];
  const tsPart = parts[1]!;
  let ms: number;

  if (prefix === 'session') {
    // session IDs use decimal timestamps
    ms = Number(tsPart);
  } else {
    // Other IDs (task_, etc.) use base36 timestamps
    ms = parseInt(tsPart, 36);
  }

  if (!Number.isFinite(ms) || ms < 1_000_000_000_000 || ms > 9_999_999_999_999) {
    return null;
  }

  const date = new Date(ms);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  return `${year}/${month}`;
}

/**
 * Get the current date bucket (YYYY/MM). Used as fallback when ID parsing fails.
 */
export function currentDateBucket(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}/${month}`;
}
