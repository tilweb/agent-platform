/**
 * Grundsicherung — Storage (Drizzle-CRUD, Optimistic-Locking via `version`).
 *
 * Muster wie Wohngeld: strukturierte Spalten überschreiben gleichnamige data-Felder,
 * `version`/timestamps kommen aus den Spalten. `data: data as never` ist die etablierte
 * jsonb-Cast-Konvention. Audit, Feldstatus, Notizen, Posteingang: Kern-Stores.
 */
import { eq, and, desc, inArray, sql as rawSql } from 'drizzle-orm';
import { getDb } from '../../db';
import {
  gsAkten, gsVorgaenge, gsPersonen, gsDokumente, gsPruefschritte, gsSchreiben, gsAktivitaeten,
  gsFeldStatus, gsNotizen, gsTextbausteine, gsAuditLog, gsPosteingang,
} from '../../db/schema/grundsicherung';
import type {
  Akte, Vorgang, Person, Dokument, Pruefschritt, Schreiben, Aktivitaet,
  VorgangSnapshot, PruefBefund, FeldStatusZielTyp, Textbaustein, Posteingang,
} from './types';
import { VersionConflictError, checkVersion } from './concurrency';
import { genId, nowIso } from '../_antrag-kern/ids';
import { createAuditStore, type AuditGesamtFilter } from '../_antrag-kern/audit';
import { createPosteingangStore } from '../_antrag-kern/posteingang/store';
import { createFeldStatusStore } from '../_antrag-kern/feldstatus';
import { createNotizenStore } from '../_antrag-kern/notizen';
import { planePruefschrittSync } from './pruefschritt-sync';

type UpdateOpts = { expectedVersion?: number; force?: boolean };

// ── Row ↔ Domain Mapper ─────────────────────────────────────────────────────

function rowToAkte(r: typeof gsAkten.$inferSelect): Akte {
  const data = (r.data ?? {}) as Partial<Akte>;
  return {
    ...data, id: r.id, name: r.name, ownerId: r.ownerId ?? undefined,
    permissions: (r.permissions ?? undefined) as Akte['permissions'],
    version: r.version, created_at: r.createdAt, updated_at: r.updatedAt,
  };
}
function rowToVorgang(r: typeof gsVorgaenge.$inferSelect): Vorgang {
  const data = (r.data ?? {}) as Partial<Vorgang>;
  return {
    ...data, id: r.id, akteId: r.akteId, vorgangsnummer: r.vorgangsnummer,
    antragsart: r.antragsart as Vorgang['antragsart'],
    anspruchsgrund: (r.anspruchsgrund ?? undefined) as Vorgang['anspruchsgrund'],
    status: r.status as Vorgang['status'],
    sachbearbeiter: r.sachbearbeiter ?? undefined,
    prioritaet: r.prioritaet as Vorgang['prioritaet'],
    ownerId: r.ownerId ?? undefined,
    permissions: (r.permissions ?? undefined) as Vorgang['permissions'],
    version: r.version, created_at: r.createdAt, updated_at: r.updatedAt,
  };
}
function rowToPerson(r: typeof gsPersonen.$inferSelect): Person {
  const data = (r.data ?? {}) as Partial<Person>;
  return {
    ...data, id: r.id, vorgangId: r.vorgangId, rolle: r.rolle as Person['rolle'],
    nachname: r.nachname, vorname: r.vorname,
    version: r.version, created_at: r.createdAt, updated_at: r.updatedAt,
  };
}
function rowToDokument(r: typeof gsDokumente.$inferSelect): Dokument {
  const data = (r.data ?? {}) as Partial<Dokument>;
  return {
    ...data, id: r.id, vorgangId: r.vorgangId, personId: r.personId ?? undefined,
    typ: r.typ as Dokument['typ'], istOriginal: r.istOriginal,
    version: r.version, created_at: r.createdAt, updated_at: r.updatedAt,
  };
}
function rowToPruef(r: typeof gsPruefschritte.$inferSelect): Pruefschritt {
  const data = (r.data ?? {}) as Partial<Pruefschritt>;
  return {
    ...data, id: r.id, vorgangId: r.vorgangId, personId: r.personId ?? undefined,
    regelId: r.regelId, kategorie: r.kategorie as Pruefschritt['kategorie'],
    typ: r.typ as Pruefschritt['typ'], status: r.status as Pruefschritt['status'],
    titel: r.titel, automatisch: data.automatisch ?? false,
    version: r.version, created_at: r.createdAt, updated_at: r.updatedAt,
  };
}
function rowToSchreiben(r: typeof gsSchreiben.$inferSelect): Schreiben {
  const data = (r.data ?? {}) as Partial<Schreiben>;
  return {
    ...data, id: r.id, vorgangId: r.vorgangId, art: r.art as Schreiben['art'],
    version: r.version, created_at: r.createdAt, updated_at: r.updatedAt,
  };
}
function rowToAktivitaet(r: typeof gsAktivitaeten.$inferSelect): Aktivitaet {
  const data = (r.data ?? {}) as Partial<Aktivitaet>;
  return {
    ...data, id: r.id, vorgangId: r.vorgangId, typ: r.typ,
    akteur: r.akteur ?? undefined, created_at: r.createdAt,
  };
}

