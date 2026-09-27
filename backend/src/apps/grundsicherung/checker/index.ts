/**
 * Grundsicherung — Regel-Engine (Vollständigkeit, Plausibilität, Vorrang).
 * Reine, DB-freie Funktion: Snapshot rein, Befund-Liste raus. Persistenz/Idempotenz in
 * storage.syncPruefschritte().
 *
 * PLATZHALTER (Welle G1): liefert noch keine Befunde. Welle G2 füllt die Regeln laut
 * docs/grundsicherung-app-spec-2026-09-27.md (Abschnitt Prüfregeln) inkl. Regelkatalog + Wächter.
 */
import type { VorgangSnapshot, PruefBefund } from '../types';

export function pruefeVorgang(snapshot: VorgangSnapshot): PruefBefund[] {
  void snapshot;
  return [];
}
