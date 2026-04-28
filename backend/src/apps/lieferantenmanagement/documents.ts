/**
 * Lieferantenmanagement Document Storage — S3 (Bytes) + DB (Metadata).
 *
 * Frueher Files unter data/apps/lieferantenmanagement/suppliers/<id>/documents/.
 * Jetzt: Bytes in S3 (`apps/lieferantenmanagement/<supplierId>/<docId>/<filename>`),
 * Metadaten in `liefermgmt.documents`.
 */

import { eq, desc, and } from 'drizzle-orm';
import { getDb } from '../../db';
import { supplierDocuments } from '../../db/schema/liefermgmt';
import { putObject, getObject, deleteObject } from '../../storage/s3';
import { s3Paths } from '../../storage/paths';
import type { DokumentMeta, DokumentTyp } from './types';
import { validateId } from './storage';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
]);

function sanitizeFilename(name: string): string {
  let safe = name.replace(/[\\/\0]/g, '_');
  const parts = safe.split('/');
  safe = parts[parts.length - 1] || 'unnamed';
  safe = safe.replace(/^\.+/, '');
  return safe || 'unnamed';
}

export function generateDokumentId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `doc-${timestamp}-${random}`;
}

export function validateFile(file: File): { ok: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, error: `Datei zu gross (max ${MAX_FILE_SIZE / 1024 / 1024} MB)` };
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return { ok: false, error: `Dateityp nicht erlaubt: ${file.type}. Erlaubt: PDF, DOCX, DOC, XLSX, PNG, JPG` };
  }
  return { ok: true };
}

function rowToMeta(row: typeof supplierDocuments.$inferSelect): DokumentMeta {
  const m = (row.metadata ?? {}) as Partial<DokumentMeta>;
  return {
    ...m,
    id: row.id,
    dateiname: row.filename,
    dateityp: row.contentType ?? '',
    dateigroesse: row.sizeBytes ?? 0,
    hochgeladen_am: row.createdAt,
  } as DokumentMeta;
}

export async function saveDokument(
  supplierId: string,
  file: File,
  meta: Omit<DokumentMeta, 'dateiname' | 'dateityp' | 'dateigroesse' | 'hochgeladen_am'>,
): Promise<DokumentMeta> {
  const safeName = sanitizeFilename(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  const s3Key = s3Paths.supplierDoc(supplierId, meta.id, safeName);

  await putObject(s3Key, buffer, file.type);

  const db = getDb();
  const fullMeta: DokumentMeta = {
    ...meta,
    dateiname: safeName,
    dateityp: file.type,
    dateigroesse: file.size,
    hochgeladen_am: new Date().toISOString(),
  };

  await db.insert(supplierDocuments).values({
    id: meta.id,
    supplierId,
    filename: safeName,
    contentType: file.type,
    sizeBytes: file.size,
    s3Key,
    metadata: fullMeta as never,
    createdAt: fullMeta.hochgeladen_am,
  });

  return fullMeta;
}

export async function getDokumente(
  supplierId: string,
  filter?: { typ?: DokumentTyp },
): Promise<DokumentMeta[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(supplierDocuments)
    .where(eq(supplierDocuments.supplierId, supplierId))
    .orderBy(desc(supplierDocuments.createdAt));
  let docs = rows.map(rowToMeta);
  if (filter?.typ) docs = docs.filter(d => d.typ === filter.typ);
  return docs;
}

export async function getDokument(
  supplierId: string,
  docId: string,
): Promise<DokumentMeta | null> {
  if (!validateId(supplierId) || !validateId(docId)) return null;
  const db = getDb();
  const rows = await db
    .select()
    .from(supplierDocuments)
    .where(and(eq(supplierDocuments.supplierId, supplierId), eq(supplierDocuments.id, docId)))
    .limit(1);
  return rows[0] ? rowToMeta(rows[0]) : null;
}

/**
 * Liest die Bytes aus S3. Frueher: `getDokumentFilePath()` lieferte einen
 * lokalen Pfad — jetzt geben wir die Bytes direkt zurueck. Routes muessen
 * leicht angepasst werden (Body statt File-Stream).
 */
export async function getDokumentBytes(
  supplierId: string,
  docId: string,
): Promise<Buffer | null> {
  const db = getDb();
  const rows = await db
    .select({ s3Key: supplierDocuments.s3Key })
    .from(supplierDocuments)
    .where(and(eq(supplierDocuments.supplierId, supplierId), eq(supplierDocuments.id, docId)))
    .limit(1);
  if (!rows[0]) return null;
  return getObject(rows[0].s3Key);
}

/**
 * Backwards-compatible Stub — fruehere File-Path-API; Routes nutzen jetzt
 * besser `getDokumentBytes()`. Wenn aufgerufen, throwt der Stub mit einem
 * klaren Hinweis.
 */
export function getDokumentFilePath(_supplierId: string, _docId: string, _dateiname: string): string {
  throw new Error(
    'getDokumentFilePath is no longer supported — Documents live in S3. Use getDokumentBytes() and stream the buffer to the response.',
  );
}

export async function deleteDokument(supplierId: string, docId: string): Promise<boolean> {
  if (!validateId(supplierId) || !validateId(docId)) return false;
  const db = getDb();
  const rows = await db
    .select({ id: supplierDocuments.id, s3Key: supplierDocuments.s3Key })
    .from(supplierDocuments)
    .where(and(eq(supplierDocuments.supplierId, supplierId), eq(supplierDocuments.id, docId)))
    .limit(1);
  if (!rows[0]) return false;
  try {
    await deleteObject(rows[0].s3Key);
  } catch (err) {
    console.warn('[liefermgmt] S3 delete failed:', err);
  }
  await db.delete(supplierDocuments).where(eq(supplierDocuments.id, docId));
  return true;
}
