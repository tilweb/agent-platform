/**
 * Antrag-Kern — Posteingang: Speicher (Drizzle-CRUD, Optimistic-Locking via `version`).
 *
 * `createPosteingangStore(tabelle)` auf einer Tabelle aus `posteingangTabelle(schema, praefix)`.
 * Der Fortschritt der Auswertung liegt in `data.fortschritt` und wird ohne Versionssprung
 * geschrieben (reine Anzeige).
 */
import { eq, and, ne, desc, sql as rawSql } from 'drizzle-orm';
import { getDb } from '../../../../db';
import { VersionConflictError, checkVersion } from '../concurrency';
import { genId, nowIso } from '../ids';
import type { PosteingangTabelle } from '../tabellen';
import type { Posteingang, PosteingangDateiBasis, PosteingangQuelle, PosteingangStatus } from './typen';

export { posteingangTabelle, type PosteingangTabelle } from '../tabellen';

/** Schnittstelle des Speichers (die Routen-Fabrik hängt nur hiervon ab — Tests nutzen Fakes). */
export interface PosteingangStore<TEingang extends Posteingang<PosteingangDateiBasis, unknown>> {
  listPosteingang(filter?: { status?: string; quelle?: string }): Promise<TEingang[]>;
  getPosteingang(id: string): Promise<TEingang | null>;
  /** Neuester nicht verworfener Eingang mit diesem Umschlag-Hash (Dedupe/Idempotenz). */
  findePosteingangNachHash(hash: string): Promise<TEingang | null>;
  createPosteingang(input?: Partial<TEingang>): Promise<TEingang>;
  updatePosteingang(id: string, updates: Partial<TEingang>, opts?: { expectedVersion?: number; force?: boolean }): Promise<TEingang | null>;
  deletePosteingang(id: string): Promise<boolean>;
  setzePosteingangFortschritt(id: string, fortschritt: unknown | null): Promise<void>;
}

