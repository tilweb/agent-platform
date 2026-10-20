import { enqueueBatch } from '../learning/jobs';
/**
 * Posteingang (Welle 4) — Verarbeitungs-Pipeline (Job `dp-posteingang` in der Hintergrund-Warteschlange).
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

import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PRIORITAET, hatOffenenJob, registriereJobArt, stelleEin } from '../queue/hintergrund';
import { renderPdfToImages, countPdfPages, PdfRenderError, type PdfPageImage } from '../../services/extraction/pdf';
import { buildPartPdf, isPdfSplitterAvailable, PdfSplitError } from '../../services/extraction/pdf-split';
import { getAllProjects, getProject } from '../learning/projects';
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
  deletePartsOfUpload,
  safeExt,
  type EingangsModus,
  type InboxPart,
  type NewInboxPart,
} from './store';
import { BASISPROFIL_ID, istBasisprofil, stelleBasisprofilSicher, zuordnungsKandidaten } from '../basisprofil';
import { umschlagAbschliessen } from './umschlag';

const AUTO_ROUTE_THRESHOLD = parseFloat(process.env.INBOX_AUTO_ROUTE_THRESHOLD || '0.8');
const MAX_PAGES = parseInt(process.env.INBOX_MAX_PAGES || '60', 10);

/**
 * Optionen je Upload. Massgeblich sind `modus`/`profilId` am Upload-Datensatz
 * (beim Anlegen gesetzt); die Optionen hier sind nur Rueckfall fuer Aufrufer,
 * die den Datensatz ohne diese Felder angelegt haben.
 */
export interface InboxProcessOptions {
  modus?: EingangsModus;
  profilId?: string | null;
  /** Veraltet: `false` = Vorgang, `true` = Stapel. */
  split?: boolean;
}

/** Eingangsmodus aus Formular-/API-Angaben (Konzept DP-Produktmodell §3; Standard: Vorgang). */
export function eingangsModus(modus: unknown, split: unknown): EingangsModus {
  if (modus === 'vorgang' || modus === 'stapel') return modus;
  if (typeof split === 'string') return ['false', '0', 'nein'].includes(split.toLowerCase()) ? 'vorgang' : 'stapel';
  if (typeof split === 'boolean') return split ? 'stapel' : 'vorgang';
  return 'vorgang';
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
  const { runId } = await enqueueBatch(projectId, saved, userId);
  return runId;
}

/**
 * Teile-Plan (rein, testbar). Vorgang: immer EIN Teil ueber alle Seiten.
 * Stapel: Schnitte aus den Grenzurteilen; ein nicht beantwortetes Urteil (`null`)
 * gilt als „kein Schnitt" und wird als offene Grenze gemeldet — statt den ganzen
 * Upload abzubrechen (Konzept §6 Punkt 5).
 */
export function planeTeile(
  modus: EingangsModus,
  pageCount: number,
  boundaries: Array<boolean | null> = [],
): { ranges: Array<{ from: number; to: number }>; offeneGrenzen: number[] } {
  if (modus === 'vorgang' || pageCount <= 1) return { ranges: [{ from: 1, to: Math.max(1, pageCount) }], offeneGrenzen: [] };
  const offeneGrenzen = boundaries.map((b, i) => (b === null ? i + 1 : 0)).filter((n) => n > 0);
  return { ranges: rangesFromBoundaries(pageCount, boundaries.map((b) => b === true)), offeneGrenzen };
}

/** Job-Art: Verarbeitung eines Posteingang-Uploads (Stufe S1 — laeuft im Worker oder im Web-Prozess). */
export const INBOX_JOB = 'dp-posteingang';

interface InboxJobNutzlast {
  uploadId: string;
  modus?: EingangsModus;
  profilId?: string | null;
  split?: boolean;
}

/**
 * Annahme eines Uploads (Web-Prozess): Original dauerhaft nach S3, dann Job einstellen. Die Verarbeitung laeuft
 * fortsetzbar in der Warteschlange — kein /tmp-Dateipfad ueber Prozessgrenzen.
 */
