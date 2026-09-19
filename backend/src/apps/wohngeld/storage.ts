/**
 * Wohngeld — Storage (Drizzle-CRUD, Optimistic-Locking via `version`).
 *
 * Muster wie echoloop: strukturierte Spalten überschreiben gleichnamige data-Felder,
 * `version`/timestamps kommen aus den Spalten. `data: data as never` ist die
 * etablierte jsonb-Cast-Konvention.
 */
import { eq, and, desc, inArray } from 'drizzle-orm';
import { getDb } from '../../db';
import {
  wgAkten, wgVorgaenge, wgPersonen, wgDokumente, wgPruefschritte, wgSchreiben, wgAktivitaeten, wgChatMessages,
  wgFeldStatus, wgNotizen,
} from '../../db/schema/wohngeld';
import type {
  Akte, Vorgang, Person, Dokument, Pruefschritt, Schreiben, Aktivitaet,
  VorgangSnapshot, PruefBefund, ChatMessage, ChatSource, FeldStatus, FeldStatusZielTyp, Notiz,
} from './types';
import { VersionConflictError, checkVersion } from './concurrency';

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function nowIso(): string {
  return new Date().toISOString();
}

// ── Row ↔ Domain Mapper ─────────────────────────────────────────────────────
// Jede Entität: strukturierte Spalten + { ...data } zusammenführen.

function rowToAkte(r: typeof wgAkten.$inferSelect): Akte {
  const data = (r.data ?? {}) as Partial<Akte>;
  return {
    ...data, id: r.id, name: r.name, ownerId: r.ownerId ?? undefined,
    permissions: (r.permissions ?? undefined) as Akte['permissions'],
    version: r.version, created_at: r.createdAt, updated_at: r.updatedAt,
  };
}
function rowToVorgang(r: typeof wgVorgaenge.$inferSelect): Vorgang {
  const data = (r.data ?? {}) as Partial<Vorgang>;
  return {
    ...data, id: r.id, akteId: r.akteId, antragsId: r.antragsId,
    wohngeldart: r.wohngeldart as Vorgang['wohngeldart'],
    antragsart: r.antragsart as Vorgang['antragsart'],
    status: r.status as Vorgang['status'],
    sachbearbeiter: r.sachbearbeiter ?? undefined,
    prioritaet: r.prioritaet as Vorgang['prioritaet'],
    ownerId: r.ownerId ?? undefined,
    permissions: (r.permissions ?? undefined) as Vorgang['permissions'],
    version: r.version, created_at: r.createdAt, updated_at: r.updatedAt,
  };
}
function rowToPerson(r: typeof wgPersonen.$inferSelect): Person {
  const data = (r.data ?? {}) as Partial<Person>;
  return {
    ...data, id: r.id, vorgangId: r.vorgangId, rolle: r.rolle as Person['rolle'],
    nachname: r.nachname, vorname: r.vorname,
    version: r.version, created_at: r.createdAt, updated_at: r.updatedAt,
  };
}
function rowToDokument(r: typeof wgDokumente.$inferSelect): Dokument {
  const data = (r.data ?? {}) as Partial<Dokument>;
  return {
    ...data, id: r.id, vorgangId: r.vorgangId, personId: r.personId ?? undefined,
    typ: r.typ as Dokument['typ'], istOriginal: r.istOriginal,
    version: r.version, created_at: r.createdAt, updated_at: r.updatedAt,
  };
}
function rowToPruef(r: typeof wgPruefschritte.$inferSelect): Pruefschritt {
  const data = (r.data ?? {}) as Partial<Pruefschritt>;
  return {
    ...data, id: r.id, vorgangId: r.vorgangId, personId: r.personId ?? undefined,
    regelId: r.regelId, kategorie: r.kategorie as Pruefschritt['kategorie'],
    typ: r.typ as Pruefschritt['typ'], status: r.status as Pruefschritt['status'],
    titel: r.titel, automatisch: data.automatisch ?? false,
    version: r.version, created_at: r.createdAt, updated_at: r.updatedAt,
  };
}
function rowToSchreiben(r: typeof wgSchreiben.$inferSelect): Schreiben {
  const data = (r.data ?? {}) as Partial<Schreiben>;
  return {
    ...data, id: r.id, vorgangId: r.vorgangId, art: r.art as Schreiben['art'],
    version: r.version, created_at: r.createdAt, updated_at: r.updatedAt,
  };
}
function rowToAktivitaet(r: typeof wgAktivitaeten.$inferSelect): Aktivitaet {
  const data = (r.data ?? {}) as Partial<Aktivitaet>;
  return {
    ...data, id: r.id, vorgangId: r.vorgangId, typ: r.typ,
    akteur: r.akteur ?? undefined, created_at: r.createdAt,
  };
}

