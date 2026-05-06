/**
 * WZ-Branchen-Matcher: Katalog- und Embeddings-Builder.
 *
 * Liest docs/WZBAR-Schluesseltabelle.xlsx, filtert auf gültige 4- bis 6-stellige
 * Codes (Klasse / Unterklasse / Detail-Unterklasse), schreibt catalog.json, und
 * erzeugt anschliessend embeddings.json über den konfigurierten Platform-
 * Embedding-Provider.
 *
 * Aufruf (aus backend/):
 *   /Users/andreasbachmann/.bun/bin/bun run src/apps/wzbar-matcher/catalog-builder.ts
 *   /Users/andreasbachmann/.bun/bin/bun run src/apps/wzbar-matcher/catalog-builder.ts --catalog-only
 *   /Users/andreasbachmann/.bun/bin/bun run src/apps/wzbar-matcher/catalog-builder.ts --force
 */

import ExcelJS from 'exceljs';
import { createHash } from 'node:crypto';
import { llmService } from '../../services/llm';
import { getPlatformModel } from '../../config/platformModels';
import type { CatalogEntry, EmbeddingsIndex } from './types';

const XLSX_PATH = '../docs/WZBAR-Schluesseltabelle.xlsx';
const CATALOG_PATH = './src/apps/wzbar-matcher/assets/catalog.json';
const EMBEDDINGS_PATH = './src/apps/wzbar-matcher/assets/embeddings.json';
const CONCURRENCY = 8;

const args = process.argv.slice(2);
const catalogOnly = args.includes('--catalog-only');
const force = args.includes('--force');

function cellToIso(cell: ExcelJS.Cell): string | null {
  const v = cell?.value;
  if (v == null || v === '') return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number' && Number.isFinite(v)) {
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  if (typeof v === 'string') {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

function cellToText(cell: ExcelJS.Cell): string {
  const v = cell?.value;
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object' && 'richText' in v && Array.isArray((v as any).richText)) {
    return (v as any).richText.map((p: any) => p.text || '').join('').trim();
  }
  if (typeof v === 'object' && 'text' in v && typeof (v as any).text === 'string') {
    return (v as any).text.trim();
  }
  if (typeof v === 'object' && 'result' in v) {
    return String((v as any).result ?? '').trim();
  }
  return String(v).trim();
}

function hashText(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

async function buildCatalog(): Promise<{ catalog: CatalogEntry[]; hash: string }> {
  const xlsxFile = Bun.file(XLSX_PATH);
  if (!(await xlsxFile.exists())) {
    throw new Error(`xlsx nicht gefunden: ${XLSX_PATH}`);
  }
  const buffer = Buffer.from(await xlsxFile.arrayBuffer());
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = wb.worksheets[0];
  if (!sheet) throw new Error('Keine Sheets in xlsx gefunden.');

  const header: Record<string, number> = {};
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell, col) => {
    header[String(cell.value ?? '').trim()] = col;
  });
  const colSchluessel = header['Schlüssel'];
  const colKurz = header['Kurztext'];
  const colLt1 = header['Langtext 1'];
  const colLt2 = header['Langtext 2'];
  const colVon = header['Gültig von'];
  const colBis = header['Gültig bis'];
  if (!colSchluessel || !colKurz) {
    throw new Error(`Header nicht wie erwartet. Gefunden: ${Object.keys(header).join(', ')}`);
  }

  const today = new Date().toISOString().slice(0, 10);

  const catalog: CatalogEntry[] = [];
  const hashInputs: string[] = [];
  let skippedWrongLength = 0;
  let skippedExpired = 0;
  const levelCounts: Record<string, number> = { '4': 0, '5': 0, '6': 0 };

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const schluesselCell = row.getCell(colSchluessel);
    if (schluesselCell.value == null || schluesselCell.value === '') continue;
    const code = String(schluesselCell.value).trim();
    if (!/^\d{4,6}$/.test(code)) {
      skippedWrongLength++;
      continue;
    }
    levelCounts[String(code.length)] = (levelCounts[String(code.length)] ?? 0) + 1;
    const validFrom = colVon ? cellToIso(row.getCell(colVon)) : null;
    const validTo = colBis ? cellToIso(row.getCell(colBis)) : null;
    if (validTo && validTo < today) {
      skippedExpired++;
      continue;
    }
    const kurztext = cellToText(row.getCell(colKurz));
    const lt1 = colLt1 ? cellToText(row.getCell(colLt1)) : '';
    const lt2 = colLt2 ? cellToText(row.getCell(colLt2)) : '';
    const langtext = [lt1, lt2 && lt2 !== lt1 ? lt2 : ''].filter(Boolean).join(' — ');

    catalog.push({
      code,
      kurztext,
      langtext: langtext || kurztext,
      validFrom,
      validTo,
    });
    hashInputs.push(`${code}|${kurztext}|${langtext}|${validFrom}|${validTo}`);
  }

  catalog.sort((a, b) => a.code.localeCompare(b.code));
  const hash = hashText(hashInputs.slice().sort().join('\n'));

  console.log(`[catalog-builder] xlsx → ${catalog.length} Einträge (4-6 stellig, gültig). Verteilung: 4=${levelCounts['4']}, 5=${levelCounts['5']}, 6=${levelCounts['6']}. Übersprungen: ${skippedWrongLength} ausserhalb 4-6 Stellen, ${skippedExpired} abgelaufen.`);
  return { catalog, hash };
}

