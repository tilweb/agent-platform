/**
 * Echo-Loop Storage — Postgres (Drizzle). Domänen-Objekte als jsonb in `data`,
 * Identität/Filter als Spalten, `version` Optimistic-Locking (wie projektmgmt).
 */
import { eq, and, desc } from 'drizzle-orm';
import { getDb } from '../../db';
import { elKunden, elProzesse, elBaustaende, elArtefakte } from '../../db/schema/echoloop';
import type { Kunde, Prozess, Baustand } from './types';
import { VersionConflictError, checkVersion } from './concurrency';

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------- Kunde

function rowToKunde(row: typeof elKunden.$inferSelect): Kunde {
  const data = (row.data ?? {}) as Partial<Kunde>;
  return {
    ...data,
    id: row.id,
    name: row.name,
    ownerId: row.ownerId ?? undefined,
    permissions: row.permissions ?? undefined,
    version: row.version,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export async function listKunden(): Promise<Kunde[]> {
  const db = getDb();
  const rows = await db.select().from(elKunden).orderBy(desc(elKunden.updatedAt));
  return rows.map(rowToKunde);
}

export async function getKunde(id: string): Promise<Kunde | null> {
  const db = getDb();
  const rows = await db.select().from(elKunden).where(eq(elKunden.id, id)).limit(1);
  return rows[0] ? rowToKunde(rows[0]) : null;
}

export async function createKunde(input: { name: string; branche?: string; notizen?: string; ownerId?: string }): Promise<Kunde> {
  const db = getDb();
  const now = new Date().toISOString();
  const id = genId('kunde');
  const data = { branche: input.branche, notizen: input.notizen };
  await db.insert(elKunden).values({
    id, ownerId: input.ownerId ?? null, name: input.name,
    data: data as never, version: 1, createdAt: now, updatedAt: now,
  });
  return (await getKunde(id))!;
}

export async function updateKunde(
  id: string,
  updates: Partial<Kunde>,
  options: { expectedVersion?: number; force?: boolean } = {},
): Promise<Kunde | null> {
  const db = getDb();
  const existing = await getKunde(id);
  if (!existing) return null;
  checkVersion(existing, options.expectedVersion, !!options.force);
  const merged = { ...existing, ...updates, id, version: (existing.version ?? 1) + 1, updated_at: new Date().toISOString() };
  const { id: _i, name, ownerId, permissions, version, created_at, updated_at, ...data } = merged;
  void _i;
  const result = await db.update(elKunden)
    .set({ name, data: data as never, updatedAt: updated_at, version })
    .where(options.force || options.expectedVersion === undefined
      ? eq(elKunden.id, id)
      : and(eq(elKunden.id, id), eq(elKunden.version, options.expectedVersion)))
    .returning({ id: elKunden.id });
  if (result.length === 0) throw new VersionConflictError(await getKunde(id));
  return getKunde(id);
}

export async function deleteKunde(id: string): Promise<boolean> {
  const db = getDb();
  const r = await db.delete(elKunden).where(eq(elKunden.id, id)).returning({ id: elKunden.id });
  return r.length > 0;
}

// ---------------------------------------------------------------- Prozess

function rowToProzess(row: typeof elProzesse.$inferSelect): Prozess {
  const data = (row.data ?? {}) as Partial<Prozess>;
  return {
    ...data,
    id: row.id,
    kundeId: row.kundeId,
    name: row.name,
    emmaPlanNr: row.emmaPlanNr ?? undefined,
    ownerId: row.ownerId ?? undefined,
    permissions: row.permissions ?? undefined,
    version: row.version,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export async function listProzesse(kundeId?: string): Promise<Prozess[]> {
  const db = getDb();
  const rows = kundeId
    ? await db.select().from(elProzesse).where(eq(elProzesse.kundeId, kundeId)).orderBy(desc(elProzesse.updatedAt))
    : await db.select().from(elProzesse).orderBy(desc(elProzesse.updatedAt));
  return rows.map(rowToProzess);
}

export async function getProzess(id: string): Promise<Prozess | null> {
  const db = getDb();
  const rows = await db.select().from(elProzesse).where(eq(elProzesse.id, id)).limit(1);
  return rows[0] ? rowToProzess(rows[0]) : null;
}

export async function createProzess(input: {
  kundeId: string; name: string; emmaPlanNr?: string; beschreibung?: string; systeme?: string[]; ownerId?: string;
}): Promise<Prozess> {
  const db = getDb();
  const now = new Date().toISOString();
  const id = genId('prozess');
  const data = { beschreibung: input.beschreibung, systeme: input.systeme };
  await db.insert(elProzesse).values({
    id, kundeId: input.kundeId, ownerId: input.ownerId ?? null, name: input.name,
    emmaPlanNr: input.emmaPlanNr ?? null, data: data as never, version: 1, createdAt: now, updatedAt: now,
  });
  return (await getProzess(id))!;
}

export async function updateProzess(
  id: string,
  updates: Partial<Prozess>,
  options: { expectedVersion?: number; force?: boolean } = {},
): Promise<Prozess | null> {
  const db = getDb();
  const existing = await getProzess(id);
  if (!existing) return null;
  checkVersion(existing, options.expectedVersion, !!options.force);
  const merged = { ...existing, ...updates, id, version: (existing.version ?? 1) + 1, updated_at: new Date().toISOString() };
  const { id: _i, kundeId, name, emmaPlanNr, ownerId, permissions, version, created_at, updated_at, ...data } = merged;
  void _i; void kundeId;
  const result = await db.update(elProzesse)
    .set({ name, emmaPlanNr: emmaPlanNr ?? null, data: data as never, updatedAt: updated_at, version })
    .where(options.force || options.expectedVersion === undefined
      ? eq(elProzesse.id, id)
      : and(eq(elProzesse.id, id), eq(elProzesse.version, options.expectedVersion)))
    .returning({ id: elProzesse.id });
  if (result.length === 0) throw new VersionConflictError(await getProzess(id));
  return getProzess(id);
}

export async function deleteProzess(id: string): Promise<boolean> {
  const db = getDb();
  const r = await db.delete(elProzesse).where(eq(elProzesse.id, id)).returning({ id: elProzesse.id });
  return r.length > 0;
}

// ---------------------------------------------------------------- Baustand

function rowToBaustand(row: typeof elBaustaende.$inferSelect): Baustand {
  const data = (row.data ?? {}) as Partial<Baustand>;
  return {
    dimensionen: {} as Baustand['dimensionen'],
    befunde: [],
    kennzahlen: { gesamtRg: 0, rgStar: 0, rgq: 0, seQuotient: 0, limiter: [], notenZeile: '' },
    ...data,
    id: row.id,
    prozessId: row.prozessId,
    datum: row.datum,
    status: row.status as Baustand['status'],
    quelle: row.quelle ?? undefined,
    reviewerId: row.reviewerId ?? undefined,
    permissions: row.permissions ?? undefined,
    version: row.version,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export async function listBaustaende(prozessId: string): Promise<Baustand[]> {
  const db = getDb();
  const rows = await db.select().from(elBaustaende)
    .where(eq(elBaustaende.prozessId, prozessId))
    .orderBy(desc(elBaustaende.datum));
  return rows.map(rowToBaustand);
}

export async function getBaustand(id: string): Promise<Baustand | null> {
  const db = getDb();
  const rows = await db.select().from(elBaustaende).where(eq(elBaustaende.id, id)).limit(1);
  return rows[0] ? rowToBaustand(rows[0]) : null;
}

export async function createBaustand(input: Omit<Baustand, 'id' | 'version' | 'created_at' | 'updated_at'>): Promise<Baustand> {
  const db = getDb();
  const now = new Date().toISOString();
  const id = genId('baustand');
  const { prozessId, datum, status, quelle, reviewerId, ...data } = input;
  await db.insert(elBaustaende).values({
    id, prozessId, datum, status: status ?? 'entwurf', quelle: quelle ?? null,
    data: data as never, reviewerId: reviewerId ?? null, version: 1, createdAt: now, updatedAt: now,
  });
  return (await getBaustand(id))!;
}

export async function updateBaustand(
  id: string,
  updates: Partial<Baustand>,
  options: { expectedVersion?: number; force?: boolean } = {},
): Promise<Baustand | null> {
  const db = getDb();
  const existing = await getBaustand(id);
  if (!existing) return null;
  checkVersion(existing, options.expectedVersion, !!options.force);
  const merged = { ...existing, ...updates, id, version: (existing.version ?? 1) + 1, updated_at: new Date().toISOString() };
  const { id: _i, prozessId, datum, status, quelle, reviewerId, permissions, version, created_at, updated_at, ...data } = merged;
  void _i; void prozessId;
  const result = await db.update(elBaustaende)
    .set({ datum, status, quelle: quelle ?? null, reviewerId: reviewerId ?? null, data: data as never, updatedAt: updated_at, version })
    .where(options.force || options.expectedVersion === undefined
      ? eq(elBaustaende.id, id)
      : and(eq(elBaustaende.id, id), eq(elBaustaende.version, options.expectedVersion)))
    .returning({ id: elBaustaende.id });
  if (result.length === 0) throw new VersionConflictError(await getBaustand(id));
  return getBaustand(id);
}

export async function deleteBaustand(id: string): Promise<boolean> {
  const db = getDb();
  const r = await db.delete(elBaustaende).where(eq(elBaustaende.id, id)).returning({ id: elBaustaende.id });
  return r.length > 0;
}

// ---------------------------------------------------------------- Artefakt

export async function createArtefakt(input: {
  prozessId: string; baustandId?: string; filename: string; mimeType?: string; s3Key: string; data?: unknown;
}): Promise<string> {
  const db = getDb();
  const id = genId('artefakt');
  await db.insert(elArtefakte).values({
    id, prozessId: input.prozessId, baustandId: input.baustandId ?? null,
    filename: input.filename, mimeType: input.mimeType ?? null, s3Key: input.s3Key,
    data: (input.data ?? null) as never, createdAt: new Date().toISOString(),
  });
  return id;
}

export async function listArtefakte(prozessId: string) {
  const db = getDb();
  return db.select().from(elArtefakte).where(eq(elArtefakte.prozessId, prozessId)).orderBy(desc(elArtefakte.createdAt));
}