// ── Akten ───────────────────────────────────────────────────────────────────

export async function listAkten(): Promise<Akte[]> {
  const rows = await getDb().select().from(gsAkten).orderBy(desc(gsAkten.updatedAt));
  return rows.map(rowToAkte);
}
export async function getAkte(id: string): Promise<Akte | null> {
  const rows = await getDb().select().from(gsAkten).where(eq(gsAkten.id, id)).limit(1);
  return rows[0] ? rowToAkte(rows[0]) : null;
}
export async function createAkte(input: Partial<Akte> & { name: string; ownerId?: string }): Promise<Akte> {
  const now = nowIso();
  const id = genId('akte');
  const { name, ownerId, permissions, version, created_at, updated_at, id: _i, ...data } = input;
  void version; void created_at; void updated_at; void _i;
  await getDb().insert(gsAkten).values({
    id, ownerId: ownerId ?? null, name, data: data as never,
    permissions: (permissions ?? null) as never, version: 1, createdAt: now, updatedAt: now,
  });
  return (await getAkte(id))!;
}
export async function updateAkte(id: string, updates: Partial<Akte>, opts: UpdateOpts = {}): Promise<Akte | null> {
  const existing = await getAkte(id);
  if (!existing) return null;
  checkVersion(existing, opts.expectedVersion, !!opts.force);
  const merged = { ...existing, ...updates, id, version: (existing.version ?? 1) + 1, updated_at: nowIso() };
  const { id: _i, name, ownerId, permissions, version, created_at, updated_at, ...data } = merged;
  void _i; void created_at;
  const res = await getDb().update(gsAkten)
    .set({ name, ownerId: ownerId ?? null, data: data as never, permissions: (permissions ?? null) as never, updatedAt: updated_at, version })
    .where(opts.force || opts.expectedVersion === undefined ? eq(gsAkten.id, id) : and(eq(gsAkten.id, id), eq(gsAkten.version, opts.expectedVersion)))
    .returning({ id: gsAkten.id });
  if (res.length === 0) throw new VersionConflictError(await getAkte(id));
  return getAkte(id);
}
export async function deleteAkte(id: string): Promise<boolean> {
  const r = await getDb().delete(gsAkten).where(eq(gsAkten.id, id)).returning({ id: gsAkten.id });
  return r.length > 0;
}

// ── Vorgänge ──────────────────────────────────────────────────────────────

export interface VorgangFilter {
  akteId?: string;
  status?: string;
  antragsart?: string;
  anspruchsgrund?: string;
}

