/**
 * Persistenz-Brücke der L-VAR-Datenspine: koordinatenbasierter Extrakt
 * (`emma.ts` · `EmmaProcessExtract`) → `el_prozess_items` + `el_variablen`.
 * Plus Reader für familienweite Sichten (Dublettencluster) und die append-only
 * Telemetrie-Senke (Prinzip §3.8), die der Gold-Runner / Tresor-Sweep bedient.
 *
 * Re-Extraktion ist idempotent je (Familie, Prozessnummer[, Baustand]):
 * bestehender Steckbrief wird ersetzt (Cascade räumt die Variablen mit ab),
 * dann frisch geschrieben — kein Auffangzweig, keine Dublette.
 */
import { eq, and, desc, inArray } from 'drizzle-orm';
import { getDb } from '../../../db';
import { elProzessItems, elVariablen, elTelemetrie } from '../../../db/schema/echoloop';
import type { ProzessItem, Variable } from '../types';
import type { EmmaProcessExtract } from './emma';
import { redactVariablen } from '../qa/tresor';

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Reader ───────────────────────────────────────────────────────────────────

function rowToProzessItem(row: typeof elProzessItems.$inferSelect): ProzessItem {
  const data = (row.data ?? {}) as Partial<ProzessItem>;
  return {
    ...data,
    id: row.id,
    prozessId: row.prozessId,
    baustandId: row.baustandId ?? undefined,
    nr: row.nr,
    nameExport: row.nameExport ?? undefined,
    typ: (row.typ as ProzessItem['typ']) ?? undefined,
    version: row.version,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

function rowToVariable(row: typeof elVariablen.$inferSelect): Variable {
  const data = (row.data ?? {}) as Partial<Variable>;
  return {
    ...data,
    id: row.id,
    prozessItemId: row.prozessItemId,
    prozessId: row.prozessId,
    p: row.p,
    varId: row.varId,
    name: row.name,
    typ: row.typ ?? undefined,
    schnitt: row.schnitt ?? undefined,
    rolle: (row.rolle as Variable['rolle']) ?? undefined,
    created_at: row.createdAt,
  };
}

/** Steckbriefe einer Familie; mit `baustandId` auf eine Datenversion (Upload) skopiert. */
export async function listProzessItems(prozessId: string, baustandId?: string): Promise<ProzessItem[]> {
  const db = getDb();
  const cond = baustandId
    ? and(eq(elProzessItems.prozessId, prozessId), eq(elProzessItems.baustandId, baustandId))
    : eq(elProzessItems.prozessId, prozessId);
  const rows = await db.select().from(elProzessItems).where(cond).orderBy(elProzessItems.nr);
  return rows.map(rowToProzessItem);
}

/** Variablen einer Familie; mit `baustandId` auf die Steckbriefe genau dieser Datenversion skopiert. */
export async function listVariablen(prozessId: string, baustandId?: string): Promise<Variable[]> {
  const db = getDb();
  if (baustandId) {
    const items = await db.select({ id: elProzessItems.id }).from(elProzessItems)
      .where(and(eq(elProzessItems.prozessId, prozessId), eq(elProzessItems.baustandId, baustandId)));
    const ids = items.map((i) => i.id);
    if (!ids.length) return [];
    const rows = await db.select().from(elVariablen)
      .where(and(eq(elVariablen.prozessId, prozessId), inArray(elVariablen.prozessItemId, ids)))
      .orderBy(elVariablen.p, elVariablen.varId);
    return rows.map(rowToVariable);
  }
  const rows = await db.select().from(elVariablen)
    .where(eq(elVariablen.prozessId, prozessId)).orderBy(elVariablen.p, elVariablen.varId);
  return rows.map(rowToVariable);
}

/**
 * Neuester Extraktions-Baustand (Datenversion) einer Familie: der Baustand, aus
 * dem zuletzt Steckbriefe extrahiert wurden. Grundlage der L-VAR-Sicht („latest wins",
 * ältere Versionen bleiben append-only erhalten). `undefined`, wenn nichts extrahiert.
 */
export async function latestExtractBaustand(prozessId: string): Promise<string | undefined> {
  const db = getDb();
  const [row] = await db.select({ baustandId: elProzessItems.baustandId }).from(elProzessItems)
    .where(eq(elProzessItems.prozessId, prozessId))
    .orderBy(desc(elProzessItems.createdAt)).limit(1);
  return row?.baustandId ?? undefined;
}

// ── Writer ────────────────────────────────────────────────────────────────────

/**
 * Persistiert einen Einzelprozess-Steckbrief samt Variablen. Ersetzt einen
 * bestehenden Steckbrief derselben (Familie, Nr[, Baustand]) idempotent.
 */
export async function saveProzessItem(
  prozessId: string,
  baustandId: string | undefined,
  ex: EmmaProcessExtract,
): Promise<string> {
  const db = getDb();

  // Bestehenden Steckbrief dieser (Familie, Nr[, Baustand]) entfernen (Cascade → Variablen).
  const nrCond = and(eq(elProzessItems.prozessId, prozessId), eq(elProzessItems.nr, ex.nr));
  await db.delete(elProzessItems).where(
    baustandId ? and(nrCond, eq(elProzessItems.baustandId, baustandId)) : nrCond,
  );

  const itemId = genId('pitem');
  const now = new Date().toISOString();
  await db.insert(elProzessItems).values({
    id: itemId,
    prozessId,
    baustandId: baustandId ?? null,
    nr: ex.nr,
    nameExport: ex.name_export,
    typ: null,                                   // NK/§A9-Klassifikation folgt in Phase 3 (prozess-start)
    data: {
      prozessStand: ex.prozess_stand,
      druckStand: ex.druck_stand,
      aufrufe: ex.aufrufe,
      cvrefs: ex.cvrefs,
      ausgaenge: ex.ausgaenge,
    } as never,
    version: 1,
    createdAt: now,
    updatedAt: now,
  });

  // Tresor-Gate: Klartext-Credentials schwärzen, bevor etwas persistiert wird.
  const { variablen: safeVars, findings } = redactVariablen(ex.variablen);
  if (findings.length) {
    await logTelemetrie({
      verfahren: 'tresor', event: 'redact', prozessId, baustandId,
      data: { nr: ex.nr, funde: findings.length, klassen: [...new Set(findings.map((f) => f.klasse))] },
    });
  }

  if (safeVars.length) {
    await db.insert(elVariablen).values(safeVars.map((v) => ({
      id: genId('var'),
      prozessItemId: itemId,
      prozessId,
      p: v.p,
      varId: v.id,
      name: v.name,
      typ: v.typ,
      schnitt: v.schnitt,
      rolle: null,                               // NK-Rollen-Ableitung folgt (Phase 2 · L-VAR NK-Gate)
      data: { init: v.init, pos: v.pos, fund: v.fund, umbruch: v.umbruch } as never,
      createdAt: now,
    })));
  }

  return itemId;
}

// ── Telemetrie (append-only, Prinzip §3.8) ───────────────────────────────────

/** Schreibt eine Telemetrie-Zeile (nur Insert, nie Update). */
export async function logTelemetrie(input: {
  verfahren: string;
  event: string;
  prozessId?: string;
  baustandId?: string;
  data?: unknown;
}): Promise<void> {
  const db = getDb();
  await db.insert(elTelemetrie).values({
    id: genId('tel'),
    prozessId: input.prozessId ?? null,
    baustandId: input.baustandId ?? null,
    verfahren: input.verfahren,
    event: input.event,
    data: (input.data ?? null) as never,
    createdAt: new Date().toISOString(),
  });
}

export async function listTelemetrie(prozessId: string, limit = 200) {
  const db = getDb();
  return db.select().from(elTelemetrie)
    .where(eq(elTelemetrie.prozessId, prozessId))
    .orderBy(desc(elTelemetrie.createdAt)).limit(limit);
}
