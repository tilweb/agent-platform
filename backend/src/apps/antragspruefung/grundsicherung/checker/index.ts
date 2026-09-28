/**
 * Grundsicherung — Regel-Engine (Vollständigkeit, Plausibilität, Vorrang, Prüfumfang).
 * Reine, DB-freie Funktion: Snapshot rein, Befund-Liste raus. Keine LLM-Aufrufe.
 * Persistenz/Idempotenz in storage.syncPruefschritte() (Schlüssel regelId + personId).
 *
 * Regeln: docs/grundsicherung-app-spec-2026-09-27.md (Prüfregeln erster Wurf),
 * Beschreibungen in ./regeln.ts (Wächter-Test regeln.test.ts).
 */
import type { VorgangSnapshot, PruefBefund } from '../types';
import { baueKontext, type PruefOptionen } from './helfer';
import { pruefeNachweise } from './nachweise';
import { pruefePlausibilitaet } from './plausibilitaet';
import { pruefeVorrang } from './vorrang';
import { pruefeAusserhalb } from './ausserhalb';

export function pruefeVorgang(snapshot: VorgangSnapshot, optionen: PruefOptionen = {}): PruefBefund[] {
  const ctx = baueKontext(snapshot, optionen);
  return [
    ...pruefeAusserhalb(ctx),
    ...pruefeNachweise(ctx),
    ...pruefePlausibilitaet(ctx),
    ...pruefeVorrang(ctx),
  ];
}

export type { PruefOptionen };