// ── Akten ───────────────────────────────────────────────────────────────────

export async function listAkten(): Promise<Akte[]> {
  const db = getDb();
  const rows = await db.select().from(wgAkten).orderBy(desc(wgAkten.updatedAt));
  return rows.map(rowToAkte);
}
export async function getAkte(id: string): Promise<Akte | null> {
  const db = getDb();
  const rows = await db.select().from(wgAkten).where(eq(wgAkten.id, id)).limit(1);
  return rows[0] ? rowToAkte(rows[0]) : null;
}
export async function createAkte(input: Partial<Akte> & { name: string; ownerId?: string }): Promise<Akte> {
  const db = getDb();
  const now = nowIso();
  const id = genId('akte');
  const { name, ownerId, permissions, version, created_at, updated_at, id: _i, ...data } = input;
  void version; void created_at; void updated_at; void _i;
  await db.insert(wgAkten).values({
    id, ownerId: ownerId ?? null, name, data: data as never,
    permissions: (permissions ?? null) as never, version: 1, createdAt: now, updatedAt: now,
  });
  return (await getAkte(id))!;
}
export async function updateAkte(id: string, updates: Partial<Akte>, opts: { expectedVersion?: number; force?: boolean } = {}): Promise<Akte | null> {
  const db = getDb();
  const existing = await getAkte(id);
  if (!existing) return null;
  checkVersion(existing, opts.expectedVersion, !!opts.force);
  const merged = { ...existing, ...updates, id, version: (existing.version ?? 1) + 1, updated_at: nowIso() };
  const { id: _i, name, ownerId, permissions, version, created_at, updated_at, ...data } = merged;
  void _i; void created_at;
  const res = await db.update(wgAkten)
    .set({ name, ownerId: ownerId ?? null, data: data as never, permissions: (permissions ?? null) as never, updatedAt: updated_at, version })
    .where(opts.force || opts.expectedVersion === undefined ? eq(wgAkten.id, id) : and(eq(wgAkten.id, id), eq(wgAkten.version, opts.expectedVersion)))
    .returning({ id: wgAkten.id });
  if (res.length === 0) throw new VersionConflictError(await getAkte(id));
  return getAkte(id);
}
export async function deleteAkte(id: string): Promise<boolean> {
  const db = getDb();
  const r = await db.delete(wgAkten).where(eq(wgAkten.id, id)).returning({ id: wgAkten.id });
  return r.length > 0;
}

// ── Vorgänge ──────────────────────────────────────────────────────────────

