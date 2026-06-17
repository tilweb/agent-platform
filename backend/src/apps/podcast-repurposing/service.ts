/**
 * Podcast-Repurposing — DB-Zugriffs-Layer (Drizzle, Schema `podcast_repurposing`).
 */

import { randomUUID } from 'crypto';
import { eq, desc, asc } from 'drizzle-orm';
import { getDb } from '../../db';
import {
  prEpisodes,
  prOutputs,
  prVisuals,
  prFormats,
  prBrandIdentities,
  prPublications,
} from '../../db/schema/podcast-repurposing';

export type EpisodeRow = typeof prEpisodes.$inferSelect;
export type OutputRow = typeof prOutputs.$inferSelect;
export type VisualRow = typeof prVisuals.$inferSelect;
export type FormatRow = typeof prFormats.$inferSelect;
export type PublicationRow = typeof prPublications.$inferSelect;

/** Singleton-Marken-Identität (geteilte Service-Identität fürs Publishing). */
export const BRAND_ID = 'default';

function genId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

function now(): string {
  return new Date().toISOString();
}

/* ----------------------------- Episodes ----------------------------- */

export async function createEpisode(userId: string, title: string): Promise<EpisodeRow> {
  const db = getDb();
  const id = genId('pr_ep');
  const ts = now();
  const [row] = await db
    .insert(prEpisodes)
    .values({
      id,
      userId,
      title: title || 'Untitled Episode',
      status: 'uploaded',
      pipelineSteps: [],
      createdAt: ts,
      updatedAt: ts,
    })
    .returning();
  return row!;
}

