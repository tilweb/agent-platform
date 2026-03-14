/**
 * Lieferantenmanagement Storage Service
 * File-based storage for suppliers, audits, and audit plans
 */

import type { Supplier, Audit, AuditPlan } from './types';

const BASE_PATH = './data/apps/lieferantenmanagement';
const SUPPLIERS_PATH = `${BASE_PATH}/suppliers`;
const AUDITS_PATH = `${BASE_PATH}/audits`;
const AUDIT_PLANS_PATH = `${BASE_PATH}/audit-plans`;
const CONFIG_PATH = `${BASE_PATH}/config.json`;

// ============== Validation ==============

const SAFE_ID_PATTERN = /^[a-z0-9\-_]+$/;

export function validateId(id: string): boolean {
  return SAFE_ID_PATTERN.test(id) && id.length <= 64;
}

// ============== ID Generation ==============

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

// ============== Supplier Storage ==============

export async function getSuppliers(): Promise<Supplier[]> {
  const suppliers: Supplier[] = [];

  try {
    const glob = new Bun.Glob('*/data.json');
    for await (const path of glob.scan(SUPPLIERS_PATH)) {
      const file = Bun.file(`${SUPPLIERS_PATH}/${path}`);
      if (await file.exists()) {
        const content = await file.text();
        suppliers.push(JSON.parse(content) as Supplier);
      }
    }
  } catch (error) {
    console.log('No suppliers found, returning empty list');
  }

  suppliers.sort((a, b) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  return suppliers;
}

export async function getSupplier(supplierId: string): Promise<Supplier | null> {
  if (!validateId(supplierId)) return null;
  const file = Bun.file(`${SUPPLIERS_PATH}/${supplierId}/data.json`);

  if (!(await file.exists())) {
    return null;
  }

  const content = await file.text();
  return JSON.parse(content) as Supplier;
}

export async function saveSupplier(supplier: Supplier): Promise<void> {
  const dir = `${SUPPLIERS_PATH}/${supplier.id}`;
  await Bun.$`mkdir -p ${dir}`;
  await Bun.write(`${dir}/data.json`, JSON.stringify(supplier, null, 2));
}

export async function deleteSupplier(supplierId: string): Promise<boolean> {
  if (!validateId(supplierId)) return false;
  const file = Bun.file(`${SUPPLIERS_PATH}/${supplierId}/data.json`);

  if (!(await file.exists())) {
    return false;
  }

  await Bun.$`rm -rf ${SUPPLIERS_PATH}/${supplierId}`;
  return true;
}

// ============== Audit Storage ==============

export async function getAudits(): Promise<Audit[]> {
  const audits: Audit[] = [];

  try {
    const glob = new Bun.Glob('*.json');
    for await (const path of glob.scan(AUDITS_PATH)) {
      const file = Bun.file(`${AUDITS_PATH}/${path}`);
      if (await file.exists()) {
        const content = await file.text();
        audits.push(JSON.parse(content) as Audit);
      }
    }
  } catch (error) {
    console.log('No audits found, returning empty list');
  }

  audits.sort((a, b) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  return audits;
}

export async function getAudit(auditId: string): Promise<Audit | null> {
  if (!validateId(auditId)) return null;
  const file = Bun.file(`${AUDITS_PATH}/${auditId}.json`);

  if (!(await file.exists())) {
    return null;
  }

  const content = await file.text();
  return JSON.parse(content) as Audit;
}

export async function saveAudit(audit: Audit): Promise<void> {
  await Bun.$`mkdir -p ${AUDITS_PATH}`;
  await Bun.write(`${AUDITS_PATH}/${audit.id}.json`, JSON.stringify(audit, null, 2));
}

export async function deleteAudit(auditId: string): Promise<boolean> {
  if (!validateId(auditId)) return false;
  const file = Bun.file(`${AUDITS_PATH}/${auditId}.json`);

  if (!(await file.exists())) {
    return false;
  }

  await Bun.$`rm ${AUDITS_PATH}/${auditId}.json`;
  return true;
}

// ============== Audit Plan Storage ==============

export async function getAuditPlan(year: number): Promise<AuditPlan | null> {
  const file = Bun.file(`${AUDIT_PLANS_PATH}/${year}.json`);

  if (!(await file.exists())) {
    return null;
  }

  const content = await file.text();
  return JSON.parse(content) as AuditPlan;
}

export async function saveAuditPlan(plan: AuditPlan): Promise<void> {
  await Bun.$`mkdir -p ${AUDIT_PLANS_PATH}`;
  await Bun.write(`${AUDIT_PLANS_PATH}/${plan.jahr}.json`, JSON.stringify(plan, null, 2));
}

// ============== Config ==============

export async function getConfig(): Promise<any> {
  const file = Bun.file(CONFIG_PATH);

  if (!(await file.exists())) {
    return null;
  }

  const content = await file.text();
  return JSON.parse(content);
}

export async function saveConfig(config: any): Promise<void> {
  await Bun.write(CONFIG_PATH, JSON.stringify(config, null, 2));
}