export async function listVorgaenge(filter?: { akteId?: string; status?: string }): Promise<Vorgang[]> {
  const db = getDb();
  const conds = [];
  if (filter?.akteId) conds.push(eq(wgVorgaenge.akteId, filter.akteId));
  if (filter?.status) conds.push(eq(wgVorgaenge.status, filter.status));
  const q = db.select().from(wgVorgaenge).orderBy(desc(wgVorgaenge.updatedAt));
  const rows = conds.length ? await q.where(and(...conds)) : await q;
  return rows.map(rowToVorgang);
}
export async function getVorgang(id: string): Promise<Vorgang | null> {
  const db = getDb();
  const rows = await db.select().from(wgVorgaenge).where(eq(wgVorgaenge.id, id)).limit(1);
  return rows[0] ? rowToVorgang(rows[0]) : null;
}
export async function createVorgang(input: Partial<Vorgang> & { akteId: string; ownerId?: string }): Promise<Vorgang> {
  const db = getDb();
  const now = nowIso();
  const id = genId('vorgang');
  const antragsId = input.antragsId ?? genAntragsId();
  const {
    akteId, ownerId, wohngeldart, antragsart, status, sachbearbeiter, prioritaet,
    permissions, version, created_at, updated_at, id: _i, antragsId: _a, ...data
  } = input;
  void version; void created_at; void updated_at; void _i; void _a;
  await db.insert(wgVorgaenge).values({
    id, akteId, antragsId,
    wohngeldart: wohngeldart ?? 'mietzuschuss', antragsart: antragsart ?? 'erstantrag',
    status: status ?? 'posteingang', sachbearbeiter: sachbearbeiter ?? null,
    prioritaet: prioritaet ?? 'normal', ownerId: ownerId ?? null,
    data: data as never, permissions: (permissions ?? null) as never,
    version: 1, createdAt: now, updatedAt: now,
  });
  return (await getVorgang(id))!;
}
export async function updateVorgang(id: string, updates: Partial<Vorgang>, opts: { expectedVersion?: number; force?: boolean } = {}): Promise<Vorgang | null> {
  const db = getDb();
  const existing = await getVorgang(id);
  if (!existing) return null;
  checkVersion(existing, opts.expectedVersion, !!opts.force);
  const merged = { ...existing, ...updates, id, akteId: existing.akteId, version: (existing.version ?? 1) + 1, updated_at: nowIso() };
  const {
    id: _i, akteId, antragsId, wohngeldart, antragsart, status, sachbearbeiter, prioritaet,
    ownerId, permissions, version, created_at, updated_at, ...data
  } = merged;
  void _i; void created_at;
  const res = await db.update(wgVorgaenge)
    .set({
      antragsId, wohngeldart, antragsart, status, sachbearbeiter: sachbearbeiter ?? null,
      prioritaet, ownerId: ownerId ?? null, data: data as never,
      permissions: (permissions ?? null) as never, updatedAt: updated_at, version,
    })
    .where(opts.force || opts.expectedVersion === undefined ? eq(wgVorgaenge.id, id) : and(eq(wgVorgaenge.id, id), eq(wgVorgaenge.version, opts.expectedVersion)))
    .returning({ id: wgVorgaenge.id });
  if (res.length === 0) throw new VersionConflictError(await getVorgang(id));
  return getVorgang(id);
}
export async function deleteVorgang(id: string): Promise<boolean> {
  const db = getDb();
  const r = await db.delete(wgVorgaenge).where(eq(wgVorgaenge.id, id)).returning({ id: wgVorgaenge.id });
  return r.length > 0;
}
function genAntragsId(): string {
  const n = Date.now().toString().slice(-9);
  return `${n.slice(0, 3)}-${n.slice(3, 6)}-${n.slice(6, 9)}`;
}

// ── Personen ─────────────────────────────────────────────────────────────

export async function listPersonen(vorgangId: string): Promise<Person[]> {
  const db = getDb();
  const rows = await db.select().from(wgPersonen).where(eq(wgPersonen.vorgangId, vorgangId)).orderBy(wgPersonen.createdAt);
  return rows.map(rowToPerson);
}
export async function getPerson(id: string): Promise<Person | null> {
  const db = getDb();
  const rows = await db.select().from(wgPersonen).where(eq(wgPersonen.id, id)).limit(1);
  return rows[0] ? rowToPerson(rows[0]) : null;
}
export async function createPerson(input: Partial<Person> & { vorgangId: string }): Promise<Person> {
  const db = getDb();
  const now = nowIso();
  const id = genId('person');
  const { vorgangId, rolle, nachname, vorname, version, created_at, updated_at, id: _i, ...data } = input;
  void version; void created_at; void updated_at; void _i;
  await db.insert(wgPersonen).values({
    id, vorgangId, rolle: rolle ?? 'haushaltsmitglied', nachname: nachname ?? '', vorname: vorname ?? '',
    data: data as never, version: 1, createdAt: now, updatedAt: now,
  });
  return (await getPerson(id))!;
}
export async function updatePerson(id: string, updates: Partial<Person>, opts: { expectedVersion?: number; force?: boolean } = {}): Promise<Person | null> {
  const db = getDb();
  const existing = await getPerson(id);
  if (!existing) return null;
  checkVersion(existing, opts.expectedVersion, !!opts.force);
  const merged = { ...existing, ...updates, id, vorgangId: existing.vorgangId, version: (existing.version ?? 1) + 1, updated_at: nowIso() };
  const { id: _i, vorgangId, rolle, nachname, vorname, version, created_at, updated_at, ...data } = merged;
  void _i; void created_at;
  const res = await db.update(wgPersonen)
    .set({ rolle, nachname, vorname, data: data as never, updatedAt: updated_at, version })
    .where(opts.force || opts.expectedVersion === undefined ? eq(wgPersonen.id, id) : and(eq(wgPersonen.id, id), eq(wgPersonen.version, opts.expectedVersion)))
    .returning({ id: wgPersonen.id });
  if (res.length === 0) throw new VersionConflictError(await getPerson(id));
  return getPerson(id);
}
export async function deletePerson(id: string): Promise<boolean> {
  const db = getDb();
  const r = await db.delete(wgPersonen).where(eq(wgPersonen.id, id)).returning({ id: wgPersonen.id });
  return r.length > 0;
}

