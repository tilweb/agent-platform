/**
 * Projektauftrag-Import End-to-End-Test.
 *
 * Iteriert ueber `docs/projektmanagement-imports/`, schickt jedes File (oder Gruppe)
 * an den /api/apps/projektmanagement/projektauftraege/import-Endpoint und sammelt
 * Ergebnisse fuer eine Qualitaetsbewertung.
 *
 * Usage:
 *   /Users/andreasbachmann/.bun/bin/bun run tools/pm-import-test/run-test.ts
 *
 * Optional: nur einzelne Files testen via Argumenten:
 *   /Users/andreasbachmann/.bun/bin/bun run tools/pm-import-test/run-test.ts "Toolbox - Relaunch Website.xlsx"
 */

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, extname, basename } from 'node:path';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';
const IMPORT_DIR = resolve(import.meta.dir, '../../docs/projektmanagement-imports');
const RESULTS_DIR = resolve(import.meta.dir, 'results');
const USERNAME = 'demo1';
const PASSWORD = process.env.DEMO_PASSWORD || 'Demo2026!';

const MIME_BY_EXT: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

interface TestCase {
  /** Eindeutiger Slug fuer Result-File und Logs */
  slug: string;
  /** Anzeigename */
  label: string;
  /** Filenames relativ zu IMPORT_DIR */
  files: string[];
  /** Erwarteter Hauptmodus (zur Klassifikation des Reports) */
  primaryFormat: 'docx' | 'pptx' | 'xlsx' | 'pdf' | 'image' | 'mixed';
}

interface TestResult {
  slug: string;
  label: string;
  files: string[];
  primaryFormat: TestCase['primaryFormat'];
  durationMs: number;
  ok: boolean;
  httpStatus?: number;
  error?: string;
  /** Aus dem API-Response (Struktur des erstellten Projektauftrags) */
  projektauftrag?: any;
  report?: {
    filesProcessed: number;
    filesFailed: number;
    fieldsExtracted: number;
    errors: string[];
    warnings: string[];
  };
  /** Eigene Qualitaets-Bewertung */
  quality?: QualityScore;
}

interface QualityScore {
  fieldsExtracted: number;
  hasName: boolean;
  hasDateRange: boolean;
  hasProjectLeader: boolean;
  hasDescription: boolean;
  arrayCounts: {
    criteria: number;
    in_scope: number;
    out_scope: number;
    tasks: number;
    milestones: number;
    budget: number;
    risks: number;
    organization: number;
    stakeholders: number;
  };
  /** Heuristik: 0..100 — fuer schnelle Sortierung */
  score: number;
}

// ============================================
// Test-Cases definieren
// ============================================

async function buildTestCases(filterTo?: string[]): Promise<TestCase[]> {
  const allFiles = await readdir(IMPORT_DIR);
  const cases: TestCase[] = [];

  // Gruppen-Definition (Multi-File-Imports, die fachlich zusammen gehoeren)
  const groups: Array<{ slug: string; label: string; pattern: RegExp; primaryFormat: TestCase['primaryFormat'] }> = [
    {
      slug: 'onepager-team-1',
      label: 'OnePager Team 1 (2 Bilder)',
      pattern: /^[Oo]nepager Team 1-/,
      primaryFormat: 'image',
    },
    {
      slug: 'onepager-team-2',
      label: 'OnePager Team 2 (3 Bilder)',
      pattern: /^OnePager Team 2-/,
      primaryFormat: 'image',
    },
    {
      slug: 'onepager-team-3',
      label: 'OnePager Team 3 (2 Bilder)',
      pattern: /^OnePager Team 3-/,
      primaryFormat: 'image',
    },
  ];

  // Erst Gruppen aufnehmen
  const usedFiles = new Set<string>();
  for (const g of groups) {
    const matched = allFiles.filter(f => g.pattern.test(f)).sort();
    if (matched.length === 0) continue;
    cases.push({ slug: g.slug, label: g.label, files: matched, primaryFormat: g.primaryFormat });
    matched.forEach(f => usedFiles.add(f));
  }

  // Dann jedes uebrig gebliebene File als eigenen Case
  for (const file of allFiles.sort()) {
    if (usedFiles.has(file)) continue;
    const ext = extname(file).toLowerCase();
    const slug = file.replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-|-$/g, '');
    let primary: TestCase['primaryFormat'] = 'mixed';
    if (['.docx', '.doc'].includes(ext)) primary = 'docx';
    else if (['.pptx', '.ppt'].includes(ext)) primary = 'pptx';
    else if (['.xlsx', '.xls'].includes(ext)) primary = 'xlsx';
    else if (ext === '.pdf') primary = 'pdf';
    else if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) primary = 'image';
    cases.push({
      slug,
      label: file,
      files: [file],
      primaryFormat: primary,
    });
  }

  if (filterTo && filterTo.length > 0) {
    return cases.filter(c => c.files.some(f => filterTo.includes(f)) || filterTo.includes(c.slug));
  }
  return cases;
}

