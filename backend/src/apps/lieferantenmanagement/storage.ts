/**
 * Lieferantenmanagement Storage — Postgres-backed (Drizzle).
 *
 * Stammdaten + Audits + Audit-Plans als jsonb-Daten in den jeweiligen Tabellen.
 * Document-Bytes wandern in S3 (siehe documents.ts), nur die Metadaten in DB.
 * Config wird vorerst als trivialer "settings"-Eintrag im Audit-Plans-Schema gehalten.
 */

import { eq, desc } from 'drizzle-orm';
import { getDb } from '../../db';
import { suppliers as suppliersTable, audits as auditsTable, auditPlans as auditPlansTable } from '../../db/schema/liefermgmt';
import type { Supplier, Audit, AuditPlan } from './types';

const SAFE_ID_PATTERN = /^[a-z0-9\-_]+$/;

export function validateId(id: string): boolean {
  return SAFE_ID_PATTERN.test(id) && id.length <= 64;
}

export function generateSupplierId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `lief-${timestamp}-${random}`;
}

export function generateAnsprechpartnerId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `ap-${timestamp}-${random}`;
}

export function generateZertifizierungId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `zert-${timestamp}-${random}`;
}

export function generateLeistungId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `leist-${timestamp}-${random}`;
}

export function generateAuditId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `audit-${timestamp}-${random}`;
}

// ============== Supplier ==============

function rowToSupplier(row: typeof suppliersTable.$inferSelect): Supplier {
  const data = (row.data ?? {}) as Partial<Supplier>;
  return {
    ...data,
    id: row.id,
    name: row.name,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  } as Supplier;
}

export async function getSuppliers(): Promise<Supplier[]> {
  const db = getDb();
  const rows = await db.select().from(suppliersTable).orderBy(desc(suppliersTable.updatedAt));
  return rows.map(rowToSupplier);
}

export async function getSupplier(supplierId: string): Promise<Supplier | null> {
  if (!validateId(supplierId)) return null;
  const db = getDb();
  const rows = await db.select().from(suppliersTable).where(eq(suppliersTable.id, supplierId)).limit(1);
  return rows[0] ? rowToSupplier(rows[0]) : null;
}

export async function saveSupplier(supplier: Supplier): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.insert(suppliersTable).values({
    id: supplier.id,
    name: supplier.name,
    data: supplier as never,
    status: (supplier as { status?: string }).status ?? null,
    createdAt: supplier.created_at ?? now,
    updatedAt: supplier.updated_at ?? now,
  }).onConflictDoUpdate({
    target: suppliersTable.id,
    set: {
      name: supplier.name,
      data: supplier as never,
      status: (supplier as { status?: string }).status ?? null,
      updatedAt: supplier.updated_at ?? now,
    },
  });
}

export async function deleteSupplier(supplierId: string): Promise<boolean> {
  if (!validateId(supplierId)) return false;
  const db = getDb();
  const res = await db.delete(suppliersTable).where(eq(suppliersTable.id, supplierId)).returning({ id: suppliersTable.id });
  return res.length > 0;
}

// ============== Audit ==============

function rowToAudit(row: typeof auditsTable.$inferSelect): Audit {
  const data = (row.data ?? {}) as Partial<Audit>;
  return {
    ...data,
    id: row.id,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  } as Audit;
}

export async function getAudits(): Promise<Audit[]> {
  const db = getDb();
  const rows = await db.select().from(auditsTable).orderBy(desc(auditsTable.updatedAt));
  return rows.map(rowToAudit);
}

export async function getAudit(auditId: string): Promise<Audit | null> {
  if (!validateId(auditId)) return null;
  const db = getDb();
  const rows = await db.select().from(auditsTable).where(eq(auditsTable.id, auditId)).limit(1);
  return rows[0] ? rowToAudit(rows[0]) : null;
}

export async function saveAudit(audit: Audit): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.insert(auditsTable).values({
    id: audit.id,
    supplierId: (audit as { supplierId?: string }).supplierId ?? null,
    data: audit as never,
    status: (audit as { status?: string }).status ?? null,
    scheduledFor: (audit as { scheduledFor?: string }).scheduledFor ?? null,
    createdAt: audit.created_at ?? now,
    updatedAt: audit.updated_at ?? now,
  }).onConflictDoUpdate({
    target: auditsTable.id,
    set: {
      supplierId: (audit as { supplierId?: string }).supplierId ?? null,
      data: audit as never,
      status: (audit as { status?: string }).status ?? null,
      scheduledFor: (audit as { scheduledFor?: string }).scheduledFor ?? null,
      updatedAt: audit.updated_at ?? now,
    },
  });
}

export async function deleteAudit(auditId: string): Promise<boolean> {
  if (!validateId(auditId)) return false;
  const db = getDb();
  const res = await db.delete(auditsTable).where(eq(auditsTable.id, auditId)).returning({ id: auditsTable.id });
  return res.length > 0;
}

// ============== Audit Plan ==============

export async function getAuditPlan(year: number): Promise<AuditPlan | null> {
  const db = getDb();
  const rows = await db.select().from(auditPlansTable).where(eq(auditPlansTable.jahr, year)).limit(1);
  if (!rows[0]) return null;
  const data = (rows[0].data ?? {}) as Partial<AuditPlan>;
  return { ...data, jahr: rows[0].jahr } as AuditPlan;
}

export async function saveAuditPlan(plan: AuditPlan): Promise<void> {
  const db = getDb();
  await db.insert(auditPlansTable).values({
    jahr: plan.jahr,
    data: plan as never,
  }).onConflictDoUpdate({
    target: auditPlansTable.jahr,
    set: {
      data: plan as never,
      updatedAt: new Date().toISOString(),
    },
  });
}

// ============== Config (Stub fuer alte API-Kompatibilitaet) ==============
// Aktuell wird die Config-Tabelle nicht genutzt — die alte File-API gibt es
// noch fuer backwards-compat in den Routes. Wenn benoetigt, koennen wir
// einen `settings`-Eintrag in apps_registry.metadata einfuehren.

export async function getConfig(): Promise<any> {
  return null;
}

export async function saveConfig(_config: any): Promise<void> {
  /* no-op: Config wird aktuell nicht persistiert */
}
