import { describe, expect, test } from 'bun:test';
import { topK, topKWithAliases } from './retrieval';
import { buildAliasEntries } from './alias-builder';
import { splitOf } from './eval/destatis';
import type { AliasIndex, EmbeddingEntry } from './types';

function vec(...v: number[]): number[] {
  return v;
}

const corpus: EmbeddingEntry[] = [
  { code: '43110', vector: vec(1, 0, 0) },
  { code: '70104', vector: vec(0, 1, 0) },
  { code: '13920', vector: vec(0, 0, 1) },
];

function aliasIndex(entries: Array<{ text: string; codes: string[] }>, vectors: number[][]): AliasIndex {
  const dim = vectors[0]?.length ?? 0;
  const bin = new Float32Array(entries.length * dim);
  vectors.forEach((v, i) => bin.set(v, i * dim));
  return { model: 'test', dimensions: dim, builtAt: '', sourceFile: '', entries, vectors: bin };
}

describe('topKWithAliases', () => {
  test('ohne Alias-Index identisch zu topK', () => {
    const q = vec(1, 0.1, 0);
    expect(topKWithAliases(q, corpus, null, 2)).toEqual(topK(q, corpus, 2));
  });

  test('Alias-Vektor hebt seinen Code an (Max-Similarity je Code)', () => {
    // Query zeigt in Richtung des Alias "Rheumadecken", nicht des Katalogtexts von 13920
    const aliases = aliasIndex([{ text: 'Rheumadecken, Herstellung', codes: ['13920'] }], [vec(0.9, 0.1, 0.3)]);
    const q = vec(1, 0, 0.2);
    const hits = topKWithAliases(q, corpus, aliases, 3);
    const h13920 = hits.find(h => h.code === '13920')!;
    const base13920 = topK(q, corpus, 3).find(h => h.code === '13920')!;
    expect(h13920.similarity).toBeGreaterThan(base13920.similarity);
  });

  test('Alias verschlechtert nie die Basis-Similarity eines Codes', () => {
    const aliases = aliasIndex([{ text: 'irrelevant', codes: ['43110'] }], [vec(0, 0, 1)]);
    const q = vec(1, 0, 0);
    const hit = topKWithAliases(q, corpus, aliases, 3).find(h => h.code === '43110')!;
    expect(hit.similarity).toBeCloseTo(1);
  });

  test('ein Alias-Text kann auf mehrere Codes zeigen', () => {
    const aliases = aliasIndex([{ text: 'Doppelt', codes: ['43110', '70104'] }], [vec(0, 0, 1)]);
    const q = vec(0, 0, 1);
    const hits = topKWithAliases(q, corpus, aliases, 3);
    expect(hits.filter(h => h.similarity > 0.99).map(h => h.code).sort()).toEqual(['13920', '43110', '70104']);
  });
});

describe('buildAliasEntries (Split-Integritaet)', () => {
  test('nimmt ausschliesslich die enrich-Haelfte und nur Katalog-Codes', () => {
    const stichwoerter = Array.from({ length: 500 }, (_, i) => ({
      text: `Stichwort ${i}`,
      expected: [i % 2 === 0 ? '43110' : '99999'],
    }));
    const entries = buildAliasEntries(stichwoerter, new Set(['43110']));
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(splitOf(e.text)).toBe('enrich');
      expect(e.codes).toEqual(['43110']);
    }
    // Kein eval-Stichwort darf durchrutschen
    const evalTexts = stichwoerter.filter(s => splitOf(s.text) === 'eval').map(s => s.text);
    const entryTexts = new Set(entries.map(e => e.text));
    expect(evalTexts.some(t => entryTexts.has(t))).toBe(false);
  });
});