// ============================================
// Auth + HTTP-Helper
// ============================================

let cookieJar: string[] = [];

function setCookies(setCookieHeaders: string[]): void {
  for (const sc of setCookieHeaders) {
    const semi = sc.indexOf(';');
    const kv = semi >= 0 ? sc.slice(0, semi) : sc;
    const eq = kv.indexOf('=');
    if (eq < 1) continue;
    const name = kv.slice(0, eq);
    cookieJar = cookieJar.filter(c => !c.startsWith(name + '='));
    cookieJar.push(kv);
  }
}

function cookieHeader(): string {
  return cookieJar.join('; ');
}

async function login(): Promise<void> {
  const res = await fetch(`${SERVER_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: SERVER_URL },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login fehlgeschlagen: HTTP ${res.status}`);
  const sc = res.headers.getSetCookie?.() ?? [];
  setCookies(sc);
}

// ============================================
// Import durchfuehren
// ============================================

async function runImport(testCase: TestCase): Promise<TestResult> {
  const result: TestResult = {
    slug: testCase.slug,
    label: testCase.label,
    files: testCase.files,
    primaryFormat: testCase.primaryFormat,
    durationMs: 0,
    ok: false,
  };

  const formData = new FormData();
  for (const filename of testCase.files) {
    const fullPath = join(IMPORT_DIR, filename);
    if (!existsSync(fullPath)) {
      result.error = `File not found: ${filename}`;
      return result;
    }
    const buffer = await readFile(fullPath);
    const ext = extname(filename).toLowerCase();
    const mime = MIME_BY_EXT[ext] || 'application/octet-stream';
    const blob = new Blob([buffer], { type: mime });
    formData.append('files', blob, filename);
  }

  const start = Date.now();
  try {
    const res = await fetch(`${SERVER_URL}/api/apps/projektmanagement/projektauftraege/import`, {
      method: 'POST',
      headers: {
        Cookie: cookieHeader(),
        Origin: SERVER_URL,
      },
      body: formData,
      signal: AbortSignal.timeout(180_000),  // 3 min Hard-Timeout
    });
    result.durationMs = Date.now() - start;
    result.httpStatus = res.status;

    if (!res.ok) {
      const body = await res.text();
      result.error = `HTTP ${res.status}: ${body.substring(0, 500)}`;
      return result;
    }

    const data = await res.json() as { projektauftrag: any; report: TestResult['report'] };
    result.ok = true;
    result.projektauftrag = data.projektauftrag;
    result.report = data.report;
    result.quality = scoreQuality(data.projektauftrag);
    return result;
  } catch (err) {
    result.durationMs = Date.now() - start;
    result.error = err instanceof Error ? err.message : String(err);
    return result;
  }
}

function scoreQuality(pa: any): QualityScore {
  const arr = (x: any): any[] => Array.isArray(x) ? x : [];
  const arrayCounts = {
    criteria: arr(pa.criteria).length,
    in_scope: arr(pa.in_scope).length,
    out_scope: arr(pa.out_scope).length,
    tasks: arr(pa.tasks).length,
    milestones: arr(pa.milestones).length,
    budget: arr(pa.budget).length,
    risks: arr(pa.risks).length,
    organization: arr(pa.organization).length,
    stakeholders: arr(pa.stakeholders).length,
  };
  const totalArrayItems = Object.values(arrayCounts).reduce((a, b) => a + b, 0);
  const hasName = !!pa.name && pa.name.length > 0;
  const hasDateRange = !!pa.start_date && !!pa.end_date;
  const hasProjectLeader = !!pa.projektleiter;
  const hasDescription = !!pa.description && pa.description.length > 20;

  // Heuristik:
  //   30 Punkte: Name vorhanden
  //   15 Punkte: Beschreibung
  //   10 Punkte: Zeitrahmen
  //   10 Punkte: Projektleiter
  //   bis zu 35 Punkte: Listen-Inhalt (1 Punkt pro Item, max 35)
  let score = 0;
  if (hasName) score += 30;
  if (hasDescription) score += 15;
  if (hasDateRange) score += 10;
  if (hasProjectLeader) score += 10;
  score += Math.min(35, totalArrayItems);

  return {
    fieldsExtracted: 0,  // Wird vom Report uebernommen, hier irrelevant
    hasName,
    hasDateRange,
    hasProjectLeader,
    hasDescription,
    arrayCounts,
    score,
  };
}