export async function nehmeInboxUploadAn(
  uploadId: string,
  buffer: Buffer,
  meta: { filename: string },
  userId?: string,
  options: InboxProcessOptions = {},
): Promise<void> {
  try {
    await saveOriginal(uploadId, buffer, safeExt(meta.filename));
  } catch (err) {
    const msg = `Original konnte nicht gespeichert werden: ${err instanceof Error ? err.message : String(err)}`;
    await updateUpload(uploadId, { status: 'failed', error: msg }).catch(() => {});
    await umschlagAbschliessen(uploadId).catch(() => {});
    throw new Error(msg);
  }
  await stelleEin<InboxJobNutzlast>(INBOX_JOB, { uploadId, modus: options.modus, profilId: options.profilId ?? null, split: options.split }, {
    schluessel: `inbox:${uploadId}`, userId: userId ?? null, prioritaet: PRIORITAET.eingang,
  });
}

registriereJobArt<InboxJobNutzlast>(INBOX_JOB, {
  async ausfuehren(n, k) {
    await verarbeiteInboxUpload(n.uploadId, k.userId, { modus: n.modus, profilId: n.profilId, split: n.split });
  },
  async beiAbbruch(n, fehler) {
    await updateUpload(n.uploadId, { status: 'failed', error: fehler });
    await umschlagAbschliessen(n.uploadId);
  },
});

/**
 * Job-Ausfuehrung: Original aus S3 laden und verarbeiten. Wiederholbar — nach einer Uebernahme werden schon
 * angelegte Teile nicht doppelt geroutet.
 */
export async function verarbeiteInboxUpload(uploadId: string, userId?: string, options: InboxProcessOptions = {}): Promise<void> {
  const upload = await getUpload(uploadId);
  if (!upload || upload.status !== 'processing') return; // geloescht oder schon abgeschlossen
  const meta = { filename: upload.filename, mimeType: upload.mimeType ?? undefined };
  const buffer = await getOriginal(uploadId, safeExt(upload.filename));
  if (!buffer) throw new Error('Original des Uploads nicht gefunden (Speicher)');

  // Wiederaufnahme: Teile aus einem vorigen Versuch.
  if (upload.parts.length) {
    const offen = upload.parts.filter((p) => !p.batchRunId);
    if (!offen.length) {
      await updateUpload(uploadId, { status: 'ready' });
      return;
    }
    if (offen.length < upload.parts.length) {
      // Teilweise geroutet: nur die offenen Teile nachholen (Bytes aus S3 bzw. Original bei einem Teil).
      const mitBytes = await Promise.all(offen.map(async (part) => ({
        part, buffer: upload.parts.length === 1 ? buffer : await getPartPdf(uploadId, part.id),
      })));
      if (mitBytes.some((x) => !x.buffer)) throw new Error('Teil-PDF eines vorigen Versuchs fehlt — bitte erneut hochladen.');
      await autoRoute(uploadId, mitBytes as Array<{ part: InboxPart; buffer: Buffer }>, userId);
      await updateUpload(uploadId, { status: 'ready' });
      return;
    }
    // Nichts geroutet: Teile verwerfen und neu beginnen.
    await deletePartsOfUpload(uploadId);
  }
  await verarbeiteUploadPuffer(uploadId, buffer, meta, userId, options);
}

