/**
 * Vertragsmanagement Storage — Postgres (Metadata) + S3 (document.md & Originals).
 *
 * `vertragsmgmt.contracts`: metadaten + s3-keys
 * S3-Bucket: apps/vertragsmanagement/<contractId>/document.md
 *           apps/vertragsmanagement/<contractId>/original.<ext>
 */

import { eq, desc } from 'drizzle-orm';
import { getDb } from '../../db';
import { contracts as contractsTable, contractSchemas as schemasTable } from '../../db/schema/vertragsmgmt';
import { putObject, getObject, deleteObject } from '../../storage/s3';
import { s3Paths } from '../../storage/paths';
import type { ContractMetadata, ContractSchema } from '../types';

// ============== Schema Storage (DB) ==============

function rowToSchema(row: typeof schemasTable.$inferSelect): ContractSchema {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon ?? '',
    fields: row.fields as ContractSchema['fields'],
    mapping: row.mapping as ContractSchema['mapping'],
  };
}

export async function getSchemas(): Promise<ContractSchema[]> {
  const db = getDb();
  const rows = await db.select().from(schemasTable);
  return rows.map(rowToSchema);
}

export async function getSchema(typeId: string): Promise<ContractSchema | null> {
  const db = getDb();
  const rows = await db.select().from(schemasTable).where(eq(schemasTable.id, typeId)).limit(1);
  return rows[0] ? rowToSchema(rows[0]) : null;
}

export async function saveSchema(schema: ContractSchema): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.insert(schemasTable).values({
    id: schema.id,
    name: schema.name,
    icon: schema.icon ?? null,
    fields: schema.fields as never,
    mapping: schema.mapping as never,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: schemasTable.id,
    set: {
      name: schema.name,
      icon: schema.icon ?? null,
      fields: schema.fields as never,
      mapping: schema.mapping as never,
      updatedAt: now,
    },
  });
}

// ============== Contract Storage (DB + S3) ==============

export function generateContractId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `contract-${timestamp}-${random}`;
}

function rowToContract(row: typeof contractsTable.$inferSelect): ContractMetadata {
  return {
    id: row.id,
    contract_type: row.contractType ?? '',
    upload_filename: row.uploadFilename,
    uploaded_at: row.uploadedAt,
    uploaded_by: row.uploadedBy,
    extracted: (row.extracted ?? {}) as ContractMetadata['extracted'],
    computed: (row.computed ?? {}) as ContractMetadata['computed'],
    obligations: (row.obligations ?? []) as ContractMetadata['obligations'],
  };
}

export async function getContracts(): Promise<ContractMetadata[]> {
  const db = getDb();
  const rows = await db.select().from(contractsTable).orderBy(desc(contractsTable.uploadedAt));
  return rows.map(rowToContract);
}

export async function getContract(contractId: string): Promise<ContractMetadata | null> {
  const db = getDb();
  const rows = await db.select().from(contractsTable).where(eq(contractsTable.id, contractId)).limit(1);
  return rows[0] ? rowToContract(rows[0]) : null;
}

export async function getContractDocument(contractId: string): Promise<string | null> {
  try {
    const buf = await getObject(s3Paths.contractDocument(contractId));
    return buf.toString('utf-8');
  } catch (err: any) {
    if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) return null;
    throw err;
  }
}

export async function saveContract(metadata: ContractMetadata): Promise<void> {
  const db = getDb();
  await db.insert(contractsTable).values({
    id: metadata.id,
    contractType: metadata.contract_type ?? null,
    uploadFilename: metadata.upload_filename,
    uploadedAt: metadata.uploaded_at,
    uploadedBy: metadata.uploaded_by,
    extracted: metadata.extracted as never,
    computed: metadata.computed as never,
    obligations: metadata.obligations as never,
    createdAt: metadata.uploaded_at,
    updatedAt: metadata.uploaded_at,
  }).onConflictDoUpdate({
    target: contractsTable.id,
    set: {
      contractType: metadata.contract_type ?? null,
      uploadFilename: metadata.upload_filename,
      extracted: metadata.extracted as never,
      computed: metadata.computed as never,
      obligations: metadata.obligations as never,
      updatedAt: new Date().toISOString(),
    },
  });
}

export async function saveContractDocument(contractId: string, document: string): Promise<void> {
  await putObject(s3Paths.contractDocument(contractId), document, 'text/markdown');
}

export async function saveContractOriginal(
  contractId: string,
  fileBuffer: Buffer,
  filename: string,
): Promise<void> {
  // Original-Filename behalten — Extension entscheidet ueber den S3-Key.
  const ext = (filename.split('.').pop() || 'bin').toLowerCase();
  const key = s3Paths.contractOriginal(contractId, ext);
  const contentTypeMap: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    txt: 'text/plain',
    md: 'text/markdown',
  };
  await putObject(key, fileBuffer, contentTypeMap[ext] || 'application/octet-stream');

  // Original-Filename in der DB persistieren, damit der Download den korrekten
  // Dateinamen ausliefern kann.
  const db = getDb();
  await db.update(contractsTable)
    .set({ updatedAt: new Date().toISOString() })
    .where(eq(contractsTable.id, contractId));
}

/**
 * Liest die Bytes des Original-Files aus S3. Probiert die ueblichen
 * Extensions durch, weil wir die Endung nur indirekt kennen (uploadFilename).
 * Returns {buffer, contentType, filename} oder null.
 */
export async function getContractOriginal(
  contractId: string,
): Promise<{ buffer: Buffer; contentType: string; filename: string } | null> {
  const meta = await getContract(contractId);
  if (!meta) return null;
  const filename = meta.upload_filename;
  const ext = (filename.split('.').pop() || 'bin').toLowerCase();
  const key = s3Paths.contractOriginal(contractId, ext);
  const contentTypeMap: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    txt: 'text/plain',
    md: 'text/markdown',
  };
  try {
    const buffer = await getObject(key);
    return { buffer, contentType: contentTypeMap[ext] || 'application/octet-stream', filename };
  } catch (err: any) {
    if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) return null;
    throw err;
  }
}

/**
 * @deprecated File-Path-API entfaellt mit S3 — Routes nutzen jetzt
 * `getContractOriginal()` und schreiben das Buffer-Body direkt.
 */
export async function getContractOriginalPath(_contractId: string): Promise<string | null> {
  throw new Error(
    'getContractOriginalPath is no longer supported — Originals live in S3. Use getContractOriginal() instead.',
  );
}

export async function deleteContract(contractId: string): Promise<boolean> {
  const meta = await getContract(contractId);
  if (!meta) return false;

  // S3-Cleanup (best-effort)
  try {
    await deleteObject(s3Paths.contractDocument(contractId));
  } catch { /* ignore */ }
  const ext = (meta.upload_filename.split('.').pop() || 'bin').toLowerCase();
  try {
    await deleteObject(s3Paths.contractOriginal(contractId, ext));
  } catch { /* ignore */ }

  const db = getDb();
  await db.delete(contractsTable).where(eq(contractsTable.id, contractId));
  return true;
}

export async function updateContract(
  contractId: string,
  updates: Partial<ContractMetadata>,
): Promise<ContractMetadata | null> {
  const existing = await getContract(contractId);
  if (!existing) return null;
  const merged: ContractMetadata = { ...existing, ...updates, id: contractId };
  await saveContract(merged);
  return merged;
}
