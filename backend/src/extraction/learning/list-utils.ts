/**
 * Hilfsfunktionen fuer Listen-Felder (Positionsdaten).
 *
 * Hintergrund: Die Engine merged Array-Gruppen immer via Union (Konkatenation
 * aller Chunk-/Seiten-Arrays, `merger.ts pickUnion` — bewusst OHNE Dedupe, weil
 * das der bestehende Kontrakt fuer andere Konsumenten wie das Vertragsmanagement
 * ist). Bei Chunk-Overlap (long-text-chunked) und seitenuebergreifenden Tabellen
 * (vision-per-page/hybrid) entstehen dadurch exakte Duplikate. Der Learning-Layer
 * entfernt sie hier nach `runPipeline()`.
 *
 * Bekannte Grenze (v1, dokumentiert): Zwei fachlich ECHTE Positionen, die in
 * ALLEN definierten Spalten identisch sind, kollabieren zu einer. Ausweg: eine
 * unterscheidende Spalte (Positionsnummer, Menge) als item_field definieren.
 */

import type { ProjectItemField } from './types';

/**
 * Entfernt exakte Duplikate aus einer Positions-Liste. Der Vergleichs-Key wird
 * ueber alle definierten item_fields gebildet (Strings: trim + lowercase;
 * fehlend/undefined → null vereinheitlicht). Nicht-Objekt-Eintraege bleiben
 * unveraendert erhalten.
 */
export function dedupeListItems(
  items: unknown[],
  itemFields: Record<string, ProjectItemField>,
): unknown[] {
  const ids = Object.keys(itemFields);
  const seen = new Set<string>();
  return items.filter((item) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return true;
    const rec = item as Record<string, unknown>;
    const key = JSON.stringify(
      ids.map((id) => {
        const v = rec[id];
        if (v === undefined || v === null) return null;
        return typeof v === 'string' ? v.trim().toLowerCase() : v;
      }),
    );
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
