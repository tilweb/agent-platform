/**
 * Batch-Läufe der manuellen Verarbeitungs-UI — YAML-basiert.
 *
 * Persistiert pro Projekt eine Lauf-Historie unter
 * `data/extraction-projects/{projectId}/batch-runs/{runId}/`:
 *   run.yaml              — Lauf-Metadaten
 *   files/{fileId}.yaml   — Pro-Datei-Ergebnis (Detail boxes+pageImages inline)
 *
 * Diese Datei ist die EINZIGE, die zwischen den Worktrees divergiert (YAML hier,
 * Postgres im Scalingo-Worktree). Service/Routen/Frontend nutzen nur die hier
 * exportierten Signaturen — identisch zur Postgres-Variante.
 */

import { readFile, writeFile, readdir, mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { FieldBox, PageImage } from '../../services/extraction/types';
import type { ReviewStatus, RuleIssue } from './types';

const PROJECTS_DIR = resolve(process.cwd(), '../data/extraction-projects');

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
}

export interface BatchFileDetail extends BatchFileSummary {
  boxes: Record<string, FieldBox> | null;
  pageImages: PageImage[] | null;
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
}

/** Interne On-Disk-Form (Lauf). */
interface RunRecord {
  id: string;
  projectId: string;
  status: BatchRunStatus;
  fileCount: number;
  order: string[];        // fileIds in Upload-Reihenfolge
  webhook?: WebhookState | null;
  createdAt: string;
  updatedAt: string;
}

/** Interne On-Disk-Form (Datei, inkl. schwerer Detail-Daten). */
interface FileRecord extends BatchFileDetail {
  createdAt: string;
  updatedAt: string;
}

function runsDir(projectId: string): string {
  return join(PROJECTS_DIR, projectId, 'batch-runs');
}
function runDir(projectId: string, runId: string): string {
  return join(runsDir(projectId), runId);
}
function runFile(projectId: string, runId: string): string {
  return join(runDir(projectId, runId), 'run.yaml');
}
function filesDir(projectId: string, runId: string): string {
  return join(runDir(projectId, runId), 'files');
}
function fileRecordPath(projectId: string, runId: string, fileId: string): string {
  return join(filesDir(projectId, runId), `${fileId}.yaml`);
}

async function ensureDir(dir: string): Promise<void> {
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
}

