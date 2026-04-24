/**
 * Retrieval utilities: cosine similarity + top-K ranking
 */

import type { EmbeddingEntry, RetrievalHit } from './types';

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error('Vektor-Dimensionen stimmen nicht überein');
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function topK(query: number[], corpus: EmbeddingEntry[], k: number): RetrievalHit[] {
  const scored: RetrievalHit[] = corpus.map(entry => ({
    code: entry.code,
    similarity: cosineSimilarity(query, entry.vector),
  }));
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, k);
}
