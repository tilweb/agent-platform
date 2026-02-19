/**
 * Safe parseInt with NaN fallback
 */
export function parseIntSafe(value: string | undefined | null, defaultValue: number): number {
  if (value == null || value === '') return defaultValue;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}
