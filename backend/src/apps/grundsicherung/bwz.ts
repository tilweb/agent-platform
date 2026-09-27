/**
 * Grundsicherung — Bewilligungszeitraum-Vorschlag (rein, DB-frei, testbar).
 *
 * § 44 Abs. 2/3 SGB XII: Der Antrag wirkt auf den Ersten des Monats zurück, in dem er gestellt
 * wird; der Bewilligungszeitraum beträgt in der Regel 12 Monate. Vorschlag = Monatserster des
 * Antragsmonats bis zum letzten Tag des 12. Monats. Nur Vorschlag — die Festsetzung trifft das
 * Fachverfahren.
 */
import { dayPart } from '../_antrag-kern/datum';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** 12-Monats-Vorschlag ab Monatserster des Antragsmonats. Ungültiges/leeres Datum → null. */
export function berechneBwzVorschlag(antragsdatum?: string): { start: string; ende: string } | null {
  const tag = dayPart(antragsdatum);
  if (!tag) return null;
  const [jahr, monat] = tag.split('-').map(Number) as [number, number];
  if (!(monat >= 1 && monat <= 12)) return null;
  const start = `${jahr}-${pad2(monat)}-01`;
  const endeIndex = (monat - 1) + 11;             // 0-basierter Monat des 12. Monats
  const endeJahr = jahr + Math.floor(endeIndex / 12);
  const endeMonat = (endeIndex % 12) + 1;
  const letzter = new Date(Date.UTC(endeJahr, endeMonat, 0)).getUTCDate();
  return { start, ende: `${endeJahr}-${pad2(endeMonat)}-${pad2(letzter)}` };
}
