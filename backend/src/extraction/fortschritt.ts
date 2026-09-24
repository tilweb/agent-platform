/**
 * Fortschrittsmeldungen der Dokumentenerkennung — ohne Signaturänderungen.
 *
 * Wer den Fortschritt sehen will, ruft seine Arbeit in `mitFortschritt(cb, fn)` auf; die Erkennung
 * meldet über `meldeFortschritt(...)` Zwischenschritte (Seiten gerendert, Seite klassifiziert,
 * Abschnitte erkannt, Abschnitt ausgelesen). Ohne Zuhörer ist `meldeFortschritt` wirkungslos.
 * Der Kontext folgt dem async-Aufrufbaum (AsyncLocalStorage), auch durch parallele Worker.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export type FortschrittEreignis =
  | { schritt: 'seiten_gerendert'; gesamt: number }
  | { schritt: 'seite_klassifiziert'; fertig: number; gesamt: number }
  | { schritt: 'abschnitte_erkannt'; anzahl: number }
  | { schritt: 'abschnitt_auslesen'; fertig: number; gesamt: number; label?: string };

type Zuhoerer = (e: FortschrittEreignis) => void;

const speicher = new AsyncLocalStorage<Zuhoerer>();

export function mitFortschritt<T>(zuhoerer: Zuhoerer, fn: () => Promise<T>): Promise<T> {
  return speicher.run(zuhoerer, fn);
}

export function meldeFortschritt(e: FortschrittEreignis): void {
  const z = speicher.getStore();
  if (!z) return;
  try { z(e); } catch { /* Fortschritt darf die Erkennung nie stören */ }
}
