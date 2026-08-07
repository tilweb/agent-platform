/**
 * Ehinger-Pilot: Token-Verbrauch je Lieferschein MESSEN (nicht schaetzen).
 *
 * Gleicher Ablauf wie `run.ts` (Klassifikation → Extraktion), aber `fetch` ist
 * gekapselt: jede Antwort des Modell-Endpunkts wird geklont und ihr
 * `usage`-Block mitgeschrieben. Damit sind alle drei Aufruf-Arten erfasst —
 * Klassifikation (Bild, 150 dpi), Vision-Extraktion je Seite (Bild, 200 dpi)
 * und der Konfidenz-Aufruf (reiner Text).
 *
 * Aufruf (im backend/-Verzeichnis):
 *   /Users/andreasbachmann/.bun/bin/bun run ../tools/ehinger-pilot/tokens.ts --only 1898_001,1900_001
 */

import { mkdir, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { renderPdfToImages } from '../../backend/src/services/extraction/pdf';
import { classifyPart } from '../../backend/src/extraction/inbox/classify';
import { extract } from '../../backend/src/extraction/learning/service';
import { getAllProjects } from '../../backend/src/extraction/learning/projects';

const PDF_DIR = resolve(import.meta.dir, '../../docs/Ehinger');
const OUT_DIR = resolve(import.meta.dir, 'results');

interface Usage { prompt: number; completion: number; total: number; at: number }

const usages: Usage[] = [];

// --- fetch kapseln: Antworten des Chat-Endpunkts mitlesen ------------------
const origFetch = globalThis.fetch;
globalThis.fetch = (async (input: any, init?: any) => {
  const res = await origFetch(input, init);
  try {
    const url = typeof input === 'string' ? input : (input?.url ?? String(input));
    const ct = res.headers.get('content-type') ?? '';
    // Nur JSON-Antworten des Chat-Endpunkts; Streams bleiben unberuehrt.
    if (url.includes('/chat/completions') && ct.includes('application/json')) {
      const body = await res.clone().json();
      const u = body?.usage;
      if (u) {
        usages.push({
          prompt: u.prompt_tokens ?? 0,
          completion: u.completion_tokens ?? 0,
          total: u.total_tokens ?? (u.prompt_tokens ?? 0) + (u.completion_tokens ?? 0),
          at: Date.now(),
        });
      }
    }
  } catch { /* Messung darf den Lauf nie stoeren */ }
  return res;
}) as typeof fetch;

async function main() {
  const args = process.argv.slice(2);
  const onlyArg = args.indexOf('--only');
  const only = onlyArg >= 0 ? (args[onlyArg + 1] ?? '').split(',').filter(Boolean) : null;
  if (!only) {
    console.error('Bitte --only <beleg,beleg> angeben (Bloecke, damit kein Zeitlimit greift).');
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });
  const projects = (await getAllProjects()).filter((p) => p.id.startsWith('ehinger-pilot-'));
  if (projects.length === 0) {
    console.error('Keine Pilot-Projekte gefunden — zuerst import.ts ausfuehren.');
    process.exit(1);
  }

  const results: Array<Record<string, unknown>> = [];

  for (const beleg of only) {
    const file = `${beleg}.pdf`;
    const path = join(PDF_DIR, file);
    const from = usages.length;
    const started = Date.now();
    process.stdout.write(`${beleg} … `);

    const buffer = Buffer.from(await Bun.file(path).arrayBuffer());
    const [firstPage] = await renderPdfToImages(buffer, { dpi: 150, maxPages: 1 });
    if (!firstPage) throw new Error('Seite 1 nicht renderbar');
    const dataUri = `data:image/png;base64,${firstPage.pngBuffer.toString('base64')}`;
    const classification = await classifyPart(dataUri, projects, '');
    const afterClassify = usages.length;

    let seiten = 0;
    let positionen = 0;
    if (classification.project_id) {
      const extraction = await extract(classification.project_id, { type: 'file', path, filename: file });
      if (!extraction.success) throw new Error(extraction.error || 'Extraktion fehlgeschlagen');
      seiten = extraction.pageImages?.length ?? 0;
      positionen = Array.isArray(extraction.data?.positionen) ? (extraction.data.positionen as unknown[]).length : 0;
    }

    const calls = usages.slice(from);
    const klass = usages.slice(from, afterClassify);
    const rest = usages.slice(afterClassify);
    const sum = (xs: Usage[], k: keyof Usage) => xs.reduce((a, b) => a + (b[k] as number), 0);

    const row = {
      beleg,
      lieferant: classification.project_id,
      seiten,
      positionen,
      aufrufe: calls.length,
      prompt_tokens: sum(calls, 'prompt'),
      completion_tokens: sum(calls, 'completion'),
      total_tokens: sum(calls, 'total'),
      klassifikation: { aufrufe: klass.length, prompt: sum(klass, 'prompt'), completion: sum(klass, 'completion') },
      extraktion: { aufrufe: rest.length, prompt: sum(rest, 'prompt'), completion: sum(rest, 'completion') },
      // Einzelaufrufe in Reihenfolge: 1x Klassifikation, N x Vision je Seite,
      // zuletzt die Konfidenz-Aufrufe (reiner Text).
      einzeln: calls.map((c) => ({ prompt: c.prompt, completion: c.completion })),
      dauerMs: Date.now() - started,
    };
    results.push(row);
    console.log(
      `${seiten} Seiten · ${positionen} Pos · ${row.aufrufe} Aufrufe · ` +
      `${row.prompt_tokens} in / ${row.completion_tokens} out = ${row.total_tokens} Token`,
    );
  }

  // Bloecke zusammenfuehren
  const outFile = join(OUT_DIR, 'tokens.json');
  let merged: Array<Record<string, unknown>> = [];
  try { merged = JSON.parse(await Bun.file(outFile).text()); } catch { /* erster Lauf */ }
  const byId = new Map(merged.map((r) => [r.beleg as string, r]));
  for (const r of results) byId.set(r.beleg as string, r);
  const all = [...byId.values()].sort((a, b) => String(a.beleg).localeCompare(String(b.beleg)));
  await writeFile(outFile, JSON.stringify(all, null, 2), 'utf-8');
  console.log(`\n${results.length} Belege gemessen, ${all.length} gesamt → ${outFile}`);
  process.exit(0);
}

void main();
