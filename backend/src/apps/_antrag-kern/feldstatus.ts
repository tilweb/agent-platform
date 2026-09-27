/**
 * Antrag-Kern — Feld-Provenienz: KI-Vorschläge auf Feldebene bestätigen/verwerfen.
 *
 * - `feldStatusTabelle(schema, praefix, vorgangIdRef)` → Tabelle im App-Schema (siehe tabellen.ts)
 * - `createFeldStatusStore(tabelle)` → CRUD inkl. Upsert je (vorgang, zielTyp, zielId, feldPfad)
 * - `createFeldstatusRoutes(...)` → Liste, Bestätigen/Verwerfen einzeln, alle bestätigen
 *
 * Der Ziel-Typ (`zielTyp`) ist ein generischer String; welche Ziele es gibt und was beim
 * Bestätigen/Verwerfen fachlich passiert (Feld leeren, Folgedaten übernehmen, Lernsignal,
 * Neuprüfung), liefert die App über Hooks.
 */
import { Hono, type Context } from 'hono';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../../db';
import { genId, nowIso } from './ids';
import type { FeldStatusTabelle } from './tabellen';

export { feldStatusTabelle, type FeldStatusTabelle } from './tabellen';

// ── Typen ────────────────────────────────────────────────────────────────────

/** Herkunft eines Feldwerts. */
export type FeldQuelle = 'llm' | 'mensch';

/**
 * Feld-Provenienz: markiert einen extrahierten Feldwert als Vorschlag, den die
 * Sachbearbeitung bestätigt/verwirft. Generisch statt Umbau jedes Feldes.
 */
export interface FeldStatus<TZiel extends string = string> {
  id: string;
  vorgangId: string;
  zielTyp: TZiel;
  zielId: string;
  feldPfad: string;
  quelle: FeldQuelle;
  bestaetigt: boolean;
  quellDokumentId?: string;
  confidence?: number;
  created_at: string;
  updated_at: string;
}

/** Eingabe für `setFeldStatus` (Upsert). */
export interface FeldStatusInput<TZiel extends string = string> {
  vorgangId: string;
  zielTyp: TZiel;
  zielId: string;
  feldPfad: string;
  quelle: FeldQuelle;
  bestaetigt?: boolean;
  quellDokumentId?: string;
  confidence?: number;
}

/** Schnittstelle des Speichers (die Routen-Fabrik hängt nur hiervon ab — Tests nutzen Fakes). */
export interface FeldStatusStore<TZiel extends string = string> {
  listFeldStatus(vorgangId: string): Promise<FeldStatus<TZiel>[]>;
  getFeldStatus(id: string): Promise<FeldStatus<TZiel> | null>;
  /** Upsert per (vorgangId, zielTyp, zielId, feldPfad). */
  setFeldStatus(input: FeldStatusInput<TZiel>): Promise<FeldStatus<TZiel>>;
  /** Einen Feld-Status bestätigen (bestaetigt=true). Unbekannt ⇒ null. */
  bestaetigeFeld(id: string): Promise<FeldStatus<TZiel> | null>;
  /** Alle offenen (unbestätigten) Feld-Status eines Vorgangs bestätigen; liefert die ganze Liste. */
  bestaetigeAlle(vorgangId: string): Promise<FeldStatus<TZiel>[]>;
  loescheFeldStatus(id: string): Promise<boolean>;
}

// ── Speicher ─────────────────────────────────────────────────────────────────

