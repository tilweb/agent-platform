/**
 * Projektmanagement Storage — Postgres-backed (Drizzle).
 *
 * Komplette Projektauftrag-Daten als jsonb in `projektmgmt.projektauftraege.data`.
 * Statusberichte und Vorlagen analog. Config bleibt vorerst in-memory (DEFAULT_CONFIG).
 */

import { eq, desc, and } from 'drizzle-orm';
import { getDb } from '../../db';
import {
  paProjektideen,
  paProjektauftraege,
  paStatusberichte,
  paVorlagen,
} from '../../db/schema/projektmgmt';
import type { Projektauftrag, Vorlage, Statusbericht } from './types';
import { VersionConflictError, checkVersion } from './concurrency';

export function generateProjektauftragId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `projekt-${timestamp}-${random}`;
}

// ============== Projektauftrag ==============

function rowToProjektauftrag(row: typeof paProjektauftraege.$inferSelect): Projektauftrag {
  const data = (row.data ?? {}) as Partial<Projektauftrag>;
  // permissions kommt aus der separaten Spalte (nicht aus data) — Phase-2.
  const permissions = ((row as { permissions?: unknown }).permissions ?? null) as Projektauftrag['permissions'];
  return {
    ...data,
    id: row.id,
    name: row.name,
    permissions,
    version: row.version,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  } as Projektauftrag;
}

/**
 * Laedt die Quell-Idee-Referenz (id + name) fuer einen Auftrag, sofern dieser
 * via "Auftrag aus Idee erstellen" entstanden ist. JOIN ueber projektauftraege.idee_id.
 * Returnt undefined wenn kein Link existiert oder die Idee zwischenzeitlich geloescht wurde.
 */
async function loadIdeeReference(ideeId: string): Promise<Projektauftrag['idee']> {
  if (!ideeId) return undefined;
  const db = getDb();
  const rows = await db
    .select({ id: paProjektideen.id, name: paProjektideen.name })
    .from(paProjektideen)
    .where(eq(paProjektideen.id, ideeId))
    .limit(1);
  return rows[0] ? { id: rows[0].id, name: rows[0].name } : undefined;
}

/**
 * Optionen fuer `getProjektauftraege` — pagination + DB-seitiges Filtern.
 *
 * - `limit`/`offset` werden direkt an SQL durchgereicht (DEFAULT_LIMIT, falls
 *   nicht uebergeben). Schuetzt vor unbounded Memory bei wachsenden Tabellen.
 * - `status` wird via WHERE-Klausel auf DB-Ebene gefiltert. Andere Filter
 *   (project_type, search, ...) bleiben im Service-Layer in-memory, weil sie
 *   im jsonb-Data leben — DB-Filter dafuer braeuchten jsonb-Indizes.
 *
 * Wichtig: die Auftrag-Permission wird **nach** dem DB-Fetch geprueft. Bei
 * paginierten Requests fuer Nicht-App-Owner kann eine Seite damit sparser
 * sein, als `limit` suggeriert — das ist bewusst, weil RBAC erst nach dem
 * Load wirkt. Frontends sollten daher `hasMore` aus der Paginierungs-Antwort
 * nutzen statt auf gefuellte Seiten zu vertrauen.
 */
export interface GetProjektauftraegeOptions {
  limit?: number;
  offset?: number;
  status?: string;
}

export const DEFAULT_PROJEKTAUFTRAEGE_LIMIT = 500;
export const MAX_PROJEKTAUFTRAEGE_LIMIT = 1000;

export async function getProjektauftraege(
  options: GetProjektauftraegeOptions = {},
): Promise<Projektauftrag[]> {
  const db = getDb();

  const baseQuery = db.select().from(paProjektauftraege);
  const whereClause = options.status
    ? baseQuery.where(eq(paProjektauftraege.status, options.status))
    : baseQuery;
  let query = whereClause.orderBy(desc(paProjektauftraege.updatedAt));

  // limit ist opt-in. Stats/interne Aufrufer ohne limit laden alle Rows
  // (Behavior-Erhalt vor TD3). Routen, die paginieren, setzen das limit
  // explizit (siehe routes.ts /projektauftraege).
  if (options.limit !== undefined) {
    const limit = Math.min(Math.max(1, options.limit), MAX_PROJEKTAUFTRAEGE_LIMIT);
    query = query.limit(limit) as typeof query;
  }
  if (options.offset !== undefined) {
    query = query.offset(Math.max(0, options.offset)) as typeof query;
  }

  const rows = await query;
  return rows.map(rowToProjektauftrag);
}

