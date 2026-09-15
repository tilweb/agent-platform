/**
 * Eval-Harness fuer den WZ-Branchen-Matcher (M2a, siehe
 * docs/wzbar-matcher-ihk-feedback-massnahmen-2026-09-15.md).
 *
 * Misst zweistufig gegen ein Golden Set `text → erwartete Codes`:
 *   - Recall@20:    war ein passender Code ueberhaupt Kandidat? (Stufe 2)
 *   - Precision@1:  hat die volle Pipeline ihn als Primary gewaehlt? (End-to-End)
 *
 * Vergleichslogik: Labels (v.a. Destatis-Stichwoerter) sind 5-stellig, der
 * Matcher darf tiefer antworten. Ein Treffer ist 'exact' oder 'deeper'
 * (Vorhersage liegt innerhalb der erwarteten Unterklasse). 'shallower' ist
 * genau die vom IHK-Feedback gemeldete Fehlerklasse "zu flach".
 */

import type { CatalogEntry } from '../types';

export type EvalSource = 'curated' | 'destatis';

export interface EvalCase {
  text: string;
  /** Any-of: mehrere fachlich vertretbare Codes moeglich. */
  expected: string[];
  source: EvalSource;
  note?: string;
}

export type MatchLevel = 'exact' | 'deeper' | 'shallower' | 'same-class' | 'wrong';

const LEVEL_RANK: Record<MatchLevel, number> = {
  exact: 0,
  deeper: 1,
  shallower: 2,
  'same-class': 3,
  wrong: 4,
};

export function normalizeCode(code: string, liftTo: Map<string, string>): string {
  return liftTo.get(code) ?? code;
}

function judgeSingle(pred: string, expected: string): MatchLevel {
  if (pred === expected) return 'exact';
  if (pred.startsWith(expected)) return 'deeper';
  if (expected.startsWith(pred)) return 'shallower';
  if (pred.slice(0, 4) === expected.slice(0, 4)) return 'same-class';
  return 'wrong';
}

/** Bestes Urteil ueber alle erwarteten Codes (beide Seiten lift-normalisiert). */
export function judgeCode(pred: string, expected: string[], liftTo: Map<string, string>): MatchLevel {
  const p = normalizeCode(pred, liftTo);
  let best: MatchLevel = 'wrong';
  for (const e of expected) {
    const level = judgeSingle(p, normalizeCode(e, liftTo));
    if (LEVEL_RANK[level] < LEVEL_RANK[best]) best = level;
  }
  return best;
}

export function isHit(level: MatchLevel): boolean {
  return level === 'exact' || level === 'deeper';
}

/** Recall@K: enthaelt die (bereits geliftete) Kandidatenliste einen Treffer? */
export function recallHit(candidates: CatalogEntry[], expected: string[], liftTo: Map<string, string>): boolean {
  return candidates.some(c => isHit(judgeCode(c.code, expected, liftTo)));
}

export interface CaseResult {
  case: EvalCase;
  recallHit: boolean;
  /** Nur im Full-Mode gesetzt: */
  primary?: string;
  primaryConfidence?: number;
  primaryLevel?: MatchLevel;
  /** Treffer irgendwo in primary + alternatives. */
  top4Hit?: boolean;
}

export interface Aggregate {
  n: number;
  recallAt20: number;
  primaryHit?: number;
  primaryExact?: number;
  top4Hit?: number;
  levels?: Record<MatchLevel, number>;
}

export function aggregate(results: CaseResult[], full: boolean): Aggregate {
  const n = results.length;
  const agg: Aggregate = {
    n,
    recallAt20: n ? results.filter(r => r.recallHit).length / n : 0,
  };
  if (full && n) {
    const levels: Record<MatchLevel, number> = { exact: 0, deeper: 0, shallower: 0, 'same-class': 0, wrong: 0 };
    for (const r of results) levels[r.primaryLevel ?? 'wrong']++;
    agg.levels = levels;
    agg.primaryExact = levels.exact / n;
    agg.primaryHit = (levels.exact + levels.deeper) / n;
    agg.top4Hit = results.filter(r => r.top4Hit).length / n;
  }
  return agg;
}

/** Einfacher Concurrency-Pool fuer die LLM-Calls im Full-Mode. */
export async function pool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
  return results;
}