export async function listVorgaenge(filter?: VorgangFilter): Promise<Vorgang[]> {
  const conds = [];
  if (filter?.akteId) conds.push(eq(gsVorgaenge.akteId, filter.akteId));
  if (filter?.status) conds.push(eq(gsVorgaenge.status, filter.status));
  if (filter?.antragsart) conds.push(eq(gsVorgaenge.antragsart, filter.antragsart));
  if (filter?.anspruchsgrund) conds.push(eq(gsVorgaenge.anspruchsgrund, filter.anspruchsgrund));
  const q = getDb().select().from(gsVorgaenge).orderBy(desc(gsVorgaenge.updatedAt));
  const rows = conds.length ? await q.where(and(...conds)) : await q;
  return rows.map(rowToVorgang);
}
export async function getVorgang(id: string): Promise<Vorgang | null> {
  const rows = await getDb().select().from(gsVorgaenge).where(eq(gsVorgaenge.id, id)).limit(1);
  return rows[0] ? rowToVorgang(rows[0]) : null;
}
export async function createVorgang(input: Partial<Vorgang> & { akteId: string; ownerId?: string }): Promise<Vorgang> {
  const now = nowIso();
  const id = genId('vorgang');
  const vorgangsnummer = input.vorgangsnummer ?? genVorgangsnummer();
  const {
    akteId, ownerId, antragsart, anspruchsgrund, status, sachbearbeiter, prioritaet,
    permissions, version, created_at, updated_at, id: _i, vorgangsnummer: _n, ...data
  } = input;
  void version; void created_at; void updated_at; void _i; void _n;
  await getDb().insert(gsVorgaenge).values({
    id, akteId, vorgangsnummer,
    antragsart: antragsart ?? 'erstantrag', anspruchsgrund: anspruchsgrund ?? null,
    status: status ?? 'posteingang', sachbearbeiter: sachbearbeiter ?? null,
    prioritaet: prioritaet ?? 'normal', ownerId: ownerId ?? null,
    data: data as never, permissions: (permissions ?? null) as never,
    version: 1, createdAt: now, updatedAt: now,
  });
  return (await getVorgang(id))!;
}
export async function updateVorgang(id: string, updates: Partial<Vorgang>, opts: UpdateOpts = {}): Promise<Vorgang | null> {
  const existing = await getVorgang(id);
  if (!existing) return null;
  checkVersion(existing, opts.expectedVersion, !!opts.force);
  const merged = { ...existing, ...updates, id, akteId: existing.akteId, version: (existing.version ?? 1) + 1, updated_at: nowIso() };
  const {
    id: _i, akteId, vorgangsnummer, antragsart, anspruchsgrund, status, sachbearbeiter, prioritaet,
    ownerId, permissions, version, created_at, updated_at, ...data
  } = merged;
  void _i; void created_at; void akteId;
  const res = await getDb().update(gsVorgaenge)
    .set({
      vorgangsnummer, antragsart, anspruchsgrund: anspruchsgrund ?? null, status,
      sachbearbeiter: sachbearbeiter ?? null, prioritaet, ownerId: ownerId ?? null,
      data: data as never, permissions: (permissions ?? null) as never, updatedAt: updated_at, version,
    })
    .where(opts.force || opts.expectedVersion === undefined ? eq(gsVorgaenge.id, id) : and(eq(gsVorgaenge.id, id), eq(gsVorgaenge.version, opts.expectedVersion)))
    .returning({ id: gsVorgaenge.id });
  if (res.length === 0) throw new VersionConflictError(await getVorgang(id));
  return getVorgang(id);
}
export async function deleteVorgang(id: string): Promise<boolean> {
  const r = await getDb().delete(gsVorgaenge).where(eq(gsVorgaenge.id, id)).returning({ id: gsVorgaenge.id });
  return r.length > 0;
}
/** Interne Vorgangsnummer `GS-NNN-NNN-NNN` (zeitbasiert). */
function genVorgangsnummer(): string {
  const n = Date.now().toString().slice(-9);
  return `GS-${n.slice(0, 3)}-${n.slice(3, 6)}-${n.slice(6, 9)}`;
}

/**
 * Prüfzeitpunkt am Vorgang setzen — bewusst OHNE Versionssprung und ohne `updatedAt`,
 * damit parallel offene Formulare (expectedVersion) nicht in einen Konflikt laufen.
 */
export async function setzeGeprueftAm(vorgangId: string, zeitpunkt: string = nowIso()): Promise<void> {
  await getDb().update(gsVorgaenge)
    .set({ data: rawSql`jsonb_set(coalesce(${gsVorgaenge.data}, '{}'::jsonb), '{geprueftAm}', to_jsonb(${zeitpunkt}::text))` as never })
    .where(eq(gsVorgaenge.id, vorgangId));
}

