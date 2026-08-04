/**
 * Ehinger-Pilot: Lieferschein-Strecke über unser Extraktionsfeature.
 *
 * Bildet das Ziel des bestehenden n8n-Workflows nach — NICHT dessen Aufbau:
 *   1. Seite 1 rendern und den Lieferanten klassifizieren (unser `classifyPart`)
 *   2. Beleg im passenden Projekt extrahieren (unsere Pipeline, vision-per-page)
 *   3. flaches Ergebnis schreiben (eine Zeile je Position, Kopfdaten wiederholt)
 *
 * Das Skript ist bewusst nur ORCHESTRIERUNG — jede fachliche Leistung kommt aus
 * dem Produkt (renderPdfToImages, classifyPart, extract). Genau diese
 * Orchestrierung würde später EMMA über die Public-API machen.
 *
 * Aufruf (im backend/-Verzeichnis, Backend muss NICHT laufen):
 *   /Users/andreasbachmann/.bun/bin/bun run ../tools/ehinger-pilot/run.ts [--only 1898_001,1900_001]
 */

import { readdir, mkdir, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { renderPdfToImages } from '../../backend/src/services/extraction/pdf';
import { classifyPart } from '../../backend/src/extraction/inbox/classify';
import { extract } from '../../backend/src/extraction/learning/service';
import { getAllProjects } from '../../backend/src/extraction/learning/projects';

const PDF_DIR = resolve(import.meta.dir, '../../docs/Ehinger');
const OUT_DIR = resolve(import.meta.dir, 'results');

/** Projekt-Id je Lieferant (wird beim Import gesetzt). */
const VENDOR_PROJECT: Record<string, string> = {
  sonepar: 'ehinger-pilot-sonepar',
  unielektro: 'ehinger-pilot-unielektro',
  eldis: 'ehinger-pilot-eldis',
  elektrobraun: 'ehinger-pilot-elektro-braun',
};

interface DocResult {
  beleg: string;
  seiten: number;
  klassifikation: { project_id: string | null; confidence: number; alternatives?: unknown };
  extraktion?: {
    strategy?: string;
    model?: string;
    data: Record<string, unknown>;
    fieldConfidences?: Record<string, number>;
    validations?: Array<{ severity: string; message: string }>;
  };
  fehler?: string;
  dauerMs: number;
}

async function main() {
  const args = process.argv.slice(2);
  const onlyArg = args.indexOf('--only');
  const only = onlyArg >= 0 ? (args[onlyArg + 1] ?? '').split(',').filter(Boolean) : null;

  await mkdir(OUT_DIR, { recursive: true });

  const projects = await getAllProjects();
  const pilotProjects = projects.filter((p) => p.id.startsWith('ehinger-pilot-'));
  if (pilotProjects.length === 0) {
    console.error('Keine Pilot-Projekte gefunden — zuerst import.ts ausfuehren.');
    process.exit(1);
  }
  console.log(`Pilot-Projekte: ${pilotProjects.map((p) => p.id).join(', ')}\n`);

  const files = (await readdir(PDF_DIR)).filter((f) => f.toLowerCase().endsWith('.pdf')).sort();
  const targets = only ? files.filter((f) => only.some((o) => f.startsWith(o))) : files;

  const results: DocResult[] = [];

  for (const file of targets) {
    const beleg = file.replace(/\.pdf$/i, '');
    const started = Date.now();
    const path = join(PDF_DIR, file);
    process.stdout.write(`${beleg} … `);

    try {
      // --- 1. Klassifikation auf Seite 1 (wie der Posteingang, aber ohne Split)
      const buffer = await Bun.file(path).arrayBuffer();
      const [firstPage] = await renderPdfToImages(Buffer.from(buffer), { dpi: 150, maxPages: 1 });
      if (!firstPage) throw new Error('Seite 1 nicht renderbar');
      const dataUri = `data:image/png;base64,${firstPage.pngBuffer.toString('base64')}`;
      const classification = await classifyPart(dataUri, pilotProjects, '');

      const result: DocResult = {
        beleg,
        seiten: 0,
        klassifikation: {
          project_id: classification.project_id,
          confidence: classification.confidence,
          alternatives: classification.alternatives,
        },
        dauerMs: 0,
      };

      // --- 2. Extraktion im erkannten Projekt
      if (classification.project_id) {
        const extraction = await extract(classification.project_id, {
          type: 'file',
          path,
          filename: file,
        });
        if (!extraction.success) throw new Error(extraction.error || 'Extraktion fehlgeschlagen');
        result.extraktion = {
          strategy: extraction.strategyUsed,
          model: extraction.audit?.model,
          data: extraction.data,
          fieldConfidences: extraction.fieldConfidences,
          validations: (extraction.validations ?? []).map((v) => ({ severity: v.severity, message: v.message })),
        };
        result.seiten = extraction.pageImages?.length ?? 0;
      }

      result.dauerMs = Date.now() - started;
      results.push(result);
      const posCount = Array.isArray(result.extraktion?.data?.positionen)
        ? (result.extraktion!.data.positionen as unknown[]).length
        : 0;
      console.log(
        `${classification.project_id ?? 'KEIN PROJEKT'} (${classification.confidence.toFixed(2)}) · ` +
        `${posCount} Positionen · ${(result.dauerMs / 1000).toFixed(1)} s`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ beleg, seiten: 0, klassifikation: { project_id: null, confidence: 0 }, fehler: msg, dauerMs: Date.now() - started });
      console.log(`FEHLER: ${msg}`);
    }
  }

  // Ergebnisse ueber Laeufe hinweg sammeln (der Gesamtlauf wird in Bloecken
  // gefahren, damit kein Einzelaufruf in ein Zeitlimit laeuft).
  const outFile = join(OUT_DIR, 'run.json');
  let merged: DocResult[] = [];
  try {
    merged = JSON.parse(await Bun.file(outFile).text()) as DocResult[];
  } catch { /* erster Lauf */ }
  const byId = new Map(merged.map((r) => [r.beleg, r]));
  for (const r of results) byId.set(r.beleg, r);
  const all = [...byId.values()].sort((a, b) => a.beleg.localeCompare(b.beleg));
  await writeFile(outFile, JSON.stringify(all, null, 2), 'utf-8');
  console.log(`\n${results.length} Belege in diesem Block, ${all.length} gesamt → ${outFile}`);
  process.exit(0);
}

void main();
