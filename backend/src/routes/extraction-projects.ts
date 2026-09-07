import { enqueueBatch, cancelBatch, retryBatch } from '../extraction/learning/jobs';
import { ruleFields } from '../extraction/learning/rule-scope';
import { getRunSnapshot } from '../extraction/learning/batch-runs';
import { profileHash } from '../extraction/learning/snapshot';
/**
 * Extraction Projects Routes
 *
 * REST API for learning extraction projects, training, and guidelines.
 */

import { notifyWebhook } from '../extraction/learning/batch-service';
import { checkReview } from '../extraction/learning/review-result';
import { isReleased } from '../extraction/learning/result-validation';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import { authMiddleware } from '../auth/middleware';
import {
  getAllProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getExamples,
  deleteExample,
  extract,
  train,
  regenerateGuidelines,
  listBatchRuns,
  getBatchRun,
  getBatchRunFileDetail,
  deleteBatchRun,
  upsertFileResult,
  exportProject,
  importProject,
  validateProjectFields,
  validateProjectSegments,
  validateProjectRules,
  evaluateProjectRules,
  ingestPlainText,
  inferSchema,
  readPageImage,
  runFullEval,
} from '../extraction/learning';
import type { ProjectField } from '../extraction/learning';
import { generateWebhookSecret, isDeliverableUrl } from '../extraction/learning/webhook';
import { createTable, addRow } from '../tables';
import type { ColumnDefinition, ColumnType } from '../tables/types';
import { generateDocument } from '../services/documentGenerator';
import { buildBatchExportSections, parseExportFormat, sectionToCsv, type ExportFormat } from '../extraction/learning/export-xlsx';

export const extractionProjectRoutes = new Hono();

// Alle Document-Processing-Routen erfordern eine gueltige Session — analog zum
// Repo-Muster (routes/agents.ts). Ohne diese Zeile lag die gesamte Flaeche
// (Profile-CRUD, Batch-Upload, extrahierte Kundendaten) unauthentifiziert offen.
extractionProjectRoutes.use('/*', authMiddleware);

// ============== Project CRUD ==============

/**
 * GET /projects — List all projects
 */
extractionProjectRoutes.get('/projects', async (c) => {
  const projects = await getAllProjects();
  return c.json(projects.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    field_count: Object.keys(p.fields).length,
    created: p.created,
    updated: p.updated,
    learning: p.learning,
  })));
});

/**
 * GET /projects/:id — Project details
 */
extractionProjectRoutes.get('/projects/:id', async (c) => {
  const project = await getProject(c.req.param('id'));
  if (!project) {
    return c.json({ error: 'Profil nicht gefunden' }, 404);
  }
  return c.json(project);
});

/**
 * POST /projects — Create project
 */
extractionProjectRoutes.post('/projects', async (c) => {
  const body = await c.req.json();

  if (!body.name || !body.fields || Object.keys(body.fields).length === 0) {
    return c.json({ error: 'Name und mindestens ein Feld erforderlich' }, 400);
  }

  const fieldError = validateProjectFields(body.fields);
  if (fieldError) {
    return c.json({ error: fieldError }, 400);
  }

  const ruleError = validateProjectRules(ruleFields({ fields: body.fields, segments: body.segments }), body.rules);
  if (ruleError) {
    return c.json({ error: ruleError }, 400);
  }

  const segmentError = validateProjectSegments(body.segments);
  if (segmentError) {
    return c.json({ error: segmentError }, 400);
  }

  const project = await createProject({
    name: body.name,
    description: body.description,
    fields: body.fields,
    instructions: body.instructions,
    extraction: body.extraction,
    rules: body.rules,
    segments: body.segments,
  });

  return c.json(project, 201);
});

/**
 * PUT /projects/:id — Update project
 */
