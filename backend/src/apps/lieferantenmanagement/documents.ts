/**
 * Lieferantenmanagement Document Storage
 * File-based storage for supplier documents (certificates, AVVs, audit reports, etc.)
 */

import type { DokumentMeta, DokumentTyp } from './types';
import { validateId } from './storage';

const BASE_PATH = './data/apps/lieferantenmanagement/suppliers';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

/**
 * Sanitize filename: remove path traversal, null bytes, keep only basename
 */
function sanitizeFilename(name: string): string {
  // Remove path separators and null bytes
  let safe = name.replace(/[\\/\0]/g, '_');
  // Extract basename (in case of remaining path components)
  const parts = safe.split('/');
  safe = parts[parts.length - 1] || 'unnamed';
  // Remove leading dots (hidden files / traversal)
  safe = safe.replace(/^\.+/, '');
  return safe || 'unnamed';
}

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/msword', // doc
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'image/png',
  'image/jpeg',
]);

// ============== ID Generation ==============

export function generateDokumentId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `doc-${timestamp}-${random}`;
}

// ============== Validation ==============

export function validateFile(file: File): { ok: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, error: `Datei zu gross (max ${MAX_FILE_SIZE / 1024 / 1024} MB)` };
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return { ok: false, error: `Dateityp nicht erlaubt: ${file.type}. Erlaubt: PDF, DOCX, DOC, XLSX, PNG, JPG` };
  }
  return { ok: true };
}

// ============== Storage ==============

function getDocumentsPath(supplierId: string): string {
  return `${BASE_PATH}/${supplierId}/documents`;
}

function getDocumentDir(supplierId: string, docId: string): string {
  return `${getDocumentsPath(supplierId)}/${docId}`;
}

/**
 * Save a document (file + metadata)
 */
export async function saveDokument(
  supplierId: string,
  file: File,
  meta: Omit<DokumentMeta, 'dateiname' | 'dateityp' | 'dateigroesse' | 'hochgeladen_am'>
): Promise<DokumentMeta> {
  const dir = getDocumentDir(supplierId, meta.id);
  await Bun.$`mkdir -p ${dir}`;

  // Save the file with sanitized filename
  const safeName = sanitizeFilename(file.name);
  const fileBuffer = await file.arrayBuffer();
  await Bun.write(`${dir}/${safeName}`, fileBuffer);

  // Build full meta
  const fullMeta: DokumentMeta = {
    ...meta,
    dateiname: safeName,
    dateityp: file.type,
    dateigroesse: file.size,
    hochgeladen_am: new Date().toISOString(),
  };

  // Save meta.json
  await Bun.write(`${dir}/meta.json`, JSON.stringify(fullMeta, null, 2));

  return fullMeta;
}

/**
 * Get all documents for a supplier
 */
export async function getDokumente(
  supplierId: string,
  filter?: { typ?: DokumentTyp }
): Promise<DokumentMeta[]> {
  const docs: DokumentMeta[] = [];
  const docsPath = getDocumentsPath(supplierId);

  try {
    const glob = new Bun.Glob('*/meta.json');
    for await (const path of glob.scan(docsPath)) {
      const file = Bun.file(`${docsPath}/${path}`);
      if (await file.exists()) {
        const content = await file.text();
        const meta = JSON.parse(content) as DokumentMeta;
        if (filter?.typ && meta.typ !== filter.typ) continue;
        docs.push(meta);
      }
    }
  } catch {
    // No documents directory yet
  }

  // Newest first
  docs.sort((a, b) =>
    new Date(b.hochgeladen_am).getTime() - new Date(a.hochgeladen_am).getTime()
  );

  return docs;
}

/**
 * Get a single document's metadata
 */
export async function getDokument(
  supplierId: string,
  docId: string
): Promise<DokumentMeta | null> {
  if (!validateId(supplierId) || !validateId(docId)) return null;
  const metaFile = Bun.file(`${getDocumentDir(supplierId, docId)}/meta.json`);

  if (!(await metaFile.exists())) {
    return null;
  }

  const content = await metaFile.text();
  return JSON.parse(content) as DokumentMeta;
}

/**
 * Get the file path for download
 */
export function getDokumentFilePath(
  supplierId: string,
  docId: string,
  dateiname: string
): string {
  return `${getDocumentDir(supplierId, docId)}/${dateiname}`;
}

/**
 * Delete a document (file + metadata)
 */
export async function deleteDokument(
  supplierId: string,
  docId: string
): Promise<boolean> {
  if (!validateId(supplierId) || !validateId(docId)) return false;
  const dir = getDocumentDir(supplierId, docId);
  const metaFile = Bun.file(`${dir}/meta.json`);

  if (!(await metaFile.exists())) {
    return false;
  }

  await Bun.$`rm -rf ${dir}`;
  return true;
}
