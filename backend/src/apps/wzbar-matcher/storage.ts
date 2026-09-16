/**
 * WZ-Branchen-Matcher Storage — Postgres-backed (matches) + Image-Asset (catalog/embeddings).
 *
 * Catalog + Embeddings bleiben Build-Time-Assets im Image (`backend/src/apps/
 * wzbar-matcher/assets/`). Nur das Audit-Log der Matches wandert in die DB.
 */

import { and, eq, desc } from 'drizzle-orm';
import { getDb } from '../../db';
import { wzbarMatches } from '../../db/schema/wzbar';
import type { AliasIndex, AliasMeta, CatalogEntry, EmbeddingsIndex, MatchRecord, MultiMatchResult, RetrievalHit } from './types';

const ASSETS_PATH = './src/apps/wzbar-matcher/assets';
const CATALOG_PATH = `${ASSETS_PATH}/catalog.json`;
const EMBEDDINGS_PATH = `${ASSETS_PATH}/embeddings.json`;
export const ALIAS_META_PATH = `${ASSETS_PATH}/alias-embeddings.meta.json`;
export const ALIAS_BIN_PATH = `${ASSETS_PATH}/alias-embeddings.bin`;

let catalogCache: CatalogEntry[] | null = null;
let embeddingsCache: EmbeddingsIndex | null = null;
let aliasCache: AliasIndex | null | undefined; // undefined = noch nicht geladen, null = nicht vorhanden

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

/**
 * Alias-Index (M4) — optional: fehlt die Datei, laeuft das Retrieval ohne
 * Aliase weiter. Vektoren liegen als Float32-Binaerdatei neben der Meta-JSON.
 */
export async function loadAliasIndex(): Promise<AliasIndex | null> {
  if (aliasCache !== undefined) return aliasCache;
  const metaFile = Bun.file(ALIAS_META_PATH);
  const binFile = Bun.file(ALIAS_BIN_PATH);
  if (!(await metaFile.exists()) || !(await binFile.exists())) {
    aliasCache = null;
    return aliasCache;
  }
  try {
    const meta = JSON.parse(await metaFile.text()) as AliasMeta;
    const vectors = new Float32Array(await binFile.arrayBuffer());
    if (vectors.length !== meta.entries.length * meta.dimensions) {
      console.error(`[wzbar-matcher] Alias-Index inkonsistent (${vectors.length} Werte, erwartet ${meta.entries.length * meta.dimensions}) — ignoriere Aliase.`);
      aliasCache = null;
      return aliasCache;
    }
    aliasCache = { ...meta, vectors };
  } catch (error) {
    console.error('[wzbar-matcher] Alias-Index konnte nicht geladen werden — ignoriere Aliase:', error);
    aliasCache = null;
  }
  return aliasCache;
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

function normalizeResult(raw: unknown, inputText: string): MultiMatchResult {
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray((obj as { activities?: unknown }).activities)) {
      return obj as unknown as MultiMatchResult;
    }
    // Legacy single-match record: { primary, alternatives }
    if ((obj as { primary?: unknown }).primary) {
      return {
        activities: [
          {
            activity: inputText,
            result: obj as unknown as MultiMatchResult['activities'][number]['result'],
            retrievalTopK: [],
          },
        ],
      };
    }
  }
  return { activities: [] };
}

function rowToRecord(row: typeof wzbarMatches.$inferSelect): MatchRecord {
  return {
    id: row.id,
    createdAt: row.createdAt,
    userId: row.userId ?? 'user_default',
    inputText: row.inputText,
    result: normalizeResult(row.result, row.inputText),
    retrievalTopK: (row.retrievalTopK ?? []) as RetrievalHit[],
    llmModel: row.llmModel ?? '',
    embeddingModel: row.embeddingModel ?? '',
    durationMs: row.durationMs ?? 0,
    inputHash: row.inputHash ?? undefined,
    pipelineVersion: row.pipelineVersion ?? undefined,
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
    inputHash: record.inputHash,
    pipelineVersion: record.pipelineVersion,
    createdAt: record.createdAt,
  });
}

/**
 * Ergebnis-Cache: juengster Match mit gleichem Input-Hash und gleicher
 * Pipeline-Version. Leere Ergebnisse (0 Activities) werden nie
 * wiederverwendet.
 */
export async function findCachedMatch(inputHash: string, pipelineVersion: string): Promise<MatchRecord | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(wzbarMatches)
    .where(and(eq(wzbarMatches.inputHash, inputHash), eq(wzbarMatches.pipelineVersion, pipelineVersion)))
    .orderBy(desc(wzbarMatches.createdAt))
    .limit(1);
  if (!rows[0]) return null;
  const record = rowToRecord(rows[0]);
  return record.result.activities.length > 0 ? record : null;
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
  aliasCache = undefined;
}