extractionProjectRoutes.put('/projects/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();

  if (body.fields) {
    const fieldError = validateProjectFields(body.fields);
    if (fieldError) {
      return c.json({ error: fieldError }, 400);
    }
  }

  if (body.segments !== undefined) {
    const segmentError = validateProjectSegments(body.segments === null ? undefined : body.segments);
    if (segmentError) {
      return c.json({ error: segmentError }, 400);
    }
  }

  if (body.rules !== undefined || body.fields || body.segments !== undefined) {
    // Regeln referenzieren Feld-IDs — gegen den kuenftigen Feldstand pruefen
    // (mitgesendete Felder, sonst die bestehenden).
    const existing = await getProject(id);
    if (!existing) return c.json({ error: 'Profil nicht gefunden' }, 404);
    const effectiveFields = body.fields ?? existing.fields;
    const effectiveRules = body.rules !== undefined ? body.rules : existing.rules;
    const ruleError = validateProjectRules(ruleFields({ fields: effectiveFields, segments: body.segments === null ? undefined : body.segments ?? existing.segments }), effectiveRules);
    if (ruleError) {
      return c.json({ error: ruleError }, 400);
    }
  }

  // Webhook-Ziel (Welle 5): `null` loescht bewusst, `undefined` laesst unberuehrt.
  let webhook: { url?: string; secret?: string } | undefined;
  if (body.webhook === null) {
    webhook = {};
  } else if (body.webhook && typeof body.webhook === 'object') {
    const url = typeof body.webhook.url === 'string' ? body.webhook.url.trim() : '';
    if (url && !isDeliverableUrl(url)) {
      return c.json({ error: 'Webhook-URL muss mit http:// oder https:// beginnen' }, 400);
    }
    webhook = {
      ...(url ? { url } : {}),
      ...(typeof body.webhook.secret === 'string' && body.webhook.secret.trim()
        ? { secret: body.webhook.secret.trim() }
        : {}),
    };
  }

  const updated = await updateProject(id, {
    name: body.name,
    description: body.description,
    fields: body.fields,
    instructions: body.instructions,
    extraction: body.extraction,
    rules: body.rules,
    webhook,
    // `null` loescht die Segmenttypen bewusst, `undefined` (weggelassen) laesst sie
    // unberuehrt. updateProject filtert nur `undefined` heraus, `null` clippt auf null.
    segments: body.segments,
  });

  if (!updated) {
    return c.json({ error: 'Profil nicht gefunden' }, 404);
  }

  return c.json(updated);
});

/**
 * DELETE /projects/:id — Delete project with all examples
 */
extractionProjectRoutes.delete('/projects/:id', async (c) => {
  const deleted = await deleteProject(c.req.param('id'));
  if (!deleted) {
    return c.json({ error: 'Profil nicht gefunden' }, 404);
  }
  return c.json({ success: true });
});

// ============== Export / Import (Projekt-Weitergabe) ==============

/**
 * POST /projects/import — Projekt aus einem Paket importieren (immer als NEUES
 * Projekt). Akzeptiert JSON-Body oder multipart mit `file`.
 *
 * Vor den `:id`-Routen registriert, damit `import` nicht als :id interpretiert wird.
 */
extractionProjectRoutes.post('/projects/import', async (c) => {
  const contentType = c.req.header('content-type') || '';
  let bundle: unknown;
  try {
    if (contentType.includes('multipart/form-data')) {
      const formData = await c.req.formData();
      const file = formData.get('file');
      if (!(file instanceof File)) return c.json({ error: 'Keine Datei hochgeladen' }, 400);
      bundle = JSON.parse(await file.text());
    } else {
      bundle = await c.req.json();
    }
  } catch {
    return c.json({ error: 'Datei ist kein gültiges JSON' }, 400);
  }

  try {
    const project = await importProject(bundle);
    return c.json(project, 201);
  } catch (error: any) {
    return c.json({ error: error.message || 'Import fehlgeschlagen' }, 400);
  }
});

/**
 * POST /projects/infer-schema — Feldvorschlag aus einem Beispieldokument (Welle 5).
 *
 * Akzeptiert multipart mit `file` oder JSON `{ text }`. Legt NICHTS an — der
 * Vorschlag geht zurueck ins Formular und wird dort bearbeitet.
 * Vor den `:id`-Routen registriert (wie `/projects/import`).
 */
extractionProjectRoutes.post('/projects/infer-schema', async (c) => {
  const contentType = c.req.header('content-type') || '';
  let text = '';

  try {
    if (contentType.includes('multipart/form-data')) {
      const formData = await c.req.formData();
      const file = formData.get('file');
      if (!(file instanceof File)) return c.json({ error: 'Keine Datei hochgeladen' }, 400);

      const { mkdir, rm } = await import('fs/promises');
      const tmpDir = `/tmp/extraction-infer/${randomUUID()}`;
      await mkdir(tmpDir, { recursive: true });
      const tmpPath = `${tmpDir}/${file.name.replace(/[^\w.\-]+/g, '_')}`;
      try {
        await Bun.write(tmpPath, await file.arrayBuffer());
        text = await ingestPlainText({ type: 'file', path: tmpPath, filename: file.name });
      } finally {
        await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }
    } else {
      const body = await c.req.json().catch(() => ({}));
      text = typeof body.text === 'string' ? body.text : '';
      if (!text.trim()) return c.json({ error: 'Text oder Datei erforderlich' }, 400);
    }

    const inferred = await inferSchema(text);
    return c.json(inferred);
  } catch (error: any) {
    console.error('[extraction] infer-schema fehlgeschlagen:', error?.message || error);
    return c.json({ error: error?.message || 'Feldvorschlag fehlgeschlagen' }, 400);
  }
});

