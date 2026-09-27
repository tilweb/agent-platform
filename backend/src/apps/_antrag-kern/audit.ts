/**
 * Antrag-Kern — Audit-/Protokoll (GOV-1/GOV-4).
 *
 * - `auditLogTabelle(schema, praefix)` → Tabelle im App-Schema (siehe tabellen.ts)
 * - `createAuditStore(tabelle)` → append-only Speicher + Abfragen
 * - `createAudit({ store, logPraefix })` → `audit(c, event)` / `auditUpdate(c, …)`
 * - `createAuditRoutes(...)` → Owner-Protokollansicht + CSV-Export
 * - reine Helfer: diffFelder, hatAenderung, diffToVorherNachher, auditEintraegeToCsv
 *
 * WICHTIG: Ein Fehler beim Protokollieren darf die eigentliche Fach-Aktion NIE
 * abbrechen — deshalb try/catch + console.error, kein re-throw.
 */
import { Hono, type Context } from 'hono';
import { eq, and, gte, lte, desc, count } from 'drizzle-orm';
import { getDb } from '../../db';
import { getCurrentUser, getCurrentUserId } from '../../auth/middleware';
import { genId, nowIso } from './ids';
import type { AuditLogTabelle } from './tabellen';

export { auditLogTabelle, type AuditLogTabelle } from './tabellen';

// ── Typen ────────────────────────────────────────────────────────────────────

/** Geänderte Felder eines Updates: feldPfad → { alt, neu }. */
export type FeldDiff = Record<string, { alt: unknown; neu: unknown }>;

/**
 * Audit-/Protokoll-Eintrag (append-only, revisionssicher).
 * Eine Zeile je fachlich relevanter Aktion — inkl. Lesezugriff und Downloads/Exporte.
 * Akteur vollständig (id+name+rolle+ip); bei Änderungen Vorher/Nachher als Diff der Kernfelder.
 */
export interface AuditEintrag {
  id: string;
  timestamp: string;
  akteurId?: string;
  akteurName?: string;
  akteurRolle?: string;          // 'owner' | 'editor' | 'viewer' (wirksame Rolle zum Zeitpunkt)
  aktion: string;                // z. B. 'vorgang.geaendert', 'dokument.hochgeladen'
  objektTyp: string;             // von der App festgelegt
  objektId?: string;
  vorgangId?: string;            // Fallbezug (für Filter)
  ergebnis: string;              // 'ok' | 'fehler'
  vorher?: unknown;
  nachher?: unknown;
  detail?: string;
  ip?: string;
}

/** Eingabe für einen neuen Audit-Eintrag. */
export interface AuditEintragInput {
  akteurId?: string | null;
  akteurName?: string | null;
  akteurRolle?: string | null;
  aktion: string;
  objektTyp: string;
  objektId?: string | null;
  vorgangId?: string | null;
  ergebnis?: string;
  vorher?: unknown;
  nachher?: unknown;
  detail?: string | null;
  ip?: string | null;
}

/** Filter für die Admin/DSB-Gesamt-Protokoll-Ansicht (GOV-4). */
export interface AuditGesamtFilter {
  aktion?: string;
  akteurId?: string;
  objektTyp?: string;
  vorgangId?: string;
  von?: string;   // ISO-Timestamp (inklusive Untergrenze)
  bis?: string;   // ISO-Timestamp (inklusive Obergrenze)
  limit?: number;
}

export interface AuditEvent<TObjekt extends string = string> {
  aktion: string;
  objektTyp: TObjekt;
  objektId?: string;
  vorgangId?: string;
  ergebnis?: 'ok' | 'fehler';
  vorher?: unknown;
  nachher?: unknown;
  detail?: string;
}

// ── Speicher ─────────────────────────────────────────────────────────────────

