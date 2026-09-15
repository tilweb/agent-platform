/**
 * Retrieval utilities: cosine similarity + top-K ranking
 */

import type { AliasIndex, EmbeddingEntry, RetrievalHit } from './types';

export function cosineSimilarity(a: ArrayLike<number>, b: ArrayLike<number>): number {
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

/**
 * Top-K ueber Katalog-Vektoren + Alias-Vektoren (M4): pro Code zaehlt die
 * beste Similarity ueber alle seine Vektoren (Katalogtext + Stichwoerter).
 * Ohne Alias-Index identisch zu topK().
 */
export function topKWithAliases(
  query: number[],
  corpus: EmbeddingEntry[],
  aliases: AliasIndex | null,
  k: number,
): RetrievalHit[] {
  if (!aliases || aliases.entries.length === 0) return topK(query, corpus, k);

  const best = new Map<string, number>();
  for (const entry of corpus) {
    const sim = cosineSimilarity(query, entry.vector);
    const prev = best.get(entry.code);
    if (prev === undefined || sim > prev) best.set(entry.code, sim);
  }
  const dim = aliases.dimensions;
  for (let i = 0; i < aliases.entries.length; i++) {
    const vec = aliases.vectors.subarray(i * dim, (i + 1) * dim);
    const sim = cosineSimilarity(query, vec);
    for (const code of aliases.entries[i]!.codes) {
      const prev = best.get(code);
      if (prev === undefined || sim > prev) best.set(code, sim);
    }
  }
  return [...best.entries()]
    .map(([code, similarity]) => ({ code, similarity }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k);
}