export async function getProjektauftrag(projektId: string): Promise<Projektauftrag | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(paProjektauftraege)
    .where(eq(paProjektauftraege.id, projektId))
    .limit(1);
  if (!rows[0]) return null;
  const auftrag = rowToProjektauftrag(rows[0]);
  if (rows[0].ideeId) {
    auftrag.idee = await loadIdeeReference(rows[0].ideeId);
  }
  return auftrag;
}

export async function saveProjektauftrag(p: Projektauftrag): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  // `idee` (JOIN-Anreicherung) und `permissions` (eigene Spalte) NICHT in `data`.
  const { idee: _ignore, permissions, ...dataToStore } = p;
  void _ignore;
  const version = p.version ?? 1;
  await db.insert(paProjektauftraege).values({
    id: p.id,
    ownerId: (p as { ownerId?: string }).ownerId ?? null,
    name: p.name,
    status: (p as { status?: string }).status ?? 'draft',
    data: dataToStore as never,
    permissions: (permissions ?? null) as never,
    version,
    createdAt: p.created_at ?? now,
    updatedAt: p.updated_at ?? now,
  }).onConflictDoUpdate({
    target: paProjektauftraege.id,
    set: {
      name: p.name,
      status: (p as { status?: string }).status ?? 'draft',
      data: dataToStore as never,
      permissions: (permissions ?? null) as never,
      version,
      updatedAt: p.updated_at ?? now,
    },
  });
}

/**
 * Update a Projektauftrag — atomic compare-and-swap auf version-Spalte.
 * Wirft VersionConflictError wenn expectedVersion gesetzt ist und 0 Rows
 * vom UPDATE betroffen sind (jemand anderes hat zwischenzeitlich geschrieben).
 */
export async function updateProjektauftrag(
  projektId: string,
  updates: Partial<Projektauftrag>,
  options: { expectedVersion?: number; force?: boolean } = {},
): Promise<Projektauftrag | null> {
  const db = getDb();
  const existing = await getProjektauftrag(projektId);
  if (!existing) return null;
  const currentVersion = existing.version ?? 1;

  // Bei force=true oder fehlendem expectedVersion: kein CAS, normales Update.
  if (options.force || options.expectedVersion === undefined) {
    const merged: Projektauftrag = {
      ...existing,
      ...updates,
      id: projektId,
      updated_at: new Date().toISOString(),
      version: currentVersion + 1,
    } as Projektauftrag;
    await saveProjektauftrag(merged);
    return merged;
  }

  checkVersion(existing, options.expectedVersion, false);
  const merged: Projektauftrag = {
    ...existing,
    ...updates,
    id: projektId,
    updated_at: new Date().toISOString(),
    version: currentVersion + 1,
  } as Projektauftrag;
  const { idee: _ignore, permissions, ...dataToStore } = merged;
  void _ignore;

  const result = await db
    .update(paProjektauftraege)
    .set({
      name: merged.name,
      status: (merged as { status?: string }).status ?? 'draft',
      data: dataToStore as never,
      permissions: (permissions ?? null) as never,
      version: merged.version,
      updatedAt: merged.updated_at,
    })
    .where(and(eq(paProjektauftraege.id, projektId), eq(paProjektauftraege.version, options.expectedVersion)))
    .returning({ id: paProjektauftraege.id });

  if (result.length === 0) {
    const fresh = await getProjektauftrag(projektId);
    throw new VersionConflictError(fresh);
  }
  return getProjektauftrag(projektId);
}

export async function deleteProjektauftrag(projektId: string): Promise<boolean> {
  const db = getDb();
  const res = await db
    .delete(paProjektauftraege)
    .where(eq(paProjektauftraege.id, projektId))
    .returning({ id: paProjektauftraege.id });
  return res.length > 0;
}

// ============== Statusbericht ==============

export function generateStatusberichtId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `sb-${timestamp}-${random}`;
}

function rowToStatusbericht(row: typeof paStatusberichte.$inferSelect): Statusbericht {
  const data = (row.data ?? {}) as Partial<Statusbericht>;
  return { ...data, id: row.id, version: row.version } as Statusbericht;
}

