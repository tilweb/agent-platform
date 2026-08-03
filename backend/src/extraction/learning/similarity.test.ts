import { describe, expect, test } from 'bun:test';
import { blendSelection, cosine, rankBySimilarity } from './similarity';

interface Ex { id: string; embedding?: number[] | null }

describe('cosine', () => {
  test('identische Vektoren = 1, orthogonale = 0', () => {
    expect(cosine([1, 0, 0], [1, 0, 0])).toBeCloseTo(1, 6);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0, 6);
    expect(cosine([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 6); // Skalierung egal
  });

  test('robust gegen Laengen-Mismatch, leer und Nullvektor', () => {
    expect(cosine([1, 2], [1, 2, 3])).toBe(0);
    expect(cosine([], [])).toBe(0);
    expect(cosine(null, [1])).toBe(0);
    expect(cosine([1], undefined)).toBe(0);
    expect(cosine([0, 0], [1, 1])).toBe(0);
  });
});

describe('rankBySimilarity', () => {
  const candidates: Ex[] = [
    { id: 'a', embedding: [1, 0] },
    { id: 'b', embedding: [0.9, 0.1] },
    { id: 'c', embedding: [0, 1] },
    { id: 'ohne', embedding: null },
    { id: 'falsche-laenge', embedding: [1, 0, 0] },
  ];

  test('sortiert absteigend und ignoriert unbrauchbare Embeddings', () => {
    const ranked = rankBySimilarity([1, 0], candidates);
    expect(ranked.map((r) => r.item.id)).toEqual(['a', 'b', 'c']);
    expect(ranked[0]!.score).toBeCloseTo(1, 6);
  });

  test('ohne Anfrage-Embedding kein Ranking', () => {
    expect(rankBySimilarity(null, candidates)).toEqual([]);
    expect(rankBySimilarity([], candidates)).toEqual([]);
  });
});

describe('blendSelection', () => {
  const fallback: Ex[] = [{ id: 'f1' }, { id: 'f2' }, { id: 'f3' }, { id: 'f4' }, { id: 'f5' }];

  test('aehnlichste zuerst, danach die bisherige Reihenfolge, ohne Dopplungen', () => {
    const ranked = [
      { item: { id: 'f4' } as Ex, score: 0.95 },
      { item: { id: 'f5' } as Ex, score: 0.9 },
    ];
    expect(blendSelection(ranked, fallback, 5).map((e) => e.id)).toEqual(['f4', 'f5', 'f1', 'f2', 'f3']);
  });

  test('haelt topK und max ein', () => {
    const ranked = fallback.map((item, i) => ({ item, score: 0.9 - i * 0.01 }));
    expect(blendSelection(ranked, fallback, 3, 2).map((e) => e.id)).toEqual(['f1', 'f2', 'f3']);
    expect(blendSelection(ranked, fallback, 2, 5)).toHaveLength(2);
  });

  test('unaehnliche Treffer werden nicht vorgezogen', () => {
    const ranked = [{ item: { id: 'f5' } as Ex, score: 0.2 }];
    expect(blendSelection(ranked, fallback, 3).map((e) => e.id)).toEqual(['f1', 'f2', 'f3']);
  });

  test('leeres Ranking laesst die Fallback-Ordnung unveraendert', () => {
    expect(blendSelection([], fallback, 3).map((e) => e.id)).toEqual(['f1', 'f2', 'f3']);
  });
});
