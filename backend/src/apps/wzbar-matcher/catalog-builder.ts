/**
 * WZ-Branchen-Matcher: Katalog- und Embeddings-Builder (WZ 2025).
 *
 * Liest docs/WZ2025-Schluesseltabelle.csv (Latin-1 / cp1252, ';'-getrennt,
 * Spalten KEYTAB_KEY;KEYTAB_KURZTEXT;KEYTAB_LANGTEXT_1;KEYTAB_LANGTEXT_2),
 * filtert auf gültige 4- bis 7-stellige Codes (Klasse / Unterklasse /
 * Detail-Unterklasse / nationale Feingliederung), schreibt catalog.json und
 * erzeugt embeddings.json über den konfigurierten Platform-Embedding-Provider.
 *
 * Effizienz: Einträge, deren Embedding-Text sich gegenüber dem bestehenden
 * embeddings.json nicht geändert hat (gleiches Modell), übernehmen den
 * vorhandenen Vektor — nur echte Neu-Texte werden neu embedded.
 *
 * Aufruf (aus backend/):
 *   /Users/andreasbachmann/.bun/bin/bun run src/apps/wzbar-matcher/catalog-builder.ts
 *   /Users/andreasbachmann/.bun/bin/bun run src/apps/wzbar-matcher/catalog-builder.ts --catalog-only
 *   /Users/andreasbachmann/.bun/bin/bun run src/apps/wzbar-matcher/catalog-builder.ts --force
 */

import { createHash } from 'node:crypto';
import { llmService } from '../../services/llm';
import { getPlatformModel } from '../../config/platformModels';
import type { CatalogEntry, EmbeddingsIndex } from './types';

const CSV_PATH = '../docs/WZ2025-Schluesseltabelle.csv';
const CATALOG_PATH = './src/apps/wzbar-matcher/assets/catalog.json';
const EMBEDDINGS_PATH = './src/apps/wzbar-matcher/assets/embeddings.json';
const CONCURRENCY = 8;
const VALID_FROM = '2025-01-01'; // WZ 2025 gültig ab

const args = process.argv.slice(2);
const catalogOnly = args.includes('--catalog-only');
const force = args.includes('--force');

