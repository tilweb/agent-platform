/**
 * Projektmanagement Storage — Postgres-backed (Drizzle).
 *
 * Komplette Projektauftrag-Daten als jsonb in `projektmgmt.projektauftraege.data`.
 * Statusberichte und Vorlagen analog. Config bleibt vorerst in-memory (DEFAULT_CONFIG).
 */

import { eq, desc, and } from 'drizzle-orm';
import { getDb } from '../../db';
import {
  paProjektauftraege,
  paStatusberichte,
  paVorlagen,
} from '../../db/schema/projektmgmt';
import type { Projektauftrag, Vorlage, Statusbericht } from './types';

export function generateProjektauftragId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `projekt-${timestamp}-${random}`;
}

// ============== Projektauftrag ==============

function rowToProjektauftrag(row: typeof paProjektauftraege.$inferSelect): Projektauftrag {
  const data = (row.data ?? {}) as Partial<Projektauftrag>;
  return {
    ...data,
    id: row.id,
    name: row.name,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  } as Projektauftrag;
}

export async function getProjektauftraege(): Promise<Projektauftrag[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(paProjektauftraege)
    .orderBy(desc(paProjektauftraege.updatedAt));
  return rows.map(rowToProjektauftrag);
}

export async function getProjektauftrag(projektId: string): Promise<Projektauftrag | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(paProjektauftraege)
    .where(eq(paProjektauftraege.id, projektId))
    .limit(1);
  return rows[0] ? rowToProjektauftrag(rows[0]) : null;
}

export async function saveProjektauftrag(p: Projektauftrag): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.insert(paProjektauftraege).values({
    id: p.id,
    ownerId: (p as { ownerId?: string }).ownerId ?? null,
    name: p.name,
    status: (p as { status?: string }).status ?? 'draft',
    data: p as never,
    createdAt: p.created_at ?? now,
    updatedAt: p.updated_at ?? now,
  }).onConflictDoUpdate({
    target: paProjektauftraege.id,
    set: {
      name: p.name,
      status: (p as { status?: string }).status ?? 'draft',
      data: p as never,
      updatedAt: p.updated_at ?? now,
    },
  });
}

export async function updateProjektauftrag(
  projektId: string,
  updates: Partial<Projektauftrag>,
): Promise<Projektauftrag | null> {
  const existing = await getProjektauftrag(projektId);
  if (!existing) return null;
  const merged: Projektauftrag = {
    ...existing,
    ...updates,
    id: projektId,
    updated_at: new Date().toISOString(),
  } as Projektauftrag;
  await saveProjektauftrag(merged);
  return merged;
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
  return { ...data, id: row.id } as Statusbericht;
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
  await db.insert(paStatusberichte).values({
    id: sb.id,
    paId: projektId,
    reportDate,
    data: sb as never,
    createdBy: (sb as { createdBy?: string }).createdBy ?? null,
    createdAt: now,
  }).onConflictDoUpdate({
    target: paStatusberichte.id,
    set: {
      paId: projektId,
      reportDate,
      data: sb as never,
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