/**
 * GET /projects/:id/export — Projekt als portables JSON-Paket herunterladen.
 * `?examples=true` schließt die Trainingsbeispiele ein (enthält Originaldokumente/PII).
 */
extractionProjectRoutes.get('/projects/:id/export', async (c) => {
  const projectId = c.req.param('id');
  const includeExamples = c.req.query('examples') === 'true';
  const bundle = await exportProject(projectId, includeExamples);
  if (!bundle) return c.json({ error: 'Profil nicht gefunden' }, 404);
  const filename = `${projectId}${includeExamples ? '-mit-beispielen' : ''}.extraction.json`;
  return c.body(JSON.stringify(bundle, null, 2), 200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
  });
});

// ============== Extraction ==============

/**
 * POST /projects/:id/extract — Extract data from document
 *
 * Accepts: JSON { text } or FormData with file
 */
extractionProjectRoutes.post('/projects/:id/extract', async (c) => {
  const projectId = c.req.param('id');
  const contentType = c.req.header('content-type') || '';

  let source: any;

  if (contentType.includes('multipart/form-data')) {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return c.json({ error: 'Keine Datei hochgeladen' }, 400);
    }

    // Save temp file
    const tmpDir = '/tmp/extraction';
    const { mkdir } = await import('fs/promises');
    const { existsSync } = await import('fs');
    if (!existsSync(tmpDir)) await mkdir(tmpDir, { recursive: true });

    const tmpPath = `${tmpDir}/${randomUUID()}_${file.name}`;
    const buffer = await file.arrayBuffer();
    await Bun.write(tmpPath, buffer);

    source = { type: 'file', path: tmpPath, filename: file.name };
  } else {
    const body = await c.req.json();
    if (!body.text) {
      return c.json({ error: 'Text oder Datei erforderlich' }, 400);
    }
    source = { type: 'text', content: body.text };
  }

  const { original, snapshot, ...result } = await extract(projectId, source);
  return c.json(result);
});

// ============== Training ==============

/**
 * POST /projects/:id/train — Save training example (initial + corrected)
 */
extractionProjectRoutes.post('/projects/:id/train', async (c) => {
  const projectId = c.req.param('id');
  const body = await c.req.json();

  if (!body.document_text || !body.initial_extraction || !body.corrected_extraction) {
    return c.json({ error: 'document_text, initial_extraction und corrected_extraction erforderlich' }, 400);
  }

  const result = await train(projectId, {
    source_filename: body.source_filename || 'unknown',
    document_text: body.document_text,
    initial_extraction: body.initial_extraction,
    corrected_extraction: body.corrected_extraction,
    field_confidences: body.field_confidences,
  });

  return c.json(result);
});

/**
 * GET /projects/:id/examples — List training examples
 */
extractionProjectRoutes.get('/projects/:id/examples', async (c) => {
  const examples = await getExamples(c.req.param('id'));
  const activeIds = (await getProject(c.req.param('id')))?.learning.approved_example_ids ?? [];
  return c.json(examples.map(e => ({
    id: e.id,
    created: e.created,
    source_filename: e.source_filename,
    corrections_count: e.corrections.length,
    confirmed_correct: e.confirmed_correct,
    purpose: e.dataset?.purpose ?? 'train',
    activation: e.dataset?.activation === 'candidate' && !activeIds.includes(e.id) ? 'candidate' : 'active',
    group: e.dataset?.group,
    has_original: !!e.dataset?.original,
  })));
});

/**
 * DELETE /projects/:id/examples/:exId — Delete training example
 */
extractionProjectRoutes.delete('/projects/:id/examples/:exId', async (c) => {
  const deleted = await deleteExample(c.req.param('id'), c.req.param('exId'));
  if (!deleted) {
    return c.json({ error: 'Beispiel nicht gefunden' }, 404);
  }
  return c.json({ success: true });
});

// ============== Guidelines ==============

/**
 * POST /projects/webhook-secret — neuen Signaturschluessel vorschlagen (Welle 5).
 * Speichert NICHT — der Wert landet im Formular und wird mit dem Projekt gesichert.
 * Kollidiert nicht mit `/projects/:id`, weil es dafuer kein POST gibt.
 */