// ── Personen ─────────────────────────────────────────────────────────────

export async function listPersonen(vorgangId: string): Promise<Person[]> {
  const rows = await getDb().select().from(gsPersonen).where(eq(gsPersonen.vorgangId, vorgangId)).orderBy(gsPersonen.createdAt);
  return rows.map(rowToPerson);
}
export async function getPerson(id: string): Promise<Person | null> {
  const rows = await getDb().select().from(gsPersonen).where(eq(gsPersonen.id, id)).limit(1);
  return rows[0] ? rowToPerson(rows[0]) : null;
}
export async function createPerson(input: Partial<Person> & { vorgangId: string }): Promise<Person> {
  const now = nowIso();
  const id = genId('person');
  const { vorgangId, rolle, nachname, vorname, version, created_at, updated_at, id: _i, ...data } = input;
  void version; void created_at; void updated_at; void _i;
  await getDb().insert(gsPersonen).values({
    id, vorgangId, rolle: rolle ?? 'haushaltsangehoerig', nachname: nachname ?? '', vorname: vorname ?? '',
    data: data as never, version: 1, createdAt: now, updatedAt: now,
  });
  return (await getPerson(id))!;
}
export async function updatePerson(id: string, updates: Partial<Person>, opts: UpdateOpts = {}): Promise<Person | null> {
  const existing = await getPerson(id);
  if (!existing) return null;
  checkVersion(existing, opts.expectedVersion, !!opts.force);
  const merged = { ...existing, ...updates, id, vorgangId: existing.vorgangId, version: (existing.version ?? 1) + 1, updated_at: nowIso() };
  const { id: _i, vorgangId, rolle, nachname, vorname, version, created_at, updated_at, ...data } = merged;
  void _i; void created_at; void vorgangId;
  const res = await getDb().update(gsPersonen)
    .set({ rolle, nachname, vorname, data: data as never, updatedAt: updated_at, version })
    .where(opts.force || opts.expectedVersion === undefined ? eq(gsPersonen.id, id) : and(eq(gsPersonen.id, id), eq(gsPersonen.version, opts.expectedVersion)))
    .returning({ id: gsPersonen.id });
  if (res.length === 0) throw new VersionConflictError(await getPerson(id));
  return getPerson(id);
}
export async function deletePerson(id: string): Promise<boolean> {
  const r = await getDb().delete(gsPersonen).where(eq(gsPersonen.id, id)).returning({ id: gsPersonen.id });
  return r.length > 0;
}

// ── Dokumente ────────────────────────────────────────────────────────────

export async function listDokumente(vorgangId: string): Promise<Dokument[]> {
  const rows = await getDb().select().from(gsDokumente).where(eq(gsDokumente.vorgangId, vorgangId)).orderBy(desc(gsDokumente.createdAt));
  return rows.map(rowToDokument);
}
export async function getDokument(id: string): Promise<Dokument | null> {
  const rows = await getDb().select().from(gsDokumente).where(eq(gsDokumente.id, id)).limit(1);
  return rows[0] ? rowToDokument(rows[0]) : null;
}
export async function createDokument(input: Partial<Dokument> & { vorgangId: string }): Promise<Dokument> {
  const now = nowIso();
  const id = genId('dok');
  const { vorgangId, personId, typ, istOriginal, version, created_at, updated_at, id: _i, ...data } = input;
  void version; void created_at; void updated_at; void _i;
  await getDb().insert(gsDokumente).values({
    id, vorgangId, personId: personId ?? null, typ: typ ?? 'sonstiges',
    istOriginal: istOriginal ?? false, data: data as never, version: 1, createdAt: now, updatedAt: now,
  });
  return (await getDokument(id))!;
}
export async function updateDokument(id: string, updates: Partial<Dokument>, opts: UpdateOpts = {}): Promise<Dokument | null> {
  const existing = await getDokument(id);
  if (!existing) return null;
  checkVersion(existing, opts.expectedVersion, !!opts.force);
  const merged = { ...existing, ...updates, id, vorgangId: existing.vorgangId, version: (existing.version ?? 1) + 1, updated_at: nowIso() };
  const { id: _i, vorgangId, personId, typ, istOriginal, version, created_at, updated_at, ...data } = merged;
  void _i; void created_at; void vorgangId;
  const res = await getDb().update(gsDokumente)
    .set({ personId: personId ?? null, typ, istOriginal: istOriginal ?? false, data: data as never, updatedAt: updated_at, version })
    .where(opts.force || opts.expectedVersion === undefined ? eq(gsDokumente.id, id) : and(eq(gsDokumente.id, id), eq(gsDokumente.version, opts.expectedVersion)))
    .returning({ id: gsDokumente.id });
  if (res.length === 0) throw new VersionConflictError(await getDokument(id));
  return getDokument(id);
}
export async function deleteDokument(id: string): Promise<boolean> {
  const r = await getDb().delete(gsDokumente).where(eq(gsDokumente.id, id)).returning({ id: gsDokumente.id });
  return r.length > 0;
}

