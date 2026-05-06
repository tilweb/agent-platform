/**
 * Neighborhood-Helper: liefert das hierarchische Umfeld eines WZ-Codes aus dem
 * Catalog — Eltern (Präfixe der Längen 4..L-1), Geschwister auf jeder Ebene
 * mit gleichem Präfix, und Kinder bis Länge 6.
 *
 * Beispiel für 439991:
 *   4399    Klasse                                          (level 4)
 *     43991   Gerüstbau                                     (level 5, Onkel)
 *     43999   Alle anderen spezialisierten Bautätigkeiten   (level 5, Eltern)
 *       439991  Brandsanierung [aktuell]                    (level 6, current)
 *       439992  Baustahlarmierung, Eisenflechterei          (level 6, Geschwister)
 *       439993  Betonbohrarbeiten...                        (level 6, Geschwister)
 */

import { loadCatalog } from './storage';
import type { CatalogEntry } from './types';

export interface NeighborhoodNode {
  code: string;
  kurztext: string;
  langtext: string;
  level: number;       // 4 | 5 | 6
  indent: number;      // 0..2 — visuelle Einrueckung relativ zum kuerzesten Praefix
  isCurrent: boolean;  // true fuer den abgefragten Code
}

const MIN_LEVEL = 4;
const MAX_LEVEL = 6;

export async function getNeighborhood(code: string): Promise<NeighborhoodNode[]> {
  const target = code.trim();
  if (!/^\d{4,6}$/.test(target)) {
    throw new Error(`Ungueltiger WZ-Code: ${code}`);
  }
  const catalog = await loadCatalog();
  const byCode = new Map<string, CatalogEntry>();
  for (const e of catalog) byCode.set(e.code, e);

  // Praefix bis zur Klassen-Ebene (4-stellig). Falls der Code 4-stellig ist,
  // bleibt der Praefix gleich dem Code selbst.
  const klassePrefix = target.slice(0, MIN_LEVEL);

  // Sammle alle Codes im Catalog, deren Klasse mit dem Praefix uebereinstimmt
  // und deren Laenge zwischen MIN_LEVEL und MAX_LEVEL liegt.
  const collected: CatalogEntry[] = [];
  for (const e of catalog) {
    if (e.code.length < MIN_LEVEL || e.code.length > MAX_LEVEL) continue;
    if (!e.code.startsWith(klassePrefix)) continue;
    collected.push(e);
  }

  // Sort: erst nach Laenge (4 oben, 6 unten), dann nach Code
  collected.sort((a, b) => {
    if (a.code.length !== b.code.length) return a.code.length - b.code.length;
    return a.code.localeCompare(b.code);
  });

  return collected.map<NeighborhoodNode>((e) => ({
    code: e.code,
    kurztext: e.kurztext,
    langtext: e.langtext,
    level: e.code.length,
    indent: e.code.length - MIN_LEVEL,
    isCurrent: e.code === target,
  }));
}