extractionProjectRoutes.post('/projects/webhook-secret', (c) => {
  return c.json({ secret: generateWebhookSecret() });
});

/**
 * POST /projects/:id/regenerate — Regeln neu ableiten (Hintergrund-
 * Champion/Challenger-Lauf; { started: false } wenn bereits einer laeuft).
 */
extractionProjectRoutes.post('/projects/:id/regenerate', async (c) => {
  try {
    const result = await regenerateGuidelines(c.req.param('id'));
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

/**
 * POST /projects/:id/evaluate — Voll-Eval der aktuellen Regeln (Hintergrund).
 */
extractionProjectRoutes.post('/projects/:id/evaluate', async (c) => {
  try {
    const result = await runFullEval(c.req.param('id'));
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

// ============== Batch-Verarbeitung ("Verarbeiten"-Tab) ==============

const FIELD_TYPE_TO_COLUMN: Record<ProjectField['type'], ColumnType> = {
  text: 'text',
  number: 'number',
  date: 'date',
  boolean: 'boolean',
  // Listen-Felder landen in Tabellen als JSON-Text (Positionen strukturiert im XLSX-Zusatzblatt).
  list: 'text',
};

/** Batch-Upload-Limits (multipart wird im RAM gepuffert). */
const MAX_BATCH_FILES = 50;
const MAX_BATCH_FILE_BYTES = 50 * 1024 * 1024;    // 50 MB pro Datei
const MAX_BATCH_TOTAL_BYTES = 200 * 1024 * 1024;  // 200 MB gesamt

/**
 * POST /projects/:id/batches — Multi-Upload, Lauf anlegen, Hintergrund-Verarbeitung starten.
 * Antwortet sofort mit { runId } (fire-and-forget); Frontend pollt den Status.
 */
extractionProjectRoutes.post('/projects/:id/batches', async (c) => {
  const projectId = c.req.param('id');
  const project = await getProject(projectId);
  if (!project) return c.json({ error: 'Profil nicht gefunden' }, 404);

  const contentType = c.req.header('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return c.json({ error: 'multipart/form-data mit Dateien erforderlich' }, 400);
  }

  const formData = await c.req.formData();
  const uploads = formData.getAll('files').filter((f): f is File => f instanceof File);
  if (uploads.length === 0) {
    return c.json({ error: 'Keine Dateien hochgeladen' }, 400);
  }

  // Upload-Limits (multipart wird im RAM gepuffert → begrenzen).
  if (uploads.length > MAX_BATCH_FILES) {
    return c.json({ error: `Zu viele Dateien (max. ${MAX_BATCH_FILES} pro Lauf)` }, 413);
  }
  let totalBytes = 0;
  for (const file of uploads) {
    if (file.size > MAX_BATCH_FILE_BYTES) {
      return c.json({ error: `Datei "${file.name}" zu gross (max. ${MAX_BATCH_FILE_BYTES / 1024 / 1024} MB)` }, 413);
    }
    totalBytes += file.size;
  }
  if (totalBytes > MAX_BATCH_TOTAL_BYTES) {
    return c.json({ error: `Upload insgesamt zu gross (max. ${MAX_BATCH_TOTAL_BYTES / 1024 / 1024} MB)` }, 413);
  }

  // Temp-Dateien ablegen.
  const { mkdir } = await import('fs/promises');
  const tmpDir = `/tmp/extraction-batch/${randomUUID()}`;
  await mkdir(tmpDir, { recursive: true });

  const saved: { filename: string; tempPath: string }[] = [];
  for (const file of uploads) {
    const safeName = file.name.replace(/[^\w.\-]+/g, '_');
    const tempPath = `${tmpDir}/${saved.length}_${safeName}`;
    await Bun.write(tempPath, await file.arrayBuffer());
    saved.push({ filename: file.name, tempPath });
  }

  const { runId, files } = await enqueueBatch(projectId, saved);
  return c.json({ runId, fileCount: files.length }, 201);
});

/**
 * GET /projects/:id/batches — Lauf-Historie.
 */
extractionProjectRoutes.get('/projects/:id/batches', async (c) => {
  const runs = await listBatchRuns(c.req.param('id'));
  return c.json(runs);
});

/**
 * GET /projects/:id/batches/:runId — Run + Datei-Summaries (Polling; ohne pageImages).
 */
extractionProjectRoutes.get('/projects/:id/batches/:runId', async (c) => {
  const result = await getBatchRun(c.req.param('id'), c.req.param('runId'));
  if (!result) return c.json({ error: 'Lauf nicht gefunden' }, 404);
  const snapshot = await getRunSnapshot(c.req.param('id'), c.req.param('runId'));
  return c.json({ ...result, run: { ...result.run, profile: snapshot?.project } });
});

/**
 * GET /projects/:id/batches/:runId/files/:fileId — Detail inkl. boxes + pageImages.
 */
extractionProjectRoutes.get('/projects/:id/batches/:runId/files/:fileId', async (c) => {
  const projectId = c.req.param('id');
  const runId = c.req.param('runId');
  const fileId = c.req.param('fileId');
  const detail = await getBatchRunFileDetail(projectId, runId, fileId);
  if (!detail) return c.json({ error: 'Datei nicht gefunden' }, 404);
  // Ausgelagerte Seitenbilder (Welle 5) bekommen ihre Abruf-URL; alte Laeufe
  // behalten ihren inline-`dataUri`.
  const pageImages = detail.pageImages?.map((p) =>
    p.dataUri
      ? p
      : { ...p, url: `/extraction/projects/${projectId}/batches/${runId}/files/${fileId}/pages/${p.page}` },
  );
  const { original, snapshot, ...visible } = detail;
  return c.json({ ...visible, hasOriginal: !!original, profile: snapshot?.project, pageImages: pageImages ?? null });
});

/**
 * GET /projects/:id/batches/:runId/files/:fileId/pages/:page — ein Seitenbild
 * (Welle 5). Same-origin ausgeliefert, damit die CSP (`img-src 'self'`) greift;
 * signierte S3-URLs waeren im Browser blockiert.
 */
extractionProjectRoutes.get('/projects/:id/batches/:runId/files/:fileId/pages/:page', async (c) => {
  const page = Number(c.req.param('page'));
  if (!Number.isInteger(page) || page < 1) return c.json({ error: 'Ungültige Seitenzahl' }, 400);

  const buffer = await readPageImage(c.req.param('runId'), c.req.param('fileId'), page);
  if (!buffer) return c.json({ error: 'Seitenbild nicht gefunden' }, 404);

  // Kein Cache-Header: die globale Security-Middleware setzt fuer alle
  // Antworten `no-store` — ein eigener max-age waere wirkungslos.
  return c.body(buffer as unknown as ArrayBuffer, 200, { 'Content-Type': 'image/png' });
});

/**
 * POST /projects/:id/batches/:runId/files/:fileId/learn — Batch-Korrektur als
 * Trainingsbeispiel uebernehmen (Welle 3). Body: { corrected: Record<fieldId, value> }.
 * Setzt die Datei auf den korrigierten Stand + review_status 'reviewed'.
 */
async function saveReview(c: Context, learnDefault: boolean) {
  const projectId = c.req.param('id');
  const runId = c.req.param('runId');
  const fileId = c.req.param('fileId');
  if (segmentCorrectionLocks.has(fileId)) return c.json({ error: 'Abschnittskorrektur läuft. Bitte anschließend prüfen.' }, 409);
  const body = await c.req.json().catch(() => null);
  const project = await getProject(projectId);
  if (!project || !(await getBatchRun(projectId, runId))) return c.json({ error: 'Lauf nicht gefunden' }, 404);
  const detail = await getBatchRunFileDetail(projectId, runId, fileId);
  if (!detail || detail.status !== 'completed' || !detail.data) return c.json({ error: 'Kein abgeschlossenes Ergebnis' }, 400);
  const checked = await checkReview(detail.snapshot?.project ?? project, body?.corrected, detail.validations ?? [], (p, data) => evaluateProjectRules(p, data, detail.snapshot));
  if (!checked.allowed) return c.json({ error: 'Freigabe nicht möglich: ' + checked.validations.map(i => i.message).join('; '), validations: checked.validations }, 422);
  const test = body?.example_purpose === 'test';
  const learn = !test && (body?.learn === true || body?.example_purpose === 'train' || (learnDefault && body?.learn !== false));
  if ((learn || test) && detail.snapshot && profileHash(detail.snapshot.project) !== profileHash(project)) return c.json({ error: 'Das Profil wurde seit der Extraktion geändert. Für ein Lern- oder Testbeispiel bitte neu verarbeiten. Die Freigabe ist ohne Beispielspeicherung möglich.' }, 422);
  if (test && !detail.original) return c.json({ error: 'Testbeispiele benötigen das Original. Bitte das Dokument neu verarbeiten.' }, 422);
  if (learn && !detail.segments?.some(segment => segment.pageTo - segment.pageFrom < 2) && !detail.documentText?.trim() && !Object.values(detail.segmentContexts ?? {}).some(text => text.trim()) && !(detail.pageImages?.length && detail.pageImages.length <= 2)) return c.json({ error: 'Kein Lerntext vorhanden. Die Prüfung kann ohne Lernen gespeichert werden.' }, 422);
  const visual: Array<{ page: number; dataUri: string }> = [];
  if (learn && detail.pageImages?.length && detail.pageImages.length <= 2 && !detail.segments?.length) {
    for (const page of detail.pageImages) {
      const bytes = page.dataUri ? null : await readPageImage(runId, fileId, page.page);
      if (page.dataUri || bytes) visual.push({ page: page.page, dataUri: page.dataUri ?? `data:image/png;base64,${bytes!.toString('base64')}` });
    }
  }
  const completeVisual = visual.length === detail.pageImages?.length ? visual : undefined;
  const segmentVisual: Record<string, Array<{ page: number; dataUri: string }>> = {};
  if (learn) for (const segment of detail.segments ?? []) {
    if (segment.pageTo - segment.pageFrom >= 2) continue;
    const definition = detail.snapshot?.project.segments?.[segment.type];
    if (!definition || definition.mode === 'classify-only') continue;
    const key = definition.repeatable ? `${segment.type}[${segment.instance}]` : segment.type;
    const pages = [];
    for (let pageNumber = segment.pageFrom; pageNumber <= segment.pageTo; pageNumber++) {
      const page = detail.pageImages?.find(page => page.page === pageNumber);
      const bytes = page?.dataUri ? null : await readPageImage(runId, fileId, pageNumber);
      if (page?.dataUri || bytes) pages.push({ page: pageNumber, dataUri: page?.dataUri ?? `data:image/png;base64,${bytes!.toString('base64')}` });
    }
    if (pages.length === segment.pageTo - segment.pageFrom + 1) segmentVisual[key] = pages;
  }

  if (learn && !detail.documentText?.trim() && !Object.values(detail.segmentContexts ?? {}).some(text => text.trim()) && !completeVisual?.length && !Object.keys(segmentVisual).length) return c.json({ error: 'Kein vollständiger visueller Beispielkontext verfügbar.' }, 422);
  let training;
  if (learn || test) {
    try { training = await train(projectId, {
    dataset: { purpose: test ? 'test' : 'train', visual: completeVisual, segment_contexts: detail.segmentContexts, segment_visual: segmentVisual, original: detail.original, profile_hash: detail.audit?.profile_hash, group: typeof body?.example_group === 'string' ? body.example_group.trim().slice(0, 100) : undefined },
    source_filename: detail.filename, document_text: detail.documentText ?? '',
    initial_extraction: detail.data, corrected_extraction: checked.data,
    field_confidences: detail.fieldConfidences ?? undefined,
  }); } catch (error) { return c.json({ error: error instanceof Error ? error.message : String(error) }, 422); }
  }
  await upsertFileResult(projectId, runId, fileId, {
    status: 'completed', reviewDraft: null, data: checked.data, fieldConfidences: {}, boxes: {},
    strategy: detail.strategy ?? undefined, audit: detail.audit ?? undefined,
    reviewStatus: 'reviewed', validations: checked.validations,
  });
  void notifyWebhook(projectId, runId, project, fileId);
  return c.json({
    guidelines_update: training?.guidelines_update ?? 'none', review_status: 'reviewed',
    example_id: training?.example.id, validations: checked.validations, data: checked.data,
  });
}
extractionProjectRoutes.post('/projects/:id/batches/:runId/files/:fileId/review', c => saveReview(c, false));
// Compatibility endpoint; same validation and release boundary.
extractionProjectRoutes.post('/projects/:id/batches/:runId/files/:fileId/learn', c => saveReview(c, true));

/**
 * GET /projects/:id/batches/:runId/export.xlsx — Ergebnistabelle als Excel.
 */
extractionProjectRoutes.get('/projects/:id/batches/:runId/export.xlsx', async (c) => {
  const projectId = c.req.param('id');
  const runId = c.req.param('runId');
  // `?format=flat` = eine Zeile je Position; `flat-wide` = eine Zeile je
  // Dokument mit den Listen als nummerierten Spalten; sonst gruppiert.
  const format = parseExportFormat(c.req.query('format'));
  const suffix = format === 'flat' ? '-flach' : format === 'flat-wide' ? '-breit' : '';
  const formatLabel = format === 'flat'
    ? 'flach (eine Zeile je Position)'
    : format === 'flat-wide'
      ? 'breit (eine Zeile je Dokument, Listen als Spalten)'
      : 'gruppiert';

  const project = (await getRunSnapshot(projectId, runId))?.project ?? await getProject(projectId);
  if (!project) return c.json({ error: 'Profil nicht gefunden' }, 404);
  const result = await getBatchRun(projectId, runId);
  if (!result) return c.json({ error: 'Lauf nicht gefunden' }, 404);

  const sections = buildBatchExportSections(project, c.req.query('scope') === 'diagnostic' ? result.files : result.files.filter(isReleased), format);
  const buffer = await generateDocument(
    {
      title: `Batch-Extraktion — ${project.name}`,
      metadata: {
        Projekt: project.name,
        Dokumente: String(result.files.length),
        Lauf: runId,
        Format: formatLabel,
      },
      sections,
    },
    'xlsx',
  );

  return c.body(buffer as unknown as ArrayBuffer, 200, {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="batch-${runId}${suffix}.xlsx"`,
  });
});

/**
 * GET /projects/:id/batches/:runId/export.csv — Ergebnistabelle als CSV.
 * `?format=flat-wide` (Default hier) = eine Zeile je Dokument, Listen als
 * nummerierte Spalten; `flat` = eine Zeile je Position. `;`-getrennt (DE-Excel).
 */
extractionProjectRoutes.get('/projects/:id/batches/:runId/export.csv', async (c) => {
  const projectId = c.req.param('id');
  const runId = c.req.param('runId');
  const raw = c.req.query('format');
  const format: ExportFormat = raw === 'flat' ? 'flat' : 'flat-wide';

  const project = (await getRunSnapshot(projectId, runId))?.project ?? await getProject(projectId);
  if (!project) return c.json({ error: 'Profil nicht gefunden' }, 404);
  const result = await getBatchRun(projectId, runId);
  if (!result) return c.json({ error: 'Lauf nicht gefunden' }, 404);

  // flat/flat-wide liefern genau EINE Section → direkt zu CSV serialisieren.
  const [section] = buildBatchExportSections(project, c.req.query('scope') === 'diagnostic' ? result.files : result.files.filter(isReleased), format);
  const csv = section ? sectionToCsv(section) : '';
  const suffix = format === 'flat' ? '-flach' : '-breit';

  return c.body(csv, 200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="batch-${runId}${suffix}.csv"`,
  });
});

/**
 * POST /projects/:id/batches/:runId/to-table — Ergebnisse in eine neue Tabelle schreiben.
 */
extractionProjectRoutes.post('/projects/:id/batches/:runId/to-table', async (c) => {
  const projectId = c.req.param('id');
  const runId = c.req.param('runId');
  const project = (await getRunSnapshot(projectId, runId))?.project ?? await getProject(projectId);
  if (!project) return c.json({ error: 'Profil nicht gefunden' }, 404);
  const result = await getBatchRun(projectId, runId);
  if (!result) return c.json({ error: 'Lauf nicht gefunden' }, 404);

  const columns: ColumnDefinition[] = [
    { id: 'quelldatei', name: 'Quelldatei', type: 'text' },
    ...Object.entries(project.fields).map(([fid, f]) => ({
      id: fid,
      name: f.label || fid,
      type: FIELD_TYPE_TO_COLUMN[f.type] || 'text',
    })),
  ];

  if (!result.files.some(isReleased)) return c.json({ error: 'Keine freigegebenen Ergebnisse vorhanden. Bitte zuerst prüfen.' }, 422);
  const tableId = `extraktion-${projectId}-${Date.now().toString(36)}`;
  const table = await createTable({
    id: tableId,
    name: `Extraktion: ${project.name}`,
    description: `Batch-Lauf ${runId} (${result.files.length} Dokumente)`,
    columns,
  });

  let rowCount = 0;
  for (const file of result.files) {
    if (!isReleased(file) || !file.data) continue;
    const data: Record<string, unknown> = { quelldatei: file.filename };
    for (const [fid, f] of Object.entries(project.fields)) {
      const v = file.data[fid];
      if (f.type === 'list') {
        // Positionen als JSON-Text in der Zelle (Tabellen kennen keine Unterzeilen).
        data[fid] = JSON.stringify(Array.isArray(v) ? v : []);
      } else {
        data[fid] = FIELD_TYPE_TO_COLUMN[f.type] === 'boolean' ? Boolean(v) : v ?? null;
      }
    }
    try {
      await addRow(table.id, { data });
      rowCount += 1;
    } catch (err) {
      console.error('[batch-extract] to-table addRow error:', err instanceof Error ? err.message : err);
    }
  }

  return c.json({ tableId: table.id, tableName: table.name, rowCount });
});

/**
 * DELETE /projects/:id/batches/:runId — Lauf löschen.
 */
extractionProjectRoutes.delete('/projects/:id/batches/:runId', async (c) => {
  const deleted = await deleteBatchRun(c.req.param('id'), c.req.param('runId'));
  if (!deleted) return c.json({ error: 'Lauf nicht gefunden' }, 404);
  return c.json({ success: true });
});

/** Evidence export includes original test documents and the frozen execution inputs. */
extractionProjectRoutes.get('/projects/:id/evaluations/:evaluationId', async c => {
  const { getEvaluation } = await import('../extraction/learning/evaluation-store');
  const artifact = await getEvaluation(c.req.param('id'), c.req.param('evaluationId'));
  if (!artifact) return c.json({ error: 'Messstand nicht gefunden' }, 404);
  return c.json(artifact);
});

const segmentCorrectionLocks = new Set<string>();

extractionProjectRoutes.post('/projects/:id/batches/:runId/files/:fileId/draft', async c => {
  const { id, runId, fileId } = c.req.param();
  if (segmentCorrectionLocks.has(fileId)) return c.json({ error: 'Die Abschnittszuordnung wird gerade verarbeitet.' }, 409);
  if (!(await getBatchRun(id, runId))) return c.json({ error: 'Lauf nicht gefunden' }, 404);
  const detail = await getBatchRunFileDetail(id, runId, fileId);
  const body = await c.req.json();
  if (!detail || detail.status !== 'completed' || detail.reviewStatus === 'reviewed') return c.json({ error: 'Kein bearbeitbares Ergebnis' }, 409);
  if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) return c.json({ error: 'Feldwerte erwartet' }, 400);
  await upsertFileResult(id, runId, fileId, { status: 'completed', reviewDraft: body.data });
  return c.json({ saved: true });
});

extractionProjectRoutes.post('/projects/:id/batches/:runId/files/:fileId/segments', async c => {
  const { id, runId, fileId } = c.req.param();
  if (segmentCorrectionLocks.has(fileId)) return c.json({ error: 'Die Abschnittszuordnung wird bereits verarbeitet.' }, 409);
  segmentCorrectionLocks.add(fileId);
  try {
    if (!(await getBatchRun(id, runId))) return c.json({ error: 'Lauf nicht gefunden' }, 404);
    const detail = await getBatchRunFileDetail(id, runId, fileId);
    if (!detail?.original || !detail.snapshot || !detail.segments || detail.status !== 'completed') return c.json({ error: 'Für Abschnittskorrekturen bitte das Dokument mit gespeichertem Original neu verarbeiten.' }, 422);
    const body = await c.req.json();
    const { correctSegmentation } = await import('../extraction/learning/service');
    const result = await correctSegmentation(detail.snapshot, Buffer.from(detail.original.base64, 'base64'), body.segments, {
      segments: detail.segments, data: body.corrected ?? detail.reviewDraft ?? detail.data ?? {},
      fieldConfidences: body.corrected ? {} : detail.fieldConfidences ?? {}, boxes: body.corrected ? {} : detail.boxes ?? {},
      pageImages: [], validations: detail.validations ?? [], llmCalls: 0, segmentContexts: detail.segmentContexts,
    });
    await upsertFileResult(id, runId, fileId, { status: 'completed', data: result.data, fieldConfidences: result.fieldConfidences,
      boxes: result.boxes, segments: result.segments, segmentContexts: result.segmentContexts,
      validations: result.validations, reviewStatus: 'needs_review', reviewDraft: null });
    return c.json({ data: result.data, segments: result.segments, validations: result.validations, fieldConfidences: result.fieldConfidences, boxes: result.boxes, reviewStatus: 'needs_review', reviewDraft: null, llmCalls: result.llmCalls });
  } catch (error) { return c.json({ error: error instanceof Error ? error.message : String(error) }, 422); }
  finally { segmentCorrectionLocks.delete(fileId); }
});

extractionProjectRoutes.post('/projects/:id/batches/:runId/cancel', async c => {
  const ok = await cancelBatch(c.req.param('id'), c.req.param('runId'));
  return c.json(ok ? { success: true } : { error: 'Lauf ist nicht mehr aktiv' }, ok ? 200 : 409);
});
extractionProjectRoutes.post('/projects/:id/batches/:runId/retry', async c => {
  const ok = await retryBatch(c.req.param('id'), c.req.param('runId'));
  return c.json(ok ? { success: true } : { error: 'Keine wiederholbaren Fehler vorhanden' }, ok ? 200 : 409);
});