// ── Prüfschritte ─────────────────────────────────────────────────────────

export async function listPruefschritte(vorgangId: string): Promise<Pruefschritt[]> {
  const rows = await getDb().select().from(gsPruefschritte).where(eq(gsPruefschritte.vorgangId, vorgangId)).orderBy(gsPruefschritte.createdAt);
  return rows.map(rowToPruef);
}
export async function getPruefschritt(id: string): Promise<Pruefschritt | null> {
  const rows = await getDb().select().from(gsPruefschritte).where(eq(gsPruefschritte.id, id)).limit(1);
  return rows[0] ? rowToPruef(rows[0]) : null;
}
export async function createPruefschritt(input: Partial<Pruefschritt> & { vorgangId: string; titel: string }): Promise<Pruefschritt> {
  const now = nowIso();
  const id = genId('pruef');
  const { vorgangId, personId, regelId, kategorie, typ, status, titel, version, created_at, updated_at, id: _i, ...data } = input;
  void version; void created_at; void updated_at; void _i;
  await getDb().insert(gsPruefschritte).values({
    id, vorgangId, personId: personId ?? null, regelId: regelId ?? '',
    kategorie: kategorie ?? 'vollstaendigkeit', typ: typ ?? 'anforderung',
    status: status ?? 'offen', titel, data: { automatisch: false, ...data } as never,
    version: 1, createdAt: now, updatedAt: now,
  });
  return (await getPruefschritt(id))!;
}
export async function updatePruefschritt(id: string, updates: Partial<Pruefschritt>, opts: UpdateOpts = {}): Promise<Pruefschritt | null> {
  const existing = await getPruefschritt(id);
  if (!existing) return null;
  checkVersion(existing, opts.expectedVersion, !!opts.force);
  const merged = { ...existing, ...updates, id, vorgangId: existing.vorgangId, version: (existing.version ?? 1) + 1, updated_at: nowIso() };
  const { id: _i, vorgangId, personId, regelId, kategorie, typ, status, titel, version, created_at, updated_at, ...data } = merged;
  void _i; void created_at; void vorgangId;
  const res = await getDb().update(gsPruefschritte)
    .set({ personId: personId ?? null, regelId, kategorie, typ, status, titel, data: data as never, updatedAt: updated_at, version })
    .where(opts.force || opts.expectedVersion === undefined ? eq(gsPruefschritte.id, id) : and(eq(gsPruefschritte.id, id), eq(gsPruefschritte.version, opts.expectedVersion)))
    .returning({ id: gsPruefschritte.id });
  if (res.length === 0) throw new VersionConflictError(await getPruefschritt(id));
  return getPruefschritt(id);
}
export async function deletePruefschritt(id: string): Promise<boolean> {
  const r = await getDb().delete(gsPruefschritte).where(eq(gsPruefschritte.id, id)).returning({ id: gsPruefschritte.id });
  return r.length > 0;
}

/**
 * Automatische Prüfschritte mit dem aktuellen Engine-Ergebnis abgleichen (idempotent).
 * Plan aus `planePruefschrittSync` (rein, getestet): manuelle und erledigte/verworfene
 * Schritte bleiben erhalten.
 */
