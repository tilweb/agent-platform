/**
 * Antrag-Kern — IDs und Zeitstempel.
 */

/** Eindeutige ID `<prefix>-<zeit36>-<zufall6>`. */
export function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Aktueller Zeitpunkt als ISO-String. */
export function nowIso(): string {
  return new Date().toISOString();
}
