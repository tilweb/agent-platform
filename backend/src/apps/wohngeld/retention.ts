/**
 * GOV-5 — Aufbewahrung & Löschung (rein, DB-frei, testbar).
 *
 * Reines Datums-/Fristen-Rechnen auf ISO-Datumsteilen (YYYY-MM-DD), analog zu
 * `fristen.ts`. KEINE Persistenz. Bei Abschluss eines Vorgangs (`abgeschlossen`
 * oder `entscheidung`) wird ab dem Stichtag die Aufbewahrungsfrist berechnet.
 * Löschung erfolgt NIE automatisch — `istLoeschfaellig` liefert nur den Kandidaten.
 *
 * Fristen (landesrechtlich final zu klären, siehe Governance-Spec §6):
 *  - Default Wohngeldakte ~10 Jahre  (ENV `WOHNGELD_AUFBEWAHRUNG_JAHRE`)
 *  - abgelehnt/gegenstandslos ~2 Jahre (ENV `WOHNGELD_AUFBEWAHRUNG_ABGELEHNT_JAHRE`)
 */
import type { Vorgang, VorgangStatus, Antragsart } from './types';

/** Abschluss-Status: ab hier läuft die Aufbewahrungsfrist. */
export const ABSCHLUSS_STATUS: VorgangStatus[] = ['abgeschlossen', 'entscheidung'];

/** true, wenn der Status ein Abschluss-Status ist. */
export function istAbschlussStatus(status: string | undefined): boolean {
  return !!status && (ABSCHLUSS_STATUS as string[]).includes(status);
}

/** ENV-Zahl lesen (positiv, ganzzahlig), sonst Fallback. */
function readJahre(name: string, fallback: number): number {
  const raw = (process.env[name] || '').trim();
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** Aufbewahrungsfrist (Jahre) für abgeschlossene Wohngeldakten (Default 10). */
export function aufbewahrungJahreDefault(): number {
  return readJahre('WOHNGELD_AUFBEWAHRUNG_JAHRE', 10);
}

/** Kürzere Aufbewahrungsfrist (Jahre) für abgelehnte/gegenstandslose Anträge (Default 2). */
export function aufbewahrungJahreAbgelehnt(): number {
  return readJahre('WOHNGELD_AUFBEWAHRUNG_ABGELEHNT_JAHRE', 2);
}

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
 * `jahre` Jahre auf ein YYYY-MM-DD-Datum addieren. Der 29.02. wird in Nicht-
 * Schaltjahren auf den 28.02. gekappt (statt in den März zu rollen).
 */
export function addJahre(day: string, jahre: number): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const ny = y + jahre;
  const lastDay = new Date(Date.UTC(ny, m, 0)).getUTCDate(); // letzter Tag des Monats m
  const nd = Math.min(d, lastDay);
  return `${ny}-${String(m).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}

/**
 * Aufbewahrungs-Enddatum berechnen. Nur bei Abschluss-Status; sonst `undefined`
 * (Frist beginnt erst mit Abschluss). `stichtagIso` = Abschluss-Datum (i. d. R.
 * heute). `jahre` optional — sonst Standardfrist aus der ENV.
 * `antragsart` ist Teil der stabilen Signatur (aktuell nicht fristbestimmend).
 */
export function berechneAufbewahrungBis(
  status: string | undefined,
  antragsart: Antragsart | string | undefined,
  stichtagIso: string | undefined,
  jahre?: number,
): string | undefined {
  void antragsart;
  if (!istAbschlussStatus(status)) return undefined;
  const day = dayPart(stichtagIso);
  if (!day) return undefined;
  const years = jahre ?? aufbewahrungJahreDefault();
  return addJahre(day, years);
}

/**
 * Ist ein Vorgang löschfällig? Löschfällig = `aufbewahrungBis` liegt VOR heute
 * (strikt <) UND kein Legal Hold. Ohne gesetzte Frist → nicht löschfällig.
 * Löschung bleibt manuell + bestätigungspflichtig (kein Auto-Delete).
 */
export function istLoeschfaellig(
  vorgang: Pick<Vorgang, 'aufbewahrungBis' | 'legalHold'> | null | undefined,
  heuteIso: string,
): boolean {
  if (!vorgang) return false;
  if (vorgang.legalHold) return false;
  const bis = dayPart(vorgang.aufbewahrungBis);
  const heute = dayPart(heuteIso);
  if (!bis || !heute) return false;
  return toUtcDay(bis) < toUtcDay(heute);
}