function embedText(entry: CatalogEntry): string {
  if (entry.langtext && entry.langtext !== entry.kurztext) {
    return `${entry.kurztext}. ${entry.langtext}`;
  }
  return entry.kurztext;
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

async function buildEmbeddings(catalog: CatalogEntry[], inputHash: string): Promise<EmbeddingsIndex> {
  const resolved = await getPlatformModel('embeddings');
  if (!resolved) throw new Error('Kein Embedding-Modell konfiguriert.');
  const modelId = resolved.model.id;

  const entries: Array<{ code: string; vector: number[] }> = new Array(catalog.length);
  let done = 0;
  const started = Date.now();

  await pLimit(catalog, CONCURRENCY, async (entry, idx) => {
    const vector = await llmService.embed(embedText(entry));
    entries[idx] = { code: entry.code, vector };
    done++;
    if (done % 100 === 0 || done === catalog.length) {
      const rate = done / ((Date.now() - started) / 1000);
      console.log(`[catalog-builder] Embeddings: ${done}/${catalog.length} (${rate.toFixed(1)}/s)`);
    }
  });

  const dimensions = entries[0]?.vector.length ?? 0;
  return {
    model: modelId,
    dimensions,
    builtAt: new Date().toISOString(),
    inputHash,
    entries,
  };
}

async function main(): Promise<void> {
  // Catalog
  const { catalog, hash } = await buildCatalog();
  await Bun.write(CATALOG_PATH, JSON.stringify(catalog, null, 2));
  console.log(`[catalog-builder] ${CATALOG_PATH} geschrieben.`);

  if (catalogOnly) {
    console.log('[catalog-builder] --catalog-only: Embeddings übersprungen.');
    return;
  }

  // Embeddings
  const existing = Bun.file(EMBEDDINGS_PATH);
  if (!force && (await existing.exists())) {
    try {
      const prev = JSON.parse(await existing.text()) as EmbeddingsIndex;
      if (prev.inputHash === hash && prev.entries.length === catalog.length) {
        console.log('[catalog-builder] Embeddings bereits aktuell (Hash stimmt). Überspringe. (--force zum Erzwingen)');
        return;
      }
    } catch {
      /* fall through */
    }
  }

  const index = await buildEmbeddings(catalog, hash);
  await Bun.write(EMBEDDINGS_PATH, JSON.stringify(index));
  console.log(`[catalog-builder] ${EMBEDDINGS_PATH} geschrieben (model=${index.model}, dim=${index.dimensions}, entries=${index.entries.length}).`);
}

main().catch(err => {
  console.error('[catalog-builder] Fehler:', err);
  process.exit(1);
});