/**
 * Verarbeitet einen hochgeladenen Posteingang-Eintrag direkt (ohne Warteschlange; Altweg fuer Skripte/Tests).
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
    await saveOriginal(uploadId, buffer, safeExt(meta.filename));
    await verarbeiteUploadPuffer(uploadId, buffer, meta, userId, options);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateUpload(uploadId, { status: 'failed', error: msg }).catch(() => {});
    await umschlagAbschliessen(uploadId).catch(() => {});
  } finally {
    await rm(tempPath, { force: true }).catch(() => {});
  }
}

/** Kern der Verarbeitung (Original liegt schon im Speicher). Fehlerbehandlung intern. */
async function verarbeiteUploadPuffer(
  uploadId: string,
  buffer: Buffer,
  meta: { filename: string; mimeType?: string },
  userId?: string,
  options: InboxProcessOptions = {},
): Promise<void> {
  try {
    const ext = safeExt(meta.filename);

    const datensatz = await getUpload(uploadId);
    const modus: EingangsModus = datensatz?.modus ?? eingangsModus(options.modus, options.split);
    const profilId = datensatz?.profilId ?? options.profilId ?? null;
    if (profilId && !(await getProject(profilId))) throw new Error(`Profil „${profilId}" nicht gefunden`);

    const isPdf = ext === 'pdf' || meta.mimeType === 'application/pdf';
    const isImage = IMAGE_EXTS.has(ext);
    const kandidaten = zuordnungsKandidaten(await getAllProjects());
    const vorgegeben: PartClassification | null = profilId ? { project_id: profilId, confidence: 1, alternatives: [] } : null;

    // ---------- Nicht-PDF ----------
    if (!isPdf) {
      let classification: PartClassification | null = vorgegeben;
      if (!classification && isImage) {
        const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
        try {
          classification = await classifyPart(`data:${mime};base64,${buffer.toString('base64')}`, kandidaten, userId);
        } catch (err) {
          console.warn('[inbox] Klassifikation fehlgeschlagen:', err instanceof Error ? err.message : err);
        }
      }
      const [part] = await createParts(uploadId, [{ index: 0, pageFrom: 1, pageTo: 1, filename: meta.filename, classification, previewDataUri: null }]);
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
      await updateUpload(uploadId, { status: 'failed', error: 'PDF konnte nicht gelesen werden (beschädigt oder kein PDF?)' });
      return;
    }
    await updateUpload(uploadId, { pageCount });

    // Vorgang oder vorgegebene Pipeline: EIN Teil, Zuordnung (falls noetig) ueber Seite 1 — keine Trennung, kein Seitenlimit.
    if (modus === 'vorgang' || profilId) {
      const classification = vorgegeben ?? await tryClassify((await renderPdfToImages(buffer, { dpi: 150, pageSelection: [1] }))[0], kandidaten, userId);
      const [part] = await createParts(uploadId, [{
        index: 0, pageFrom: 1, pageTo: pageCount, filename: meta.filename,
        classification, previewDataUri: await renderPreview(buffer, 1),
      }]);
      await autoRoute(uploadId, [{ part: part!, buffer }], userId);
      await updateUpload(uploadId, { status: 'ready' });
      return;
    }

    // ---------- Stapel: Trennen + Zuordnen je Teil ----------
    if (pageCount > MAX_PAGES) {
      throw new Error(`${pageCount} Seiten: Dokumentgrenzen können nur bis ${MAX_PAGES} Seiten geprüft werden. Bitte in kleinere Stapel aufteilen oder als Vorgang verarbeiten.`);
    }
    const pages = await renderPdfToImages(buffer, { dpi: 150 });
    const boundaries = pages.length > 1 ? await judgeBoundaries(pages, userId) : [];
    const { ranges, offeneGrenzen } = planeTeile('stapel', pages.length, boundaries);
    const note = offeneGrenzen.length
      ? `Grenze nach Seite ${offeneGrenzen.join(', ')} nicht geprüft (keine Modellantwort) — dort nicht getrennt.`
      : undefined;

    // Teil-PDFs bauen (bei >1 Teil).
    const partBuffers: Buffer[] = [];
    if (ranges.length > 1) {
      if (!(await isPdfSplitterAvailable())) {
        throw new Error('Dokumenttrennung erforderlich, aber PDF-Splitter nicht verfügbar.');
      }
      const tmpDir = await mkdtemp(join(tmpdir(), 'extraction-inbox-split-'));
      const tmpPdf = join(tmpDir, 'quelle.pdf');
      await Bun.write(tmpPdf, buffer);
      try {
        for (const range of ranges) partBuffers.push(await buildPartPdf(tmpPdf, range.from, range.to));
      } catch (err) {
        const msg = err instanceof PdfSplitError ? err.message : String(err);
        console.warn(`[inbox] Teil-PDF-Bau fehlgeschlagen (${uploadId}):`, msg);
        throw new Error('Dokument konnte nicht getrennt werden — keine automatische Weiterverarbeitung.');
      } finally {
        await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }
    } else {
      partBuffers.push(buffer); // Ein Teil = Originaldokument
    }

    // Teile anlegen: Zuordnung je Teil (erste Seite des Bereichs) + kleines Preview.
    const newParts: NewInboxPart[] = [];
    for (let i = 0; i < ranges.length; i += 1) {
      const range = ranges[i]!;
      newParts.push({
        index: i,
        pageFrom: range.from,
        pageTo: range.to,
        filename: ranges.length === 1 ? meta.filename : partFilename(meta.filename, i + 1),
        classification: await tryClassify(pages[range.from - 1], kandidaten, userId),
        previewDataUri: await renderPreview(partBuffers[i]!, 1),
      });
    }
    const parts = await createParts(uploadId, newParts);
    if (ranges.length > 1) {
      for (let i = 0; i < parts.length; i += 1) await savePartPdf(uploadId, parts[i]!.id, partBuffers[i]!);
    }

    await autoRoute(uploadId, parts.map((part, i) => ({ part, buffer: partBuffers[i]! })), userId);
    await updateUpload(uploadId, { status: 'ready', ...(note ? { note } : {}) });
  } catch (err) {
    const msg = err instanceof PdfRenderError || err instanceof Error ? err.message : String(err);
    console.error(`[inbox] Verarbeitung fehlgeschlagen (${uploadId}):`, msg);
    await updateUpload(uploadId, { status: 'failed', error: msg }).catch(() => {});
    // Auch ein gescheiterter Upload ist abgeschlossen — Umschlag-Webhook informiert den Aufrufer.
    await umschlagAbschliessen(uploadId).catch(() => {});
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
 * Auto-Routing: Teile mit sicherer Zuordnung (>= Schwelle) je Pipeline in EINEN
 * Batch-Lauf; alle anderen an das Basisprofil „Allgemein" (Status `kein_profil`,
 * manuell umleitbar) — nie Zwangszuordnung zur wahrscheinlichsten Pipeline.
 */
async function autoRoute(
  uploadId: string,
  parts: Array<{ part: InboxPart; buffer: Buffer }>,
  userId?: string,
): Promise<void> {
  const byProject = new Map<string, Array<{ part: InboxPart; buffer: Buffer }>>();
  for (const entry of parts) {
    const c = entry.part.classification;
    const sicher = !!c?.project_id && c.confidence >= AUTO_ROUTE_THRESHOLD && !!(await getProject(c.project_id));
    const pid = sicher ? c!.project_id! : BASISPROFIL_ID;
    if (pid === BASISPROFIL_ID) await stelleBasisprofilSicher();
    const list = byProject.get(pid) ?? [];
    list.push(entry);
    byProject.set(pid, list);
  }

  for (const [projectId, group] of byProject) {
    try {
      const runId = await routePartsToProject(projectId, group, userId);
      for (const { part } of group) {
        await updatePart(uploadId, part.id, {
          status: istBasisprofil(projectId) ? 'kein_profil' : 'auto_routed',
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

/** Manuelle Zuordnung eines Teils zu einem Projekt (auch Umleitung aus dem Basisprofil). */
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
  if (part.status !== 'unassigned' && part.status !== 'kein_profil') throw new Error('Teil ist bereits zugeordnet');
  const project = await getProject(projectId);
  if (!project) throw new Error(`Profil "${projectId}" nicht gefunden`);

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
    // Uploads mit offenem Job (wartet auf den Worker, laeuft) sind nicht abgebrochen.
    if (u.status === 'processing' && new Date(u.updatedAt).getTime() < cutoff && !(await hatOffenenJob(`inbox:${u.id}`))) {
      await updateUpload(u.id, {
        status: 'failed',
        error: 'Verarbeitung unterbrochen (Server-Neustart) — bitte erneut hochladen',
      }).catch(() => {});
    }
  }
}