/** Append-only Audit-Speicher auf der übergebenen Tabelle. */
export function createAuditStore(tabelle: AuditLogTabelle) {
  function rowToAudit(r: AuditLogTabelle['$inferSelect']): AuditEintrag {
    return {
      id: r.id,
      timestamp: r.timestamp,
      akteurId: r.akteurId ?? undefined,
      akteurName: r.akteurName ?? undefined,
      akteurRolle: r.akteurRolle ?? undefined,
      aktion: r.aktion,
      objektTyp: r.objektTyp,
      objektId: r.objektId ?? undefined,
      vorgangId: r.vorgangId ?? undefined,
      ergebnis: r.ergebnis,
      vorher: (r.vorher ?? undefined) as unknown,
      nachher: (r.nachher ?? undefined) as unknown,
      detail: r.detail ?? undefined,
      ip: r.ip ?? undefined,
    };
  }

  /** Baut die WHERE-Bedingungen für einen Audit-Filter (intern, wiederverwendet für Count). */
  function auditFilterConds(filter?: AuditGesamtFilter) {
    const conds = [];
    if (filter?.aktion) conds.push(eq(tabelle.aktion, filter.aktion));
    if (filter?.akteurId) conds.push(eq(tabelle.akteurId, filter.akteurId));
    if (filter?.objektTyp) conds.push(eq(tabelle.objektTyp, filter.objektTyp));
    if (filter?.vorgangId) conds.push(eq(tabelle.vorgangId, filter.vorgangId));
    if (filter?.von) conds.push(gte(tabelle.timestamp, filter.von));
    if (filter?.bis) conds.push(lte(tabelle.timestamp, filter.bis));
    return conds;
  }

  /** Einen Audit-Eintrag anhängen (append-only — es gibt bewusst kein Update/Delete). */
  async function addAuditEintrag(input: AuditEintragInput): Promise<void> {
    const db = getDb();
    await db.insert(tabelle).values({
      id: genId('audit'),
      akteurId: input.akteurId ?? null,
      akteurName: input.akteurName ?? null,
      akteurRolle: input.akteurRolle ?? null,
      aktion: input.aktion,
      objektTyp: input.objektTyp,
      objektId: input.objektId ?? null,
      vorgangId: input.vorgangId ?? null,
      ergebnis: input.ergebnis ?? 'ok',
      vorher: (input.vorher ?? null) as never,
      nachher: (input.nachher ?? null) as never,
      detail: input.detail ?? null,
      ip: input.ip ?? null,
      timestamp: nowIso(),
    });
  }

  /** Fall-Protokoll eines Vorgangs (neueste zuerst). */
  async function listAuditEintraege(vorgangId: string): Promise<AuditEintrag[]> {
    const db = getDb();
    const rows = await db.select().from(tabelle)
      .where(eq(tabelle.vorgangId, vorgangId))
      .orderBy(desc(tabelle.timestamp));
    return rows.map(rowToAudit);
  }

  /**
   * Gesamt-Protokoll mit Filtern (GOV-4 Admin/DSB-Ansicht). Sortierung neueste
   * zuerst, sinnvolles Standard-Limit. Deckt auch Lesezugriffe/Exporte mit ab.
   */
  async function listAuditEintraegeGesamt(filter?: AuditGesamtFilter): Promise<AuditEintrag[]> {
    const db = getDb();
    const conds = auditFilterConds(filter);
    const limit = Math.min(Math.max(filter?.limit ?? 500, 1), 5000);
    const q = db.select().from(tabelle).where(conds.length ? and(...conds) : undefined);
    const rows = await q.orderBy(desc(tabelle.timestamp)).limit(limit);
    return rows.map(rowToAudit);
  }

  /** Gesamtzahl der Audit-Einträge für einen Filter (ohne Limit) — für die Sicht. */
  async function countAuditEintraegeGesamt(filter?: AuditGesamtFilter): Promise<number> {
    const db = getDb();
    const conds = auditFilterConds(filter);
    const rows = await db.select({ n: count() }).from(tabelle).where(conds.length ? and(...conds) : undefined);
    return Number(rows[0]?.n ?? 0);
  }

  return { addAuditEintrag, listAuditEintraege, listAuditEintraegeGesamt, countAuditEintraegeGesamt };
}

export type AuditStore = ReturnType<typeof createAuditStore>;

// ── audit(c, event) ──────────────────────────────────────────────────────────

