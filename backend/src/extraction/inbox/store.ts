/**
 * Posteingang (Welle 4) — Persistenz, YAML + Dateien (Railway-Variante).
 *
 * Layout unter `data/extraction-inbox/{uploadId}/`:
 *   upload.yaml           — Upload-Metadaten + Teile (inkl. Klassifikation/Preview)
 *   original.<ext>        — hochgeladene Originaldatei
 *   parts/{partId}.pdf    — Teil-PDFs (nur bei echten Splits)
 *
 * Diese Datei ist die EINZIGE des Posteingangs, die zwischen den Worktrees
 * divergiert (Scalingo: Postgres-Metadaten + S3-Bytes). Service/Routen/Frontend
 * nutzen nur die hier exportierten Signaturen — identisch zur Postgres-Variante.
 */

import { readFile, writeFile, readdir, mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { PartClassification } from './classify';

const INBOX_DIR = resolve(process.cwd(), '../data/extraction-inbox');

export type InboxUploadStatus = 'processing' | 'ready' | 'failed';
export type InboxPartStatus = 'unassigned' | 'auto_routed' | 'routed';

export interface InboxUpload {
  id: string;
  filename: string;
  mimeType: string | null;
  pageCount: number | null;
  status: InboxUploadStatus;
  error: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InboxPart {
  id: string;
  index: number;
  pageFrom: number;
  pageTo: number;
  filename: string;
  status: InboxPartStatus;
  classification: PartClassification | null;
  targetProjectId: string | null;
  batchRunId: string | null;
  previewDataUri: string | null;
}

export interface InboxUploadWithParts extends InboxUpload {
  parts: InboxPart[];
}

export interface NewInboxPart {
  index: number;
  pageFrom: number;
  pageTo: number;
  filename: string;
  classification?: PartClassification | null;
  previewDataUri?: string | null;
}

/** On-Disk-Form: Upload + Teile in einer YAML. */
interface UploadRecord extends InboxUpload {
  parts: InboxPart[];
}

function generateUploadId(): string {
  return `inb_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
}
function generatePartId(): string {
  return `inp_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

/** Datei-Endung fuer die Original-Ablage (sanitisiert, Default 'bin'). */
export function safeExt(filename: string): string {
  const m = filename.match(/\.([a-zA-Z0-9]{1,12})$/);
  return (m ? m[1]! : 'bin').toLowerCase();
}

function uploadDir(id: string): string {
  return join(INBOX_DIR, id);
}
function uploadFile(id: string): string {
  return join(uploadDir(id), 'upload.yaml');
}
function partsDir(id: string): string {
  return join(uploadDir(id), 'parts');
}

async function ensureDir(dir: string): Promise<void> {
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
}

async function readRecord(id: string): Promise<UploadRecord | null> {
  const file = uploadFile(id);
  if (!existsSync(file)) return null;
  try {
    return parseYaml(await readFile(file, 'utf-8')) as UploadRecord;
  } catch {
    return null;
  }
}

async function writeRecord(record: UploadRecord): Promise<void> {
  await ensureDir(uploadDir(record.id));
  await writeFile(uploadFile(record.id), stringifyYaml(record), 'utf-8');
}

export async function createUpload(meta: { filename: string; mimeType?: string }): Promise<InboxUpload> {
  const now = new Date().toISOString();
  const record: UploadRecord = {
    id: generateUploadId(),
    filename: meta.filename,
    mimeType: meta.mimeType ?? null,
    pageCount: null,
    status: 'processing',
    error: null,
    note: null,
    createdAt: now,
    updatedAt: now,
    parts: [],
  };
  await writeRecord(record);
  const { parts: _parts, ...upload } = record;
  return upload;
}

export async function updateUpload(
  id: string,
  patch: Partial<Pick<InboxUpload, 'status' | 'error' | 'note' | 'pageCount' | 'mimeType'>>,
): Promise<void> {
  const record = await readRecord(id);
  if (!record) return;
  Object.assign(record, patch, { updatedAt: new Date().toISOString() });
  await writeRecord(record);
}

export async function createParts(uploadId: string, parts: NewInboxPart[]): Promise<InboxPart[]> {
  const record = await readRecord(uploadId);
  if (!record) return [];
  const created: InboxPart[] = parts.map((p) => ({
    id: generatePartId(),
    index: p.index,
    pageFrom: p.pageFrom,
    pageTo: p.pageTo,
    filename: p.filename,
    status: 'unassigned',
    classification: p.classification ?? null,
    targetProjectId: null,
    batchRunId: null,
    previewDataUri: p.previewDataUri ?? null,
  }));
  record.parts.push(...created);
  record.updatedAt = new Date().toISOString();
  await writeRecord(record);
  return created;
}

export async function updatePart(
  uploadId: string,
  partId: string,
  patch: Partial<Pick<InboxPart, 'status' | 'classification' | 'targetProjectId' | 'batchRunId' | 'previewDataUri'>>,
): Promise<void> {
  const record = await readRecord(uploadId);
  if (!record) return;
  const part = record.parts.find((p) => p.id === partId);
  if (!part) return;
  Object.assign(part, patch);
  record.updatedAt = new Date().toISOString();
  await writeRecord(record);
}

export async function listUploads(): Promise<InboxUploadWithParts[]> {
  if (!existsSync(INBOX_DIR)) return [];
  const entries = await readdir(INBOX_DIR, { withFileTypes: true });
  const out: InboxUploadWithParts[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const record = await readRecord(entry.name);
    if (record) {
      out.push({ ...record, parts: [...record.parts].sort((a, b) => a.index - b.index) });
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getUpload(id: string): Promise<InboxUploadWithParts | null> {
  const record = await readRecord(id);
  if (!record) return null;
  return { ...record, parts: [...record.parts].sort((a, b) => a.index - b.index) };
}

// ============== PDF-Bytes (Dateisystem) ==============

export async function saveOriginal(uploadId: string, buffer: Buffer, ext: string): Promise<void> {
  await ensureDir(uploadDir(uploadId));
  await writeFile(join(uploadDir(uploadId), `original.${ext}`), buffer);
}

export async function getOriginal(uploadId: string, ext: string): Promise<Buffer | null> {
  const path = join(uploadDir(uploadId), `original.${ext}`);
  if (!existsSync(path)) return null;
  try {
    return Buffer.from(await readFile(path));
  } catch {
    return null;
  }
}

export async function savePartPdf(uploadId: string, partId: string, buffer: Buffer): Promise<void> {
  await ensureDir(partsDir(uploadId));
  await writeFile(join(partsDir(uploadId), `${partId}.pdf`), buffer);
}

export async function getPartPdf(uploadId: string, partId: string): Promise<Buffer | null> {
  const path = join(partsDir(uploadId), `${partId}.pdf`);
  if (!existsSync(path)) return null;
  try {
    return Buffer.from(await readFile(path));
  } catch {
    return null;
  }
}

export async function deleteUpload(id: string): Promise<boolean> {
  const dir = uploadDir(id);
  if (!existsSync(dir)) return false;
  await rm(dir, { recursive: true, force: true });
  return true;
}
