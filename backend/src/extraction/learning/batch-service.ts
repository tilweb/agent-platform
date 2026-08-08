/**
 * Hintergrund-Verarbeitung für Batch-Läufe (fire-and-forget).
 *
 * Wird von der Route mit `void runBatchExtraction(...)` (ohne await) gestartet;
 * das Frontend pollt den Status über `getBatchRun`. Verarbeitet die Dokumente mit
 * begrenzter Parallelität (pLimit) durch den bestehenden `extract()`-Pfad und
 * persistiert je Datei das Ergebnis. Fail-Soft: scheitert eine Datei, laufen die
 * übrigen weiter. Temp-Dateien werden am Ende aufgeräumt.
 *
 * Storage-agnostisch — nutzt nur die Signaturen aus `batch-runs.ts`. Identisch in
 * beiden Worktrees.
 */

import { rm } from 'fs/promises';
import { dirname } from 'path';
import { extract } from './service';
import { getProject } from './projects';
import { computeReviewStatus } from './review';
import { deliverWebhook } from './webhook';
import { getBatchRun, getRunWebhookUrl, setRunStatus, setWebhookResult, upsertFileResult } from './batch-runs';
import type { ExtractionProject } from './types';
import type { ExtractionSource } from '../types';

export interface BatchInputFile {
  fileId: string;
  filename: string;
  tempPath: string;
}

/** Verarbeite `items` mit höchstens `concurrency` parallel laufenden Workern. */
async function pLimit<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, idx: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const idx = next++;
      if (idx >= items.length) return;
      await worker(items[idx]!, idx);
    }
  });
  await Promise.all(runners);
}

const BATCH_CONCURRENCY = Number(process.env.EXTRACTION_BATCH_CONCURRENCY) || 3;

/**
 * Ergebnis-Webhook nach Lauf-Ende (Welle 5). Ziel: `callback_url` des Laufs,
 * sonst der Projekt-Default. Ohne Ziel passiert nichts. Fehlschlaege werden am
 * Lauf vermerkt, nicht geworfen — die Ergebnisse bleiben ueber die API abrufbar.
 */
async function notifyWebhook(
  projectId: string,
  runId: string,
  project: ExtractionProject | null,
): Promise<void> {
  try {
    const url = (await getRunWebhookUrl(projectId, runId)) || project?.webhook?.url;
    if (!url) return;

    const result = await getBatchRun(projectId, runId);
    if (!result) return;

    const payload = {
      event: 'batch.completed',
      run_id: runId,
      project_id: projectId,
      status: result.run.status,
      file_count: result.run.fileCount,
      completed: result.run.completedCount,
      failed: result.run.failedCount,
      needs_review: result.files.filter((f) => f.reviewStatus === 'needs_review').length,
      files: result.files.map((f) => ({
        filename: f.filename,
        status: f.status,
        data: f.data,
        field_confidences: f.fieldConfidences,
        review_status: f.reviewStatus,
        validations: f.validations ?? [],
        ...(f.segments ? { segments: f.segments } : {}),
        error: f.error,
      })),
    };

    const delivery = await deliverWebhook(url, project?.webhook?.secret, payload);
    await setWebhookResult(projectId, runId, {
      status: delivery.delivered ? 'delivered' : 'failed',
      attempts: delivery.attempts,
      error: delivery.error ?? null,
      url,
    });
    console.log(
      `[batch-extract] Webhook ${runId} ${delivery.delivered ? 'zugestellt' : `fehlgeschlagen (${delivery.error})`} nach ${delivery.attempts} Versuch(en)`,
    );
  } catch (err) {
    console.error('[batch-extract] Webhook-Zustellung abgebrochen:', err instanceof Error ? err.message : err);
  }
}

export async function runBatchExtraction(
  projectId: string,
  runId: string,
  files: BatchInputFile[],
  userId?: string,
): Promise<void> {
  try {
    await setRunStatus(projectId, runId, 'processing');

    // Projekt einmal je Lauf laden (Review-Schwelle + Feld-Definitionen fuer Triage).
    const project = await getProject(projectId);

    await pLimit(files, BATCH_CONCURRENCY, async (file) => {
      await upsertFileResult(projectId, runId, file.fileId, { status: 'processing' });
      try {
        const source: ExtractionSource = { type: 'file', path: file.tempPath, filename: file.filename };
        const result = await extract(projectId, source, userId);
        // Review-Triage (Welle 3) + fachliche Pruefregeln (Welle 5): nur fuer
        // erfolgreiche Extraktionen.
        const reviewStatus =
          result.success && project
            ? computeReviewStatus(project, result.data, result.fieldConfidences, result.validations)
            : undefined;
        await upsertFileResult(projectId, runId, file.fileId, {
          status: result.success ? 'completed' : 'failed',
          data: result.data,
          fieldConfidences: result.fieldConfidences,
          strategy: result.strategyUsed,
          error: result.error,
          boxes: result.boxes,
          pageImages: result.pageImages,
          audit: result.audit,
          documentText: result.document_text,
          reviewStatus,
          validations: result.validations,
          segments: result.segments,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[batch-extract] ${runId}/${file.filename} fehlgeschlagen:`, msg);
        await upsertFileResult(projectId, runId, file.fileId, { status: 'failed', error: msg });
      }
    });

    await setRunStatus(projectId, runId, 'completed');
    await notifyWebhook(projectId, runId, project);
  } catch (err) {
    console.error(`[batch-extract] Lauf ${runId} abgebrochen:`, err instanceof Error ? err.message : err);
    await setRunStatus(projectId, runId, 'failed').catch(() => {});
  } finally {
    // Temp-Dateien aufräumen (Best-Effort).
    await Promise.all(
      files.map((f) => rm(f.tempPath, { force: true }).catch(() => {})),
    );
    // Sammelordner mit entfernen — sonst bleiben leere /tmp/extraction-batch/*-Dirs liegen.
    const tmpDir = files[0] ? dirname(files[0].tempPath) : undefined;
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
