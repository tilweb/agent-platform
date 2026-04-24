/**
 * WZ-Branchen-Matcher Storage
 */

import { parse, stringify } from 'yaml';
import type { CatalogEntry, EmbeddingsIndex, MatchRecord } from './types';

// System-Assets (catalog + embeddings) werden mit dem Container-Image ausgeliefert
// und NICHT im Daten-Volume gespeichert. Nur matches/ liegt im Volume (Audit-Trail).
const ASSETS_PATH = './src/apps/wzbar-matcher/assets';
const DATA_PATH = './data/apps/wzbar-matcher';
const CATALOG_PATH = `${ASSETS_PATH}/catalog.json`;
const EMBEDDINGS_PATH = `${ASSETS_PATH}/embeddings.json`;
const MATCHES_PATH = `${DATA_PATH}/matches`;

let catalogCache: CatalogEntry[] | null = null;
let embeddingsCache: EmbeddingsIndex | null = null;

export async function loadCatalog(): Promise<CatalogEntry[]> {
  if (catalogCache) return catalogCache;
  const file = Bun.file(CATALOG_PATH);
  if (!(await file.exists())) {
    throw new Error(`Katalog nicht gefunden: ${CATALOG_PATH}. Bitte catalog-builder.ts ausführen.`);
  }
  const content = await file.text();
  catalogCache = JSON.parse(content) as CatalogEntry[];
  return catalogCache;
}

export async function loadEmbeddings(): Promise<EmbeddingsIndex> {
  if (embeddingsCache) return embeddingsCache;
  const file = Bun.file(EMBEDDINGS_PATH);
  if (!(await file.exists())) {
    throw new Error(`Embeddings nicht gefunden: ${EMBEDDINGS_PATH}. Bitte catalog-builder.ts ausführen.`);
  }
  const content = await file.text();
  embeddingsCache = JSON.parse(content) as EmbeddingsIndex;
  return embeddingsCache;
}

export async function isIndexReady(): Promise<boolean> {
  const catalog = Bun.file(CATALOG_PATH);
  const emb = Bun.file(EMBEDDINGS_PATH);
  return (await catalog.exists()) && (await emb.exists());
}

export function generateMatchId(): string {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).substring(2, 8);
  return `match-${ts}-${rnd}`;
}

export async function saveMatch(record: MatchRecord): Promise<void> {
  await Bun.write(`${MATCHES_PATH}/${record.id}.yaml`, stringify(record));
}

export async function getMatch(id: string): Promise<MatchRecord | null> {
  const file = Bun.file(`${MATCHES_PATH}/${id}.yaml`);
  if (!(await file.exists())) return null;
  const content = await file.text();
  return parse(content) as MatchRecord;
}

export async function listMatches(limit = 50): Promise<MatchRecord[]> {
  const records: MatchRecord[] = [];
  const glob = new Bun.Glob('*.yaml');
  try {
    const files: Array<{ path: string; mtime: number }> = [];
    for await (const name of glob.scan(MATCHES_PATH)) {
      const path = `${MATCHES_PATH}/${name}`;
      const file = Bun.file(path);
      files.push({ path, mtime: file.lastModified });
    }
    files.sort((a, b) => b.mtime - a.mtime);
    for (const { path } of files.slice(0, limit)) {
      const content = await Bun.file(path).text();
      records.push(parse(content) as MatchRecord);
    }
  } catch {
    // no matches yet
  }
  return records;
}

export function invalidateCaches(): void {
  catalogCache = null;
  embeddingsCache = null;
}
