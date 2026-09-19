/**
 * Wohngeld — Regel-Engine (Vollständigkeit + Plausibilität).
 * Reine, DB-freie Funktion: Snapshot rein, Befund-Liste raus.
 * Persistenz/Idempotenz erfolgt in storage.syncPruefschritte().
 */
import type { VorgangSnapshot, PruefBefund } from '../types';
import { pruefeNachweise } from './nachweise';
import { pruefePlausibilitaet } from './plausibilitaet';

export function pruefeVorgang(snapshot: VorgangSnapshot): PruefBefund[] {
  return [
    ...pruefeNachweise(snapshot),
    ...pruefePlausibilitaet(snapshot),
  ];
}

export { pruefeNachweise, pruefePlausibilitaet };
