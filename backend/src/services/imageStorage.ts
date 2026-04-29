/**
 * Image Storage — Postgres-Metadata + Flow.swiss-S3-Binary.
 *
 * Frueher: Datei + JSON-Sidecar in `data/generated-images/`.
 * Jetzt: Binary in S3 unter `s3Paths.generatedImage(id, ext)`,
 * Metadata-Row in `generated.images`.
 */

import { eq, desc, and } from 'drizzle-orm';
import { getDb } from '../db';
import { generatedImages } from '../db/schema/generated';
import { putObject, getObject, deleteObject } from '../storage/s3';
import { s3Paths } from '../storage/paths';

export interface SavedImageMetadata {
  id: string;
  prompt: string;
  mimeType: string;
  width: number;
  height: number;
  provider: string;
  model: string;
  createdAt: string;
  sessionId?: string;
  revisedPrompt?: string;
}

function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  return map[mimeType] || 'png';
}

interface DbMeta {
  ext: string;
  width: number;
  height: number;
  sessionId?: string;
  revisedPrompt?: string;
  mimeType: string;
}

function rowToMetadata(row: typeof generatedImages.$inferSelect): SavedImageMetadata {
  const meta = (row.metadata ?? {}) as Partial<DbMeta>;
  return {
    id: row.id,
    prompt: row.prompt ?? '',
    mimeType: row.contentType,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    provider: row.providerId ?? '',
    model: row.modelId ?? '',
    createdAt: row.createdAt,
    sessionId: meta.sessionId,
    revisedPrompt: meta.revisedPrompt,
  };
}

export async function saveGeneratedImage(input: {
  id: string;
  base64Data: string;
  mimeType: string;
  width: number;
  height: number;
  prompt: string;
  provider: string;
  model: string;
  sessionId?: string;
  revisedPrompt?: string;
}): Promise<{ id: string; url: string; path: string }> {
  const ext = getExtension(input.mimeType);
  const s3Key = s3Paths.generatedImage(input.id, ext);
  const buf = Buffer.from(input.base64Data, 'base64');
  await putObject(s3Key, buf, input.mimeType);

  const dbMeta: DbMeta = {
    ext,
    width: input.width,
    height: input.height,
    sessionId: input.sessionId,
    revisedPrompt: input.revisedPrompt,
    mimeType: input.mimeType,
  };
  const db = getDb();
  await db.insert(generatedImages).values({
    id: input.id,
    userId: input.sessionId ?? null,        // sessionId als grobe Owner-Heuristik (besser: separater userId-Param)
    prompt: input.prompt,
    providerId: input.provider,
    modelId: input.model,
    s3Key,
    contentType: input.mimeType,
    sizeBytes: buf.length,
    metadata: dbMeta as never,
  }).onConflictDoUpdate({
    target: generatedImages.id,
    set: {
      prompt: input.prompt,
      providerId: input.provider,
      modelId: input.model,
      s3Key,
      contentType: input.mimeType,
      sizeBytes: buf.length,
      metadata: dbMeta as never,
    },
  });

  return {
    id: input.id,
    url: `/api/images/generated/${input.id}`,
    path: s3Key,
  };
}

async function loadRow(id: string): Promise<typeof generatedImages.$inferSelect | null> {
  const db = getDb();
  const rows = await db.select().from(generatedImages).where(eq(generatedImages.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getGeneratedImage(id: string): Promise<Buffer | null> {
  const row = await loadRow(id);
  if (!row) return null;
  try {
    return await getObject(row.s3Key);
  } catch {
    return null;
  }
}

export async function getImageMetadata(id: string): Promise<SavedImageMetadata | null> {
  const row = await loadRow(id);
  return row ? rowToMetadata(row) : null;
}

export async function getImageMimeType(id: string): Promise<string | null> {
  const row = await loadRow(id);
  return row?.contentType ?? null;
}

export async function listGeneratedImages(options?: {
  sessionId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ images: SavedImageMetadata[]; total: number }> {
  const db = getDb();
  const rows = await db.select().from(generatedImages).orderBy(desc(generatedImages.createdAt));
  let images = rows.map(rowToMetadata);
  if (options?.sessionId) {
    images = images.filter(i => i.sessionId === options.sessionId);
  }
  const total = images.length;
  const offset = options?.offset ?? 0;
  const limit = options?.limit ?? 50;
  return { images: images.slice(offset, offset + limit), total };
}

export async function deleteGeneratedImage(id: string): Promise<boolean> {
  const row = await loadRow(id);
  if (!row) return false;
  try { await deleteObject(row.s3Key); } catch { /* ignore */ }
  const db = getDb();
  const res = await db.delete(generatedImages).where(eq(generatedImages.id, id)).returning({ id: generatedImages.id });
  return res.length > 0;
}