export async function syncPruefschritte(vorgangId: string, befunde: PruefBefund[]): Promise<Pruefschritt[]> {
  const db = getDb();
  const plan = planePruefschrittSync(await listPruefschritte(vorgangId), befunde);
  const now = nowIso();
  if (plan.anlegen.length) {
    await db.insert(gsPruefschritte).values(plan.anlegen.map((b) => ({
      id: genId('pruef'), vorgangId, personId: b.personId ?? null, regelId: b.regelId,
      kategorie: b.kategorie, typ: b.typ, status: 'offen', titel: b.titel,
      data: { automatisch: true, belegtext: b.belegtext, quellDokumentId: b.quellDokumentId } as never,
      version: 1, createdAt: now, updatedAt: now,
    })));
  }
  if (plan.entfernen.length) {
    await db.delete(gsPruefschritte).where(inArray(gsPruefschritte.id, plan.entfernen));
  }
  return listPruefschritte(vorgangId);
}

// ── Schreiben ────────────────────────────────────────────────────────────

export async function listSchreiben(vorgangId: string): Promise<Schreiben[]> {
  const rows = await getDb().select().from(gsSchreiben).where(eq(gsSchreiben.vorgangId, vorgangId)).orderBy(desc(gsSchreiben.createdAt));
  return rows.map(rowToSchreiben);
}
export async function getSchreiben(id: string): Promise<Schreiben | null> {
  const rows = await getDb().select().from(gsSchreiben).where(eq(gsSchreiben.id, id)).limit(1);
  return rows[0] ? rowToSchreiben(rows[0]) : null;
}
export async function createSchreiben(input: Partial<Schreiben> & { vorgangId: string }): Promise<Schreiben> {
  const now = nowIso();
  const id = genId('schreiben');
  const { vorgangId, art, version, created_at, updated_at, id: _i, ...data } = input;
  void version; void created_at; void updated_at; void _i;
  await getDb().insert(gsSchreiben).values({
    id, vorgangId, art: art ?? 'erstanforderung', data: data as never, version: 1, createdAt: now, updatedAt: now,
  });
  return (await getSchreiben(id))!;
}
export async function updateSchreiben(id: string, updates: Partial<Schreiben>, opts: UpdateOpts = {}): Promise<Schreiben | null> {
  const existing = await getSchreiben(id);
  if (!existing) return null;
  checkVersion(existing, opts.expectedVersion, !!opts.force);
  const merged = { ...existing, ...updates, id, vorgangId: existing.vorgangId, version: (existing.version ?? 1) + 1, updated_at: nowIso() };
  const { id: _i, vorgangId, art, version, created_at, updated_at, ...data } = merged;
  void _i; void created_at; void vorgangId;
  const res = await getDb().update(gsSchreiben)
    .set({ art, data: data as never, updatedAt: updated_at, version })
    .where(opts.force || opts.expectedVersion === undefined ? eq(gsSchreiben.id, id) : and(eq(gsSchreiben.id, id), eq(gsSchreiben.version, opts.expectedVersion)))
    .returning({ id: gsSchreiben.id });
  if (res.length === 0) throw new VersionConflictError(await getSchreiben(id));
  return getSchreiben(id);
}
export async function deleteSchreiben(id: string): Promise<boolean> {
  const r = await getDb().delete(gsSchreiben).where(eq(gsSchreiben.id, id)).returning({ id: gsSchreiben.id });
  return r.length > 0;
}

// ── Aktivitäten (append-only) ──────────────────────────────────────────────

export async function listAktivitaeten(vorgangId: string): Promise<Aktivitaet[]> {
  const rows = await getDb().select().from(gsAktivitaeten).where(eq(gsAktivitaeten.vorgangId, vorgangId)).orderBy(desc(gsAktivitaeten.createdAt));
  return rows.map(rowToAktivitaet);
}
export async function addAktivitaet(input: { vorgangId: string; typ: string; akteur?: string; beschreibung?: string }): Promise<Aktivitaet> {
  const now = nowIso();
  const id = genId('akt');
  await getDb().insert(gsAktivitaeten).values({
    id, vorgangId: input.vorgangId, typ: input.typ, akteur: input.akteur ?? null,
    data: { beschreibung: input.beschreibung } as never, createdAt: now,
  });
  return (await listAktivitaeten(input.vorgangId))[0]!;
}