function hashText(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

function embedText(entry: { kurztext: string; langtext: string }): string {
  if (entry.langtext && entry.langtext !== entry.kurztext) {
    return `${entry.kurztext}. ${entry.langtext}`;
  }
  return entry.kurztext;
}

async function buildCatalog(): Promise<{ catalog: CatalogEntry[]; hash: string }> {
  const csvFile = Bun.file(CSV_PATH);
  if (!(await csvFile.exists())) {
    throw new Error(`CSV nicht gefunden: ${CSV_PATH}`);
  }
  // Quelle ist Latin-1 (cp1252) kodiert — Umlaute sonst kaputt.
  const raw = new TextDecoder('latin1').decode(new Uint8Array(await csvFile.arrayBuffer()));
  const lines = raw.split(/\r?\n/);
  const header = (lines.shift() ?? '').split(';').map((h) => h.trim());
  const iKey = header.indexOf('KEYTAB_KEY');
  const iKurz = header.indexOf('KEYTAB_KURZTEXT');
  const iLt1 = header.indexOf('KEYTAB_LANGTEXT_1');
  const iLt2 = header.indexOf('KEYTAB_LANGTEXT_2');
  if (iKey < 0 || iKurz < 0) {
    throw new Error(`Header nicht wie erwartet. Gefunden: ${header.join(', ')}`);
  }

  const catalog: CatalogEntry[] = [];
  const hashInputs: string[] = [];
  let skippedWrongLength = 0;
  const levelCounts: Record<string, number> = { '4': 0, '5': 0, '6': 0, '7': 0 };

  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = line.split(';');
    const code = (cols[iKey] ?? '').trim();
    if (!/^\d{4,7}$/.test(code)) {
      skippedWrongLength++;
      continue;
    }
    levelCounts[String(code.length)] = (levelCounts[String(code.length)] ?? 0) + 1;
    const kurztext = (cols[iKurz] ?? '').trim();
    const lt1 = iLt1 >= 0 ? (cols[iLt1] ?? '').trim() : '';
    const lt2 = iLt2 >= 0 ? (cols[iLt2] ?? '').trim() : '';
    const langtext = [lt1, lt2 && lt2 !== lt1 ? lt2 : ''].filter(Boolean).join(' — ') || kurztext;

    catalog.push({ code, kurztext, langtext, validFrom: VALID_FROM, validTo: null });
    hashInputs.push(`${code}|${kurztext}|${langtext}|${VALID_FROM}|`);
  }

  catalog.sort((a, b) => a.code.localeCompare(b.code));
  const hash = hashText(hashInputs.slice().sort().join('\n'));

  console.log(`[catalog-builder] CSV → ${catalog.length} Einträge (4-7 stellig). Verteilung: 4=${levelCounts['4']}, 5=${levelCounts['5']}, 6=${levelCounts['6']}, 7=${levelCounts['7']}. Übersprungen (ausserhalb 4-7 Stellen): ${skippedWrongLength}.`);
  return { catalog, hash };
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

/**
 * Lädt aus dem bestehenden catalog.json + embeddings.json eine Map
 * embedText → Vektor, um unveränderte Einträge nicht neu embedden zu müssen.
 * Nur gültig, wenn das gespeicherte Modell dem aktuellen entspricht.
 */
async function loadReusableVectors(currentModel: string): Promise<Map<string, number[]>> {
  const byText = new Map<string, number[]>();
  if (force) return byText;
  try {
    const prevEmb = JSON.parse(await Bun.file(EMBEDDINGS_PATH).text()) as EmbeddingsIndex;
    if (prevEmb.model !== currentModel) return byText;
    const prevCat = JSON.parse(await Bun.file(CATALOG_PATH).text()) as CatalogEntry[];
    const vecByCode = new Map(prevEmb.entries.map((e) => [e.code, e.vector]));
    for (const e of prevCat) {
      const v = vecByCode.get(e.code);
      if (v) byText.set(embedText(e), v);
    }
  } catch {
    /* kein/kaputter Vorlauf — dann eben alles neu embedden */
  }
  return byText;
}

async function buildEmbeddings(
  catalog: CatalogEntry[],
  inputHash: string,
  reuseByText: Map<string, number[]>,
  modelId: string,
): Promise<EmbeddingsIndex> {
  const entries: Array<{ code: string; vector: number[] }> = new Array(catalog.length);
  const toEmbed: Array<{ idx: number; entry: CatalogEntry }> = [];
  let reused = 0;

  catalog.forEach((entry, idx) => {
    const v = reuseByText.get(embedText(entry));
    if (v) {
      entries[idx] = { code: entry.code, vector: v };
      reused++;
    } else {
      toEmbed.push({ idx, entry });
    }
  });
  console.log(`[catalog-builder] Embeddings: ${reused} wiederverwendet, ${toEmbed.length} neu zu erzeugen.`);

  let done = 0;
  const started = Date.now();
  await pLimit(toEmbed, CONCURRENCY, async ({ idx, entry }) => {
    const vector = await llmService.embed(embedText(entry));
    entries[idx] = { code: entry.code, vector };
    done++;
    if (done % 25 === 0 || done === toEmbed.length) {
      const rate = done / ((Date.now() - started) / 1000);
      console.log(`[catalog-builder] Neue Embeddings: ${done}/${toEmbed.length} (${rate.toFixed(1)}/s)`);
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
  // Embedding-Modell zuerst aufloesen — bestimmt, ob Vektoren wiederverwendbar sind.
  const resolved = catalogOnly ? null : await getPlatformModel('embeddings');
  const modelId = resolved?.model.id ?? '';
  const reuseByText = catalogOnly ? new Map<string, number[]>() : await loadReusableVectors(modelId);

  // Catalog bauen (danach ist catalog.json überschrieben — Reuse-Map ist schon geladen).
  const { catalog, hash } = await buildCatalog();
  await Bun.write(CATALOG_PATH, JSON.stringify(catalog, null, 2));
  console.log(`[catalog-builder] ${CATALOG_PATH} geschrieben.`);

  if (catalogOnly) {
    console.log('[catalog-builder] --catalog-only: Embeddings übersprungen.');
    return;
  }
  if (!resolved) throw new Error('Kein Embedding-Modell konfiguriert.');

  // Skip nur wenn Hash + Anzahl exakt passen (nichts geändert).
  const existing = Bun.file(EMBEDDINGS_PATH);
  if (!force && (await existing.exists())) {
    try {
      const prev = JSON.parse(await existing.text()) as EmbeddingsIndex;
      if (prev.inputHash === hash && prev.entries.length === catalog.length && prev.model === modelId) {
        console.log('[catalog-builder] Embeddings bereits aktuell (Hash stimmt). Überspringe. (--force zum Erzwingen)');
        return;
      }
    } catch {
      /* fall through */
    }
  }

  const index = await buildEmbeddings(catalog, hash, reuseByText, modelId);
  await Bun.write(EMBEDDINGS_PATH, JSON.stringify(index));
  console.log(`[catalog-builder] ${EMBEDDINGS_PATH} geschrieben (model=${index.model}, dim=${index.dimensions}, entries=${index.entries.length}).`);
}

main().catch((err) => {
  console.error('[catalog-builder] Fehler:', err);
  process.exit(1);
});
