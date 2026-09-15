/**
 * Ebenen-Normalisierung: hebt WZ-Codes auf die tiefste eindeutig identische
 * Ebene an.
 *
 * Hintergrund: Nicht weiter untergliederte Klassen haben im Katalog genau eine
 * textgleiche Unterklasse (z.B. 4311 "Abbrucharbeiten" → 43110
 * "Abbrucharbeiten"). Offiziell verschlüsselt wird auf Unterklassen-Ebene —
 * die Wahl zwischen beiden ist keine fachliche Entscheidung und soll dem LLM
 * gar nicht erst gestellt werden.
 *
 * Der Lift greift NUR bei genau einem Kind mit identischem kurztext: Die
 * nationalen 6-/7-stelligen Codes sind keine vollstaendigen Partitionen ihrer
 * Elternebene (10510 "Herstellung von Milcherzeugnissen" hat als einziges Kind
 * 105101 "Käserei" — ein Lift waere dort fachlich falsch).
 */

import type { CatalogEntry } from './types';

/**
 * Baut eine Map `code → tiefster textgleicher Einzelkind-Nachfahre`.
 * Enthaelt nur Codes, die sich durch den Lift tatsaechlich aendern.
 */
export function buildLiftMap(catalog: CatalogEntry[]): Map<string, string> {
  const childrenOf = new Map<string, CatalogEntry[]>();
  for (const entry of catalog) {
    if (entry.code.length <= 4) continue;
    const parent = entry.code.slice(0, -1);
    const list = childrenOf.get(parent);
    if (list) list.push(entry);
    else childrenOf.set(parent, [entry]);
  }

  const map = new Map<string, string>();
  for (const entry of catalog) {
    let current = entry;
    for (;;) {
      const kids = childrenOf.get(current.code);
      if (kids && kids.length === 1 && kids[0]!.kurztext === current.kurztext) {
        current = kids[0]!;
      } else {
        break;
      }
    }
    if (current.code !== entry.code) map.set(entry.code, current.code);
  }
  return map;
}
