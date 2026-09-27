/**
 * Grundsicherung — Aufbewahrung & Löschung (Adapter auf den Antrag-Kern; rein, DB-frei).
 *
 * Bei Abschluss eines Vorgangs (`abgeschlossen` oder `entscheidung`) wird ab dem Stichtag die
 * Aufbewahrungsfrist berechnet. Löschung erfolgt NIE automatisch — `istLoeschfaellig` liefert
 * nur den Kandidaten. Logik in `apps/_antrag-kern/aufbewahrung.ts`.
 *
 * Fristen — MIT DER KOMMUNE ABZUSTIMMEN (Aktenordnung/Landesrecht; Defaults wie Wohngeld):
 *  - Standard ~10 Jahre ab Abschluss              (Env `GRUNDSICHERUNG_AUFBEWAHRUNG_JAHRE`)
 *  - abgelehnt/zurückgenommen ~2 Jahre            (Env `GRUNDSICHERUNG_AUFBEWAHRUNG_ABGELEHNT_JAHRE`)
 */
import type { AbschlussErgebnis, Vorgang, VorgangStatus } from './types';
import { createAufbewahrung, istLoeschfaellig } from '../_antrag-kern/aufbewahrung';

export { istLoeschfaellig };

/** Abschluss-Status: ab hier läuft die Aufbewahrungsfrist. */
export const ABSCHLUSS_STATUS: VorgangStatus[] = ['abgeschlossen', 'entscheidung'];

/** Ergebnisse, für die die kürzere Frist gilt. */
export const KURZE_FRIST_ERGEBNISSE: AbschlussErgebnis[] = ['abgelehnt', 'zurueckgenommen'];

/** Env-Zahl lesen (positiv, ganzzahlig), sonst Fallback. */
function readJahre(name: string, fallback: number): number {
  const raw = (process.env[name] || '').trim();
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

const kern = createAufbewahrung({
  jahre: () => readJahre('GRUNDSICHERUNG_AUFBEWAHRUNG_JAHRE', 10),
  jahreAbgelehnt: () => readJahre('GRUNDSICHERUNG_AUFBEWAHRUNG_ABGELEHNT_JAHRE', 2),
  abschlussStatus: ABSCHLUSS_STATUS,
});

export const istAbschlussStatus = kern.istAbschlussStatus;
export const aufbewahrungJahreDefault = kern.aufbewahrungJahreDefault;
export const aufbewahrungJahreAbgelehnt = kern.aufbewahrungJahreAbgelehnt;
export const berechneAufbewahrungBis = kern.berechneAufbewahrungBis;

/**
 * Reiner Helfer: Aufbewahrungsfrist setzen, sobald ein Vorgang in einen Abschluss-Status
 * wechselt und noch keine Frist gesetzt ist. Nie überschreiben. Kürzere Frist bei
 * abgelehntem/zurückgenommenem Antrag. `heuteIso` = Stichtag.
 */
export function aufbewahrungsPatch(
  before: Pick<Vorgang, 'status' | 'aufbewahrungBis' | 'abschluss'> | null | undefined,
  updates: { status?: string; aufbewahrungBis?: string; abschluss?: Vorgang['abschluss'] },
  heuteIso: string,
): { aufbewahrungBis?: string } {
  const neuerStatus = updates.status ?? before?.status;
  if (!istAbschlussStatus(neuerStatus) || before?.aufbewahrungBis || updates.aufbewahrungBis) return {};
  const ergebnis = updates.abschluss?.ergebnis ?? before?.abschluss?.ergebnis;
  const jahre = ergebnis && KURZE_FRIST_ERGEBNISSE.includes(ergebnis) ? aufbewahrungJahreAbgelehnt() : aufbewahrungJahreDefault();
  const bis = berechneAufbewahrungBis(neuerStatus, heuteIso, jahre);
  return bis ? { aufbewahrungBis: bis } : {};
}