// ── Dokumente ────────────────────────────────────────────────────────────

export async function listDokumente(vorgangId: string): Promise<Dokument[]> {
  const db = getDb();
  const rows = await db.select().from(wgDokumente).where(eq(wgDokumente.vorgangId, vorgangId)).orderBy(desc(wgDokumente.createdAt));
  return rows.map(rowToDokument);
}
export async function getDokument(id: string): Promise<Dokument | null> {
  const db = getDb();
  const rows = await db.select().from(wgDokumente).where(eq(wgDokumente.id, id)).limit(1);
  return rows[0] ? rowToDokument(rows[0]) : null;
}
export async function createDokument(input: Partial<Dokument> & { vorgangId: string }): Promise<Dokument> {
  const db = getDb();
  const now = nowIso();
  const id = genId('dok');
  const { vorgangId, personId, typ, istOriginal, version, created_at, updated_at, id: _i, ...data } = input;
  void version; void created_at; void updated_at; void _i;
  await db.insert(wgDokumente).values({
    id, vorgangId, personId: personId ?? null, typ: typ ?? 'sonstiges',
    istOriginal: istOriginal ?? false, data: data as never, version: 1, createdAt: now, updatedAt: now,
  });
  return (await getDokument(id))!;
}
export async function updateDokument(id: string, updates: Partial<Dokument>, opts: { expectedVersion?: number; force?: boolean } = {}): Promise<Dokument | null> {
  const db = getDb();
  const existing = await getDokument(id);
  if (!existing) return null;
  checkVersion(existing, opts.expectedVersion, !!opts.force);
  const merged = { ...existing, ...updates, id, vorgangId: existing.vorgangId, version: (existing.version ?? 1) + 1, updated_at: nowIso() };
  const { id: _i, vorgangId, personId, typ, istOriginal, version, created_at, updated_at, ...data } = merged;
  void _i; void created_at;
  const res = await db.update(wgDokumente)
    .set({ personId: personId ?? null, typ, istOriginal: istOriginal ?? false, data: data as never, updatedAt: updated_at, version })
    .where(opts.force || opts.expectedVersion === undefined ? eq(wgDokumente.id, id) : and(eq(wgDokumente.id, id), eq(wgDokumente.version, opts.expectedVersion)))
    .returning({ id: wgDokumente.id });
  if (res.length === 0) throw new VersionConflictError(await getDokument(id));
  return getDokument(id);
}
export async function deleteDokument(id: string): Promise<boolean> {
  const db = getDb();
  const r = await db.delete(wgDokumente).where(eq(wgDokumente.id, id)).returning({ id: wgDokumente.id });
  return r.length > 0;
}

// ── Prüfschritte ─────────────────────────────────────────────────────────