export async function getEpisode(id: string): Promise<EpisodeRow | null> {
  const db = getDb();
  const rows = await db.select().from(prEpisodes).where(eq(prEpisodes.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listEpisodesForUser(userId: string): Promise<EpisodeRow[]> {
  const db = getDb();
  return db
    .select()
    .from(prEpisodes)
    .where(eq(prEpisodes.userId, userId))
    .orderBy(desc(prEpisodes.createdAt));
}

export async function updateEpisode(
  id: string,
  patch: Partial<Omit<EpisodeRow, 'id' | 'createdAt'>>,
): Promise<void> {
  const db = getDb();
  await db
    .update(prEpisodes)
    .set({ ...patch, updatedAt: now() })
    .where(eq(prEpisodes.id, id));
}

export async function getEpisodeDetail(
  id: string,
): Promise<{ episode: EpisodeRow; outputs: OutputRow[]; visuals: VisualRow[]; publications: PublicationRow[] } | null> {
  const episode = await getEpisode(id);
  if (!episode) return null;
  const db = getDb();
  const [outputs, visuals, publications] = await Promise.all([
    db.select().from(prOutputs).where(eq(prOutputs.episodeId, id)).orderBy(asc(prOutputs.kind), asc(prOutputs.variant)),
    db.select().from(prVisuals).where(eq(prVisuals.episodeId, id)).orderBy(asc(prVisuals.role)),
    db.select().from(prPublications).where(eq(prPublications.episodeId, id)).orderBy(desc(prPublications.createdAt)),
  ]);
  return { episode, outputs, visuals, publications };
}

/* ----------------------------- Outputs ------------------------------ */

export async function insertOutput(data: {
  episodeId: string;
  kind: string;
  platform?: string | null;
  variant?: number;
  formatId: string;
  title?: string | null;
  content?: string;
  fields?: unknown;
  status?: string;
  modelUsed?: string | null;
  error?: string | null;
}): Promise<OutputRow> {
  const db = getDb();
  const ts = now();
  const [row] = await db
    .insert(prOutputs)
    .values({
      id: genId('pr_out'),
      episodeId: data.episodeId,
      kind: data.kind,
      platform: data.platform ?? null,
      variant: data.variant ?? 0,
      formatId: data.formatId,
      title: data.title ?? null,
      content: data.content ?? '',
      fields: (data.fields ?? null) as never,
      status: data.status ?? 'generated',
      modelUsed: data.modelUsed ?? null,
      error: data.error ?? null,
      createdAt: ts,
      updatedAt: ts,
    })
    .returning();
  return row!;
}

export async function getOutput(id: string): Promise<OutputRow | null> {
  const db = getDb();
  const rows = await db.select().from(prOutputs).where(eq(prOutputs.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function updateOutput(
  id: string,
  patch: Partial<Omit<OutputRow, 'id' | 'episodeId' | 'createdAt'>>,
): Promise<OutputRow | null> {
  const db = getDb();
  const [row] = await db
    .update(prOutputs)
    .set({ ...patch, updatedAt: now() })
    .where(eq(prOutputs.id, id))
    .returning();
  return row ?? null;
}

/* ----------------------------- Visuals ------------------------------ */

export async function insertVisual(data: {
  episodeId: string;
  role: string;
  aspectRatio: string;
  imageId?: string | null;
  prompt?: string | null;
  status?: string;
  error?: string | null;
}): Promise<VisualRow> {
  const db = getDb();
  const ts = now();
  const [row] = await db
    .insert(prVisuals)
    .values({
      id: genId('pr_vis'),
      episodeId: data.episodeId,
      role: data.role,
      aspectRatio: data.aspectRatio,
      imageId: data.imageId ?? null,
      prompt: data.prompt ?? null,
      status: data.status ?? 'generated',
      error: data.error ?? null,
      createdAt: ts,
      updatedAt: ts,
    })
    .returning();
  return row!;
}

export async function getVisual(id: string): Promise<VisualRow | null> {
  const db = getDb();
  const rows = await db.select().from(prVisuals).where(eq(prVisuals.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function updateVisual(
  id: string,
  patch: Partial<Omit<VisualRow, 'id' | 'episodeId' | 'createdAt'>>,
): Promise<VisualRow | null> {
  const db = getDb();
  const [row] = await db
    .update(prVisuals)
    .set({ ...patch, updatedAt: now() })
    .where(eq(prVisuals.id, id))
    .returning();
  return row ?? null;
}

/* ----------------------------- Formats ------------------------------ */

export async function listFormats(opts?: { enabledOnly?: boolean }): Promise<FormatRow[]> {
  const db = getDb();
  const rows = await db.select().from(prFormats).orderBy(asc(prFormats.sortOrder));
  return opts?.enabledOnly ? rows.filter((r) => r.enabled) : rows;
}

export async function getFormat(id: string): Promise<FormatRow | null> {
  const db = getDb();
  const rows = await db.select().from(prFormats).where(eq(prFormats.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function updateFormat(
  id: string,
  patch: Partial<Omit<FormatRow, 'id' | 'createdAt'>>,
): Promise<FormatRow | null> {
  const db = getDb();
  const [row] = await db
    .update(prFormats)
    .set({ ...patch, updatedAt: now() })
    .where(eq(prFormats.id, id))
    .returning();
  return row ?? null;
}

/* ------------------------- Brand settings --------------------------- */

/** Liefert die (entschlüsselt nutzbaren) Marken-Settings als rohes JSON-Objekt. */
export async function getBrandSettings(): Promise<Record<string, any>> {
  const db = getDb();
  const rows = await db.select().from(prBrandIdentities).where(eq(prBrandIdentities.id, BRAND_ID)).limit(1);
  return (rows[0]?.settings as Record<string, any>) ?? {};
}

/** Speichert die Marken-Settings (Upsert auf die Singleton-Marke). */
export async function saveBrandSettings(settings: Record<string, any>): Promise<void> {
  const db = getDb();
  await db
    .insert(prBrandIdentities)
    .values({ id: BRAND_ID, label: 'Marke', settings: settings as never, createdAt: now() })
    .onConflictDoUpdate({ target: prBrandIdentities.id, set: { settings: settings as never } });
}

/* -------------------------- Publications ---------------------------- */

export async function insertPublication(data: {
  episodeId: string;
  platform: string;
  status?: string;
  externalId?: string | null;
  externalUrl?: string | null;
  error?: string | null;
}): Promise<PublicationRow> {
  const db = getDb();
  const ts = now();
  const [row] = await db
    .insert(prPublications)
    .values({
      id: genId('pr_pub'),
      episodeId: data.episodeId,
      platform: data.platform,
      status: data.status ?? 'pending',
      externalId: data.externalId ?? null,
      externalUrl: data.externalUrl ?? null,
      error: data.error ?? null,
      createdAt: ts,
      updatedAt: ts,
    })
    .returning();
  return row!;
}

export async function updatePublication(
  id: string,
  patch: Partial<Omit<PublicationRow, 'id' | 'episodeId' | 'createdAt'>>,
): Promise<PublicationRow | null> {
  const db = getDb();
  const [row] = await db
    .update(prPublications)
    .set({ ...patch, updatedAt: now() })
    .where(eq(prPublications.id, id))
    .returning();
  return row ?? null;
}

export async function listPublications(episodeId: string): Promise<PublicationRow[]> {
  const db = getDb();
  return db
    .select()
    .from(prPublications)
    .where(eq(prPublications.episodeId, episodeId))
    .orderBy(desc(prPublications.createdAt));
}
