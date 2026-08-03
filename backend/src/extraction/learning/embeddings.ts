/**
 * Embedding-Anbindung fuer die Aehnlichkeits-Auswahl der Few-Shot-Beispiele
 * (Welle 5).
 *
 * Duennes, absichtlich fehlertolerantes Vorspiel zum LLM-Service: Ein fehlendes
 * oder langsames Embedding-Modell darf eine Extraktion NIE ausbremsen oder
 * scheitern lassen — im Zweifel gibt es kein Embedding und die Auswahl bleibt
 * bei der bisherigen Reihenfolge (Korrekturen zuerst, dann jung).
 *
 * Identisch in beiden Worktrees.
 */

import { llmService } from '../../services/llm';

/** Wieviel Dokumenttext ins Embedding geht (Kosten/Kontext-Grenze). */
const EMBED_CHARS = 2000;
/** Nach dieser Zeit gilt der Embedding-Dienst als nicht verfuegbar. */
const EMBED_TIMEOUT_MS = Number(process.env.EXTRACTION_EMBED_TIMEOUT_MS) || 8000;

/** Kill-Switch: `EXTRACTION_SIMILARITY_FEWSHOT=0` schaltet auf das alte Verhalten. */
export function isSimilarityEnabled(): boolean {
  return process.env.EXTRACTION_SIMILARITY_FEWSHOT !== '0';
}

/**
 * Embedding eines Dokumenttexts — `null` statt Fehler, wenn kein Modell
 * konfiguriert ist, der Dienst haengt oder der Text leer ist.
 */
export async function embedDocument(text: string | null | undefined): Promise<number[] | null> {
  if (!isSimilarityEnabled()) return null;
  const snippet = (text ?? '').trim().slice(0, EMBED_CHARS);
  if (!snippet) return null;

  try {
    const vector = await Promise.race([
      llmService.embed(snippet),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), EMBED_TIMEOUT_MS)),
    ]);
    return Array.isArray(vector) && vector.length > 0 ? vector : null;
  } catch (err) {
    console.warn('[embeddings] Embedding nicht moeglich:', err instanceof Error ? err.message : err);
    return null;
  }
}
