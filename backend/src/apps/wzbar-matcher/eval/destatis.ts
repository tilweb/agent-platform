/**
 * Destatis-Stichwoerter als Gold-Quelle (docs/WZ2025-Stichwoerter.csv,
 * Export des Klassifikationsservers: ~36k Paare `Stichwort → 5-stelliger
 * WZ-2025-Code`).
 *
 * WICHTIG — Eval/Enrich-Split: Die Haelfte der Stichwoerter ist fuer die
 * Evaluation reserviert ('eval'), die andere fuer die geplante
 * Alias-Anreicherung der Embeddings (M4, 'enrich'). Der Split ist eine
 * deterministische Hash-Funktion ueber den Stichwort-Text — M4 darf
 * ausschliesslich die 'enrich'-Haelfte in die Embeddings einbauen, sonst
 * misst das Eval-Set spaeter seine eigenen Trainingsdaten.
 */

export interface StichwortCase {
  text: string;
  /** Any-of: dasselbe Stichwort kann auf mehrere Codes verweisen. */
  expected: string[];
}

/** FNV-1a 32-bit — stabiler, dependency-freier String-Hash. */
export function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function splitOf(text: string): 'eval' | 'enrich' {
  return fnv1a(text) % 2 === 0 ? 'eval' : 'enrich';
}

/**
 * Parst den Klassifikationsserver-Export (UTF-8 mit BOM, `;`-getrennt,
 * Datenzeilen nach der Headerzeile `"Stichwort";"Schlüssel WZ 2025"`).
 * Gleiche Stichwort-Texte mit mehreren Codes werden zu any-of gebuendelt.
 */
export function parseStichwoerter(csv: string): StichwortCase[] {
  const lines = csv.replace(/^﻿/, '').split(/\r?\n/);
  const startIdx = lines.findIndex(l => l.startsWith('"Stichwort"'));
  if (startIdx === -1) throw new Error('Stichwoerter-CSV: Headerzeile "Stichwort" nicht gefunden');

  const byText = new Map<string, Set<string>>();
  for (const line of lines.slice(startIdx + 1)) {
    const m = line.match(/^"(.+)";"([\d.]+)"\s*$/);
    if (!m) continue;
    const text = m[1]!;
    const code = m[2]!.replaceAll('.', '');
    const set = byText.get(text);
    if (set) set.add(code);
    else byText.set(text, new Set([code]));
  }

  return [...byText.entries()].map(([text, codes]) => ({ text, expected: [...codes].sort() }));
}

/**
 * Deterministische Stichprobe aus der 'eval'-Haelfte: sortiert nach
 * Hash(seed + text), nimmt die ersten n. Gleicher Seed → gleiches Sample,
 * unabhaengig von der Reihenfolge in der CSV.
 */
export function sampleEvalCases(all: StichwortCase[], n: number, seed: number): StichwortCase[] {
  return all
    .filter(c => splitOf(c.text) === 'eval')
    .map(c => ({ c, key: fnv1a(`${seed}:${c.text}`) }))
    .sort((a, b) => a.key - b.key || a.c.text.localeCompare(b.c.text))
    .slice(0, n)
    .map(x => x.c);
}
