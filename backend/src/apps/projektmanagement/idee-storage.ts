/**
 * Projektidee Storage — Postgres-backed (Drizzle).
 *
 * Komplette Idee-Daten als jsonb in `projektmgmt.projektideen.data`.
 * Auftrag-Verknuepfung ueber `paProjektauftraege.ideeId` (FK) — die
 * `abgeleitete_auftraege`-Liste wird beim Lesen via JOIN angereichert.
 */

import { eq, desc } from 'drizzle-orm';
import { getDb } from '../../db';
import { paProjektideen, paProjektauftraege } from '../../db/schema/projektmgmt';
import type { Projektidee } from './types';

export function generateProjektideeId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `idee-${timestamp}-${random}`;
}

function rowToIdee(row: typeof paProjektideen.$inferSelect): Projektidee {
  const data = (row.data ?? {}) as Partial<Projektidee>;
  return {
    ...data,
    id: row.id,
    name: row.name,
    status: (row.status as Projektidee['status']) ?? 'draft',
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  } as Projektidee;
}

async function loadAbgeleiteteAuftraege(ideeId: string): Promise<Projektidee['abgeleitete_auftraege']> {
  const db = getDb();
  const rows = await db
    .select({
      id: paProjektauftraege.id,
      name: paProjektauftraege.name,
      status: paProjektauftraege.status,
      createdAt: paProjektauftraege.createdAt,
    })
    .from(paProjektauftraege)
    .where(eq(paProjektauftraege.ideeId, ideeId))
    .orderBy(desc(paProjektauftraege.createdAt));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    created_at: r.createdAt,
  }));
}

export async function getProjektideen(): Promise<Projektidee[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(paProjektideen)
    .orderBy(desc(paProjektideen.updatedAt));
  return rows.map(rowToIdee);
}

export async function getProjektidee(id: string): Promise<Projektidee | null> {
  const db = getDb();
  const rows = await db.select().from(paProjektideen).where(eq(paProjektideen.id, id)).limit(1);
  if (!rows[0]) return null;
  const idee = rowToIdee(rows[0]);
  idee.abgeleitete_auftraege = await loadAbgeleiteteAuftraege(id);
  return idee;
}

export async function saveProjektidee(idee: Projektidee): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  // abgeleitete_auftraege werden nicht in `data` gespeichert — das ist nur eine
  // Lese-Anreicherung. Strippe es vor dem Schreiben.
  const { abgeleitete_auftraege: _ignore, ...dataToStore } = idee;
  void _ignore;
  await db.insert(paProjektideen).values({
    id: idee.id,
    ownerId: (idee as { ownerId?: string }).ownerId ?? null,
    name: idee.name,
    status: idee.status ?? 'draft',
    data: dataToStore as never,
    createdAt: idee.created_at ?? now,
    updatedAt: idee.updated_at ?? now,
  }).onConflictDoUpdate({
    target: paProjektideen.id,
    set: {
      name: idee.name,
      status: idee.status ?? 'draft',
      data: dataToStore as never,
      updatedAt: idee.updated_at ?? now,
    },
  });
}

export async function updateProjektidee(
  id: string,
  updates: Partial<Projektidee>,
): Promise<Projektidee | null> {
  const existing = await getProjektidee(id);
  if (!existing) return null;
  const merged: Projektidee = {
    ...existing,
    ...updates,
    id,
    updated_at: new Date().toISOString(),
  } as Projektidee;
  await saveProjektidee(merged);
  return getProjektidee(id);
}

export async function deleteProjektidee(id: string): Promise<boolean> {
  const db = getDb();
  // Auftraege bleiben bestehen, ihre idee_id wird auf NULL gesetzt damit kein
  // Dangling-FK entsteht. Idee-Loeschung verwirft die Hypothese, der daraus
  // entstandene Auftrag verliert nur seinen Ursprungs-Verweis.
  await db.update(paProjektauftraege)
    .set({ ideeId: null })
    .where(eq(paProjektauftraege.ideeId, id));
  const res = await db.delete(paProjektideen)
    .where(eq(paProjektideen.id, id))
    .returning({ id: paProjektideen.id });
  return res.length > 0;
}
