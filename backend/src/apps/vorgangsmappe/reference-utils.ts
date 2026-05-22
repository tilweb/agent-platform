/**
 * Vorgangsmappe — Reference-Helpers
 *
 * Vorgangsnummern haben das Format `<PREFIX>-<NUMMER>`:
 *   PREFIX = 1–4 Buchstaben, optional gefolgt von 0–4 Ziffern (Jahres-Suffix)
 *   NUMMER = 1–6 Ziffern
 *
 * Beispiele: `V-1000`, `ERB-000129`, `AB26-12345`, `ABC-00000`.
 *
 * User-Eingaben sind uneinheitlich (Case, Whitespace, optionaler Bindestrich).
 * Diese Helpers normalisieren + erkennen das Pattern.
 */

// Normalisiert: PREFIX-NUMMER (Bindestrich, Uppercase).
const REFERENCE_PATTERN_NORMALIZED = /^[A-Z]{1,4}\d{0,4}-\d{1,6}$/;
// Lose: erlaubt fehlenden Bindestrich beim User-Input.
const REFERENCE_PATTERN_LOOSE = /^[A-Z]{1,4}\d{0,4}-?\d{1,6}$/i;

/**
 * Normalisiert eine User-Eingabe in das Standard-Format `<PREFIX>-<NUMMER>`.
 * Akzeptiert „ab26-12345", „AB26 12345", „v-1000", „ERB000129", „AB2612345".
 * Returnt den getrimmten Original-Input wenn das Pattern nicht erkannt wird
 * (damit Suchen mit freiem Text weiterlaufen koennen).
 */
export function normalizeReferenceNumber(input: string): string {
  const trimmed = input.trim();
  const compact = trimmed.replace(/\s+/g, '');
  const m = compact.match(/^([A-Z]{1,4}\d{0,4})-?(\d{1,6})$/i);
  if (!m) return trimmed;
  return `${m[1]!.toUpperCase()}-${m[2]}`;
}

/**
 * Ist der Input eine Vorgangsnummer (in loser Form, mit/ohne Bindestrich)?
 */
export function isReferencePattern(input: string): boolean {
  const compact = input.trim().replace(/\s+/g, '');
  return REFERENCE_PATTERN_LOOSE.test(compact);
}

/**
 * Strikt — nur das normalisierte Format `<PREFIX>-<NUMMER>`.
 */
export function isNormalizedReference(input: string): boolean {
  return REFERENCE_PATTERN_NORMALIZED.test(input);
}
