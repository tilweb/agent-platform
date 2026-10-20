/**
 * Posteingang (Welle 4) — Persistenz, Postgres + S3 (Scalingo-Variante).
 *
 * Metadaten (Uploads + Teile) in `extraction.inbox_uploads`/`inbox_parts`;
 * die PDF-Bytes (Original + Teile) in S3 unter `extraction-inbox/{uploadId}/...`
 * (Scalingo-Dateisystem ist ephemeral — wartende Teile muessen Redeploys
 * ueberleben).
 *
 * Diese Datei ist die EINZIGE des Posteingangs, die zwischen den Worktrees
 * divergiert (Railway: YAML + Dateien unter data/extraction-inbox/). Service/
 * Routen/Frontend nutzen nur die hier exportierten Signaturen.
 */

import { eq, desc, and, isNull } from 'drizzle-orm';
import { getDb } from '../../db';
import { extractionInboxUploads, extractionInboxParts } from '../../db/schema/extraction';
import { putObject, getObject, deleteObject, listObjectsByPrefix } from '../../storage/s3';
import { s3Paths } from '../../storage/paths';
import type { PartClassification } from './classify';
import type { AbrechnungsPosten } from '../produkte';

export type InboxUploadStatus = 'processing' | 'ready' | 'failed';
/** `kein_profil`: Sicherheit unter Schwelle → automatisch an das Basisprofil „Allgemein" (manuell umleitbar). */
export type InboxPartStatus = 'unassigned' | 'auto_routed' | 'routed' | 'kein_profil';
export type EingangsModus = 'vorgang' | 'stapel';
export type WebhookStatus = 'wird_zugestellt' | 'zugestellt' | 'fehlgeschlagen';