export async function getStatusberichte(projektId: string): Promise<Statusbericht[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(paStatusberichte)
    .where(eq(paStatusberichte.paId, projektId));
  const reports = rows.map(rowToStatusbericht);
  reports.sort((a, b) => a.nummer - b.nummer);
  return reports;
}

export async function getStatusbericht(
  projektId: string,
  sbId: string,
): Promise<Statusbericht | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(paStatusberichte)
    .where(and(eq(paStatusberichte.paId, projektId), eq(paStatusberichte.id, sbId)))
    .limit(1);
  return rows[0] ? rowToStatusbericht(rows[0]) : null;
}

export async function saveStatusbericht(projektId: string, sb: Statusbericht): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  const reportDate = (sb as { datum?: string }).datum ?? now;
  const version = sb.version ?? 1;
  await db.insert(paStatusberichte).values({
    id: sb.id,
    paId: projektId,
    reportDate,
    data: sb as never,
    version,
    createdBy: (sb as { createdBy?: string }).createdBy ?? null,
    createdAt: now,
  }).onConflictDoUpdate({
    target: paStatusberichte.id,
    set: {
      paId: projektId,
      reportDate,
      data: sb as never,
      version,
    },
  });
}

export async function deleteStatusbericht(projektId: string, sbId: string): Promise<boolean> {
  const db = getDb();
  const res = await db
    .delete(paStatusberichte)
    .where(and(eq(paStatusberichte.paId, projektId), eq(paStatusberichte.id, sbId)))
    .returning({ id: paStatusberichte.id });
  return res.length > 0;
}

// ============== Vorlagen ==============

function rowToVorlage(row: typeof paVorlagen.$inferSelect): Vorlage {
  const data = (row.data ?? {}) as Partial<Vorlage>;
  return { ...data, id: row.id, name: row.name } as Vorlage;
}

export async function getVorlagen(): Promise<Vorlage[]> {
  const db = getDb();
  const rows = await db.select().from(paVorlagen);
  return rows.map(rowToVorlage);
}

export async function getVorlage(vorlageId: string): Promise<Vorlage | null> {
  const db = getDb();
  const rows = await db.select().from(paVorlagen).where(eq(paVorlagen.id, vorlageId)).limit(1);
  return rows[0] ? rowToVorlage(rows[0]) : null;
}

export async function saveVorlage(v: Vorlage): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.insert(paVorlagen).values({
    id: v.id,
    name: v.name,
    description: (v as { description?: string }).description ?? null,
    data: v as never,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: paVorlagen.id,
    set: {
      name: v.name,
      description: (v as { description?: string }).description ?? null,
      data: v as never,
      updatedAt: now,
    },
  });
}

export async function deleteVorlage(vorlageId: string): Promise<boolean> {
  const db = getDb();
  const res = await db
    .delete(paVorlagen)
    .where(eq(paVorlagen.id, vorlageId))
    .returning({ id: paVorlagen.id });
  return res.length > 0;
}

// ============== Config (in-memory defaults) ==============