export function createFeldStatusStore<TZiel extends string = string>(
  tabelle: FeldStatusTabelle,
  opts: { idPraefix?: string } = {},
): FeldStatusStore<TZiel> {
  const idPraefix = opts.idPraefix ?? 'fs';

  function rowToFeldStatus(r: FeldStatusTabelle['$inferSelect']): FeldStatus<TZiel> {
    return {
      id: r.id,
      vorgangId: r.vorgangId,
      zielTyp: r.zielTyp as TZiel,
      zielId: r.zielId,
      feldPfad: r.feldPfad,
      quelle: r.quelle as FeldQuelle,
      bestaetigt: r.bestaetigt,
      quellDokumentId: r.quellDokumentId ?? undefined,
      confidence: r.confidence ?? undefined,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
    };
  }

  async function listFeldStatus(vorgangId: string): Promise<FeldStatus<TZiel>[]> {
    const db = getDb();
    const rows = await db.select().from(tabelle)
      .where(eq(tabelle.vorgangId, vorgangId))
      .orderBy(tabelle.createdAt);
    return rows.map(rowToFeldStatus);
  }

  async function getFeldStatus(id: string): Promise<FeldStatus<TZiel> | null> {
    const db = getDb();
    const rows = await db.select().from(tabelle).where(eq(tabelle.id, id)).limit(1);
    return rows[0] ? rowToFeldStatus(rows[0]) : null;
  }

  async function setFeldStatus(input: FeldStatusInput<TZiel>): Promise<FeldStatus<TZiel>> {
    const db = getDb();
    const now = nowIso();
    const existing = await db.select().from(tabelle).where(and(
      eq(tabelle.vorgangId, input.vorgangId),
      eq(tabelle.zielTyp, input.zielTyp),
      eq(tabelle.zielId, input.zielId),
      eq(tabelle.feldPfad, input.feldPfad),
    )).limit(1);
    if (existing[0]) {
      await db.update(tabelle).set({
        quelle: input.quelle,
        bestaetigt: input.bestaetigt ?? false,
        quellDokumentId: input.quellDokumentId ?? null,
        confidence: input.confidence ?? null,
        updatedAt: now,
      }).where(eq(tabelle.id, existing[0].id));
      return (await getFeldStatus(existing[0].id))!;
    }
    const id = genId(idPraefix);
    await db.insert(tabelle).values({
      id, vorgangId: input.vorgangId, zielTyp: input.zielTyp, zielId: input.zielId,
      feldPfad: input.feldPfad, quelle: input.quelle, bestaetigt: input.bestaetigt ?? false,
      quellDokumentId: input.quellDokumentId ?? null, confidence: input.confidence ?? null,
      createdAt: now, updatedAt: now,
    });
    return (await getFeldStatus(id))!;
  }

  async function bestaetigeFeld(id: string): Promise<FeldStatus<TZiel> | null> {
    const db = getDb();
    const res = await db.update(tabelle)
      .set({ bestaetigt: true, updatedAt: nowIso() })
      .where(eq(tabelle.id, id))
      .returning({ id: tabelle.id });
    if (res.length === 0) return null;
    return getFeldStatus(id);
  }

  async function bestaetigeAlle(vorgangId: string): Promise<FeldStatus<TZiel>[]> {
    const db = getDb();
    await db.update(tabelle)
      .set({ bestaetigt: true, updatedAt: nowIso() })
      .where(and(eq(tabelle.vorgangId, vorgangId), eq(tabelle.bestaetigt, false)));
    return listFeldStatus(vorgangId);
  }

  async function loescheFeldStatus(id: string): Promise<boolean> {
    const db = getDb();
    const r = await db.delete(tabelle).where(eq(tabelle.id, id)).returning({ id: tabelle.id });
    return r.length > 0;
  }

  return { listFeldStatus, getFeldStatus, setFeldStatus, bestaetigeFeld, bestaetigeAlle, loescheFeldStatus };
}

// ── Routen ───────────────────────────────────────────────────────────────────

/** Audit-Ereignis der Feld-Provenienz (Objekttyp immer `feldstatus`). */
export interface FeldstatusAuditEvent {
  aktion: string;
  objektTyp: 'feldstatus';
  objektId?: string;
  vorgangId?: string;
  detail?: string;
}

export type FeldEntscheidung = 'bestaetigt' | 'verworfen';

export interface FeldstatusRoutenOptionen<TZiel extends string = string> {
  store: Pick<FeldStatusStore<TZiel>, 'listFeldStatus' | 'getFeldStatus' | 'bestaetigeFeld' | 'bestaetigeAlle' | 'loescheFeldStatus'>;
  guards: {
    denyIfNotAppEditor: (c: Context) => { error: string } | null;
    /** Einschränkungs-Gate des Vorgangs (z. B. Art. 18 DSGVO „nur lesend"). */
    denyIfVorgangEingeschraenkt: (vorgangId: string) => Promise<{ error: string } | null>;
  };
  audit: (c: Context, e: FeldstatusAuditEvent) => Promise<void>;
  /** Je bestätigtem Feld (einzeln bzw. je vorher offenem Feld bei „alle"), vor dem Audit. */
  beiBestaetigt?: (fs: FeldStatus<TZiel>) => Promise<void>;
  /** Vor dem Löschen des Status: den vorgeschlagenen Feldwert fachlich zurücknehmen. */
  beiVerwerfen?: (fs: FeldStatus<TZiel>) => Promise<void>;
  /**
   * Entscheidung vermerken (z. B. Lernsignal). Aufrufzeitpunkt wie bisher: bestätigen →
   * nach dem Audit; verwerfen / alle bestätigen → vor dem Audit.
   */
  beiEntscheidung?: (vorgangId: string, felder: FeldStatus<TZiel>[], entscheidung: FeldEntscheidung) => Promise<void>;
  /** Nach Audit, letzter Schritt vor der Antwort (z. B. automatische Neuprüfung). */
  nachAenderung?: (vorgangId: string, entscheidung: FeldEntscheidung) => Promise<void>;
}

