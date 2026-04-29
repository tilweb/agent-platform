/**
 * Extraction Profiles — Postgres-backed (Drizzle).
 *
 * Frueher YAML-Files unter data/extraction-profiles/, jetzt
 * `extraction.profiles`. In-Memory-Cache (5 min TTL) fuer hot-path
 * (auto-detect bei jedem Upload).
 */

import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { extractionProfiles } from '../db/schema/extraction';
import type { ExtractionProfile } from './types';

let profileCache: Map<string, ExtractionProfile> = new Map();
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

function rowToProfile(row: typeof extractionProfiles.$inferSelect): ExtractionProfile {
  // Profile-Stammdaten in Spalten + jsonb-Felder. fields/guidelines sind eigene
  // Spalten; alles andere (detection, version, etc.) in metadata-jsonb.
  const meta = (row.metadata ?? {}) as Partial<ExtractionProfile>;
  return {
    ...meta,
    id: row.id,
    name: row.name,
    fields: row.fields as ExtractionProfile['fields'],
    guidelines: row.guidelines ?? undefined,
  } as ExtractionProfile;
}

export async function loadProfiles(): Promise<void> {
  const db = getDb();
  const rows = await db.select().from(extractionProfiles);
  profileCache.clear();
  for (const row of rows) {
    const profile = rowToProfile(row);
    profileCache.set(profile.id, profile);
  }
  cacheLoadedAt = Date.now();
  console.log(`[Extraction] Loaded ${profileCache.size} extraction profiles`);
}

async function ensureCache(): Promise<void> {
  if (Date.now() - cacheLoadedAt > CACHE_TTL_MS) {
    await loadProfiles();
  }
}

export async function getAllProfiles(): Promise<ExtractionProfile[]> {
  await ensureCache();
  return Array.from(profileCache.values());
}

export async function getProfile(id: string): Promise<ExtractionProfile | null> {
  await ensureCache();
  return profileCache.get(id) || null;
}

export async function saveProfile(profile: ExtractionProfile): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.insert(extractionProfiles).values({
    id: profile.id,
    ownerId: (profile as { ownerId?: string }).ownerId ?? null,
    name: profile.name,
    fields: profile.fields as never,
    guidelines: profile.guidelines ?? null,
    metadata: profile as never,
    createdAt: now,
    updatedAt: now,
  } as typeof extractionProfiles.$inferInsert).onConflictDoUpdate({
    target: extractionProfiles.id,
    set: {
      name: profile.name,
      fields: profile.fields as never,
      guidelines: profile.guidelines ?? null,
      metadata: profile as never,
      updatedAt: now,
    },
  });
  profileCache.set(profile.id, profile);
}

export async function deleteProfile(id: string): Promise<boolean> {
  const db = getDb();
  const res = await db.delete(extractionProfiles).where(eq(extractionProfiles.id, id)).returning({ id: extractionProfiles.id });
  if (res.length === 0) return false;
  profileCache.delete(id);
  return true;
}

export async function detectProfile(text: string): Promise<ExtractionProfile | null> {
  await ensureCache();
  const sample = text.substring(0, 3000).toLowerCase();
  let bestMatch: ExtractionProfile | null = null;
  let bestScore = 0;
  for (const profile of profileCache.values()) {
    const keywords = profile.detection?.keywords || [];
    if (keywords.length === 0) continue;
    let score = 0;
    for (const keyword of keywords) {
      if (sample.includes(keyword.toLowerCase())) score++;
    }
    const normalizedScore = score / keywords.length;
    if (normalizedScore > bestScore && score >= 2) {
      bestScore = normalizedScore;
      bestMatch = profile;
    }
  }
  return bestMatch;
}
