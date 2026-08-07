/**
 * Segment-Pilot (W10.1): Segmentierung der Beispiel-Dokumente aus
 * docs/SplitDocuments mit den Familien-Profilen aus profiles.json.
 *
 * Nur Orchestrierung — die fachliche Leistung kommt aus dem Produkt
 * (renderPdfToImages @150dpi, classifySegmentPages, buildSegments).
 * Ergebnisse werden je Block in results/segments.json gemerged (Muster
 * ehinger-pilot). ACHTUNG: groundtruth/ + results/ sind gitignored
 * (personenbezogene Dokumente).
 *
 * Aufruf (im backend/-Verzeichnis):
 *   /Users/andreasbachmann/.bun/bin/bun run ../tools/segment-pilot/run.ts --only "<datei.pdf>,<datei2.pdf>"
 *   /Users/andreasbachmann/.bun/bin/bun run ../tools/segment-pilot/run.ts --alle
 */

import { readdir, mkdir, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { renderPdfToImages } from '../../backend/src/services/extraction/pdf';
import { classifySegmentPages, buildSegments } from '../../backend/src/extraction/segmentation/segmenter';
import type { SegmentTypeDef } from '../../backend/src/extraction/learning/types';

const PDF_DIR = resolve(import.meta.dir, '../../docs/SplitDocuments');
const OUT_DIR = resolve(import.meta.dir, 'results');

async function main() {
  const args = process.argv.slice(2);
  const onlyArg = args.indexOf('--only');
  // '|' als Trenner, wenn vorhanden — Dateinamen koennen Kommata enthalten.
  const rawOnly = onlyArg >= 0 ? (args[onlyArg + 1] ?? '') : '';
  const only = onlyArg >= 0 ? rawOnly.split(rawOnly.includes('|') ? '|' : ',').filter(Boolean) : null;
  const alle = args.includes('--alle');
  if (!only && !alle) {
    console.error('Aufruf: run.ts --only "<datei,...>" | --alle');
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });
  const profiles = JSON.parse(await Bun.file(resolve(import.meta.dir, 'profiles.json')).text()) as Record<string, Record<string, SegmentTypeDef>>;
  const mapping = JSON.parse(await Bun.file(resolve(import.meta.dir, 'groundtruth/mapping.json')).text()) as Record<string, string>;

  const files = (await readdir(PDF_DIR)).filter((f) => f.toLowerCase().endsWith('.pdf')).sort();
  const targets = only ? files.filter((f) => only.includes(f)) : files;

  const results: Array<Record<string, unknown>> = [];
  for (const file of targets) {
    const profileId = mapping[file];
    if (!profileId || !profiles[profileId]) {
      console.log(`${file}: KEIN Profil-Mapping — uebersprungen`);
      continue;
    }
    const defs = Object.fromEntries(
      Object.entries(profiles[profileId]!).filter(([k]) => !k.startsWith('_')),
    ) as Record<string, SegmentTypeDef>;

    const started = Date.now();
    process.stdout.write(`${file} [${profileId}] … `);
    const buffer = Buffer.from(await Bun.file(join(PDF_DIR, file)).arrayBuffer());
    const pages = await renderPdfToImages(buffer, { dpi: 150 });
    const classifications = await classifySegmentPages(
      pages.map((p) => ({ page: p.pageNumber, pngBuffer: p.pngBuffer })),
      defs,
    );
    const { segments, findings } = buildSegments(classifications, defs);
    const dauerMs = Date.now() - started;
    results.push({ file, profileId, seiten: pages.length, dauerMs, classifications, segments, findings });
    console.log(`${pages.length} Seiten → ${segments.length} Segmente, ${findings.length} Befund(e) · ${(dauerMs / 1000).toFixed(1)}s`);
  }

  const outFile = join(OUT_DIR, 'segments.json');
  let merged: Array<Record<string, unknown>> = [];
  try { merged = JSON.parse(await Bun.file(outFile).text()); } catch { /* erster Lauf */ }
  const byFile = new Map(merged.map((r) => [r.file as string, r]));
  for (const r of results) byFile.set(r.file as string, r);
  await writeFile(outFile, JSON.stringify([...byFile.values()], null, 2), 'utf-8');
  console.log(`\n${results.length} Dokument(e) in diesem Block, ${byFile.size} gesamt → ${outFile}`);
  process.exit(0);
}

void main();
