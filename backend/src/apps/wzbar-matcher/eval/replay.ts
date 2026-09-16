/**
 * M2b: Replay-Diff — schickt echte Produktions-Eingaben durch die aktuelle
 * lokale Pipeline (ohne Persistenz) und vergleicht die Primary-Codes mit den
 * gespeicherten Produktions-Ergebnissen.
 *
 * Aufruf (aus backend/):
 *   bun src/apps/wzbar-matcher/eval/replay.ts <export.json> [--limit 50] [--out diff.json]
 *
 * Braucht keine Soll-Codes: Die Differenzliste ist die Review-Menge — statt
 * alle Faelle zu labeln, schaut man nur die an, deren Ergebnis sich durch
 * M1/M3/M4 geaendert hat. Achtung: lokal gepinntes Apps-Modell kann vom
 * Produktions-Modell abweichen (steht mit im Diff).
 */

import { buildMatchDeps, matchActivity } from '../service';
import { splitActivities } from '../splitter';
import { pool } from './harness';
import type { MatchRecord } from '../types';

function flag(name: string, fallback: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1]! : fallback;
}

const file = process.argv[2];
if (!file || file.startsWith('--')) {
  console.error('Usage: bun replay.ts <export.json> [--limit 50] [--out diff.json]');
  process.exit(1);
}
const limit = Number(flag('limit', '50'));
const concurrency = Number(flag('concurrency', '4'));
const outPath = flag('out', '');

const all = (await Bun.file(file).json()) as MatchRecord[];
const records = all.slice(-limit); // die juengsten N
console.log(`Replay: ${records.length} von ${all.length} Matches (juengste zuerst exportiert: nein — chronologisch, genommen die letzten ${limit})`);

const deps = await buildMatchDeps();

interface ReplayDiff {
  id: string;
  createdAt: string;
  inputText: string;
  prodModel: string;
  prodPrimaries: string[];
  replayPrimaries: string[];
  changed: boolean;
  detail: Array<{ activity: string; primary: string; confidence: number; reasoning: string }>;
}

const diffs: ReplayDiff[] = await pool(records, concurrency, async (r, i) => {
  if ((i + 1) % 10 === 0) console.log(`  ... ${i + 1}/${records.length}`);
  const prodPrimaries = (r.result?.activities ?? []).map(a => a.result.primary.code).sort();
  let replayPrimaries: string[] = [];
  const detail: ReplayDiff['detail'] = [];
  try {
    const acts = await splitActivities(r.inputText);
    const matches = await Promise.all(acts.map(a => matchActivity(a.text, deps, a.searchVariants)));
    replayPrimaries = matches.map(m => m.result.primary.code).sort();
    for (const m of matches) {
      detail.push({ activity: m.activity, primary: m.result.primary.code, confidence: m.result.primary.confidence, reasoning: m.result.primary.reasoning });
    }
  } catch (error) {
    replayPrimaries = [`FEHLER: ${String(error).slice(0, 80)}`];
  }
  return {
    id: r.id,
    createdAt: r.createdAt,
    inputText: r.inputText,
    prodModel: r.llmModel,
    prodPrimaries,
    replayPrimaries,
    changed: JSON.stringify(prodPrimaries) !== JSON.stringify(replayPrimaries),
    detail,
  };
});

const changed = diffs.filter(d => d.changed);
console.log(`\nErgebnis: ${changed.length}/${diffs.length} Matches mit geaendertem Primary-Set`);
for (const d of changed.slice(0, 30)) {
  console.log(`\n  "${d.inputText.slice(0, 80)}"`);
  console.log(`    prod:   ${d.prodPrimaries.join(', ')} [${d.prodModel}]`);
  console.log(`    replay: ${d.replayPrimaries.join(', ')}`);
}

if (outPath) {
  await Bun.write(outPath, JSON.stringify({ file, replayed: diffs.length, changed: changed.length, diffs }, null, 2));
  console.log(`\nDiff-Report: ${outPath}`);
}
process.exit(0);
