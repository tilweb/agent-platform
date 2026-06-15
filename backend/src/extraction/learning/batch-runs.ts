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
}

export interface BatchFileSummary {
  id: string;
  filename: string;
  status: BatchRunStatus;
  data: Record<string, unknown> | null;
  fieldConfidences: Record<string, number> | null;
  strategy: string | null;
  error: string | null;
}

export interface BatchFileDetail extends BatchFileSummary {
  boxes: Record<string, FieldBox> | null;
  pageImages: PageImage[] | null;
}

export interface FileResultPayload {
  status: BatchRunStatus;
  data?: Record<string, unknown>;
  fieldConfidences?: Record<string, number>;
  strategy?: string;
  error?: string;
  boxes?: Record<string, FieldBox>;
  pageImages?: PageImage[];
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
): Promise<{ runId: string; files: { id: string; filename: string }[] }> {
  const db = getDb();
  const runId = generateRunId();
  const now = new Date().toISOString();

  await db.insert(extractionBatchRuns).values({
    id: runId,
    projectId,
    status: 'pending',
    fileCount: filenames.length,
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
  const detail =
    payload.boxes || payload.pageImages
      ? { boxes: payload.boxes ?? null, pageImages: payload.pageImages ?? null }
      : undefined;
  await db.update(extractionBatchRunFiles)
    .set({
      status: payload.status,
      extractedData: (payload.data ?? null) as never,
      fieldConfidences: (payload.fieldConfidences ?? null) as never,
      strategy: payload.strategy ?? null,
      error: payload.error ?? null,
      ...(detail ? { detail: detail as never } : {}),
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
  const detail = (r.detail as { boxes?: Record<string, FieldBox>; pageImages?: PageImage[] } | null) ?? null;
  return {
    id: r.id,
    filename: r.filename,
    status: r.status as BatchRunStatus,
    data: (r.extractedData as Record<string, unknown> | null) ?? null,
    fieldConfidences: (r.fieldConfidences as Record<string, number> | null) ?? null,
    strategy: r.strategy,
    error: r.error,
    boxes: detail?.boxes ?? null,
    pageImages: detail?.pageImages ?? null,
  };
}

export async function deleteBatchRun(projectId: string, runId: string): Promise<boolean> {
  const db = getDb();
  const res = await db.delete(extractionBatchRuns)
    .where(and(eq(extractionBatchRuns.id, runId), eq(extractionBatchRuns.projectId, projectId)))
    .returning({ id: extractionBatchRuns.id });
  return res.length > 0;
}