/** Client-IP aus den üblichen Proxy-Headern (erste IP aus x-forwarded-for, sonst x-real-ip). */
function clientIp(c: Context): string | undefined {
  const fwd = c.req.header('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  return c.req.header('x-real-ip') || undefined;
}

/**
 * Audit-Funktionen einer App. `audit(c, e)` liest den Akteur (id + name + wirksame
 * Rolle + IP) aus dem Hono-Context und schreibt EINE append-only Zeile.
 */
export function createAudit<TObjekt extends string>(opts: {
  store: Pick<AuditStore, 'addAuditEintrag'>;
  logPraefix: string;
}) {
  /** Protokolliert eine fachlich relevante Aktion. Fehler werden geschluckt (nur geloggt). */
  async function audit(c: Context, e: AuditEvent<TObjekt>): Promise<void> {
    try {
      const user = getCurrentUser(c);
      await opts.store.addAuditEintrag({
        akteurId: getCurrentUserId(c) ?? null,
        akteurName: user?.displayName || user?.username || null,
        akteurRolle: (c.get('appRole') as string | undefined) ?? null,
        aktion: e.aktion,
        objektTyp: e.objektTyp,
        objektId: e.objektId ?? null,
        vorgangId: e.vorgangId ?? null,
        ergebnis: e.ergebnis ?? 'ok',
        vorher: e.vorher ?? null,
        nachher: e.nachher ?? null,
        detail: e.detail ?? null,
        ip: clientIp(c) ?? null,
      });
    } catch (err) {
      console.error(`${opts.logPraefix} audit fehlgeschlagen:`, err);
    }
  }

  /**
   * Bequemer Update-Audit: berechnet den Diff der Kernfelder und protokolliert
   * `vorher`/`nachher` NUR, wenn sich mindestens ein Feld geändert hat.
   * (Der Eintrag wird immer geschrieben — auch ohne Feldänderung, als Nachweis
   * der Bearbeitung; dann ohne Diff.)
   */
  async function auditUpdate<T extends object>(
    c: Context,
    o: {
      aktion: string;
      objektTyp: TObjekt;
      objektId?: string;
      vorgangId?: string;
      before: T | null | undefined;
      after: T | null | undefined;
      felder: Array<keyof T & string>;
      detail?: string;
    },
  ): Promise<void> {
    const diff = diffFelder(o.before, o.after, o.felder);
    const { vorher, nachher } = diffToVorherNachher(diff);
    await audit(c, {
      aktion: o.aktion,
      objektTyp: o.objektTyp,
      objektId: o.objektId,
      vorgangId: o.vorgangId,
      detail: o.detail,
      vorher: hatAenderung(diff) ? vorher : undefined,
      nachher: hatAenderung(diff) ? nachher : undefined,
    });
  }

  return { audit, auditUpdate };
}

// ── Reine Helfer ─────────────────────────────────────────────────────────────

/**
 * Reiner Helfer: Diff zweier Objekte, beschränkt auf die angegebenen Felder.
 * Liefert nur die tatsächlich geänderten Felder als { feld: { alt, neu } }.
 * Vergleich per JSON-Serialisierung (deckt Objekte/Arrays ab);
 * `undefined` und fehlende Felder gelten als gleich.
 */
export function diffFelder<T extends object>(
  vorher: T | null | undefined,
  nachher: T | null | undefined,
  felder: Array<keyof T & string>,
): FeldDiff {
  const diff: FeldDiff = {};
  const v = (vorher ?? {}) as Record<string, unknown>;
  const n = (nachher ?? {}) as Record<string, unknown>;
  for (const feld of felder) {
    const alt = v[feld];
    const neu = n[feld];
    if (JSON.stringify(alt ?? null) !== JSON.stringify(neu ?? null)) {
      diff[feld] = { alt: alt ?? null, neu: neu ?? null };
    }
  }
  return diff;
}

/** true, wenn der Diff mindestens ein geändertes Feld enthält. */
export function hatAenderung(diff: FeldDiff): boolean {
  return Object.keys(diff).length > 0;
}

/** Zerlegt einen FeldDiff in getrennte vorher/nachher-Objekte (nur geänderte Felder). */
export function diffToVorherNachher(diff: FeldDiff): { vorher: Record<string, unknown>; nachher: Record<string, unknown> } {
  const vorher: Record<string, unknown> = {};
  const nachher: Record<string, unknown> = {};
  for (const [feld, { alt, neu }] of Object.entries(diff)) {
    vorher[feld] = alt;
    nachher[feld] = neu;
  }
  return { vorher, nachher };
}

// ── CSV-Export des Protokolls (GOV-4) ───────────────────────────────────────

/** Ein CSV-Feld quoten (Excel-kompatibel: immer quoten, `"` verdoppeln). */
function csvCell(value: unknown): string {
  if (value == null) return '""';
  const s = typeof value === 'string' ? value : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

/** Detail-Zusammenfassung inkl. Diff (kompakt) für die CSV-Spalte `detail`. */
function detailMitDiff(e: AuditEintrag): string {
  const parts: string[] = [];
  if (e.detail) parts.push(e.detail);
  if (e.vorher !== undefined && e.vorher !== null) parts.push(`vorher=${JSON.stringify(e.vorher)}`);
  if (e.nachher !== undefined && e.nachher !== null) parts.push(`nachher=${JSON.stringify(e.nachher)}`);
  return parts.join(' | ');
}

/** CSV-Spalten (Reihenfolge + Header). */
const CSV_HEADER = [
  'timestamp', 'akteur_name', 'akteur_rolle', 'aktion', 'objekt_typ',
  'objekt_id', 'vorgang_id', 'ergebnis', 'detail', 'ip',
] as const;

/**
 * Reiner CSV-Bau (testbar). Semikolon-getrennt (deutsches Excel), CRLF-Zeilen,
 * UTF-8-BOM vorangestellt (Umlaute in Excel). Eine Kopfzeile + eine Zeile je Eintrag.
 */
export function auditEintraegeToCsv(eintraege: AuditEintrag[]): string {
  const lines: string[] = [];
  lines.push(CSV_HEADER.join(';'));
  for (const e of eintraege) {
    lines.push([
      csvCell(e.timestamp),
      csvCell(e.akteurName ?? ''),
      csvCell(e.akteurRolle ?? ''),
      csvCell(e.aktion),
      csvCell(e.objektTyp),
      csvCell(e.objektId ?? ''),
      csvCell(e.vorgangId ?? ''),
      csvCell(e.ergebnis),
      csvCell(detailMitDiff(e)),
      csvCell(e.ip ?? ''),
    ].join(';'));
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}

// ── Routen: Admin/DSB-Protokollansicht (GOV-4) ──────────────────────────────

/** Query → Filter (leere Strings ignorieren). */
function filterFromQuery(c: Context): AuditGesamtFilter {
  const q = (name: string) => {
    const v = c.req.query(name);
    return v && v.trim() ? v.trim() : undefined;
  };
  const limitRaw = q('limit');
  const limit = limitRaw ? Number(limitRaw) : undefined;
  return {
    aktion: q('aktion'),
    akteurId: q('akteurId'),
    objektTyp: q('objektTyp'),
    vorgangId: q('vorgangId'),
    von: q('von'),
    bis: q('bis'),
    limit: Number.isFinite(limit) ? limit : undefined,
  };
}

/**
 * Reine Lese-/Revisionssicht auf das app-weite Audit-Log (`GET /audit`) plus
 * CSV-Export (`GET /audit/export`). NUR über den Owner-Guard. Der Export selbst
 * wird auditiert (`protokoll.exportiert`, objektTyp `protokoll`).
 */
export function createAuditRoutes(opts: {
  store: Pick<AuditStore, 'listAuditEintraegeGesamt' | 'countAuditEintraegeGesamt'>;
  audit: (c: Context, e: AuditEvent<'protokoll'>) => Promise<void>;
  denyIfNotAppOwner: (c: Context) => { error: string } | null;
}) {
  const routes = new Hono();

  routes.get('/audit', async (c) => {
    const denied = opts.denyIfNotAppOwner(c);
    if (denied) return c.json(denied, 403);
    const filter = filterFromQuery(c);
    const [eintraege, gesamt] = await Promise.all([
      opts.store.listAuditEintraegeGesamt(filter),
      opts.store.countAuditEintraegeGesamt(filter),
    ]);
    return c.json({ eintraege, gesamt });
  });

  routes.get('/audit/export', async (c) => {
    const denied = opts.denyIfNotAppOwner(c);
    if (denied) return c.json(denied, 403);
    const format = (c.req.query('format') ?? 'csv').toLowerCase();
    if (format !== 'csv') return c.json({ error: 'format muss csv sein' }, 400);
    const filter = filterFromQuery(c);
    // Export = größerer Standardumfang, aber weiterhin gedeckelt in der Storage-Funktion.
    const eintraege = await opts.store.listAuditEintraegeGesamt({ ...filter, limit: filter.limit ?? 5000 });
    const csv = auditEintraegeToCsv(eintraege);
    // Der Export selbst ist eine Weitergabe → auditieren.
    await opts.audit(c, { aktion: 'protokoll.exportiert', objektTyp: 'protokoll', detail: `${eintraege.length} Eintrag/Einträge · CSV` });
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="Protokoll-${stamp}.csv"`,
      },
    });
  });

  return routes;
}
