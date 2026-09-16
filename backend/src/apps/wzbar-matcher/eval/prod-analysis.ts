/**
 * M2b: Unueberwachte Produktionsmetriken aus exportierten wzbar.matches.
 *
 * Aufruf (aus backend/):
 *   bun src/apps/wzbar-matcher/eval/prod-analysis.ts <export1.json> [<export2.json> ...]
 *
 * Braucht keine Soll-Codes: misst Ebenen-Verteilung (Fall-1-Quote =
 * 4-stellige Primaries), Konfidenzen, Modelle, Laufzeiten — und sucht die
 * dokumentierten IHK-Faelle (Abbruch/Komplementaer) zur Verifikation.
 */

import { basename } from 'node:path';
import type { MatchRecord } from '../types';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: bun prod-analysis.ts <export1.json> [...]');
  process.exit(1);
}

function pct(part: number, total: number): string {
  return total === 0 ? '—' : `${((part / total) * 100).toFixed(1)}%`;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
}

for (const file of files) {
  const records = (await Bun.file(file).json()) as MatchRecord[];
  const label = basename(file).replace(/\.json$/, '');
  console.log(`\n================ ${label} — ${records.length} Matches ================`);
  if (records.length === 0) continue;

  console.log(`Zeitraum: ${records[0]!.createdAt?.slice(0, 10)} … ${records[records.length - 1]!.createdAt?.slice(0, 10)}`);

  const activities = records.flatMap(r => r.result?.activities ?? []);
  const primaries = activities.map(a => a.result?.primary).filter(Boolean);
  console.log(`Activities: ${activities.length} (${(activities.length / records.length).toFixed(2)}/Match), Multi-Activity-Matches: ${records.filter(r => (r.result?.activities?.length ?? 0) > 1).length}`);

  // Fall-1-Quote: 4-stellige Primaries (vor M1-Deployment > 0 zu erwarten)
  const byLen: Record<number, number> = {};
  for (const p of primaries) byLen[p!.code.length] = (byLen[p!.code.length] ?? 0) + 1;
  console.log(`Primary-Ebenen: ${Object.entries(byLen).map(([l, n]) => `${l}-stellig: ${n} (${pct(n, primaries.length)})`).join(', ')}`);

  const confs = primaries.map(p => p!.confidence).sort((a, b) => a - b);
  console.log(`Confidence: p10=${quantile(confs, 0.1).toFixed(2)} median=${quantile(confs, 0.5).toFixed(2)} p90=${quantile(confs, 0.9).toFixed(2)}, <0.5: ${pct(confs.filter(c => c < 0.5).length, confs.length)}, =0: ${confs.filter(c => c === 0).length} (Fallback-Verdacht)`);

  const durs = records.map(r => r.durationMs).filter(Boolean).sort((a, b) => a - b);
  console.log(`Dauer: median=${(quantile(durs, 0.5) / 1000).toFixed(1)}s p90=${(quantile(durs, 0.9) / 1000).toFixed(1)}s`);

  const models = new Map<string, number>();
  for (const r of records) models.set(r.llmModel || '?', (models.get(r.llmModel || '?') ?? 0) + 1);
  console.log(`LLM-Modelle: ${[...models.entries()].map(([m, n]) => `${m}: ${n}`).join(', ')}`);

  const codeCounts = new Map<string, number>();
  for (const p of primaries) codeCounts.set(p!.code, (codeCounts.get(p!.code) ?? 0) + 1);
  const top = [...codeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log(`Top-Primary-Codes: ${top.map(([c, n]) => `${c}×${n}`).join(', ')}`);

  // Dokumentierte IHK-Faelle wiederfinden
  const interesting = records.filter(r => /abbruch|komplement|haftende/i.test(r.inputText));
  if (interesting.length > 0) {
    console.log(`\nIHK-Feedback-relevante Eingaben (${interesting.length}):`);
    for (const r of interesting.slice(0, 15)) {
      const codes = (r.result?.activities ?? []).map(a => `${a.result.primary.code} (${(a.result.primary.confidence * 100).toFixed(0)}%)`).join(' | ');
      console.log(`  ${r.createdAt?.slice(0, 10)} "${r.inputText.slice(0, 70)}" → ${codes} [${r.llmModel}]`);
    }
  }
}
process.exit(0);
