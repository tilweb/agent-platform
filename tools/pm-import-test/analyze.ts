/**
 * Analysiert die Result-JSON aus run-test.ts und gibt eine fachliche Bewertung aus.
 *
 * Usage:
 *   /Users/andreasbachmann/.bun/bin/bun run tools/pm-import-test/analyze.ts
 *   /Users/andreasbachmann/.bun/bin/bun run tools/pm-import-test/analyze.ts <result-file.json>
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const RESULTS_DIR = resolve(import.meta.dir, 'results');

interface TestResult {
  slug: string;
  label: string;
  files: string[];
  primaryFormat: string;
  durationMs: number;
  ok: boolean;
  httpStatus?: number;
  error?: string;
  projektauftrag?: any;
  report?: {
    filesProcessed: number;
    filesFailed: number;
    fieldsExtracted: number;
    errors: string[];
    warnings: string[];
  };
  quality?: {
    score: number;
    hasName: boolean;
    hasDateRange: boolean;
    hasProjectLeader: boolean;
    hasDescription: boolean;
    arrayCounts: Record<string, number>;
  };
}

async function loadLatestResults(): Promise<TestResult[]> {
  const arg = process.argv[2];
  if (arg) {
    const data = JSON.parse(await readFile(arg, 'utf-8'));
    return data.results;
  }
  const files = (await readdir(RESULTS_DIR)).filter(f => f.endsWith('.json')).sort();
  if (files.length === 0) throw new Error('No result files found');
  const latest = files[files.length - 1]!;
  const data = JSON.parse(await readFile(join(RESULTS_DIR, latest), 'utf-8'));
  console.log(`Analyzing: ${latest}\n`);
  return data.results;
}

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}

function main(): void {
  loadLatestResults().then(results => {
    const ok = results.filter(r => r.ok);
    const failed = results.filter(r => !r.ok);

    console.log('=== Per-Case-Detail ===');
    console.log(`${pad('Score', 6)} ${pad('Format', 8)} ${pad('Time', 7)} ${pad('Felder', 7)} ${pad('Name', 5)} ${pad('Datum', 6)} ${pad('Lead', 5)} ${pad('Desc', 5)} Tasks Miles Risks Stake Org   Crit  In/Out Budget`);
    console.log('-'.repeat(140));

    const sorted = [...ok].sort((a, b) => (b.quality?.score ?? 0) - (a.quality?.score ?? 0));
    for (const r of sorted) {
      const q = r.quality!;
      const a = q.arrayCounts;
      const time = `${(r.durationMs / 1000).toFixed(0)}s`;
      console.log(
        `${pad(String(q.score), 6)} ${pad(r.primaryFormat, 8)} ${pad(time, 7)} ${pad(String(r.report?.fieldsExtracted ?? 0), 7)} ${pad(q.hasName ? '✓' : '·', 5)} ${pad(q.hasDateRange ? '✓' : '·', 6)} ${pad(q.hasProjectLeader ? '✓' : '·', 5)} ${pad(q.hasDescription ? '✓' : '·', 5)} ${pad(String(a.tasks), 5)} ${pad(String(a.milestones), 5)} ${pad(String(a.risks), 5)} ${pad(String(a.stakeholders), 5)} ${pad(String(a.organization), 5)} ${pad(String(a.criteria), 5)} ${pad(`${a.in_scope}/${a.out_scope}`, 7)} ${pad(String(a.budget), 6)} ${r.label}`
      );
    }

    if (failed.length > 0) {
      console.log('\n=== Failed Cases ===');
      for (const r of failed) {
        console.log(`  ${pad(r.primaryFormat, 8)} ${pad(`${(r.durationMs / 1000).toFixed(1)}s`, 7)} ${r.label}`);
        console.log(`    ${(r.error ?? '').slice(0, 220)}`);
      }
    }

    // Aggregations
    console.log('\n=== Aggregat nach Format ===');
    const formats = ['docx', 'pptx', 'xlsx', 'pdf', 'image', 'mixed'];
    console.log(`${pad('Format', 7)} ${pad('OK/Total', 10)} ${pad('Avg-Score', 11)} ${pad('Avg-Felder', 11)} ${pad('Avg-Time', 9)} ${pad('Avg-Items', 10)}`);
    for (const fmt of formats) {
      const matchOk = ok.filter(r => r.primaryFormat === fmt);
      const matchAll = results.filter(r => r.primaryFormat === fmt);
      if (matchAll.length === 0) continue;
      const avgScore = matchOk.length > 0 ? (matchOk.reduce((s, r) => s + (r.quality?.score ?? 0), 0) / matchOk.length).toFixed(1) : '—';
      const avgFields = matchOk.length > 0 ? (matchOk.reduce((s, r) => s + (r.report?.fieldsExtracted ?? 0), 0) / matchOk.length).toFixed(1) : '—';
      const avgMs = matchOk.length > 0 ? (matchOk.reduce((s, r) => s + r.durationMs, 0) / matchOk.length / 1000).toFixed(1) : '—';
      const avgArr = matchOk.length > 0
        ? (matchOk.reduce((s, r) => s + Object.values(r.quality?.arrayCounts ?? {}).reduce((a, b) => a + (b as number), 0), 0) / matchOk.length).toFixed(1)
        : '—';
      console.log(`${pad(fmt, 7)} ${pad(`${matchOk.length}/${matchAll.length}`, 10)} ${pad(avgScore, 11)} ${pad(avgFields, 11)} ${pad(avgMs + 's', 9)} ${pad(avgArr, 10)}`);
    }

    // Field-Coverage
    console.log('\n=== Feld-Abdeckung (% der erfolgreichen Imports mit dem Feld) ===');
    if (ok.length > 0) {
      const fieldCoverage = {
        name: ok.filter(r => r.quality?.hasName).length,
        description: ok.filter(r => r.quality?.hasDescription).length,
        dateRange: ok.filter(r => r.quality?.hasDateRange).length,
        projectLeader: ok.filter(r => r.quality?.hasProjectLeader).length,
        tasks: ok.filter(r => (r.quality?.arrayCounts.tasks ?? 0) > 0).length,
        milestones: ok.filter(r => (r.quality?.arrayCounts.milestones ?? 0) > 0).length,
        risks: ok.filter(r => (r.quality?.arrayCounts.risks ?? 0) > 0).length,
        stakeholders: ok.filter(r => (r.quality?.arrayCounts.stakeholders ?? 0) > 0).length,
        organization: ok.filter(r => (r.quality?.arrayCounts.organization ?? 0) > 0).length,
        criteria: ok.filter(r => (r.quality?.arrayCounts.criteria ?? 0) > 0).length,
        budget: ok.filter(r => (r.quality?.arrayCounts.budget ?? 0) > 0).length,
        in_scope: ok.filter(r => (r.quality?.arrayCounts.in_scope ?? 0) > 0).length,
        out_scope: ok.filter(r => (r.quality?.arrayCounts.out_scope ?? 0) > 0).length,
      };
      for (const [field, count] of Object.entries(fieldCoverage)) {
        const pct = ((count / ok.length) * 100).toFixed(0);
        const bar = '█'.repeat(Math.round((count / ok.length) * 20));
        console.log(`  ${pad(field, 16)} ${pad(`${count}/${ok.length}`, 8)} ${pad(`${pct}%`, 5)} ${bar}`);
      }
    }

    // Top + Bottom
    console.log('\n=== Top-3 + Bottom-3 ===');
    if (sorted.length >= 1) {
      for (const r of sorted.slice(0, 3)) {
        console.log(`  TOP    ${r.quality?.score}  ${r.primaryFormat.padEnd(7)} ${r.projektauftrag?.name?.slice(0, 60)} (${r.label})`);
      }
      for (const r of sorted.slice(-3)) {
        console.log(`  BOTTOM ${r.quality?.score}  ${r.primaryFormat.padEnd(7)} ${r.projektauftrag?.name?.slice(0, 60)} (${r.label})`);
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`  ${ok.length}/${results.length} successful (${((ok.length / results.length) * 100).toFixed(0)}%)`);
    if (ok.length > 0) {
      const avgScore = ok.reduce((s, r) => s + (r.quality?.score ?? 0), 0) / ok.length;
      console.log(`  Avg-Score: ${avgScore.toFixed(1)}/100`);
    }
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

main();
