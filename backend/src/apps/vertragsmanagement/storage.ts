/**
 * Vertragsmanagement Storage — Postgres (Metadata) + S3 (document.md & Originals).
 *
 * `vertragsmgmt.contracts`: metadaten + s3-keys
 * S3-Bucket: apps/vertragsmanagement/<contractId>/document.md
 *           apps/vertragsmanagement/<contractId>/original.<ext>
 */

import { eq, desc, asc } from 'drizzle-orm';
import { getDb } from '../../db';
import {
  contracts as contractsTable,
  contractSchemas as schemasTable,
  contractAttachments as attachmentsTable,
} from '../../db/schema/vertragsmgmt';
import { putObject, getObject, deleteObject } from '../../storage/s3';
import { s3Paths } from '../../storage/paths';
import { randomUUID } from 'crypto';
import type {
  ContractMetadata,
  ContractSchema,
  ContractAttachment,
  ContractDocumentRole,
  ContractTypeDetection,
  ContractExtractionSnapshot,
} from '../types';

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
  // Type-Cast auf row mit Phase-2-Felder — die Drizzle-Spalten sind hinzugefuegt,
  // aber Migration kann auf alten Instanzen noch nicht gelaufen sein → defensives default.
  const r = row as typeof contractsTable.$inferSelect & {
    primaryAttachmentId?: string | null;
    typeDetection?: unknown;
    provenance?: unknown;
    extractedHistory?: unknown;
  };
  return {
    id: row.id,
    contract_type: row.contractType ?? '',
    upload_filename: row.uploadFilename,
    uploaded_at: row.uploadedAt,
    uploaded_by: row.uploadedBy,
    extracted: (row.extracted ?? {}) as ContractMetadata['extracted'],
    computed: (row.computed ?? {}) as ContractMetadata['computed'],
    obligations: (row.obligations ?? []) as ContractMetadata['obligations'],
    primary_attachment_id: r.primaryAttachmentId ?? null,
    type_detection: (r.typeDetection ?? null) as ContractTypeDetection | null,
    provenance: (r.provenance ?? null) as Record<string, string[]> | null,
    extracted_history: (r.extractedHistory ?? []) as ContractExtractionSnapshot[],
  };
}

function rowToAttachment(row: typeof attachmentsTable.$inferSelect): ContractAttachment {
  return {
    id: row.id,
    contract_id: row.contractId,
    filename: row.filename,
    content_type: row.contentType ?? undefined,
    s3_key_original: row.s3KeyOriginal,
    s3_key_markdown: row.s3KeyMarkdown ?? null,
    size_bytes: row.sizeBytes ?? undefined,
    document_role: (row.documentRole as ContractDocumentRole) ?? 'sonstiges',
    uploaded_at: row.uploadedAt,
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
  if (!rows[0]) return null;
  const contract = rowToContract(rows[0]);
  // Multi-File: Attachments dazu laden — kein eigenes API noetig, kommt direkt
  // mit dem Contract.
  contract.attachments = await listAttachments(contractId);
  return contract;
}

// ============== Attachments ==============

export function generateAttachmentId(): string {
  return `att-${randomUUID()}`;
}

export async function listAttachments(contractId: string): Promise<ContractAttachment[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(attachmentsTable)
    .where(eq(attachmentsTable.contractId, contractId))
    .orderBy(asc(attachmentsTable.uploadedAt));
  return rows.map(rowToAttachment);
}

export async function getAttachment(attachmentId: string): Promise<ContractAttachment | null> {
  const db = getDb();
  const rows = await db.select().from(attachmentsTable).where(eq(attachmentsTable.id, attachmentId)).limit(1);
  return rows[0] ? rowToAttachment(rows[0]) : null;
}

/**
 * Persistiert ein Attachment KOMPLETT — Bytes nach S3 + Metadata in DB.
 * Wird vom Import-Service genutzt um Storage-Details (S3 vs YAML) zu kapseln,
 * damit der Import-Service auf beiden Worktrees identisch ist.
 *
 * `bytes` und `markdown` sind die Original-Datei + die Markitdown-Konversion;
 * letzteres optional (Bilder/text haben keinen markdown-cache).
 */
export async function saveAttachmentWithBytes(
  att: Omit<ContractAttachment, 's3_key_original' | 's3_key_markdown'>,
  bytes: Buffer,
  markdown: string | null,
): Promise<ContractAttachment> {
  const ext = (att.filename.split('.').pop() || 'bin').toLowerCase();
  const s3KeyOriginal = s3Paths.contractAttachmentOriginal(att.contract_id, att.id, ext);
  const contentType = att.content_type ?? 'application/octet-stream';
  await putObject(s3KeyOriginal, bytes, contentType);

  let s3KeyMarkdown: string | null = null;
  if (markdown) {
    s3KeyMarkdown = s3Paths.contractAttachmentMarkdown(att.contract_id, att.id);
    await putObject(s3KeyMarkdown, markdown, 'text/markdown');
  }

  const enriched: ContractAttachment = {
    ...att,
    s3_key_original: s3KeyOriginal,
    s3_key_markdown: s3KeyMarkdown,
  };

  const db = getDb();
  await db.insert(attachmentsTable).values({
    id: enriched.id,
    contractId: enriched.contract_id,
    filename: enriched.filename,
    contentType: enriched.content_type ?? null,
    s3KeyOriginal: enriched.s3_key_original,
    s3KeyMarkdown: enriched.s3_key_markdown ?? null,
    sizeBytes: enriched.size_bytes ?? null,
    documentRole: enriched.document_role,
    uploadedAt: enriched.uploaded_at,
  }).onConflictDoUpdate({
    target: attachmentsTable.id,
    set: {
      documentRole: enriched.document_role,
      s3KeyMarkdown: enriched.s3_key_markdown ?? null,
    },
  });

  return enriched;
}

export async function updateAttachmentRole(
  _contractId: string,
  attachmentId: string,
  role: ContractDocumentRole,
): Promise<void> {
  const db = getDb();
  await db.update(attachmentsTable)
    .set({ documentRole: role })
    .where(eq(attachmentsTable.id, attachmentId));
}

export async function deleteAttachment(attachmentId: string): Promise<boolean> {
  const att = await getAttachment(attachmentId);
  if (!att) return false;
  // S3-Cleanup (best-effort)
  try { await deleteObject(att.s3_key_original); } catch { /* ignore */ }
  if (att.s3_key_markdown) {
    try { await deleteObject(att.s3_key_markdown); } catch { /* ignore */ }
  }
  const db = getDb();
  await db.delete(attachmentsTable).where(eq(attachmentsTable.id, attachmentId));
  return true;
}

export async function getAttachmentBytes(
  _contractId: string,
  attachmentId: string,
): Promise<{ buffer: Buffer; contentType: string; filename: string } | null> {
  const att = await getAttachment(attachmentId);
  if (!att) return null;
  try {
    const buffer = await getObject(att.s3_key_original);
    return { buffer, contentType: att.content_type ?? 'application/octet-stream', filename: att.filename };
  } catch (err: any) {
    if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) return null;
    throw err;
  }
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
    primaryAttachmentId: metadata.primary_attachment_id ?? null,
    typeDetection: (metadata.type_detection ?? null) as never,
    provenance: (metadata.provenance ?? null) as never,
    extractedHistory: (metadata.extracted_history ?? null) as never,
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
      primaryAttachmentId: metadata.primary_attachment_id ?? null,
      typeDetection: (metadata.type_detection ?? null) as never,
      provenance: (metadata.provenance ?? null) as never,
      extractedHistory: (metadata.extracted_history ?? null) as never,
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
