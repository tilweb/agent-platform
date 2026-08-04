/**
 * Posteingang (Welle 4) — Verarbeitungs-Pipeline (fire-and-forget).
 *
 * Je Upload: PDF rendern → Dokumentgrenzen beurteilen (Vision) → Teil-PDFs
 * bauen (pdfseparate/pdfunite) → je Teil klassifizieren (Vision, Erste Seite)
 * → sichere Teile automatisch als Batch-Lauf ins Zielprojekt routen
 * (W3-Review-Triage ist dort das zweite Netz). Unsichere Teile bleiben zur
 * manuellen Zuordnung (`routePart`).
 *
 * Storage-agnostisch — nutzt nur die Signaturen aus `store.ts`. Identisch in
 * beiden Worktrees.
 */

import { mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { renderPdfToImages, countPdfPages, PdfRenderError, type PdfPageImage } from '../../services/extraction/pdf';
import { buildPartPdf, isPdfSplitterAvailable, PdfSplitError } from '../../services/extraction/pdf-split';
import { getAllProjects, getProject } from '../learning/projects';
import { createBatchRun } from '../learning/batch-runs';
import { runBatchExtraction, type BatchInputFile } from '../learning/batch-service';
import { judgeBoundaries, rangesFromBoundaries } from './split';
import { classifyPart, partFilename, type PartClassification } from './classify';
import {
  createParts,
  updatePart,
  updateUpload,
  getUpload,
  listUploads,
  saveOriginal,
  savePartPdf,
  getPartPdf,
  getOriginal,
  safeExt,
  type InboxPart,
  type NewInboxPart,
} from './store';

const AUTO_ROUTE_THRESHOLD = parseFloat(process.env.INBOX_AUTO_ROUTE_THRESHOLD || '0.8');
const MAX_PAGES = parseInt(process.env.INBOX_MAX_PAGES || '60', 10);

/** Optionen je Upload. */
export interface InboxProcessOptions {
  /**
   * Mehrseitige PDFs an vermuteten Dokumentgrenzen trennen. Default `true`.
   * `false` behandelt den Upload als EIN Dokument — kein Seitenpaar-Urteil,
   * kein Zerschneiden; die Klassifikation laeuft auf Seite 1.
   */
  split?: boolean;
}
/** processing-Uploads aelter als das gelten als abgebrochen (Server-Restart). */
const STALE_PROCESSING_MS = 30 * 60 * 1000;

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);