export interface InboxUpload {
  id: string;
  filename: string;
  mimeType: string | null;
  pageCount: number | null;
  status: InboxUploadStatus;
  error: string | null;
  note: string | null;
  modus: EingangsModus;
  profilId: string | null;
  quelle: 'oberflaeche' | 'api';
  callbackUrl: string | null;
  webhookStatus: WebhookStatus | null;
  webhookError: string | null;
  abrechnung: AbrechnungsPosten[] | null;
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

function generateUploadId(): string {
  return `inb_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
}
function generatePartId(): string {
  return `inp_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

/** Datei-Endung fuer den S3-Key des Originals (sanitisiert, Default 'bin'). */
export function safeExt(filename: string): string {
  const m = filename.match(/\.([a-zA-Z0-9]{1,12})$/);
  return (m ? m[1]! : 'bin').toLowerCase();
}

function mapPart(r: typeof extractionInboxParts.$inferSelect): InboxPart {
  return {
    id: r.id,
    index: r.partIndex,
    pageFrom: r.pageFrom,
    pageTo: r.pageTo,
    filename: r.filename,
    status: r.status as InboxPartStatus,
    classification: (r.classification as PartClassification | null) ?? null,
    targetProjectId: r.targetProjectId,
    batchRunId: r.batchRunId,
    previewDataUri: r.previewDataUri,
  };
}

function mapUpload(r: typeof extractionInboxUploads.$inferSelect): InboxUpload {
  return {
    id: r.id,
    filename: r.filename,
    mimeType: r.mimeType,
    pageCount: r.pageCount,
    status: r.status as InboxUploadStatus,
    error: r.error,
    note: r.note,
    modus: (r.modus === 'vorgang' ? 'vorgang' : 'stapel') as EingangsModus,
    profilId: r.profilId ?? null,
    quelle: (r.quelle === 'api' ? 'api' : 'oberflaeche'),
    callbackUrl: r.callbackUrl ?? null,
    webhookStatus: (r.webhookStatus as WebhookStatus | null) ?? null,
    webhookError: r.webhookError ?? null,
    abrechnung: (r.abrechnung as AbrechnungsPosten[] | null) ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function createUpload(meta: {
  filename: string; mimeType?: string;
  modus?: EingangsModus; profilId?: string | null; quelle?: 'oberflaeche' | 'api'; callbackUrl?: string | null;
}): Promise<InboxUpload> {
  const db = getDb();
  const now = new Date().toISOString();
  const row = {
    id: generateUploadId(),
    filename: meta.filename,
    mimeType: meta.mimeType ?? null,
    pageCount: null,
    status: 'processing' as InboxUploadStatus,
    error: null,
    note: null,
    modus: meta.modus ?? 'vorgang',
    profilId: meta.profilId ?? null,
    quelle: meta.quelle ?? 'oberflaeche',
    callbackUrl: meta.callbackUrl ?? null,
    webhookStatus: null,
    webhookError: null,
    abrechnung: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(extractionInboxUploads).values(row as never);
  return mapUpload(row as typeof extractionInboxUploads.$inferSelect);
}

export async function updateUpload(
  id: string,
  patch: Partial<Pick<InboxUpload, 'status' | 'error' | 'note' | 'pageCount' | 'mimeType' | 'webhookStatus' | 'webhookError' | 'abrechnung'>>,
): Promise<void> {
  const db = getDb();
  const set: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (patch.webhookStatus !== undefined) set.webhookStatus = patch.webhookStatus;
  if (patch.webhookError !== undefined) set.webhookError = patch.webhookError;
  if (patch.abrechnung !== undefined) set.abrechnung = patch.abrechnung as never;
  if (patch.status !== undefined) set.status = patch.status;
  if (patch.error !== undefined) set.error = patch.error;
  if (patch.note !== undefined) set.note = patch.note;
  if (patch.pageCount !== undefined) set.pageCount = patch.pageCount;
  if (patch.mimeType !== undefined) set.mimeType = patch.mimeType;
  await db.update(extractionInboxUploads).set(set).where(eq(extractionInboxUploads.id, id));
}

export async function createParts(uploadId: string, parts: NewInboxPart[]): Promise<InboxPart[]> {
  const db = getDb();
  const now = new Date().toISOString();
  const rows = parts.map((p) => ({
    id: generatePartId(),
    uploadId,
    partIndex: p.index,
    pageFrom: p.pageFrom,
    pageTo: p.pageTo,
    filename: p.filename,
    status: 'unassigned' as InboxPartStatus,
    classification: (p.classification ?? null) as never,
    targetProjectId: null,
    batchRunId: null,
    previewDataUri: p.previewDataUri ?? null,
    createdAt: now,
    updatedAt: now,
  }));
  if (rows.length > 0) await db.insert(extractionInboxParts).values(rows);
  return rows.map((r) => mapPart(r as typeof extractionInboxParts.$inferSelect));
}

/** Teile eines Uploads verwerfen (Wiederaufnahme nach abgebrochenem Versuch, noch nichts geroutet). */
export async function deletePartsOfUpload(uploadId: string): Promise<void> {
  await getDb().delete(extractionInboxParts).where(eq(extractionInboxParts.uploadId, uploadId));
}

export async function updatePart(
  uploadId: string,
  partId: string,
  patch: Partial<Pick<InboxPart, 'status' | 'classification' | 'targetProjectId' | 'batchRunId' | 'previewDataUri'>>,
): Promise<void> {
  const db = getDb();
  const set: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (patch.status !== undefined) set.status = patch.status;
  if (patch.classification !== undefined) set.classification = patch.classification as never;
  if (patch.targetProjectId !== undefined) set.targetProjectId = patch.targetProjectId;
  if (patch.batchRunId !== undefined) set.batchRunId = patch.batchRunId;
  if (patch.previewDataUri !== undefined) set.previewDataUri = patch.previewDataUri;
  await db.update(extractionInboxParts)
    .set(set)
    .where(and(eq(extractionInboxParts.id, partId), eq(extractionInboxParts.uploadId, uploadId)));
}

export async function listUploads(): Promise<InboxUploadWithParts[]> {
  const db = getDb();
  const uploads = await db.select().from(extractionInboxUploads)
    .orderBy(desc(extractionInboxUploads.createdAt));
  if (uploads.length === 0) return [];
  const allParts = await db.select().from(extractionInboxParts);
  const byUpload = new Map<string, InboxPart[]>();
  for (const p of allParts) {
    const list = byUpload.get(p.uploadId) ?? [];
    list.push(mapPart(p));
    byUpload.set(p.uploadId, list);
  }
  return uploads.map((u) => ({
    ...mapUpload(u),
    parts: (byUpload.get(u.id) ?? []).sort((a, b) => a.index - b.index),
  }));
}

export async function getUpload(id: string): Promise<InboxUploadWithParts | null> {
  const db = getDb();
  const rows = await db.select().from(extractionInboxUploads).where(eq(extractionInboxUploads.id, id));
  const u = rows[0];
  if (!u) return null;
  const parts = await db.select().from(extractionInboxParts)
    .where(eq(extractionInboxParts.uploadId, id));
  return { ...mapUpload(u), parts: parts.map(mapPart).sort((a, b) => a.index - b.index) };
}

/** Teile, die in einen bestimmten Batch-Lauf geroutet wurden (Umschlag-Abschluss je Lauf). */
export async function findPartsByRunId(runId: string): Promise<Array<{ uploadId: string; partId: string }>> {
  const db = getDb();
  const rows = await db.select({ uploadId: extractionInboxParts.uploadId, partId: extractionInboxParts.id })
    .from(extractionInboxParts).where(eq(extractionInboxParts.batchRunId, runId));
  return rows;
}

/**
 * Umschlag-Zustellung genau einmal beanspruchen: setzt `webhook_status` nur von
 * NULL auf `wird_zugestellt` — enden zwei Laeufe gleichzeitig, gewinnt einer.
 */
export async function claimUmschlagZustellung(uploadId: string): Promise<boolean> {
  const db = getDb();
  const res = await db.update(extractionInboxUploads)
    .set({ webhookStatus: 'wird_zugestellt', updatedAt: new Date().toISOString() })
    .where(and(eq(extractionInboxUploads.id, uploadId), isNull(extractionInboxUploads.webhookStatus)))
    .returning({ id: extractionInboxUploads.id });
  return res.length > 0;
}

// ============== PDF-Bytes (S3) ==============

export async function saveOriginal(uploadId: string, buffer: Buffer, ext: string): Promise<void> {
  await putObject(s3Paths.inboxOriginal(uploadId, ext), buffer, 'application/pdf');
}

export async function getOriginal(uploadId: string, ext: string): Promise<Buffer | null> {
  try {
    return await getObject(s3Paths.inboxOriginal(uploadId, ext));
  } catch {
    return null;
  }
}

export async function savePartPdf(uploadId: string, partId: string, buffer: Buffer): Promise<void> {
  await putObject(s3Paths.inboxPart(uploadId, partId), buffer, 'application/pdf');
}

export async function getPartPdf(uploadId: string, partId: string): Promise<Buffer | null> {
  try {
    return await getObject(s3Paths.inboxPart(uploadId, partId));
  } catch {
    return null;
  }
}

export async function deleteUpload(id: string): Promise<boolean> {
  const db = getDb();
  const res = await db.delete(extractionInboxUploads)
    .where(eq(extractionInboxUploads.id, id))
    .returning({ id: extractionInboxUploads.id });
  // S3-Objekte best-effort aufräumen (Parts + Original).
  try {
    const objects = await listObjectsByPrefix(`extraction-inbox/${id}/`);
    for (const obj of objects) {
      await deleteObject(obj.key).catch(() => {});
    }
  } catch (err) {
    console.warn('[inbox] S3-Cleanup fehlgeschlagen:', err instanceof Error ? err.message : err);
  }
  return res.length > 0;
}