function generateRunId(): string {
  return `batch_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
}
function generateFileId(): string {
  return `bf_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

async function readRun(projectId: string, runId: string): Promise<RunRecord | null> {
  const file = runFile(projectId, runId);
  if (!existsSync(file)) return null;
  try {
    return parseYaml(await readFile(file, 'utf-8')) as RunRecord;
  } catch {
    return null;
  }
}

async function writeRun(projectId: string, run: RunRecord): Promise<void> {
  await writeFile(runFile(projectId, run.id), stringifyYaml(run), 'utf-8');
}

async function readFileRecord(projectId: string, runId: string, fileId: string): Promise<FileRecord | null> {
  const path = fileRecordPath(projectId, runId, fileId);
  if (!existsSync(path)) return null;
  try {
    return parseYaml(await readFile(path, 'utf-8')) as FileRecord;
  } catch {
    return null;
  }
}

function toSummary(f: FileRecord): BatchFileSummary {
  return {
    id: f.id,
    filename: f.filename,
    status: f.status,
    data: f.data ?? null,
    fieldConfidences: f.fieldConfidences ?? null,
    strategy: f.strategy ?? null,
    error: f.error ?? null,
    audit: f.audit ?? null,
    reviewStatus: f.reviewStatus ?? null,
    validations: f.validations ?? null,
  };
}

function counts(files: FileRecord[]): { completed: number; failed: number } {
  let completed = 0, failed = 0;
  for (const f of files) {
    if (f.status === 'completed') completed += 1;
    else if (f.status === 'failed') failed += 1;
  }
  return { completed, failed };
}

export async function createBatchRun(
  projectId: string,
  filenames: string[],
  webhookUrl?: string,
): Promise<{ runId: string; files: { id: string; filename: string }[] }> {
  const runId = generateRunId();
  await ensureDir(runDir(projectId, runId));
  await ensureDir(filesDir(projectId, runId));
  const now = new Date().toISOString();

  const files = filenames.map((filename) => ({ id: generateFileId(), filename }));

  for (const f of files) {
    const record: FileRecord = {
      id: f.id,
      filename: f.filename,
      status: 'pending',
      data: null,
      fieldConfidences: null,
      strategy: null,
      error: null,
      audit: null,
      reviewStatus: null,
      validations: null,
      boxes: null,
      pageImages: null,
      documentText: null,
      createdAt: now,
      updatedAt: now,
    };
    await writeFile(fileRecordPath(projectId, runId, f.id), stringifyYaml(record), 'utf-8');
  }

  await writeRun(projectId, {
    id: runId,
    projectId,
    status: 'pending',
    fileCount: filenames.length,
    order: files.map((f) => f.id),
    webhook: webhookUrl ? { url: webhookUrl, status: 'pending', attempts: 0, error: null } : null,
    createdAt: now,
    updatedAt: now,
  });

  return { runId, files };
}

/** Ziel-URL des Laufs (fuer die Zustellung am Lauf-Ende). */
export async function getRunWebhookUrl(projectId: string, runId: string): Promise<string | null> {
  const run = await readRun(projectId, runId);
  return run?.webhook?.url ?? null;
}

/** Zustellergebnis am Lauf vermerken. */
export async function setWebhookResult(
  projectId: string,
  runId: string,
  result: { status: WebhookState['status']; attempts: number; error?: string | null; url?: string },
): Promise<void> {
  const run = await readRun(projectId, runId);
  if (!run) return;
  const url = result.url ?? run.webhook?.url;
  if (!url) return;
  run.webhook = { url, status: result.status, attempts: result.attempts, error: result.error ?? null };
  run.updatedAt = new Date().toISOString();
  await writeRun(projectId, run);
}

export async function setRunStatus(
  projectId: string,
  runId: string,
  status: BatchRunStatus,
): Promise<void> {
  const run = await readRun(projectId, runId);
  if (!run) return;
  run.status = status;
  run.updatedAt = new Date().toISOString();
  await writeRun(projectId, run);
}

export async function upsertFileResult(
  projectId: string,
  runId: string,
  fileId: string,
  payload: FileResultPayload,
): Promise<void> {
  const existing = await readFileRecord(projectId, runId, fileId);
  if (!existing) return;
  const now = new Date().toISOString();
  const updated: FileRecord = {
    ...existing,
    status: payload.status,
    data: payload.data ?? existing.data ?? null,
    fieldConfidences: payload.fieldConfidences ?? existing.fieldConfidences ?? null,
    strategy: payload.strategy ?? existing.strategy ?? null,
    error: payload.error ?? null,
    audit: payload.audit ?? existing.audit ?? null,
    reviewStatus: payload.reviewStatus ?? existing.reviewStatus ?? null,
    validations: payload.validations ?? existing.validations ?? null,
    boxes: payload.boxes ?? existing.boxes ?? null,
    pageImages: payload.pageImages ?? existing.pageImages ?? null,
    documentText: payload.documentText ?? existing.documentText ?? null,
    updatedAt: now,
  };
  await writeFile(fileRecordPath(projectId, runId, fileId), stringifyYaml(updated), 'utf-8');
}

async function loadAllFiles(projectId: string, run: RunRecord): Promise<FileRecord[]> {
  const out: FileRecord[] = [];
  for (const fileId of run.order) {
    const rec = await readFileRecord(projectId, run.id, fileId);
    if (rec) out.push(rec);
  }
  return out;
}

export async function listBatchRuns(projectId: string): Promise<BatchRunSummary[]> {
  const dir = runsDir(projectId);
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const runs: BatchRunSummary[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const run = await readRun(projectId, entry.name);
    if (!run) continue;
    const files = await loadAllFiles(projectId, run);
    const c = counts(files);
    runs.push({
      id: run.id,
      projectId,
      status: run.status,
      fileCount: run.fileCount,
      completedCount: c.completed,
      failedCount: c.failed,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      webhook: run.webhook ?? null,
    });
  }
  return runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getBatchRun(
  projectId: string,
  runId: string,
): Promise<{ run: BatchRunSummary; files: BatchFileSummary[] } | null> {
  const run = await readRun(projectId, runId);
  if (!run) return null;
  const files = await loadAllFiles(projectId, run);
  const c = counts(files);
  return {
    run: {
      id: run.id,
      projectId,
      status: run.status,
      fileCount: run.fileCount,
      completedCount: c.completed,
      failedCount: c.failed,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      webhook: run.webhook ?? null,
    },
    files: files.map(toSummary),
  };
}

export async function getBatchRunFileDetail(
  projectId: string,
  runId: string,
  fileId: string,
): Promise<BatchFileDetail | null> {
  const rec = await readFileRecord(projectId, runId, fileId);
  if (!rec) return null;
  return {
    id: rec.id,
    filename: rec.filename,
    status: rec.status,
    data: rec.data ?? null,
    fieldConfidences: rec.fieldConfidences ?? null,
    strategy: rec.strategy ?? null,
    error: rec.error ?? null,
    audit: rec.audit ?? null,
    reviewStatus: rec.reviewStatus ?? null,
    validations: rec.validations ?? null,
    boxes: rec.boxes ?? null,
    pageImages: rec.pageImages ?? null,
    documentText: rec.documentText ?? null,
  };
}

export async function deleteBatchRun(projectId: string, runId: string): Promise<boolean> {
  const dir = runDir(projectId, runId);
  if (!existsSync(dir)) return false;
  await rm(dir, { recursive: true, force: true });
  return true;
}