export async function listPruefschritte(vorgangId: string): Promise<Pruefschritt[]> {
  const db = getDb();
  const rows = await db.select().from(wgPruefschritte).where(eq(wgPruefschritte.vorgangId, vorgangId)).orderBy(wgPruefschritte.createdAt);
  return rows.map(rowToPruef);
}
export async function getPruefschritt(id: string): Promise<Pruefschritt | null> {
  const db = getDb();
  const rows = await db.select().from(wgPruefschritte).where(eq(wgPruefschritte.id, id)).limit(1);
  return rows[0] ? rowToPruef(rows[0]) : null;
}
export async function createPruefschritt(input: Partial<Pruefschritt> & { vorgangId: string; titel: string }): Promise<Pruefschritt> {
  const db = getDb();
  const now = nowIso();
  const id = genId('pruef');
  const { vorgangId, personId, regelId, kategorie, typ, status, titel, version, created_at, updated_at, id: _i, ...data } = input;
  void version; void created_at; void updated_at; void _i;
  await db.insert(wgPruefschritte).values({
    id, vorgangId, personId: personId ?? null, regelId: regelId ?? '',
    kategorie: kategorie ?? 'vollstaendigkeit', typ: typ ?? 'anforderung',
    status: status ?? 'offen', titel, data: { automatisch: false, ...data } as never,
    version: 1, createdAt: now, updatedAt: now,
  });
  return (await getPruefschritt(id))!;
}
export async function updatePruefschritt(id: string, updates: Partial<Pruefschritt>, opts: { expectedVersion?: number; force?: boolean } = {}): Promise<Pruefschritt | null> {
  const db = getDb();
  const existing = await getPruefschritt(id);
  if (!existing) return null;
  checkVersion(existing, opts.expectedVersion, !!opts.force);
  const merged = { ...existing, ...updates, id, vorgangId: existing.vorgangId, version: (existing.version ?? 1) + 1, updated_at: nowIso() };
  const { id: _i, vorgangId, personId, regelId, kategorie, typ, status, titel, version, created_at, updated_at, ...data } = merged;
  void _i; void created_at;
  const res = await db.update(wgPruefschritte)
    .set({ personId: personId ?? null, regelId, kategorie, typ, status, titel, data: data as never, updatedAt: updated_at, version })
    .where(opts.force || opts.expectedVersion === undefined ? eq(wgPruefschritte.id, id) : and(eq(wgPruefschritte.id, id), eq(wgPruefschritte.version, opts.expectedVersion)))
    .returning({ id: wgPruefschritte.id });
  if (res.length === 0) throw new VersionConflictError(await getPruefschritt(id));
  return getPruefschritt(id);
}
export async function deletePruefschritt(id: string): Promise<boolean> {
  const db = getDb();
  const r = await db.delete(wgPruefschritte).where(eq(wgPruefschritte.id, id)).returning({ id: wgPruefschritte.id });
  return r.length > 0;
}

/**
 * Automatische Prüfschritte mit dem aktuellen Engine-Ergebnis abgleichen (idempotent).
 * - Neue Befunde → anlegen (status offen).
 * - Befunde die es nicht mehr gibt → automatische, noch offene Schritte entfernen.
 * - Manuelle Schritte (automatisch=false) und bereits erledigte/verworfene bleiben unberührt.
 * Schlüssel: regelId + personId.
 */
export async function syncPruefschritte(vorgangId: string, befunde: PruefBefund[]): Promise<Pruefschritt[]> {
  const db = getDb();
  const existing = await listPruefschritte(vorgangId);
  const keyOf = (regelId: string, personId?: string) => `${regelId}::${personId ?? ''}`;
  const befundKeys = new Set(befunde.map(b => keyOf(b.regelId, b.personId)));
  const existingByKey = new Map(existing.filter(p => p.automatisch).map(p => [keyOf(p.regelId, p.personId), p]));

  // Neue Befunde anlegen
  const toInsert = befunde.filter(b => !existingByKey.has(keyOf(b.regelId, b.personId)));
  const now = nowIso();
  if (toInsert.length) {
    await db.insert(wgPruefschritte).values(toInsert.map(b => ({
      id: genId('pruef'), vorgangId, personId: b.personId ?? null, regelId: b.regelId,
      kategorie: b.kategorie, typ: b.typ, status: 'offen', titel: b.titel,
      data: { automatisch: true, belegtext: b.belegtext, quellDokumentId: b.quellDokumentId } as never,
      version: 1, createdAt: now, updatedAt: now,
    })));
  }

  // Verschwundene, automatische & noch offene Schritte entfernen (Widerspruch aufgelöst)
  const staleIds = existing
    .filter(p => p.automatisch && p.status === 'offen' && !befundKeys.has(keyOf(p.regelId, p.personId)))
    .map(p => p.id);
  if (staleIds.length) {
    await db.delete(wgPruefschritte).where(inArray(wgPruefschritte.id, staleIds));
  }

  return listPruefschritte(vorgangId);
}

