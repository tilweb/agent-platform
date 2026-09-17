/**
 * Eval-Runner fuer den WZ-Branchen-Matcher.
 *
 * Aufruf (im backend/):
 *   bun src/apps/wzbar-matcher/eval/run-eval.ts                       # Retrieval-only (nur Embedding-Calls)
 *   bun src/apps/wzbar-matcher/eval/run-eval.ts --mode full           # inkl. LLM-Re-Ranking (Precision@1)
 *   bun src/apps/wzbar-matcher/eval/run-eval.ts --sample 300 --seed 7 # groesseres Destatis-Sample
 *   bun src/apps/wzbar-matcher/eval/run-eval.ts --only curated --mode full
 *
 * Flags: --mode retrieval|full (default retrieval), --sample N (default 150),
 *        --seed N (default 42), --only curated|destatis|all (default all),
 *        --concurrency N (default 4), --out <pfad.json>,
 *        --no-expand (Query-Expansion/Splitter ueberspringen — Vergleich zur
 *        Vor-M3-Baseline; mit Expansion kostet auch der Retrieval-Modus einen
 *        LLM-Call pro Fall)
 */

import { parse as parseYaml } from 'yaml';
import { buildMatchDeps, matchActivity, retrieveCandidates } from '../service';
import { splitActivities } from '../splitter';
import { aggregate, isHit, judgeCode, pool, recallHit } from './harness';
import type { Aggregate, CaseResult, EvalCase, EvalSource } from './harness';
import { parseStichwoerter, sampleEvalCases } from './destatis';

function flag(name: string, fallback: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1]! : fallback;
}

const mode = flag('mode', 'retrieval') as 'retrieval' | 'full';
const sampleN = Number(flag('sample', '150'));
const seed = Number(flag('seed', '42'));
const only = flag('only', 'all') as EvalSource | 'all';
const concurrency = Number(flag('concurrency', '4'));
const outPath = flag('out', '');
const expand = !process.argv.includes('--no-expand');

const deps = await buildMatchDeps();

// --- Faelle laden -----------------------------------------------------------

const cases: EvalCase[] = [];

if (only !== 'destatis') {
  const curatedRaw = parseYaml(await Bun.file(new URL('./cases-curated.yaml', import.meta.url)).text()) as {
    cases: Array<{ text: string; expected: string[]; note?: string }>;
  };
  for (const c of curatedRaw.cases) cases.push({ ...c, source: 'curated' });
}

if (only !== 'curated') {
  const csv = await Bun.file(new URL('../../../../../docs/WZ2025-Stichwoerter.csv', import.meta.url)).text();
  const all = parseStichwoerter(csv);
  const sample = sampleEvalCases(all, sampleN, seed);
  for (const c of sample) cases.push({ ...c, source: 'destatis' });
  console.log(`Destatis: ${all.length} Stichwoerter gesamt, Sample ${sample.length} aus der Eval-Haelfte (seed ${seed})`);
}

// Labels gegen den Katalog validieren — nicht aufloesbare Faelle raus.
const valid = cases.filter(c => c.expected.every(e => deps.byCode.has(e)));
const dropped = cases.length - valid.length;
if (dropped > 0) console.log(`WARNUNG: ${dropped} Faelle mit katalogfremden Codes uebersprungen`);
console.log(`Eval-Faelle: ${valid.length} (${valid.filter(c => c.source === 'curated').length} curated, ${valid.filter(c => c.source === 'destatis').length} destatis), Modus: ${mode}, Expansion: ${expand ? 'an' : 'aus'}\n`);

// --- Ausfuehren -------------------------------------------------------------

const started = Date.now();
let expandedCount = 0;
let multiSplitCount = 0;

let caseErrors = 0;

const results: (CaseResult | null)[] = await pool(valid, mode === 'full' || expand ? concurrency : 8, async (c, i) => {
  if ((i + 1) % 25 === 0) console.log(`  ... ${i + 1}/${valid.length}`);
  try {
    return await runCase(c);
  } catch (error) {
    caseErrors++;
    console.error(`  FEHLER bei "${c.text.slice(0, 50)}": ${String(error).slice(0, 120)}`);
    return null;
  }
});

