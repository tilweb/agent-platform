/**
 * S4: Langtext-Eval — misst die Fehlerklasse "sehr ausfuehrliche
 * Gegenstandstexte" (IHK-Rueckmeldung 2), die der normale Harness nicht
 * abdeckt. Da fuer Langtexte meist keine Soll-Codes existieren, misst der
 * Runner primaer VERHALTENS-Metriken ueber R Wiederholungen je Fall:
 *
 *   - Konsistenz:    liefern alle R Laeufe dasselbe Primary-Set?
 *   - Passthrough:   hat der Splitter den Rohtext (>200 Zeichen) als
 *                    "Activity" durchgereicht statt zu verdichten?
 *   - Varianten:     kam die M3-Query-Expansion zum Zug?
 *   - Latenz:        Dauer je Lauf (p50/p90) — UX-Budget aktuell ~3-5 s
 *   - Trunkierung:   Eingaben nahe der 512-Token-Grenze von e5 (~1800 Z.)
 *   - Hit (optional): wenn `expected` (any-of) vorhanden, Treffer je Lauf
 *
 * Faelle: eval/cases-longtext.yaml (kuratiert) + optional die laengsten
 * Eingaben aus einem Produktions-Export (--from-export, Kundendaten bleiben
 * lokal).
 *
 * Aufruf (aus backend/):
 *   bun src/apps/wzbar-matcher/eval/longtext-eval.ts
 *   bun src/apps/wzbar-matcher/eval/longtext-eval.ts --from-export <prod.json> --limit 8
 * Flags: --runs 3, --min-chars 400, --limit 8, --out <pfad.json>
 *
 * Laeufe sind bewusst SEQUENZIELL, damit die Latenz-Messung der echten
 * Nutzer-Wartezeit entspricht (keine Parallelisierungs-Verzerrung).
 */

import { parse as parseYaml } from 'yaml';
import { buildMatchDeps, matchActivity } from '../service';
import { splitActivities } from '../splitter';
import { isHit, judgeCode } from './harness';
import type { MatchRecord } from '../types';

function flag(name: string, fallback: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1]! : fallback;
}

const runs = Number(flag('runs', '3'));
const fromExport = flag('from-export', '');
const minChars = Number(flag('min-chars', '400'));
const limit = Number(flag('limit', '8'));
const outPath = flag('out', '');

/** Splitter hat nicht verdichtet, sondern Rohtext durchgereicht. */
const PASSTHROUGH_CHARS = 200;
/** Grobe Token-Schaetzung fuer die e5-512-Token-Grenze. */
const TRUNCATION_RISK_CHARS = 1800;

interface LongtextCase {
  id: string;
  text: string;
  expected?: string[];
  source: 'curated' | 'export';
}

const cases: LongtextCase[] = [];

const curated = parseYaml(await Bun.file(new URL('./cases-longtext.yaml', import.meta.url)).text()) as {
  cases: Array<{ id: string; text: string; expected?: string[] }>;
};
for (const c of curated.cases) cases.push({ id: c.id, text: c.text.trim(), expected: c.expected, source: 'curated' });

if (fromExport) {
  const records = (await Bun.file(fromExport).json()) as MatchRecord[];
  const long = records
    .filter(r => r.inputText.length >= minChars)
    .sort((a, b) => b.inputText.length - a.inputText.length)
    .slice(0, limit);
  for (const r of long) cases.push({ id: `export-${r.id}`, text: r.inputText, source: 'export' });
  console.log(`Export: ${long.length} Langtexte >= ${minChars} Zeichen uebernommen (von ${records.length} Matches).`);
}

const deps = await buildMatchDeps();
console.log(`Langtext-Eval: ${cases.length} Faelle × ${runs} Laeufe (sequenziell)\n`);

interface RunResult {
  primaries: string[];
  activityCount: number;
  passthrough: boolean;
  hasVariants: boolean;
  durationMs: number;
  hit?: boolean;
}

interface CaseReport {
  id: string;
  source: string;
  chars: number;
  truncationRisk: boolean;
  runs: RunResult[];
  consistent: boolean;
}

const reports: CaseReport[] = [];

