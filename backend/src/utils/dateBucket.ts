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
  if (parts.length < 2) return null;

  // Determine the timestamp part:
  // 3+ parts: {prefix}_{timestamp}_{random} → parts[1] is the timestamp
  // 2 parts:  {prefix}_{timestamp+random} (legacy) → first 8 chars of parts[1]
  const tsPart = parts.length >= 3 ? parts[1]! : parts[1]!.substring(0, 8);
  let ms: number;

  // Try decimal first (session IDs, older img IDs with decimal timestamps)
  const decimal = Number(tsPart);
  if (Number.isFinite(decimal) && decimal >= 1_000_000_000_000 && decimal <= 9_999_999_999_999) {
    ms = decimal;
  } else {
    // Try base36 (current generateId format)
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
 * Extract a YYYY/MM date bucket from an export filename.
 *
 * Format: `{slug}_{decimal_timestamp}.{ext}` (e.g. mein-dokument_1771202553489.docx)
 * The timestamp is the last underscore-separated segment before the file extension.
 */
export function dateBucketFromFilename(filename: string): string | null {
  // Strip extension first
  const base = filename.replace(/\.[^.]+$/, '');
  const lastUnderscore = base.lastIndexOf('_');
  if (lastUnderscore === -1) return null;

  const tsPart = base.substring(lastUnderscore + 1);
  const ms = Number(tsPart);

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