// ── Schreiben ────────────────────────────────────────────────────────────

export async function listSchreiben(vorgangId: string): Promise<Schreiben[]> {
  const db = getDb();
  const rows = await db.select().from(wgSchreiben).where(eq(wgSchreiben.vorgangId, vorgangId)).orderBy(desc(wgSchreiben.createdAt));
  return rows.map(rowToSchreiben);
}
export async function getSchreiben(id: string): Promise<Schreiben | null> {
  const db = getDb();
  const rows = await db.select().from(wgSchreiben).where(eq(wgSchreiben.id, id)).limit(1);
  return rows[0] ? rowToSchreiben(rows[0]) : null;
}
export async function createSchreiben(input: Partial<Schreiben> & { vorgangId: string }): Promise<Schreiben> {
  const db = getDb();
  const now = nowIso();
  const id = genId('schreiben');
  const { vorgangId, art, version, created_at, updated_at, id: _i, ...data } = input;
  void version; void created_at; void updated_at; void _i;
  await db.insert(wgSchreiben).values({
    id, vorgangId, art: art ?? 'erstanforderung', data: data as never, version: 1, createdAt: now, updatedAt: now,
  });
  return (await getSchreiben(id))!;
}
export async function updateSchreiben(id: string, updates: Partial<Schreiben>, opts: { expectedVersion?: number; force?: boolean } = {}): Promise<Schreiben | null> {
  const db = getDb();
  const existing = await getSchreiben(id);
  if (!existing) return null;
  checkVersion(existing, opts.expectedVersion, !!opts.force);
  const merged = { ...existing, ...updates, id, vorgangId: existing.vorgangId, version: (existing.version ?? 1) + 1, updated_at: nowIso() };
  const { id: _i, vorgangId, art, version, created_at, updated_at, ...data } = merged;
  void _i; void created_at;
  const res = await db.update(wgSchreiben)
    .set({ art, data: data as never, updatedAt: updated_at, version })
    .where(opts.force || opts.expectedVersion === undefined ? eq(wgSchreiben.id, id) : and(eq(wgSchreiben.id, id), eq(wgSchreiben.version, opts.expectedVersion)))
    .returning({ id: wgSchreiben.id });
  if (res.length === 0) throw new VersionConflictError(await getSchreiben(id));
  return getSchreiben(id);
}
export async function deleteSchreiben(id: string): Promise<boolean> {
  const db = getDb();
  const r = await db.delete(wgSchreiben).where(eq(wgSchreiben.id, id)).returning({ id: wgSchreiben.id });
  return r.length > 0;
}

// ── Aktivitäten (append-only) ──────────────────────────────────────────────

export async function listAktivitaeten(vorgangId: string): Promise<Aktivitaet[]> {
  const db = getDb();
  const rows = await db.select().from(wgAktivitaeten).where(eq(wgAktivitaeten.vorgangId, vorgangId)).orderBy(desc(wgAktivitaeten.createdAt));
  return rows.map(rowToAktivitaet);
}
export async function addAktivitaet(input: { vorgangId: string; typ: string; akteur?: string; beschreibung?: string }): Promise<Aktivitaet> {
  const db = getDb();
  const now = nowIso();
  const id = genId('akt');
  await db.insert(wgAktivitaeten).values({
    id, vorgangId: input.vorgangId, typ: input.typ, akteur: input.akteur ?? null,
    data: { beschreibung: input.beschreibung } as never, createdAt: now,
  });
  return (await listAktivitaeten(input.vorgangId))[0]!;
}

