import { describe, expect, test } from 'bun:test';
import { aggregate, isHit, judgeCode, recallHit } from './harness';
import { parseStichwoerter, sampleEvalCases, splitOf } from './destatis';
import type { CatalogEntry } from '../types';

const noLift = new Map<string, string>();

describe('judgeCode', () => {
  test('exact / deeper / shallower / same-class / wrong', () => {
    expect(judgeCode('43110', ['43110'], noLift)).toBe('exact');
    expect(judgeCode('431101', ['43110'], noLift)).toBe('deeper');
    expect(judgeCode('4311', ['43110'], noLift)).toBe('shallower');
    expect(judgeCode('43112', ['43110'], noLift)).toBe('same-class');
    expect(judgeCode('96022', ['43110'], noLift)).toBe('wrong');
  });

  test('any-of nimmt das beste Urteil', () => {
    expect(judgeCode('701041', ['69103', '70104'], noLift)).toBe('deeper');
    expect(judgeCode('69103', ['69103', '70104'], noLift)).toBe('exact');
  });

  test('lift-normalisiert beide Seiten (4311 → 43110)', () => {
    const lift = new Map([['4311', '43110']]);
    expect(judgeCode('4311', ['43110'], lift)).toBe('exact');
    expect(judgeCode('43110', ['4311'], lift)).toBe('exact');
  });

  test('isHit nur bei exact/deeper', () => {
    expect(isHit('exact')).toBe(true);
    expect(isHit('deeper')).toBe(true);
    expect(isHit('shallower')).toBe(false);
    expect(isHit('same-class')).toBe(false);
  });
});

describe('recallHit', () => {
  const entry = (code: string): CatalogEntry => ({ code, kurztext: code, langtext: code, validFrom: null, validTo: null });

  test('Treffer wenn Kandidat exact oder deeper ist', () => {
    expect(recallHit([entry('96022'), entry('431101')], ['43110'], noLift)).toBe(true);
    expect(recallHit([entry('96022'), entry('4311')], ['43110'], noLift)).toBe(false);
  });
});

describe('parseStichwoerter', () => {
  const csv = [
    '﻿"Klassifikation der Wirtschaftszweige, Ausgabe 2025";""',
    '"Copyright:";""',
    '"Stichwort";"Schlüssel WZ 2025"',
    '"Abbrucharbeiten";"43.11.0"',
    '"Komplementärgesellschaft (A)";"69.10.3"',
    '"Doppeltes Stichwort";"69.10.3"',
    '"Doppeltes Stichwort";"70.10.4"',
  ].join('\n');

  test('parst Codes ohne Punkte und buendelt Duplikate als any-of', () => {
    const cases = parseStichwoerter(csv);
    expect(cases.find(c => c.text === 'Abbrucharbeiten')?.expected).toEqual(['43110']);
    expect(cases.find(c => c.text === 'Doppeltes Stichwort')?.expected).toEqual(['69103', '70104']);
    expect(cases.length).toBe(3);
  });
});

describe('Eval/Enrich-Split & Sampling', () => {
  test('splitOf ist deterministisch und teilt grob haelftig', () => {
    const texts = Array.from({ length: 1000 }, (_, i) => `Stichwort ${i}`);
    const evalShare = texts.filter(t => splitOf(t) === 'eval').length / texts.length;
    expect(splitOf('Abbrucharbeiten')).toBe(splitOf('Abbrucharbeiten'));
    expect(evalShare).toBeGreaterThan(0.4);
    expect(evalShare).toBeLessThan(0.6);
  });

  test('sampleEvalCases: deterministisch, nur eval-Haelfte, reihenfolge-unabhaengig', () => {
    const all = Array.from({ length: 200 }, (_, i) => ({ text: `Fall ${i}`, expected: ['43110'] }));
    const a = sampleEvalCases(all, 20, 42);
    const b = sampleEvalCases([...all].reverse(), 20, 42);
    expect(a.map(c => c.text)).toEqual(b.map(c => c.text));
    expect(a.every(c => splitOf(c.text) === 'eval')).toBe(true);
    expect(sampleEvalCases(all, 20, 7).map(c => c.text)).not.toEqual(a.map(c => c.text));
  });
});

describe('aggregate', () => {
  test('berechnet Quoten im Full-Mode', () => {
    const mk = (recall: boolean, level: 'exact' | 'wrong', top4: boolean) => ({
      case: { text: 'x', expected: ['43110'], source: 'curated' as const },
      recallHit: recall,
      primaryLevel: level,
      top4Hit: top4,
    });
    const agg = aggregate([mk(true, 'exact', true), mk(true, 'wrong', true), mk(false, 'wrong', false), mk(true, 'exact', true)], true);
    expect(agg.recallAt20).toBeCloseTo(0.75);
    expect(agg.primaryExact).toBeCloseTo(0.5);
    expect(agg.top4Hit).toBeCloseTo(0.75);
  });
});
