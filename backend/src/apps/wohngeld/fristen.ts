/**
 * Fristen / Wiedervorlage (§ Gap H, Welle 4, WP7) — rein, DB-frei, testbar.
 *
 * Bewusst schlank: reines Datums-Rechnen auf ISO-Datumsteilen (YYYY-MM-DD),
 * ohne Zeitzonen-Fallstricke. KEINE Kalenderlogik, keine Eskalationsstufen.
 */

/** Datumsanteil (YYYY-MM-DD) eines ISO-Strings. Ungültig/leer → null. */
function dayPart(iso?: string): string | null {
  if (!iso) return null;
  const s = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** ISO-Datum → UTC-Zeitstempel des Tagesbeginns. */
function toUtcDay(day: string): number {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

/**
 * Ist die Frist überfällig? Überfällig = Frist liegt VOR heute (strikt <).
 * Frist == heute gilt noch nicht als überfällig. Fehlende/ungültige Frist → false.
 */
export function istUeberfaellig(iso: string | undefined, heuteIso: string): boolean {
  const frist = dayPart(iso);
  const heute = dayPart(heuteIso);
  if (!frist || !heute) return false;
  return toUtcDay(frist) < toUtcDay(heute);
}

/**
 * Tage bis zur Frist (positiv = in der Zukunft, 0 = heute, negativ = überfällig).
 * Fehlende/ungültige Frist → NaN.
 */
export function tageBisFrist(iso: string | undefined, heuteIso: string): number {
  const frist = dayPart(iso);
  const heute = dayPart(heuteIso);
  if (!frist || !heute) return Number.NaN;
  const MS_PRO_TAG = 24 * 60 * 60 * 1000;
  return Math.round((toUtcDay(frist) - toUtcDay(heute)) / MS_PRO_TAG);
}