for (const c of cases) {
  const runResults: RunResult[] = [];
  for (let r = 0; r < runs; r++) {
    const t0 = Date.now();
    let acts;
    let matches;
    try {
      acts = await splitActivities(c.text);
      matches = await Promise.all(acts.map(a => matchActivity(a.text, deps, a.searchVariants)));
    } catch (error) {
      console.error(`  FEHLER bei ${c.id} Lauf ${r + 1}: ${String(error).slice(0, 120)}`);
      runResults.push({ primaries: ['FEHLER'], activityCount: 0, passthrough: false, hasVariants: false, durationMs: Date.now() - t0 });
      continue;
    }
    const durationMs = Date.now() - t0;
    const primaries = matches.map(m => m.result.primary.code).sort();
    const result: RunResult = {
      primaries,
      activityCount: acts.length,
      passthrough: acts.some(a => a.text.length > PASSTHROUGH_CHARS),
      hasVariants: acts.some(a => a.searchVariants.length > 0),
      durationMs,
    };
    if (c.expected) {
      result.hit = primaries.some(p => isHit(judgeCode(p, c.expected!, deps.liftTo)));
    }
    runResults.push(result);
  }
  const sets = new Set(runResults.map(r => r.primaries.join(',')));
  const report: CaseReport = {
    id: c.id,
    source: c.source,
    chars: c.text.length,
    truncationRisk: c.text.length > TRUNCATION_RISK_CHARS,
    runs: runResults,
    consistent: sets.size === 1,
  };
  reports.push(report);

  const durs = runResults.map(r => r.durationMs);
  console.log(`${report.consistent ? 'KONSISTENT  ' : 'INKONSISTENT'} ${c.id} (${report.chars} Z.${report.truncationRisk ? ', TRUNKIERUNGS-RISIKO' : ''})`);
  for (const r of runResults) {
    console.log(`    ${(r.durationMs / 1000).toFixed(1)}s | ${r.activityCount} Act. | passthrough=${r.passthrough ? 'JA' : 'nein'} | Varianten=${r.hasVariants ? 'ja' : 'NEIN'}${r.hit !== undefined ? ` | hit=${r.hit ? 'ja' : 'NEIN'}` : ''} | ${r.primaries.join(', ')}`);
  }
}

// --- Zusammenfassung ---------------------------------------------------------

const allRuns = reports.flatMap(r => r.runs);
const durs = allRuns.map(r => r.durationMs).sort((a, b) => a - b);
const q = (p: number) => durs[Math.min(durs.length - 1, Math.floor(p * durs.length))]! / 1000;
const pct = (n: number, total: number) => (total === 0 ? '—' : `${((n / total) * 100).toFixed(0)}%`);

console.log(`\n================ ZUSAMMENFASSUNG ================`);
console.log(`Faelle: ${reports.length}, Laeufe gesamt: ${allRuns.length}`);
console.log(`Konsistenz:        ${pct(reports.filter(r => r.consistent).length, reports.length)} der Faelle liefern ueber ${runs} Laeufe dasselbe Primary-Set`);
console.log(`Passthrough-Quote: ${pct(allRuns.filter(r => r.passthrough).length, allRuns.length)} der Laeufe reichen Rohtext >${PASSTHROUGH_CHARS} Z. durch`);
console.log(`Varianten-Quote:   ${pct(allRuns.filter(r => r.hasVariants).length, allRuns.length)} der Laeufe haben Query-Expansion`);
console.log(`Latenz:            p50=${q(0.5).toFixed(1)}s p90=${q(0.9).toFixed(1)}s max=${(durs[durs.length - 1]! / 1000).toFixed(1)}s (UX-Budget ~3-5 s)`);
const withExpected = allRuns.filter(r => r.hit !== undefined);
if (withExpected.length > 0) {
  console.log(`Hit (nur Faelle mit expected): ${pct(withExpected.filter(r => r.hit).length, withExpected.length)} der Laeufe`);
}
console.log(`Trunkierungs-Risiko (> ${TRUNCATION_RISK_CHARS} Z.): ${reports.filter(r => r.truncationRisk).length} Faelle`);

if (outPath) {
  await Bun.write(outPath, JSON.stringify({ ranAt: new Date().toISOString(), runs, reports }, null, 2));
  console.log(`\nReport: ${outPath}`);
}
process.exit(0);
