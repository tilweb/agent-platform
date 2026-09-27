/**
 * GOV-5 — Aufbewahrung & Löschung (Adapter auf den Antrag-Kern; rein, DB-frei).
 *
 * Bei Abschluss eines Vorgangs (`abgeschlossen` oder `entscheidung`) wird ab dem
 * Stichtag die Aufbewahrungsfrist berechnet. Löschung erfolgt NIE automatisch —
 * `istLoeschfaellig` liefert nur den Kandidaten. Logik in `apps/_antrag-kern/aufbewahrung.ts`.
 *
 * Fristen (landesrechtlich final zu klären, siehe Governance-Spec §6):
 *  - Default Wohngeldakte ~10 Jahre  (ENV `WOHNGELD_AUFBEWAHRUNG_JAHRE`)
 *  - abgelehnt/gegenstandslos ~2 Jahre (ENV `WOHNGELD_AUFBEWAHRUNG_ABGELEHNT_JAHRE`)
 */
import type { VorgangStatus, Antragsart } from './types';
import { createAufbewahrung, istLoeschfaellig } from '../_antrag-kern/aufbewahrung';

export { addJahre } from '../_antrag-kern/datum';
export { istLoeschfaellig };

/** Abschluss-Status: ab hier läuft die Aufbewahrungsfrist. */
export const ABSCHLUSS_STATUS: VorgangStatus[] = ['abgeschlossen', 'entscheidung'];

/** ENV-Zahl lesen (positiv, ganzzahlig), sonst Fallback. */
function readJahre(name: string, fallback: number): number {
  const raw = (process.env[name] || '').trim();
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

// ENV wird bei jedem Aufruf gelesen (wie bisher).
const kern = createAufbewahrung({
  jahre: () => readJahre('WOHNGELD_AUFBEWAHRUNG_JAHRE', 10),
  jahreAbgelehnt: () => readJahre('WOHNGELD_AUFBEWAHRUNG_ABGELEHNT_JAHRE', 2),
  abschlussStatus: ABSCHLUSS_STATUS,
});

/** true, wenn der Status ein Abschluss-Status ist. */
export const istAbschlussStatus = kern.istAbschlussStatus;

/** Aufbewahrungsfrist (Jahre) für abgeschlossene Wohngeldakten (Default 10). */
export const aufbewahrungJahreDefault = kern.aufbewahrungJahreDefault;

/** Kürzere Aufbewahrungsfrist (Jahre) für abgelehnte/gegenstandslose Anträge (Default 2). */
export const aufbewahrungJahreAbgelehnt = kern.aufbewahrungJahreAbgelehnt;

/**
 * Aufbewahrungs-Enddatum berechnen. Nur bei Abschluss-Status; sonst `undefined`.
 * `jahre` optional — sonst Standardfrist aus der ENV.
 * `antragsart` ist Teil der stabilen Signatur (aktuell nicht fristbestimmend).
 */
export function berechneAufbewahrungBis(
  status: string | undefined,
  antragsart: Antragsart | string | undefined,
  stichtagIso: string | undefined,
  jahre?: number,
): string | undefined {
  void antragsart;
  return kern.berechneAufbewahrungBis(status, stichtagIso, jahre);
}