// ── Fall-Chat (append-only) ────────────────────────────────────────────────

function rowToChatMessage(r: typeof wgChatMessages.$inferSelect): ChatMessage {
  const data = (r.data ?? {}) as { content?: string; sources?: ChatSource[]; model?: string; tokens?: number };
  return {
    id: r.id,
    vorgangId: r.vorgangId,
    rolle: r.rolle as ChatMessage['rolle'],
    content: data.content ?? '',
    sources: data.sources,
    model: data.model,
    tokens: data.tokens,
    created_at: r.createdAt,
  };
}

/** Chat-Verlauf eines Vorgangs, chronologisch (älteste zuerst). */
export async function listChatMessages(vorgangId: string): Promise<ChatMessage[]> {
  const db = getDb();
  const rows = await db.select().from(wgChatMessages)
    .where(eq(wgChatMessages.vorgangId, vorgangId))
    .orderBy(wgChatMessages.createdAt);
  return rows.map(rowToChatMessage);
}

/** Neue Chat-Nachricht anhängen (append-only). */
export async function addChatMessage(input: {
  vorgangId: string;
  rolle: ChatMessage['rolle'];
  content: string;
  sources?: ChatSource[];
  model?: string;
  tokens?: number;
}): Promise<ChatMessage> {
  const db = getDb();
  const now = nowIso();
  const id = genId('chat');
  await db.insert(wgChatMessages).values({
    id, vorgangId: input.vorgangId, rolle: input.rolle,
    data: {
      content: input.content,
      sources: input.sources,
      model: input.model,
      tokens: input.tokens,
    } as never,
    createdAt: now,
  });
  return (await getChatMessage(id))!;
}

async function getChatMessage(id: string): Promise<ChatMessage | null> {
  const db = getDb();
  const rows = await db.select().from(wgChatMessages).where(eq(wgChatMessages.id, id)).limit(1);
  return rows[0] ? rowToChatMessage(rows[0]) : null;
}

// ── Feld-Status (WP3) ───────────────────────────────────────────────────────

