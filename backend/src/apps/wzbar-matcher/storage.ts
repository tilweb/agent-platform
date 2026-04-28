/**
 * WZ-Branchen-Matcher Storage — Postgres-backed (matches) + Image-Asset (catalog/embeddings).
 *
 * Catalog + Embeddings bleiben Build-Time-Assets im Image (`backend/src/apps/
 * wzbar-matcher/assets/`). Nur das Audit-Log der Matches wandert in die DB.
 */

import { eq, desc } from 'drizzle-orm';
import { getDb } from '../../db';
import { wzbarMatches } from '../../db/schema/wzbar';
import type { CatalogEntry, EmbeddingsIndex, MatchRecord } from './types';

const ASSETS_PATH = './src/apps/wzbar-matcher/assets';
const CATALOG_PATH = `${ASSETS_PATH}/catalog.json`;
const EMBEDDINGS_PATH = `${ASSETS_PATH}/embeddings.json`;

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

function rowToRecord(row: typeof wzbarMatches.$inferSelect): MatchRecord {
  return {
    id: row.id,
    createdAt: row.createdAt,
    userId: row.userId ?? 'user_default',
    inputText: row.inputText,
    result: row.result as MatchRecord['result'],
    retrievalTopK: (row.retrievalTopK ?? []) as MatchRecord['retrievalTopK'],
    llmModel: row.llmModel ?? '',
    embeddingModel: row.embeddingModel ?? '',
    durationMs: row.durationMs ?? 0,
  };
}

export async function saveMatch(record: MatchRecord): Promise<void> {
  const db = getDb();
  await db.insert(wzbarMatches).values({
    id: record.id,
    userId: record.userId,
    inputText: record.inputText,
    result: record.result as never,
    retrievalTopK: record.retrievalTopK as never,
    llmModel: record.llmModel,
    embeddingModel: record.embeddingModel,
    durationMs: record.durationMs,
    createdAt: record.createdAt,
  });
}

export async function getMatch(id: string): Promise<MatchRecord | null> {
  const db = getDb();
  const rows = await db.select().from(wzbarMatches).where(eq(wzbarMatches.id, id)).limit(1);
  return rows[0] ? rowToRecord(rows[0]) : null;
}

export async function listMatches(limit = 50): Promise<MatchRecord[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(wzbarMatches)
    .orderBy(desc(wzbarMatches.createdAt))
    .limit(limit);
  return rows.map(rowToRecord);
}

export function invalidateCaches(): void {
  catalogCache = null;
  embeddingsCache = null;
}
