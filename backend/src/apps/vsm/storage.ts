/**
 * VSM Storage — Postgres-backed (Drizzle).
 * Komplette Diagramm-Daten als jsonb in `vsm.projekte.data`.
 */

import { eq, desc } from 'drizzle-orm';
import { getDb } from '../../db';
import { vsmProjekte } from '../../db/schema/vsm';
import type { VsmProjekt } from './types';

export function generateProjektId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `vsm-${timestamp}-${random}`;
}

const SAFE_ID_PATTERN = /^[a-z0-9\-_]+$/;
export function validateId(id: string): boolean {
  return SAFE_ID_PATTERN.test(id) && id.length <= 64;
}

function rowToProjekt(row: typeof vsmProjekte.$inferSelect): VsmProjekt {
  // Komplette VSM-Struktur lebt im jsonb-data-Feld; Stammdaten in DB-Spalten.
  const data = (row.data ?? {}) as Partial<VsmProjekt>;
  return {
    ...data,
    id: row.id,
    name: row.name,
    updated_at: row.updatedAt,
    created_at: row.createdAt,
  } as VsmProjekt;
}

export async function getProjekte(): Promise<VsmProjekt[]> {
  const db = getDb();
  const rows = await db.select().from(vsmProjekte).orderBy(desc(vsmProjekte.updatedAt));
  return rows.map(rowToProjekt);
}

export async function getProjekt(id: string): Promise<VsmProjekt | null> {
  if (!validateId(id)) return null;
  const db = getDb();
  const rows = await db.select().from(vsmProjekte).where(eq(vsmProjekte.id, id)).limit(1);
  return rows[0] ? rowToProjekt(rows[0]) : null;
}

export async function saveProjekt(projekt: VsmProjekt): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.insert(vsmProjekte).values({
    id: projekt.id,
    ownerId: (projekt as { ownerId?: string }).ownerId ?? null,
    name: projekt.name,
    data: projekt as never,
    createdAt: projekt.created_at ?? now,
    updatedAt: projekt.updated_at ?? now,
  }).onConflictDoUpdate({
    target: vsmProjekte.id,
    set: {
      name: projekt.name,
      data: projekt as never,
      updatedAt: projekt.updated_at ?? now,
    },
  });
}

export async function deleteProjekt(id: string): Promise<boolean> {
  if (!validateId(id)) return false;
  const db = getDb();
  const res = await db.delete(vsmProjekte).where(eq(vsmProjekte.id, id)).returning({ id: vsmProjekte.id });
  return res.length > 0;
}
