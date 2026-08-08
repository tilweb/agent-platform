/**
 * Batch-Läufe der manuellen Verarbeitungs-UI — Postgres-backed (Drizzle).
 *
 * Persistiert pro Projekt eine Lauf-Historie (`extraction.batch_runs`) und je
 * Dokument ein Ergebnis (`extraction.batch_run_files`). Die schweren Detail-Daten
 * (boxes + pageImages, base64-PNGs) liegen in `detail` und werden NUR vom
 * Detail-Endpoint gelesen — Listen/Polling lassen sie aus.
 *
 * Diese Datei ist die EINZIGE, die zwischen den Worktrees divergiert
 * (Postgres hier, YAML-Dateien im Railway-Worktree). Service/Routen/Frontend
 * nutzen nur die hier exportierten Signaturen.
 */

import { eq, and, desc, inArray } from 'drizzle-orm';
import { getDb } from '../../db';
import { extractionBatchRuns, extractionBatchRunFiles } from '../../db/schema/extraction';
import type { FieldBox, PageImage } from '../../services/extraction/types';
import { deletePageImages, savePageImages, type StoredPageImage } from './page-store';
import type { ReviewStatus, RuleIssue, SegmentInstance } from './types';

export type BatchRunStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface BatchRunSummary {
  id: string;
  projectId: string;
  status: BatchRunStatus;
  fileCount: number;
  completedCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
  /** Webhook-Ziel + Zustellstand (Welle 5); null wenn kein Webhook konfiguriert. */
  webhook: WebhookState | null;
}

/** Zustellstand des Ergebnis-Webhooks eines Laufs. */
export interface WebhookState {
  url: string;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  error: string | null;
}

/** Audit-Metadaten eines Ergebnisses (Regel-Stand/Modell/Strategie). */
export interface FileAudit {
  guideline_version: number;
  model: string;
  strategy?: string;
}

export interface BatchFileSummary {
  id: string;
  filename: string;
  status: BatchRunStatus;
  data: Record<string, unknown> | null;
  fieldConfidences: Record<string, number> | null;
  strategy: string | null;
  error: string | null;
  audit: FileAudit | null;
  /** Review-Triage (Welle 3); null bei fehlgeschlagenen/alten Dateien. */
  reviewStatus: ReviewStatus | null;
  /** Befunde der fachlichen Pruefregeln (Welle 5); null bei alten Laeufen. */
  validations: RuleIssue[] | null;
  /** Segment-Instanzen (Welle 10); null bei segmentlosen Profilen/alten Laeufen. */
  segments: SegmentInstance[] | null;
}

export interface BatchFileDetail extends BatchFileSummary {
  boxes: Record<string, FieldBox> | null;
  /**
   * Seitenbilder als Referenz (Welle 5) — die Bytes liegen ausserhalb der Zeile
   * und werden ueber die Seiten-Route geliefert. Alte Laeufe tragen hier
   * weiterhin `dataUri`.
   */
  pageImages: StoredPageImage[] | null;
  /** Dokumenttext (Welle 3) — Grundlage fuer "Uebernehmen & lernen"; nur im Detail. */
  documentText: string | null;
}

export interface FileResultPayload {
  status: BatchRunStatus;
  data?: Record<string, unknown>;
  fieldConfidences?: Record<string, number>;
  strategy?: string;
  error?: string;
  boxes?: Record<string, FieldBox>;
  pageImages?: PageImage[];
  audit?: FileAudit;
  documentText?: string;
  reviewStatus?: ReviewStatus;
  validations?: RuleIssue[];
  segments?: SegmentInstance[];
}

