/**
 * Aehnlichkeits-Auswahl der Few-Shot-Beispiele (Welle 5).
 *
 * Bisher wurden Beispiele nach "Korrekturen zuerst, dann jung" gewaehlt. Das
 * ist gut, solange ein Projekt EINEN Dokumenttyp sieht. Sobald mehrere
 * Auspraegungen zusammenkommen (verschiedene Lieferanten-Layouts, Formulare
 * mit/ohne Positionstabelle), fuettert das den Prompt mit Beispielen, die zum
 * aktuellen Dokument nichts sagen — und kostet Kontext.
 *
 * Hier wird das Anfragedokument mit den Beispielen verglichen (Kosinus auf
 * Embeddings) und die Auswahl gemischt: erst die aehnlichsten, dann die
 * bisherige Reihenfolge. Ohne Embeddings (nicht konfiguriert, Dienst weg,
 * Kill-Switch) bleibt exakt das alte Verhalten.
 *
 * Reine Rechenfunktionen — identisch in beiden Worktrees.
 */

/** Kosinus-Aehnlichkeit zweier Vektoren; 0 bei Laengen-Mismatch oder Nullvektor. */
export function cosine(a: number[] | null | undefined, b: number[] | null | undefined): number {
  if (!a || !b || a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface Embeddable {
  id: string;
  embedding?: number[] | null;
}

/**
 * Kandidaten mit Embedding nach Aehnlichkeit sortieren (absteigend).
 * Kandidaten ohne Embedding fallen heraus — sie kommen ueber die
 * Fallback-Reihenfolge zurueck ins Rennen.
 */
export function rankBySimilarity<T extends Embeddable>(
  queryEmbedding: number[] | null | undefined,
  candidates: T[],
): Array<{ item: T; score: number }> {
  if (!queryEmbedding || queryEmbedding.length === 0) return [];
  return candidates
    .filter((c) => Array.isArray(c.embedding) && c.embedding.length === queryEmbedding.length)
    .map((item) => ({ item, score: cosine(queryEmbedding, item.embedding) }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Auswahl mischen: bis zu `topK` der aehnlichsten Kandidaten zuerst, danach die
 * bisherige (fachlich begruendete) Reihenfolge — ohne Dopplungen, bis `max`.
 *
 * Bewusst KEIN reines Aehnlichkeits-Ranking: die Korrektur-zuerst-Ordnung ist
 * das, was den Lern-Loop informativ macht. Aehnlichkeit ergaenzt sie, ersetzt
 * sie nicht.
 */
export function blendSelection<T extends Embeddable>(
  ranked: Array<{ item: T; score: number }>,
  fallbackOrdered: T[],
  max: number,
  topK = 3,
  minScore = 0.5,
): T[] {
  const selected: T[] = [];
  const seen = new Set<string>();

  for (const { item, score } of ranked) {
    if (selected.length >= Math.min(topK, max)) break;
    if (score < minScore) break; // unaehnlich = kein Mehrwert
    selected.push(item);
    seen.add(item.id);
  }

  for (const item of fallbackOrdered) {
    if (selected.length >= max) break;
    if (seen.has(item.id)) continue;
    selected.push(item);
    seen.add(item.id);
  }

  return selected;
}