function rowToFeldStatus(r: typeof wgFeldStatus.$inferSelect): FeldStatus {
  return {
    id: r.id,
    vorgangId: r.vorgangId,
    zielTyp: r.zielTyp as FeldStatusZielTyp,
    zielId: r.zielId,
    feldPfad: r.feldPfad,
    quelle: r.quelle as FeldStatus['quelle'],
    bestaetigt: r.bestaetigt,
    quellDokumentId: r.quellDokumentId ?? undefined,
    confidence: r.confidence ?? undefined,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

export async function listFeldStatus(vorgangId: string): Promise<FeldStatus[]> {
  const db = getDb();
  const rows = await db.select().from(wgFeldStatus)
    .where(eq(wgFeldStatus.vorgangId, vorgangId))
    .orderBy(wgFeldStatus.createdAt);
  return rows.map(rowToFeldStatus);
}

export async function getFeldStatus(id: string): Promise<FeldStatus | null> {
  const db = getDb();
  const rows = await db.select().from(wgFeldStatus).where(eq(wgFeldStatus.id, id)).limit(1);
  return rows[0] ? rowToFeldStatus(rows[0]) : null;
}

/** Upsert per (vorgangId, zielTyp, zielId, feldPfad). */
export async function setFeldStatus(input: {
  vorgangId: string;
  zielTyp: FeldStatusZielTyp;
  zielId: string;
  feldPfad: string;
  quelle: FeldStatus['quelle'];
  bestaetigt?: boolean;
  quellDokumentId?: string;
  confidence?: number;
}): Promise<FeldStatus> {
  const db = getDb();
  const now = nowIso();
  const existing = await db.select().from(wgFeldStatus).where(and(
    eq(wgFeldStatus.vorgangId, input.vorgangId),
    eq(wgFeldStatus.zielTyp, input.zielTyp),
    eq(wgFeldStatus.zielId, input.zielId),
    eq(wgFeldStatus.feldPfad, input.feldPfad),
  )).limit(1);
  if (existing[0]) {
    await db.update(wgFeldStatus).set({
      quelle: input.quelle,
      bestaetigt: input.bestaetigt ?? false,
      quellDokumentId: input.quellDokumentId ?? null,
      confidence: input.confidence ?? null,
      updatedAt: now,
    }).where(eq(wgFeldStatus.id, existing[0].id));
    return (await getFeldStatus(existing[0].id))!;
  }
  const id = genId('fs');
  await db.insert(wgFeldStatus).values({
    id, vorgangId: input.vorgangId, zielTyp: input.zielTyp, zielId: input.zielId,
    feldPfad: input.feldPfad, quelle: input.quelle, bestaetigt: input.bestaetigt ?? false,
    quellDokumentId: input.quellDokumentId ?? null, confidence: input.confidence ?? null,
    createdAt: now, updatedAt: now,
  });
  return (await getFeldStatus(id))!;
}

/** Einen Feld-Status bestätigen (bestaetigt=true). */
export async function bestaetigeFeld(id: string): Promise<FeldStatus | null> {
  const db = getDb();
  const res = await db.update(wgFeldStatus)
    .set({ bestaetigt: true, updatedAt: nowIso() })
    .where(eq(wgFeldStatus.id, id))
    .returning({ id: wgFeldStatus.id });
  if (res.length === 0) return null;
  return getFeldStatus(id);
}

/** Alle offenen (unbestätigten) Feld-Status eines Vorgangs bestätigen. */
export async function bestaetigeAlle(vorgangId: string): Promise<FeldStatus[]> {
  const db = getDb();
  await db.update(wgFeldStatus)
    .set({ bestaetigt: true, updatedAt: nowIso() })
    .where(and(eq(wgFeldStatus.vorgangId, vorgangId), eq(wgFeldStatus.bestaetigt, false)));
  return listFeldStatus(vorgangId);
}

export async function loescheFeldStatus(id: string): Promise<boolean> {
  const db = getDb();
  const r = await db.delete(wgFeldStatus).where(eq(wgFeldStatus.id, id)).returning({ id: wgFeldStatus.id });
  return r.length > 0;
}

// ── Notizen (WP4, append-only) ──────────────────────────────────────────────

function rowToNotiz(r: typeof wgNotizen.$inferSelect): Notiz {
  return {
    id: r.id, vorgangId: r.vorgangId, anker: r.anker,
    autor: r.autor ?? undefined, text: r.text, created_at: r.createdAt,
  };
}

export async function listNotizen(vorgangId: string): Promise<Notiz[]> {
  const db = getDb();
  const rows = await db.select().from(wgNotizen)
    .where(eq(wgNotizen.vorgangId, vorgangId))
    .orderBy(wgNotizen.createdAt);
  return rows.map(rowToNotiz);
}

export async function addNotiz(input: { vorgangId: string; anker: string; autor?: string; text: string }): Promise<Notiz> {
  const db = getDb();
  const now = nowIso();
  const id = genId('notiz');
  await db.insert(wgNotizen).values({
    id, vorgangId: input.vorgangId, anker: input.anker,
    autor: input.autor ?? null, text: input.text, createdAt: now,
  });
  return (await getNotiz(id))!;
}

async function getNotiz(id: string): Promise<Notiz | null> {
  const db = getDb();
  const rows = await db.select().from(wgNotizen).where(eq(wgNotizen.id, id)).limit(1);
  return rows[0] ? rowToNotiz(rows[0]) : null;
}

export async function loescheNotiz(id: string): Promise<boolean> {
  const db = getDb();
  const r = await db.delete(wgNotizen).where(eq(wgNotizen.id, id)).returning({ id: wgNotizen.id });
  return r.length > 0;
}

// ── Snapshot (Input für die Regel-Engine) ──────────────────────────────────

export async function getVorgangSnapshot(vorgangId: string): Promise<VorgangSnapshot | null> {
  const vorgang = await getVorgang(vorgangId);
  if (!vorgang) return null;
  const [personen, dokumente] = await Promise.all([
    listPersonen(vorgangId),
    listDokumente(vorgangId),
  ]);
  return { vorgang, personen, dokumente };
}