export function createPosteingangStore<TEingang extends Posteingang<PosteingangDateiBasis, unknown>>(
  tabelle: PosteingangTabelle,
  opts: { idPraefix?: string } = {},
): PosteingangStore<TEingang> {
  const idPraefix = opts.idPraefix ?? 'pe';

  function rowToPosteingang(r: PosteingangTabelle['$inferSelect']): TEingang {
    const data = (r.data ?? {}) as Record<string, unknown>;
    return {
      id: r.id,
      quelle: r.quelle as PosteingangQuelle,
      eingegangenAm: r.eingegangenAm,
      betreff: r.betreff ?? undefined,
      status: r.status as PosteingangStatus,
      dateien: (r.dateien ?? []) as TEingang['dateien'],
      matchVorschlag: (r.matchVorschlag ?? undefined) as TEingang['matchVorschlag'],
      zugeordneterVorgangId: r.zugeordneterVorgangId ?? undefined,
      zugeordneteAkteId: r.zugeordneteAkteId ?? undefined,
      bearbeiterId: r.bearbeiterId ?? undefined,
      verworfenGrund: r.verworfenGrund ?? undefined,
      hash: r.hash ?? undefined,
      data,
      version: r.version,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
    } as TEingang;
  }

  async function listPosteingang(filter?: { status?: string; quelle?: string }): Promise<TEingang[]> {
    const db = getDb();
    const conds = [];
    if (filter?.status) conds.push(eq(tabelle.status, filter.status));
    if (filter?.quelle) conds.push(eq(tabelle.quelle, filter.quelle));
    const q = db.select().from(tabelle).orderBy(desc(tabelle.eingegangenAm));
    const rows = conds.length ? await q.where(and(...conds)) : await q;
    return rows.map(rowToPosteingang);
  }

  async function getPosteingang(id: string): Promise<TEingang | null> {
    const db = getDb();
    const rows = await db.select().from(tabelle).where(eq(tabelle.id, id)).limit(1);
    return rows[0] ? rowToPosteingang(rows[0]) : null;
  }

  async function findePosteingangNachHash(hash: string): Promise<TEingang | null> {
    const db = getDb();
    const rows = await db.select().from(tabelle)
      .where(and(eq(tabelle.hash, hash), ne(tabelle.status, 'verworfen')))
      .orderBy(desc(tabelle.eingegangenAm))
      .limit(1);
    return rows[0] ? rowToPosteingang(rows[0]) : null;
  }

  async function createPosteingang(input: Partial<TEingang> = {}): Promise<TEingang> {
    const db = getDb();
    const now = nowIso();
    const id = genId(idPraefix);
    await db.insert(tabelle).values({
      id,
      quelle: input.quelle ?? 'manuell',
      eingegangenAm: input.eingegangenAm ?? now,
      betreff: input.betreff ?? null,
      status: input.status ?? 'eingegangen',
      dateien: (input.dateien ?? []) as never,
      matchVorschlag: (input.matchVorschlag ?? null) as never,
      zugeordneterVorgangId: input.zugeordneterVorgangId ?? null,
      zugeordneteAkteId: input.zugeordneteAkteId ?? null,
      bearbeiterId: input.bearbeiterId ?? null,
      verworfenGrund: input.verworfenGrund ?? null,
      hash: input.hash ?? null,
      data: (input.data ?? {}) as never,
      version: 1, createdAt: now, updatedAt: now,
    });
    return (await getPosteingang(id))!;
  }

  /**
   * Fortschritt der Auswertung am Eingang setzen/entfernen — ohne Versionssprung und ohne
   * `updatedAt` (reine Anzeige, darf parallele Änderungen nicht in Konflikte treiben).
   */
  async function setzePosteingangFortschritt(id: string, fortschritt: unknown | null): Promise<void> {
    const db = getDb();
    const data = fortschritt === null
      ? rawSql`coalesce(${tabelle.data}, '{}'::jsonb) - 'fortschritt'`
      : rawSql`jsonb_set(coalesce(${tabelle.data}, '{}'::jsonb), '{fortschritt}', ${JSON.stringify(fortschritt)}::jsonb)`;
    await db.update(tabelle).set({ data: data as never }).where(eq(tabelle.id, id));
  }

  async function updatePosteingang(id: string, updates: Partial<TEingang>, o: { expectedVersion?: number; force?: boolean } = {}): Promise<TEingang | null> {
    const db = getDb();
    const existing = await getPosteingang(id);
    if (!existing) return null;
    checkVersion(existing, o.expectedVersion, !!o.force);
    const merged = { ...existing, ...updates, id, version: (existing.version ?? 1) + 1, updated_at: nowIso() };
    const {
      quelle, eingegangenAm, betreff, status, dateien, matchVorschlag,
      zugeordneterVorgangId, zugeordneteAkteId, bearbeiterId, verworfenGrund, hash, data, version, updated_at,
    } = merged;
    const res = await db.update(tabelle)
      .set({
        quelle, eingegangenAm, betreff: betreff ?? null, status,
        dateien: (dateien ?? []) as never,
        matchVorschlag: (matchVorschlag ?? null) as never,
        zugeordneterVorgangId: zugeordneterVorgangId ?? null,
        zugeordneteAkteId: zugeordneteAkteId ?? null,
        bearbeiterId: bearbeiterId ?? null,
        verworfenGrund: verworfenGrund ?? null,
        hash: hash ?? null,
        data: (data ?? {}) as never,
        updatedAt: updated_at, version,
      })
      .where(o.force || o.expectedVersion === undefined ? eq(tabelle.id, id) : and(eq(tabelle.id, id), eq(tabelle.version, o.expectedVersion)))
      .returning({ id: tabelle.id });
    if (res.length === 0) throw new VersionConflictError(await getPosteingang(id));
    return getPosteingang(id);
  }

  async function deletePosteingang(id: string): Promise<boolean> {
    const db = getDb();
    const r = await db.delete(tabelle).where(eq(tabelle.id, id)).returning({ id: tabelle.id });
    return r.length > 0;
  }

  return {
    listPosteingang, getPosteingang, findePosteingangNachHash, createPosteingang,
    updatePosteingang, deletePosteingang, setzePosteingangFortschritt,
  };
}