// ── Textbausteine ───────────────────────────────────────────────────────────

function rowToTextbaustein(r: typeof gsTextbausteine.$inferSelect): Textbaustein {
  return { id: r.id, kategorie: r.kategorie, titel: r.titel, text: r.text, created_at: r.createdAt, updated_at: r.updatedAt };
}
export async function listTextbausteine(): Promise<Textbaustein[]> {
  const rows = await getDb().select().from(gsTextbausteine).orderBy(gsTextbausteine.kategorie, gsTextbausteine.titel);
  return rows.map(rowToTextbaustein);
}
async function getTextbaustein(id: string): Promise<Textbaustein | null> {
  const rows = await getDb().select().from(gsTextbausteine).where(eq(gsTextbausteine.id, id)).limit(1);
  return rows[0] ? rowToTextbaustein(rows[0]) : null;
}
export async function createTextbaustein(input: { kategorie: string; titel: string; text: string }): Promise<Textbaustein> {
  const now = nowIso();
  const id = genId('tb');
  await getDb().insert(gsTextbausteine).values({
    id, kategorie: input.kategorie || 'Allgemein', titel: input.titel, text: input.text, createdAt: now, updatedAt: now,
  });
  return (await getTextbaustein(id))!;
}
export async function updateTextbaustein(id: string, updates: Partial<Pick<Textbaustein, 'kategorie' | 'titel' | 'text'>>): Promise<Textbaustein | null> {
  const existing = await getTextbaustein(id);
  if (!existing) return null;
  await getDb().update(gsTextbausteine).set({
    kategorie: updates.kategorie ?? existing.kategorie,
    titel: updates.titel ?? existing.titel,
    text: updates.text ?? existing.text,
    updatedAt: nowIso(),
  }).where(eq(gsTextbausteine.id, id));
  return getTextbaustein(id);
}
export async function loescheTextbaustein(id: string): Promise<boolean> {
  const r = await getDb().delete(gsTextbausteine).where(eq(gsTextbausteine.id, id)).returning({ id: gsTextbausteine.id });
  return r.length > 0;
}

// ── Audit-Log (append-only) — Antrag-Kern ─────────────────────────────────

export type { AuditGesamtFilter };

const auditStore = createAuditStore(gsAuditLog);

export const addAuditEintrag = auditStore.addAuditEintrag;
export const listAuditEintraege = auditStore.listAuditEintraege;
export const listAuditEintraegeGesamt = auditStore.listAuditEintraegeGesamt;
export const countAuditEintraegeGesamt = auditStore.countAuditEintraegeGesamt;

// ── Feld-Status / Notizen — Antrag-Kern ────────────────────────────────────

const feldStatusStore = createFeldStatusStore<FeldStatusZielTyp>(gsFeldStatus);

export const listFeldStatus = feldStatusStore.listFeldStatus;
export const getFeldStatus = feldStatusStore.getFeldStatus;
/** Upsert per (vorgangId, zielTyp, zielId, feldPfad). */
export const setFeldStatus = feldStatusStore.setFeldStatus;
export { feldStatusStore };

const notizenStore = createNotizenStore(gsNotizen);

export const listNotizen = notizenStore.listNotizen;
export const addNotiz = notizenStore.addNotiz;
export { notizenStore };

// ── Posteingang-Warteschlange — Antrag-Kern (Routen folgen in G3) ────────────

const posteingangStore = createPosteingangStore<Posteingang>(gsPosteingang);

export const listPosteingang = posteingangStore.listPosteingang;
export const getPosteingang = posteingangStore.getPosteingang;
export const createPosteingang = posteingangStore.createPosteingang;
export const updatePosteingang = posteingangStore.updatePosteingang;
export { posteingangStore };

// ── Snapshot (Input für die Regel-Engine) ──────────────────────────────────

export async function getVorgangSnapshot(vorgangId: string): Promise<VorgangSnapshot | null> {
  const vorgang = await getVorgang(vorgangId);
  if (!vorgang) return null;
  const [personen, dokumente] = await Promise.all([listPersonen(vorgangId), listDokumente(vorgangId)]);
  return { vorgang, personen, dokumente };
}
