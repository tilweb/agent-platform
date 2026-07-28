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
import { extract } from './service';
import { getProject } from './projects';
import { computeReviewStatus } from './review';
import { setRunStatus, upsertFileResult } from './batch-runs';
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
        // Review-Triage (Welle 3): nur fuer erfolgreiche Extraktionen.
        const reviewStatus =
          result.success && project
            ? computeReviewStatus(project, result.data, result.fieldConfidences)
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
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[batch-extract] ${runId}/${file.filename} fehlgeschlagen:`, msg);
        await upsertFileResult(projectId, runId, file.fileId, { status: 'failed', error: msg });
      }
    });

    await setRunStatus(projectId, runId, 'completed');
  } catch (err) {
    console.error(`[batch-extract] Lauf ${runId} abgebrochen:`, err instanceof Error ? err.message : err);
    await setRunStatus(projectId, runId, 'failed').catch(() => {});
  } finally {
    // Temp-Dateien aufräumen (Best-Effort).
    await Promise.all(
      files.map((f) => rm(f.tempPath, { force: true }).catch(() => {})),
    );
  }
}