function generateRunId(): string {
  return `batch_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
}

function generateFileId(): string {
  return `bf_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Legt einen Lauf + eine Datei-Zeile je Eingabe-Datei (Status pending) an.
 * Gibt die fileIds in derselben Reihenfolge wie `filenames` zurück, damit der
 * Aufrufer Temp-Pfade auf Datei-Zeilen abbilden kann.
 */
export async function createBatchRun(
  projectId: string,
  filenames: string[],
  webhookUrl?: string,
): Promise<{ runId: string; files: { id: string; filename: string }[] }> {
  const db = getDb();
  const runId = generateRunId();
  const now = new Date().toISOString();

  await db.insert(extractionBatchRuns).values({
    id: runId,
    projectId,
    status: 'pending',
    fileCount: filenames.length,
    webhookUrl: webhookUrl ?? null,
    webhookStatus: webhookUrl ? 'pending' : null,
    webhookAttempts: webhookUrl ? 0 : null,
    createdAt: now,
    updatedAt: now,
  });

  const files = filenames.map((filename) => ({ id: generateFileId(), filename }));
  if (files.length > 0) {
    await db.insert(extractionBatchRunFiles).values(
      files.map((f) => ({
        id: f.id,
        batchRunId: runId,
        filename: f.filename,
        status: 'pending' as BatchRunStatus,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }

  return { runId, files };
}

function toWebhookState(row: typeof extractionBatchRuns.$inferSelect): WebhookState | null {
  if (!row.webhookUrl) return null;
  return {
    url: row.webhookUrl,
    status: (row.webhookStatus as WebhookState['status']) ?? 'pending',
    attempts: row.webhookAttempts ?? 0,
    error: row.webhookError ?? null,
  };
}

/** Ziel-URL des Laufs (fuer die Zustellung am Lauf-Ende). */
export async function getRunWebhookUrl(_projectId: string, runId: string): Promise<string | null> {
  const db = getDb();
  const rows = await db.select({ url: extractionBatchRuns.webhookUrl })
    .from(extractionBatchRuns).where(eq(extractionBatchRuns.id, runId));
  return rows[0]?.url ?? null;
}

/** Zustellergebnis am Lauf vermerken. */
export async function setWebhookResult(
  _projectId: string,
  runId: string,
  result: { status: WebhookState['status']; attempts: number; error?: string | null; url?: string },
): Promise<void> {
  const db = getDb();
  await db.update(extractionBatchRuns)
    .set({
      ...(result.url ? { webhookUrl: result.url } : {}),
      webhookStatus: result.status,
      webhookAttempts: result.attempts,
      webhookError: result.error ?? null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(extractionBatchRuns.id, runId));
}

export async function setRunStatus(
  _projectId: string,
  runId: string,
  status: BatchRunStatus,
): Promise<void> {
  const db = getDb();
  await db.update(extractionBatchRuns)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(extractionBatchRuns.id, runId));
}

export async function upsertFileResult(
  _projectId: string,
  _runId: string,
  fileId: string,
  payload: FileResultPayload,
): Promise<void> {
  const db = getDb();
  // Seitenbilder aus der Zeile auslagern (Welle 5) — in `detail` bleibt nur die Referenz.
  const storedPages = await savePageImages(_runId, fileId, payload.pageImages);
  const detail =
    payload.boxes || storedPages
      ? { boxes: payload.boxes ?? null, pageImages: storedPages ?? null }
      : undefined;
  await db.update(extractionBatchRunFiles)
    .set({
      status: payload.status,
      extractedData: (payload.data ?? null) as never,
      fieldConfidences: (payload.fieldConfidences ?? null) as never,
      strategy: payload.strategy ?? null,
      error: payload.error ?? null,
      ...(detail ? { detail: detail as never } : {}),
      ...(payload.audit ? { audit: payload.audit as never } : {}),
      ...(payload.documentText !== undefined ? { documentText: payload.documentText } : {}),
      ...(payload.reviewStatus !== undefined ? { reviewStatus: payload.reviewStatus } : {}),
      ...(payload.validations !== undefined ? { validations: payload.validations as never } : {}),
      ...(payload.segments !== undefined ? { segments: payload.segments as never } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(extractionBatchRunFiles.id, fileId));
}

export async function listBatchRuns(projectId: string): Promise<BatchRunSummary[]> {
  const db = getDb();
  const runs = await db.select().from(extractionBatchRuns)
    .where(eq(extractionBatchRuns.projectId, projectId))
    .orderBy(desc(extractionBatchRuns.createdAt));
  if (runs.length === 0) return [];

  const runIds = runs.map((r) => r.id);
  const files = await db.select({
    batchRunId: extractionBatchRunFiles.batchRunId,
    status: extractionBatchRunFiles.status,
  }).from(extractionBatchRunFiles).where(inArray(extractionBatchRunFiles.batchRunId, runIds));

  const counts = new Map<string, { completed: number; failed: number }>();
  for (const f of files) {
    const c = counts.get(f.batchRunId) ?? { completed: 0, failed: 0 };
    if (f.status === 'completed') c.completed += 1;
    else if (f.status === 'failed') c.failed += 1;
    counts.set(f.batchRunId, c);
  }

  return runs.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    status: r.status as BatchRunStatus,
    fileCount: r.fileCount,
    completedCount: counts.get(r.id)?.completed ?? 0,
    failedCount: counts.get(r.id)?.failed ?? 0,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    webhook: toWebhookState(r),
  }));
}

/** Run + Datei-Summaries (OHNE schwere Detail-Daten). */
export async function getBatchRun(
  projectId: string,
  runId: string,
): Promise<{ run: BatchRunSummary; files: BatchFileSummary[] } | null> {
  const db = getDb();
  const runs = await db.select().from(extractionBatchRuns)
    .where(and(eq(extractionBatchRuns.id, runId), eq(extractionBatchRuns.projectId, projectId)));
  const run = runs[0];
  if (!run) return null;

  const rows = await db.select({
    id: extractionBatchRunFiles.id,
    filename: extractionBatchRunFiles.filename,
    status: extractionBatchRunFiles.status,
    extractedData: extractionBatchRunFiles.extractedData,
    fieldConfidences: extractionBatchRunFiles.fieldConfidences,
    strategy: extractionBatchRunFiles.strategy,
    error: extractionBatchRunFiles.error,
    audit: extractionBatchRunFiles.audit,
    reviewStatus: extractionBatchRunFiles.reviewStatus,
    validations: extractionBatchRunFiles.validations,
    segments: extractionBatchRunFiles.segments,
  }).from(extractionBatchRunFiles)
    .where(eq(extractionBatchRunFiles.batchRunId, runId))
    .orderBy(extractionBatchRunFiles.createdAt);

  const files: BatchFileSummary[] = rows.map((r) => ({
    id: r.id,
    filename: r.filename,
    status: r.status as BatchRunStatus,
    data: (r.extractedData as Record<string, unknown> | null) ?? null,
    fieldConfidences: (r.fieldConfidences as Record<string, number> | null) ?? null,
    strategy: r.strategy,
    error: r.error,
    audit: (r.audit as FileAudit | null) ?? null,
    reviewStatus: (r.reviewStatus as ReviewStatus | null) ?? null,
    validations: (r.validations as RuleIssue[] | null) ?? null,
    segments: (r.segments as SegmentInstance[] | null) ?? null,
  }));

  let completedCount = 0, failedCount = 0;
  for (const f of files) {
    if (f.status === 'completed') completedCount += 1;
    else if (f.status === 'failed') failedCount += 1;
  }

  return {
    run: {
      id: run.id,
      projectId: run.projectId,
      status: run.status as BatchRunStatus,
      fileCount: run.fileCount,
      completedCount,
      failedCount,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      webhook: toWebhookState(run),
    },
    files,
  };
}

/** Vollständiges Pro-Datei-Ergebnis inkl. boxes + pageImages (für die Detail-Vorschau). */
export async function getBatchRunFileDetail(
  _projectId: string,
  runId: string,
  fileId: string,
): Promise<BatchFileDetail | null> {
  const db = getDb();
  const rows = await db.select().from(extractionBatchRunFiles)
    .where(and(eq(extractionBatchRunFiles.id, fileId), eq(extractionBatchRunFiles.batchRunId, runId)));
  const r = rows[0];
  if (!r) return null;
  const detail = (r.detail as { boxes?: Record<string, FieldBox>; pageImages?: StoredPageImage[] } | null) ?? null;
  return {
    id: r.id,
    filename: r.filename,
    status: r.status as BatchRunStatus,
    data: (r.extractedData as Record<string, unknown> | null) ?? null,
    fieldConfidences: (r.fieldConfidences as Record<string, number> | null) ?? null,
    strategy: r.strategy,
    error: r.error,
    audit: (r.audit as FileAudit | null) ?? null,
    reviewStatus: (r.reviewStatus as ReviewStatus | null) ?? null,
    validations: (r.validations as RuleIssue[] | null) ?? null,
    segments: (r.segments as SegmentInstance[] | null) ?? null,
    boxes: detail?.boxes ?? null,
    pageImages: detail?.pageImages ?? null,
    documentText: r.documentText ?? null,
  };
}

export async function deleteBatchRun(projectId: string, runId: string): Promise<boolean> {
  const db = getDb();
  const res = await db.delete(extractionBatchRuns)
    .where(and(eq(extractionBatchRuns.id, runId), eq(extractionBatchRuns.projectId, projectId)))
    .returning({ id: extractionBatchRuns.id });
  if (res.length > 0) await deletePageImages(runId);
  return res.length > 0;
}
