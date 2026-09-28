/**
 * Bewilligungszeitraum-Vorschlag (§ 22/§ 25 WoGG) — rein, DB-frei, testbar.
 *
 * Regel: Wohngeld wird ab Antragsmonat gewährt (§ 22); der Bewilligungszeitraum
 * beträgt in der Regel 12 Monate (§ 25). Vorschlag = erster Tag des Antragsmonats
 * bis zum letzten Tag des 12. Monats.
 *
 * KEINE taggenaue Teil-BWZ-Logik, KEINE Mehrfach-Splittung (bewusst schlank).
 */

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Letzter Tag eines Monats (1-basiert). */
function letzterTag(jahr: number, monat1: number): number {
  return new Date(jahr, monat1, 0).getDate(); // monat1 = 1..12, Tag 0 = letzter Vortag
}

/**
 * 12-Monats-BWZ-Vorschlag ab Antragsmonat.
 * @param antragsdatum ISO-Datum (YYYY-MM-DD). Ungültig/leer → null.
 */
export function berechneBwzVorschlag(antragsdatum?: string): { start: string; ende: string } | null {
  if (!antragsdatum) return null;
  const d = new Date(antragsdatum);
  if (Number.isNaN(d.getTime())) return null;
  const jahr = d.getUTCFullYear();
  const monat1 = d.getUTCMonth() + 1; // 1..12
  const start = `${jahr}-${pad2(monat1)}-01`;
  // Ende = letzter Tag des Monats, der 11 Monate nach dem Startmonat liegt (12 Monate inkl.).
  const endeMonat0 = d.getUTCMonth() + 11; // 0-basiert + 11
  const endeJahr = jahr + Math.floor(endeMonat0 / 12);
  const endeMonat1 = (endeMonat0 % 12) + 1;
  const ende = `${endeJahr}-${pad2(endeMonat1)}-${pad2(letzterTag(endeJahr, endeMonat1))}`;
  return { start, ende };
}

/** Deutsches Kurzformat (TT.MM.JJJJ) für Belegtexte. */
export function fmtDe(iso?: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return d && m && y ? `${d}.${m}.${y}` : iso;
}
