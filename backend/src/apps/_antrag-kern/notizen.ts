/**
 * Antrag-Kern — Interne Notizen je Sektion/Person eines Vorgangs (append-only).
 *
 * - `notizenTabelle(schema, praefix, vorgangIdRef)` → Tabelle im App-Schema (siehe tabellen.ts)
 * - `createNotizenStore(tabelle)` → Liste, Anlegen, Lesen, Löschen
 * - `createNotizenRoutes(...)` → GET/POST je Vorgang, DELETE je Notiz (mit Audit)
 */
import { Hono, type Context } from 'hono';
import { eq } from 'drizzle-orm';
import { getDb } from '../../db';
import { getCurrentUserId } from '../../auth/middleware';
import { genId, nowIso } from './ids';
import type { NotizenTabelle } from './tabellen';

export { notizenTabelle, type NotizenTabelle } from './tabellen';

// ── Typen ────────────────────────────────────────────────────────────────────

/** Interne Notiz zu einer Sektion oder Person eines Vorgangs (append-only). */
export interface Notiz {
  id: string;
  vorgangId: string;
  anker: string;                // z. B. 'sektion:allgemein' | 'person:<id>'
  autor?: string;
  text: string;
  created_at: string;
}

export interface NotizInput {
  vorgangId: string;
  anker: string;
  autor?: string;
  text: string;
}

/** Schnittstelle des Speichers (die Routen-Fabrik hängt nur hiervon ab — Tests nutzen Fakes). */
export interface NotizenStore {
  listNotizen(vorgangId: string): Promise<Notiz[]>;
  addNotiz(input: NotizInput): Promise<Notiz>;
  getNotiz(id: string): Promise<Notiz | null>;
  loescheNotiz(id: string): Promise<boolean>;
}

// ── Speicher ─────────────────────────────────────────────────────────────────

export function createNotizenStore(tabelle: NotizenTabelle, opts: { idPraefix?: string } = {}): NotizenStore {
  const idPraefix = opts.idPraefix ?? 'notiz';

  function rowToNotiz(r: NotizenTabelle['$inferSelect']): Notiz {
    return {
      id: r.id, vorgangId: r.vorgangId, anker: r.anker,
      autor: r.autor ?? undefined, text: r.text, created_at: r.createdAt,
    };
  }

  async function listNotizen(vorgangId: string): Promise<Notiz[]> {
    const db = getDb();
    const rows = await db.select().from(tabelle)
      .where(eq(tabelle.vorgangId, vorgangId))
      .orderBy(tabelle.createdAt);
    return rows.map(rowToNotiz);
  }

  async function getNotiz(id: string): Promise<Notiz | null> {
    const db = getDb();
    const rows = await db.select().from(tabelle).where(eq(tabelle.id, id)).limit(1);
    return rows[0] ? rowToNotiz(rows[0]) : null;
  }

  async function addNotiz(input: NotizInput): Promise<Notiz> {
    const db = getDb();
    const now = nowIso();
    const id = genId(idPraefix);
    await db.insert(tabelle).values({
      id, vorgangId: input.vorgangId, anker: input.anker,
      autor: input.autor ?? null, text: input.text, createdAt: now,
    });
    return (await getNotiz(id))!;
  }

  async function loescheNotiz(id: string): Promise<boolean> {
    const db = getDb();
    const r = await db.delete(tabelle).where(eq(tabelle.id, id)).returning({ id: tabelle.id });
    return r.length > 0;
  }

  return { listNotizen, addNotiz, getNotiz, loescheNotiz };
}

// ── Routen ───────────────────────────────────────────────────────────────────

/** Audit-Ereignis der Notizen (Objekttyp immer `notiz`). */
export interface NotizAuditEvent {
  aktion: string;
  objektTyp: 'notiz';
  objektId?: string;
  vorgangId?: string;
  detail?: string;
}

export interface NotizenRoutenOptionen {
  store: NotizenStore;
  vorgangExistiert: (vorgangId: string) => Promise<boolean>;
  guards: {
    denyIfNotAppEditor: (c: Context) => { error: string } | null;
    /** Art. 18: eingeschränkte Vorgänge sind schreibgeschützt (auch für Notizen). */
    denyIfVorgangEingeschraenkt?: (vorgangId: string) => Promise<{ error: string } | null>;
  };
  audit: (c: Context, e: NotizAuditEvent) => Promise<void>;
}

/**
 *  - GET    /vorgaenge/:vorgangId/notizen  → { notizen }
 *  - POST   /vorgaenge/:vorgangId/notizen  { anker, text } → { notiz } (201)
 *  - DELETE /notizen/:id                   → { ok }
 *
 * Lesen ohne Gate; Anlegen/Löschen nur Editor/Owner. Autor = angemeldeter Nutzer.
 */
export function createNotizenRoutes(opts: NotizenRoutenOptionen) {
  const { store, guards, audit } = opts;
  const routes = new Hono();

  routes.get('/vorgaenge/:vorgangId/notizen', async (c) => {
    return c.json({ notizen: await store.listNotizen(c.req.param('vorgangId')) });
  });

  routes.post('/vorgaenge/:vorgangId/notizen', async (c) => {
    const denied = guards.denyIfNotAppEditor(c);
    if (denied) return c.json(denied, 403);
    const vorgangId = c.req.param('vorgangId');
    if (!(await opts.vorgangExistiert(vorgangId))) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
    const eingeschr = await guards.denyIfVorgangEingeschraenkt?.(vorgangId);
    if (eingeschr) return c.json(eingeschr, 403);
    const body = await c.req.json<{ anker?: string; text?: string }>().catch(() => null);
    if (!body?.anker?.trim()) return c.json({ error: 'anker ist erforderlich' }, 400);
    if (!body?.text?.trim()) return c.json({ error: 'text ist erforderlich' }, 400);
    const notiz = await store.addNotiz({
      vorgangId, anker: body.anker.trim(), text: body.text.trim(), autor: getCurrentUserId(c),
    });
    await audit(c, { aktion: 'notiz.erstellt', objektTyp: 'notiz', objektId: notiz.id, vorgangId, detail: notiz.anker });
    return c.json({ notiz }, 201);
  });

  routes.delete('/notizen/:id', async (c) => {
    const denied = guards.denyIfNotAppEditor(c);
    if (denied) return c.json(denied, 403);
    const id = c.req.param('id');
    const before = await store.getNotiz(id);
    const eingeschr = before ? await guards.denyIfVorgangEingeschraenkt?.(before.vorgangId) : null;
    if (eingeschr) return c.json(eingeschr, 403);
    const ok = await store.loescheNotiz(id);
    if (ok) await audit(c, { aktion: 'notiz.geloescht', objektTyp: 'notiz', objektId: id, vorgangId: before?.vorgangId, detail: before?.anker });
    return ok ? c.json({ ok: true }) : c.json({ error: 'Notiz nicht gefunden' }, 404);
  });

  return routes;
}