// ============================================
// Cleanup: importierte Projektauftraege wieder loeschen
// ============================================

async function cleanupProjektauftrag(id: string): Promise<void> {
  await fetch(`${SERVER_URL}/api/apps/projektmanagement/projektauftraege/${id}`, {
    method: 'DELETE',
    headers: {
      Cookie: cookieHeader(),
      Origin: SERVER_URL,
    },
  }).catch(() => { /* ignore */ });
}

// ============================================
// Main
// ============================================

async function main(): Promise<void> {
  const filterArgs = process.argv.slice(2);
  const cases = await buildTestCases(filterArgs.length > 0 ? filterArgs : undefined);

  console.log(`\n=== Projektauftrag-Import-Test ===`);
  console.log(`Server: ${SERVER_URL}`);
  console.log(`Test-Cases: ${cases.length}`);
  console.log(`Import-Dir: ${IMPORT_DIR}\n`);

  if (!existsSync(RESULTS_DIR)) await mkdir(RESULTS_DIR, { recursive: true });

  console.log('--- Login ---');
  await login();
  console.log(`OK\n`);

  const results: TestResult[] = [];
  for (let i = 0; i < cases.length; i++) {
    const testCase = cases[i]!;
    console.log(`[${i + 1}/${cases.length}] ${testCase.primaryFormat.padEnd(6)} ${testCase.label}`);
    const result = await runImport(testCase);
    results.push(result);
    if (result.ok) {
      const q = result.quality!;
      console.log(`           ✓ ${result.durationMs}ms  score=${q.score}  fields=${result.report!.fieldsExtracted}  name="${result.projektauftrag.name?.slice(0, 50) ?? '(none)'}"`);
      if (result.report!.errors.length > 0) {
        for (const e of result.report!.errors) console.log(`             ! ${e}`);
      }
      if (result.report!.warnings.length > 0) {
        for (const w of result.report!.warnings) console.log(`             ⚠ ${w}`);
      }
      // Cleanup
      if (result.projektauftrag?.id) {
        await cleanupProjektauftrag(result.projektauftrag.id);
      }
    } else {
      console.log(`           ✗ ${result.durationMs}ms  ${result.error?.slice(0, 200)}`);
    }
  }

  // Summary
  const ok = results.filter(r => r.ok);
  const failed = results.filter(r => !r.ok);
  console.log(`\n=== Summary ===`);
  console.log(`OK:     ${ok.length}/${results.length}`);
  console.log(`Failed: ${failed.length}/${results.length}`);
  if (ok.length > 0) {
    const avgScore = ok.reduce((s, r) => s + (r.quality?.score ?? 0), 0) / ok.length;
    const avgFields = ok.reduce((s, r) => s + (r.report?.fieldsExtracted ?? 0), 0) / ok.length;
    const avgMs = ok.reduce((s, r) => s + r.durationMs, 0) / ok.length;
    console.log(`Avg-Score:  ${avgScore.toFixed(1)}/100`);
    console.log(`Avg-Fields: ${avgFields.toFixed(1)}`);
    console.log(`Avg-Time:   ${(avgMs / 1000).toFixed(1)}s`);
  }
  console.log(`\nBy format:`);
  const byFormat: Record<string, { ok: number; failed: number; avgScore: number }> = {};
  for (const r of results) {
    const f = r.primaryFormat;
    if (!byFormat[f]) byFormat[f] = { ok: 0, failed: 0, avgScore: 0 };
    if (r.ok) {
      byFormat[f]!.ok++;
      byFormat[f]!.avgScore += r.quality?.score ?? 0;
    } else byFormat[f]!.failed++;
  }
  for (const [fmt, stats] of Object.entries(byFormat).sort()) {
    const total = stats.ok + stats.failed;
    const avgScore = stats.ok > 0 ? (stats.avgScore / stats.ok).toFixed(1) : '—';
    console.log(`  ${fmt.padEnd(7)} ${stats.ok}/${total}  avg-score=${avgScore}`);
  }

  // Top problems
  if (failed.length > 0) {
    console.log(`\n=== Failed Cases ===`);
    for (const r of failed) {
      console.log(`  ${r.primaryFormat.padEnd(6)} ${r.label}`);
      console.log(`    ${r.error?.slice(0, 200) ?? '(no error msg)'}`);
    }
  }

  // Save full results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultPath = join(RESULTS_DIR, `${timestamp}.json`);
  await writeFile(resultPath, JSON.stringify({
    timestamp,
    server: SERVER_URL,
    summary: {
      total: results.length,
      ok: ok.length,
      failed: failed.length,
      byFormat,
    },
    results,
  }, null, 2), 'utf-8');
  console.log(`\nFull results: ${resultPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