/**
 *  - GET    /vorgaenge/:vorgangId/feldstatus                     → { feldStatus }
 *  - POST   /vorgaenge/:vorgangId/feldstatus/:fsId/bestaetigen   → { feldStatus } (bestaetigt=true)
 *  - POST   /vorgaenge/:vorgangId/feldstatus/:fsId/verwerfen     → { ok } (Hook + Status löschen)
 *  - POST   /vorgaenge/:vorgangId/feldstatus/alle-bestaetigen    → { feldStatus } (alle offenen)
 *
 * Lesen ohne Gate; Schreiben nur Editor/Owner und nicht bei eingeschränktem Vorgang.
 */
export function createFeldstatusRoutes<TZiel extends string = string>(opts: FeldstatusRoutenOptionen<TZiel>) {
  const { store, guards, audit } = opts;
  const routes = new Hono();

  routes.get('/vorgaenge/:vorgangId/feldstatus', async (c) => {
    return c.json({ feldStatus: await store.listFeldStatus(c.req.param('vorgangId')) });
  });

  routes.post('/vorgaenge/:vorgangId/feldstatus/:fsId/bestaetigen', async (c) => {
    const denied = guards.denyIfNotAppEditor(c);
    if (denied) return c.json(denied, 403);
    const eingeschr = await guards.denyIfVorgangEingeschraenkt(c.req.param('vorgangId'));
    if (eingeschr) return c.json(eingeschr, 403);
    // Der Eintrag muss zum Vorgang der URL gehören — sonst greift die Einschränkungs-Prüfung ins Leere.
    const vorher = await store.getFeldStatus(c.req.param('fsId'));
    if (!vorher || vorher.vorgangId !== c.req.param('vorgangId')) return c.json({ error: 'Feld-Status nicht gefunden' }, 404);
    const fs = await store.bestaetigeFeld(vorher.id);
    if (!fs) return c.json({ error: 'Feld-Status nicht gefunden' }, 404);
    await opts.beiBestaetigt?.(fs);
    await audit(c, { aktion: 'feld.bestaetigt', objektTyp: 'feldstatus', objektId: fs.id, vorgangId: fs.vorgangId, detail: fs.feldPfad });
    await opts.beiEntscheidung?.(fs.vorgangId, [fs], 'bestaetigt');
    await opts.nachAenderung?.(fs.vorgangId, 'bestaetigt');
    return c.json({ feldStatus: fs });
  });

  routes.post('/vorgaenge/:vorgangId/feldstatus/:fsId/verwerfen', async (c) => {
    const denied = guards.denyIfNotAppEditor(c);
    if (denied) return c.json(denied, 403);
    const eingeschr = await guards.denyIfVorgangEingeschraenkt(c.req.param('vorgangId'));
    if (eingeschr) return c.json(eingeschr, 403);
    const fs = await store.getFeldStatus(c.req.param('fsId'));
    if (!fs || fs.vorgangId !== c.req.param('vorgangId')) return c.json({ error: 'Feld-Status nicht gefunden' }, 404);
    await opts.beiVerwerfen?.(fs);
    await store.loescheFeldStatus(fs.id);
    await opts.beiEntscheidung?.(fs.vorgangId, [fs], 'verworfen');
    await audit(c, { aktion: 'feld.verworfen', objektTyp: 'feldstatus', objektId: fs.id, vorgangId: fs.vorgangId, detail: fs.feldPfad });
    await opts.nachAenderung?.(fs.vorgangId, 'verworfen');
    return c.json({ ok: true });
  });

  routes.post('/vorgaenge/:vorgangId/feldstatus/alle-bestaetigen', async (c) => {
    const denied = guards.denyIfNotAppEditor(c);
    if (denied) return c.json(denied, 403);
    const vorgangId = c.req.param('vorgangId');
    const eingeschr = await guards.denyIfVorgangEingeschraenkt(vorgangId);
    if (eingeschr) return c.json(eingeschr, 403);
    const offenVorher = (await store.listFeldStatus(vorgangId)).filter((f) => !f.bestaetigt);
    const feldStatus = await store.bestaetigeAlle(vorgangId);
    if (opts.beiBestaetigt) for (const fs of offenVorher) await opts.beiBestaetigt(fs);
    await opts.beiEntscheidung?.(vorgangId, offenVorher, 'bestaetigt');
    await audit(c, { aktion: 'feld.alle_bestaetigt', objektTyp: 'feldstatus', vorgangId, detail: 'Alle offenen KI-Vorschläge bestätigt' });
    await opts.nachAenderung?.(vorgangId, 'bestaetigt');
    return c.json({ feldStatus });
  });

  return routes;
}
