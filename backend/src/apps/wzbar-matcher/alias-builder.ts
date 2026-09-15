/**
 * WZ-Branchen-Matcher: Alias-Embeddings-Builder (M4, siehe
 * docs/wzbar-matcher-ihk-feedback-massnahmen-2026-09-15.md).
 *
 * Baut zusaetzliche Embedding-Vektoren pro Code aus der enrich-Haelfte der
 * amtlichen Destatis-Stichwoerter (docs/WZ2025-Stichwoerter.csv). Das
 * Retrieval nimmt pro Code die beste Similarity ueber Katalogtext + alle
 * Alias-Vektoren — damit finden produktspezifische Umschreibungen
 * ("Rheumadecken, Herstellung") ihre Sammel-Codes.
 *
 * KRITISCH: Es darf ausschliesslich die 'enrich'-Haelfte des deterministischen
 * Splits aus eval/destatis.ts verwendet werden — die 'eval'-Haelfte ist das
 * Golden Set des Eval-Harness. Wuerde sie mit eingebaut, misst die Evaluation
 * ihre eigenen Trainingsdaten und ist wertlos.
 *
 * Output:
 *   assets/alias-embeddings.meta.json  — Modell, Dimensionen, entries[{text, codes}]
 *   assets/alias-embeddings.bin        — Float32-Vektoren, Reihenfolge = entries
 *
 * Aufruf (aus backend/):
 *   /Users/andreasbachmann/.bun/bin/bun run src/apps/wzbar-matcher/alias-builder.ts
 *   /Users/andreasbachmann/.bun/bin/bun run src/apps/wzbar-matcher/alias-builder.ts --force
 */

import { llmService } from '../../services/llm';
import { getPlatformModel } from '../../config/platformModels';
import { parseStichwoerter, splitOf, type StichwortCase } from './eval/destatis';
import { ALIAS_BIN_PATH, ALIAS_META_PATH } from './storage';
import type { AliasMeta, CatalogEntry } from './types';

const STICHWOERTER_PATH = '../docs/WZ2025-Stichwoerter.csv';
const CATALOG_PATH = './src/apps/wzbar-matcher/assets/catalog.json';
const CONCURRENCY = 8;

const force = process.argv.includes('--force');

/**
 * Baut die Alias-Eintraege: enrich-Haelfte, nur Codes, die im Katalog
 * existieren. Exportiert fuer Unit-Tests (Split-Integritaet).
 */
export function buildAliasEntries(
  stichwoerter: StichwortCase[],
  catalogCodes: Set<string>,
): Array<{ text: string; codes: string[] }> {
  const entries: Array<{ text: string; codes: string[] }> = [];
  for (const s of stichwoerter) {
    if (splitOf(s.text) !== 'enrich') continue;
    const codes = s.expected.filter(c => catalogCodes.has(c));
    if (codes.length > 0) entries.push({ text: s.text, codes });
  }
  return entries;
}

async function loadReusableVectors(currentModel: string): Promise<Map<string, Float32Array>> {
  const byText = new Map<string, Float32Array>();
  if (force) return byText;
  try {
    const meta = JSON.parse(await Bun.file(ALIAS_META_PATH).text()) as AliasMeta;
    if (meta.model !== currentModel) return byText;
    const vectors = new Float32Array(await Bun.file(ALIAS_BIN_PATH).arrayBuffer());
    if (vectors.length !== meta.entries.length * meta.dimensions) return byText;
    meta.entries.forEach((e, i) => {
      byText.set(e.text, vectors.subarray(i * meta.dimensions, (i + 1) * meta.dimensions));
    });
  } catch {
    /* kein/kaputter Vorlauf — alles neu embedden */
  }
  return byText;
}

async function pLimit<T>(items: T[], concurrency: number, worker: (item: T, idx: number) => Promise<void>): Promise<void> {
  let i = 0;
  const runners = Array.from({ length: concurrency }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      await worker(items[idx]!, idx);
    }
  });
  await Promise.all(runners);
}

async function main(): Promise<void> {
  const resolved = await getPlatformModel('embeddings');
  if (!resolved) throw new Error('Kein Embedding-Modell konfiguriert.');
  const modelId = resolved.model.id;

  const catalog = JSON.parse(await Bun.file(CATALOG_PATH).text()) as CatalogEntry[];
  const catalogCodes = new Set(catalog.map(e => e.code));

  const csv = await Bun.file(STICHWOERTER_PATH).text();
  const all = parseStichwoerter(csv);
  const entries = buildAliasEntries(all, catalogCodes);
  console.log(`[alias-builder] ${all.length} Stichwoerter gesamt → ${entries.length} Alias-Eintraege (enrich-Haelfte, Codes im Katalog).`);

  const reuseByText = await loadReusableVectors(modelId);
  const vectorsByIdx: Float32Array[] = new Array(entries.length);
  const toEmbed: number[] = [];
  let reused = 0;
  entries.forEach((e, idx) => {
    const v = reuseByText.get(e.text);
    if (v) {
      vectorsByIdx[idx] = v;
      reused++;
    } else {
      toEmbed.push(idx);
    }
  });
  console.log(`[alias-builder] Embeddings: ${reused} wiederverwendet, ${toEmbed.length} neu zu erzeugen.`);

  let done = 0;
  const started = Date.now();
  await pLimit(toEmbed, CONCURRENCY, async (idx) => {
    const vector = await llmService.embed(entries[idx]!.text);
    vectorsByIdx[idx] = Float32Array.from(vector);
    done++;
    if (done % 200 === 0 || done === toEmbed.length) {
      const rate = done / ((Date.now() - started) / 1000);
      const eta = Math.round((toEmbed.length - done) / rate);
      console.log(`[alias-builder] Neue Embeddings: ${done}/${toEmbed.length} (${rate.toFixed(1)}/s, ETA ${eta}s)`);
    }
  });

  const dimensions = vectorsByIdx[0]?.length ?? 0;
  const bin = new Float32Array(entries.length * dimensions);
  vectorsByIdx.forEach((v, i) => bin.set(v, i * dimensions));

  const meta: AliasMeta = {
    model: modelId,
    dimensions,
    builtAt: new Date().toISOString(),
    sourceFile: 'docs/WZ2025-Stichwoerter.csv',
    entries,
  };
  await Bun.write(ALIAS_META_PATH, JSON.stringify(meta));
  await Bun.write(ALIAS_BIN_PATH, bin.buffer as ArrayBuffer);
  console.log(`[alias-builder] Geschrieben: ${ALIAS_META_PATH} (${entries.length} Eintraege), ${ALIAS_BIN_PATH} (${(bin.byteLength / 1e6).toFixed(1)} MB, model=${modelId}, dim=${dimensions}).`);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error('[alias-builder] Fehler:', err);
    process.exit(1);
  });
}