const DEFAULT_CONFIG = {
  project_type: [
    { value: 'internal', label: 'Internes Projekt' },
    { value: 'external', label: 'Externes Projekt' },
    { value: 'research', label: 'Forschungsprojekt' },
    { value: 'infrastructure', label: 'Infrastrukturprojekt' },
  ],
  project_size: [
    { value: 'small', label: 'Klein' },
    { value: 'medium', label: 'Mittel' },
    { value: 'large', label: 'Groß' },
  ],
  priority: [
    { value: 'low', label: 'Niedrig' },
    { value: 'medium', label: 'Mittel' },
    { value: 'high', label: 'Hoch' },
    { value: 'critical', label: 'Kritisch' },
  ],
  project_driver: [
    { value: 'strategic', label: 'Strategisch' },
    { value: 'legal', label: 'Gesetzlich' },
    { value: 'operational', label: 'Operativ' },
  ],
  project_status: [
    { value: 'initiation', label: 'Initiierung' },
    { value: 'planning', label: 'Planung' },
    { value: 'execution', label: 'Umsetzung' },
    { value: 'closing', label: 'Abschluss' },
    { value: 'stopped', label: 'Gestoppt' },
  ],
  order_status: [
    { value: 'draft', label: 'Entwurf' },
    { value: 'active', label: 'Aktiv' },
    { value: 'completed', label: 'Abgeschlossen' },
    { value: 'cancelled', label: 'Abgebrochen' },
  ],
  role: [
    { value: 'projektleiter', label: 'Projektleiter' },
    { value: 'teilprojektleiter', label: 'Teilprojektleiter' },
    { value: 'entwickler', label: 'Entwickler' },
    { value: 'analyst', label: 'Analyst' },
    { value: 'designer', label: 'Designer' },
    { value: 'tester', label: 'Tester' },
    { value: 'berater', label: 'Berater' },
  ],
  member_status: [
    { value: 'intern', label: 'Intern' },
    { value: 'extern', label: 'Extern' },
  ],
  interest: [
    { value: 'low', label: 'Niedrig' },
    { value: 'medium', label: 'Mittel' },
    { value: 'high', label: 'Hoch' },
  ],
  influence: [
    { value: 'low', label: 'Niedrig' },
    { value: 'medium', label: 'Mittel' },
    { value: 'high', label: 'Hoch' },
  ],
  probability: [
    { value: 'low', label: 'Niedrig' },
    { value: 'medium', label: 'Mittel' },
    { value: 'high', label: 'Hoch' },
  ],
  impact: [
    { value: 'low', label: 'Niedrig' },
    { value: 'medium', label: 'Mittel' },
    { value: 'high', label: 'Hoch' },
  ],
  roadmap_status: [
    { value: 'planned', label: 'Geplant' },
    { value: 'in_progress', label: 'In Bearbeitung' },
    { value: 'completed', label: 'Abgeschlossen' },
    { value: 'delayed', label: 'Verzögert' },
    { value: 'blocked', label: 'Blockiert' },
    { value: 'cancelled', label: 'Abgesagt' },
  ],
  risk_strategie: [
    { value: 'B-vermeiden', label: 'B-vermeiden' },
    { value: 'B-uebertragen', label: 'B-übertragen' },
    { value: 'B-mindern', label: 'B-mindern' },
    { value: 'B-akzeptieren', label: 'B-akzeptieren' },
    { value: 'C-nutzen', label: 'C-nutzen' },
    { value: 'C-teilen', label: 'C-teilen' },
    { value: 'C-verbessern', label: 'C-verbessern' },
    { value: 'C-akzeptieren', label: 'C-akzeptieren' },
  ],
  risk_status: [
    { value: 'vorbesetzt', label: 'Vorbesetzt' },
    { value: 'identifiziert', label: 'Identifiziert' },
    { value: 'bewertet', label: 'Bewertet' },
    { value: 'aktiv', label: 'Aktiv' },
    { value: 'vermieden', label: 'Vermieden' },
    { value: 'eingetreten', label: 'Eingetreten' },
  ],
  lesson_themengebiet: [
    { value: 'basis', label: 'Basis' },
    { value: 'stakeholder', label: 'Stakeholder' },
    { value: 'organisation', label: 'Organisation' },
    { value: 'ziele', label: 'Ziele' },
    { value: 'inhalt', label: 'Inhalt' },
    { value: 'roadmap', label: 'Roadmap' },
    { value: 'kosten', label: 'Kosten' },
    { value: 'risiko', label: 'Risiko' },
    { value: 'lessons_learned', label: 'Lessons Learned' },
    { value: 'projektidee', label: 'Projektidee' },
    { value: 'auftragsklaerung', label: 'Auftragsklärung' },
    { value: 'umsetzung', label: 'Umsetzung' },
    { value: 'projektabschluss', label: 'Projektabschluss' },
  ],
  lesson_kategorie: [
    { value: 'strength', label: 'Strength' },
    { value: 'weakness', label: 'Weakness' },
    { value: 'opportunity', label: 'Opportunity' },
    { value: 'threat', label: 'Threat' },
  ],
};

/**
 * Aktuell statisch — Override gibt's noch nicht in der DB. In einer
 * Folgemigration koennen wir einen `apps_registry.metadata`-Eintrag
 * fuer Customer-spezifische Overrides nutzen.
 */
export async function getConfig(): Promise<Record<string, any>> {
  return { ...DEFAULT_CONFIG };
}

export async function saveConfig(_config: Record<string, any>): Promise<void> {
  /* no-op fuer den Moment — siehe getConfig */
}

export async function initializeStorage(): Promise<void> {
  /* no-op — Schema kommt ueber die Migration */
}