function tmpRouteDir(): string {
  return `/tmp/extraction-inbox/${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Teile eines Uploads in Batch-Laeufe des Zielprojekts geben. `partBuffers`
 * liefert die PDF-Bytes je Teil (aus dem Speicher oder Storage).
 */
async function routePartsToProject(
  projectId: string,
  parts: Array<{ part: InboxPart; buffer: Buffer }>,
  userId?: string,
): Promise<string> {
  const dir = tmpRouteDir();
  await mkdir(dir, { recursive: true });
  const saved: { filename: string; tempPath: string }[] = [];
  for (const { part, buffer } of parts) {
    const tempPath = join(dir, `${saved.length}_${part.filename.replace(/[^\w.\-]+/g, '_')}`);
    await Bun.write(tempPath, buffer);
    saved.push({ filename: part.filename, tempPath });
  }
  const { runId, files } = await createBatchRun(projectId, saved.map((s) => s.filename));
  const inputFiles: BatchInputFile[] = files.map((f, i) => ({
    fileId: f.id,
    filename: f.filename,
    tempPath: saved[i]!.tempPath,
  }));
  void runBatchExtraction(projectId, runId, inputFiles, userId).catch((err) =>
    console.error('[inbox] runBatchExtraction error:', err instanceof Error ? err.message : err),
  );
  return runId;
}

/**
 * Verarbeitet einen frisch hochgeladenen Posteingang-Eintrag (fire-and-forget).
 * Fehlerbehandlung komplett intern; raeumt tempPath am Ende auf.
 */
export async function processInboxUpload(
  uploadId: string,
  tempPath: string,
  meta: { filename: string; mimeType?: string },
  userId?: string,
  options: InboxProcessOptions = {},
): Promise<void> {
  try {
    const buffer = Buffer.from(await readFile(tempPath));
    const ext = safeExt(meta.filename);
    await saveOriginal(uploadId, buffer, ext);

    const isPdf = ext === 'pdf' || meta.mimeType === 'application/pdf';
    const isImage = IMAGE_EXTS.has(ext);

    const projects = await getAllProjects();

    // ---------- Nicht-PDF ----------
    if (!isPdf) {
      let classification: PartClassification | null = null;
      let preview: string | null = null;
      if (isImage) {
        const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
        const dataUri = `data:${mime};base64,${buffer.toString('base64')}`;
        try {
          classification = await classifyPart(dataUri, projects, userId);
        } catch (err) {
          console.warn('[inbox] Klassifikation fehlgeschlagen:', err instanceof Error ? err.message : err);
        }
        preview = null; // Original kann gross sein — kein Thumbnail ohne Renderer (v1)
      }
      const [part] = await createParts(uploadId, [{
        index: 0,
        pageFrom: 1,
        pageTo: 1,
        filename: meta.filename,
        classification,
        previewDataUri: preview,
      }]);
      await autoRoute(uploadId, [{ part: part!, buffer }], userId);
      await updateUpload(uploadId, { status: 'ready', pageCount: 1 });
      return;
    }

    // ---------- PDF ----------
    let pageCount = 0;
    try {
      pageCount = await countPdfPages(buffer);
    } catch { /* unten behandelt */ }
    if (!pageCount || pageCount < 1) {
      await updateUpload(uploadId, {
        status: 'failed',
        error: 'PDF konnte nicht gelesen werden (beschädigt oder kein PDF?)',
      });
      return;
    }
    await updateUpload(uploadId, { pageCount });

    // Seiten-Cap: nicht splitten, aber klassifizieren.
    if (pageCount > MAX_PAGES) {
      const firstPage = await renderPdfToImages(buffer, { dpi: 150, pageSelection: [1] });
      const preview = await renderPreview(buffer, 1);
      const classification = await tryClassify(firstPage[0], projects, userId);
      const [part] = await createParts(uploadId, [{
        index: 0, pageFrom: 1, pageTo: pageCount, filename: meta.filename,
        classification, previewDataUri: preview,
      }]);
      await autoRoute(uploadId, [{ part: part!, buffer }], userId);
      await updateUpload(uploadId, {
        status: 'ready',
        note: `${pageCount} Seiten (> ${MAX_PAGES}) — nicht auf Dokumentgrenzen geprüft`,
      });
      return;
    }

    // Rendern + Grenzen beurteilen. Ohne Split (`split: false`) wird der Beleg
    // als EIN Dokument behandelt — sinnvoll, wenn die Quelle ohnehin je Vorgang
    // eine Datei liefert (z.B. ein RPA-Roboter, der einen Lieferschein scannt).
    // Dann entfaellt auch das Seitenpaar-Urteil, also ein LLM-Call je Uebergang.
    const splitEnabled = options.split !== false;
    const pages = await renderPdfToImages(buffer, { dpi: 150, ...(splitEnabled ? {} : { maxPages: 1 }) });
    const boundaries = splitEnabled && pages.length > 1 ? await judgeBoundaries(pages, userId) : [];
    let ranges = splitEnabled
      ? rangesFromBoundaries(pages.length, boundaries)
      : [{ from: 1, to: pageCount }];

    // Teil-PDFs bauen (bei >1 Teil). Fallback auf 1 Teil, wenn der Splitter
    // fehlt oder scheitert (z.B. verschluesseltes PDF) — kein Hard-Fail.
    let note: string | undefined;
    const partBuffers: Buffer[] = [];
    if (ranges.length > 1) {
      if (!(await isPdfSplitterAvailable())) {
        note = 'pdfseparate/pdfunite fehlt — Dokument nicht getrennt (poppler-utils installieren)';
        ranges = [{ from: 1, to: pages.length }];
      } else {
        const tmpPdf = `${tempPath}.split-src.pdf`;
        await Bun.write(tmpPdf, buffer);
        try {
          for (const range of ranges) {
            partBuffers.push(await buildPartPdf(tmpPdf, range.from, range.to));
          }
        } catch (err) {
          const msg = err instanceof PdfSplitError ? err.message : String(err);
          console.warn(`[inbox] Teil-PDF-Bau fehlgeschlagen (${uploadId}):`, msg);
          note = 'Dokument konnte nicht getrennt werden — als Ganzes übernommen';
          ranges = [{ from: 1, to: pages.length }];
          partBuffers.length = 0;
        } finally {
          await rm(tmpPdf, { force: true }).catch(() => {});
        }
      }
    }
    if (ranges.length === 1) {
      partBuffers.length = 0;
      partBuffers.push(buffer); // Ein Teil = Originaldokument
    }

    // Teile anlegen: Klassifikation (Erste Seite des Ranges, bereits gerendert)
    // + kleines Preview.
    const newParts: NewInboxPart[] = [];
    for (let i = 0; i < ranges.length; i += 1) {
      const range = ranges[i]!;
      const firstPage = pages[range.from - 1];
      const classification = await tryClassify(firstPage, projects, userId);
      const preview = await renderPreview(partBuffers[i]!, 1);
      newParts.push({
        index: i,
        pageFrom: range.from,
        pageTo: range.to,
        filename: ranges.length === 1 ? meta.filename : partFilename(meta.filename, i + 1),
        classification,
        previewDataUri: preview,
      });
    }
    const parts = await createParts(uploadId, newParts);

    // Teil-PDFs persistieren (nur echte Teile — Ein-Teil-Uploads nutzen das Original).
    if (ranges.length > 1) {
      for (let i = 0; i < parts.length; i += 1) {
        await savePartPdf(uploadId, parts[i]!.id, partBuffers[i]!);
      }
    }

    await autoRoute(
      uploadId,
      parts.map((part, i) => ({ part, buffer: partBuffers[i]! })),
      userId,
    );
    await updateUpload(uploadId, { status: 'ready', ...(note ? { note } : {}) });
  } catch (err) {
    const msg = err instanceof PdfRenderError || err instanceof Error ? err.message : String(err);
    console.error(`[inbox] Verarbeitung fehlgeschlagen (${uploadId}):`, msg);
    await updateUpload(uploadId, { status: 'failed', error: msg }).catch(() => {});
  } finally {
    await rm(tempPath, { force: true }).catch(() => {});
  }
}

async function tryClassify(
  firstPage: PdfPageImage | undefined,
  projects: Awaited<ReturnType<typeof getAllProjects>>,
  userId?: string,
): Promise<PartClassification | null> {
  if (!firstPage) return null;
  try {
    const dataUri = `data:image/png;base64,${firstPage.pngBuffer.toString('base64')}`;
    return await classifyPart(dataUri, projects, userId);
  } catch (err) {
    console.warn('[inbox] Klassifikation fehlgeschlagen:', err instanceof Error ? err.message : err);
    return null;
  }
}

/** Kleines Vorschau-PNG (40dpi, Seite 1) — Best-Effort. */
async function renderPreview(pdfBuffer: Buffer, page: number): Promise<string | null> {
  try {
    const imgs = await renderPdfToImages(pdfBuffer, { dpi: 40, pageSelection: [page] });
    const img = imgs[0];
    if (!img) return null;
    return `data:image/png;base64,${img.pngBuffer.toString('base64')}`;
  } catch {
    return null;
  }
}

/**
 * Auto-Routing: Teile mit sicherer Klassifikation (>= Schwelle) nach Projekt
 * gruppieren und je Projekt EINEN Batch-Lauf starten.
 */
async function autoRoute(
  uploadId: string,
  parts: Array<{ part: InboxPart; buffer: Buffer }>,
  userId?: string,
): Promise<void> {
  const eligible = parts.filter(
    ({ part }) =>
      part.classification?.project_id &&
      part.classification.confidence >= AUTO_ROUTE_THRESHOLD,
  );
  if (eligible.length === 0) return;

  const byProject = new Map<string, Array<{ part: InboxPart; buffer: Buffer }>>();
  for (const entry of eligible) {
    const pid = entry.part.classification!.project_id!;
    const list = byProject.get(pid) ?? [];
    list.push(entry);
    byProject.set(pid, list);
  }

  for (const [projectId, group] of byProject) {
    // Projekt koennte inzwischen geloescht sein → Teile bleiben unassigned.
    const project = await getProject(projectId);
    if (!project) continue;
    try {
      const runId = await routePartsToProject(projectId, group, userId);
      for (const { part } of group) {
        await updatePart(uploadId, part.id, {
          status: 'auto_routed',
          targetProjectId: projectId,
          batchRunId: runId,
        });
      }
      console.log(`[inbox] ${group.length} Teil(e) automatisch → ${projectId} (Lauf ${runId})`);
    } catch (err) {
      console.error('[inbox] Auto-Routing fehlgeschlagen:', err instanceof Error ? err.message : err);
    }
  }
}

/** Manuelle Zuordnung eines Teils zu einem Projekt. */
export async function routePart(
  uploadId: string,
  partId: string,
  projectId: string,
  userId?: string,
): Promise<{ runId: string }> {
  const upload = await getUpload(uploadId);
  if (!upload) throw new Error('Upload nicht gefunden');
  const part = upload.parts.find((p) => p.id === partId);
  if (!part) throw new Error('Teil nicht gefunden');
  if (part.status !== 'unassigned') throw new Error('Teil ist bereits zugeordnet');
  const project = await getProject(projectId);
  if (!project) throw new Error(`Projekt "${projectId}" nicht gefunden`);

  // Bytes: eigenes Teil-PDF, sonst Original (Ein-Teil-Uploads).
  let buffer = await getPartPdf(uploadId, partId);
  if (!buffer) buffer = await getOriginal(uploadId, safeExt(upload.filename));
  if (!buffer) throw new Error('Dokument-Datei nicht mehr vorhanden');

  const runId = await routePartsToProject(projectId, [{ part, buffer }], userId);
  await updatePart(uploadId, partId, {
    status: 'routed',
    targetProjectId: projectId,
    batchRunId: runId,
  });
  return { runId };
}

/**
 * Aufraeumen haengender Uploads (Server-Restart waehrend processing):
 * processing aelter als 30 min → failed. Wird vom GET /inbox aufgerufen.
 */
export async function sweepStaleUploads(): Promise<void> {
  const uploads = await listUploads();
  const cutoff = Date.now() - STALE_PROCESSING_MS;
  for (const u of uploads) {
    if (u.status === 'processing' && new Date(u.updatedAt).getTime() < cutoff) {
      await updateUpload(u.id, {
        status: 'failed',
        error: 'Verarbeitung unterbrochen (Server-Neustart) — bitte erneut hochladen',
      }).catch(() => {});
    }
  }
}