async function runCase(c: EvalCase): Promise<CaseResult> {

  // Produktionsidentischer Pfad: Splitter liefert Text + Suchvarianten.
  // Eval-Faelle sind single-activity; bei Mehrfach-Splits zaehlt die erste.
  let text = c.text;
  let variants: string[] = [];
  if (expand) {
    const acts = await splitActivities(c.text);
    if (acts.length > 0) {
      text = acts[0]!.text;
      variants = acts[0]!.searchVariants;
      if (variants.length > 0) expandedCount++;
      if (acts.length > 1) multiSplitCount++;
    }
  }

  if (mode === 'retrieval') {
    const { candidates } = await retrieveCandidates(text, deps, variants);
    return { case: c, recallHit: recallHit(candidates, c.expected, deps.liftTo) };
  }
  const am = await matchActivity(text, deps, variants, c.text);
  const candidates = am.retrievalTopK
    .map(h => deps.byCode.get(deps.liftTo.get(h.code) ?? h.code))
    .filter((e): e is NonNullable<typeof e> => Boolean(e));
  const primaryLevel = judgeCode(am.result.primary.code, c.expected, deps.liftTo);
  const allCodes = [am.result.primary.code, ...am.result.alternatives.map(a => a.code)];
  return {
    case: c,
    recallHit: recallHit(candidates, c.expected, deps.liftTo),
    primary: am.result.primary.code,
    primaryConfidence: am.result.primary.confidence,
    primaryLevel,
    top4Hit: allCodes.some(code => isHit(judgeCode(code, c.expected, deps.liftTo))),
  };
}

const okResults: CaseResult[] = results.filter((r): r is CaseResult => r !== null);
if (caseErrors > 0) {
  console.log(`\nWARNUNG: ${caseErrors}/${valid.length} Faelle mit Fehlern (Timeout/API) — Quoten beziehen sich auf die ${okResults.length} erfolgreichen.`);
}

// --- Report -----------------------------------------------------------------

const pct = (x: number | undefined) => (x === undefined ? '—' : `${(x * 100).toFixed(1)}%`);

function printAggregate(label: string, agg: Aggregate) {
  console.log(`\n${label} (n=${agg.n})`);
  console.log(`  Recall@20:     ${pct(agg.recallAt20)}`);
  if (mode === 'full') {
    console.log(`  Primary-Hit:   ${pct(agg.primaryHit)}  (exakt: ${pct(agg.primaryExact)})`);
    console.log(`  Top-4-Hit:     ${pct(agg.top4Hit)}`);
    console.log(`  Diagnose:      ${JSON.stringify(agg.levels)}`);
  }
}

const bySource: Record<string, CaseResult[]> = {};
for (const r of okResults) (bySource[r.case.source] ??= []).push(r);
for (const [source, rs] of Object.entries(bySource)) printAggregate(source, aggregate(rs, mode === 'full'));
printAggregate('GESAMT', aggregate(okResults, mode === 'full'));

const misses = okResults.filter(r => (mode === 'full' ? !isHit(r.primaryLevel ?? 'wrong') : !r.recallHit));
if (misses.length > 0) {
  console.log(`\nFehlgriffe (${misses.length}, max. 30 gezeigt):`);
  for (const m of misses.slice(0, 30)) {
    const got = mode === 'full' ? `primary=${m.primary} [${m.primaryLevel}]` : 'nicht in Top-20';
    console.log(`  - "${m.case.text}" erwartet ${m.case.expected.join('|')} → ${got}`);
  }
}

if (expand) console.log(`\nExpansion: ${expandedCount}/${valid.length} Faelle mit Suchvarianten, ${multiSplitCount} Mehrfach-Splits`);
console.log(`Dauer: ${((Date.now() - started) / 1000).toFixed(1)}s`);

if (outPath) {
  await Bun.write(outPath, JSON.stringify({
    ranAt: new Date().toISOString(),
    mode, seed, sampleN, expand,
    aggregate: { total: aggregate(okResults, mode === 'full'), ...Object.fromEntries(Object.entries(bySource).map(([s, rs]) => [s, aggregate(rs, mode === 'full')])) },
    results: okResults,
    caseErrors,
  }, null, 2));
  console.log(`Report: ${outPath}`);
}

process.exit(0);
