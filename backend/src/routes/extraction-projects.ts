/**
 * Extraction Projects Routes
 *
 * REST API for learning extraction projects, training, and guidelines.
 */

import { Hono } from 'hono';
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
  createBatchRun,
  listBatchRuns,
  getBatchRun,
  getBatchRunFileDetail,
  deleteBatchRun,
  runBatchExtraction,
  upsertFileResult,
  exportProject,
  importProject,
  validateProjectFields,
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
import { buildBatchExportSections, type ExportFormat } from '../extraction/learning/export-xlsx';

export const extractionProjectRoutes = new Hono();

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

  const ruleError = validateProjectRules(body.fields, body.rules);
  if (ruleError) {
    return c.json({ error: ruleError }, 400);
  }

  const project = await createProject({
    name: body.name,
    description: body.description,
    fields: body.fields,
    instructions: body.instructions,
    extraction: body.extraction,
    rules: body.rules,
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

  if (body.rules !== undefined || body.fields) {
    // Regeln referenzieren Feld-IDs — gegen den kuenftigen Feldstand pruefen
    // (mitgesendete Felder, sonst die bestehenden).
    const existing = await getProject(id);
    if (!existing) return c.json({ error: 'Profil nicht gefunden' }, 404);
    const effectiveFields = body.fields ?? existing.fields;
    const effectiveRules = body.rules !== undefined ? body.rules : existing.rules;
    const ruleError = validateProjectRules(effectiveFields, effectiveRules);
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
      const tmpDir = `/tmp/extraction-infer/${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
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

    const tmpPath = `${tmpDir}/${Date.now()}_${file.name}`;
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

  const result = await extract(projectId, source);
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
  return c.json(examples.map(e => ({
    id: e.id,
    created: e.created,
    source_filename: e.source_filename,
    corrections_count: e.corrections.length,
    confirmed_correct: e.confirmed_correct,
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

  // Temp-Dateien ablegen.
  const { mkdir } = await import('fs/promises');
  const tmpDir = `/tmp/extraction-batch/${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  await mkdir(tmpDir, { recursive: true });

  const saved: { filename: string; tempPath: string }[] = [];
  for (const file of uploads) {
    const safeName = file.name.replace(/[^\w.\-]+/g, '_');
    const tempPath = `${tmpDir}/${saved.length}_${safeName}`;
    await Bun.write(tempPath, await file.arrayBuffer());
    saved.push({ filename: file.name, tempPath });
  }

  const { runId, files } = await createBatchRun(projectId, saved.map((s) => s.filename));
  const inputFiles = files.map((f, i) => ({
    fileId: f.id,
    filename: f.filename,
    tempPath: saved[i]!.tempPath,
  }));

  // Fire-and-forget — kein await.
  void runBatchExtraction(projectId, runId, inputFiles).catch((err) =>
    console.error('[batch-extract] runBatchExtraction error:', err),
  );

  return c.json({ runId, fileCount: inputFiles.length }, 201);
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
  return c.json(result);
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
  return c.json({ ...detail, pageImages: pageImages ?? null });
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
extractionProjectRoutes.post('/projects/:id/batches/:runId/files/:fileId/learn', async (c) => {
  const projectId = c.req.param('id');
  const runId = c.req.param('runId');
  const fileId = c.req.param('fileId');

  const body = await c.req.json().catch(() => null);
  const corrected = body?.corrected;
  if (!corrected || typeof corrected !== 'object' || Array.isArray(corrected)) {
    return c.json({ error: 'corrected (Objekt mit Feldwerten) erforderlich' }, 400);
  }

  const detail = await getBatchRunFileDetail(projectId, runId, fileId);
  if (!detail) return c.json({ error: 'Datei nicht gefunden' }, 404);
  if (detail.status !== 'completed' || !detail.data) {
    return c.json({ error: 'Nur erfolgreich extrahierte Dateien koennen gelernt werden' }, 400);
  }
  if (!detail.documentText || !detail.documentText.trim()) {
    return c.json({ error: 'Dieser Lauf hat keinen gespeicherten Dokumenttext (aelterer Lauf) — bitte die Datei neu verarbeiten' }, 400);
  }

  const result = await train(projectId, {
    source_filename: detail.filename,
    document_text: detail.documentText,
    initial_extraction: detail.data,
    corrected_extraction: corrected,
    field_confidences: detail.fieldConfidences ?? undefined,
  });

  // Befunde gegen den korrigierten Stand neu bewerten (Welle 5) — sonst haengt
  // der alte Befund an einer Datei, die der Mensch gerade in Ordnung gebracht hat.
  const project = await getProject(projectId);
  const validations = project ? await evaluateProjectRules(project, corrected) : [];

  // Datei auf den geprueften Stand heben (Tabelle/Exporte zeigen die Korrektur;
  // das Original bleibt im Trainingsbeispiel als initial_extraction erhalten).
  await upsertFileResult(projectId, runId, fileId, {
    status: 'completed',
    data: corrected,
    fieldConfidences: detail.fieldConfidences ?? undefined,
    strategy: detail.strategy ?? undefined,
    audit: detail.audit ?? undefined,
    reviewStatus: 'reviewed',
    validations,
  });

  return c.json({
    guidelines_update: result.guidelines_update,
    review_status: 'reviewed',
    example_id: result.example.id,
    validations,
  });
});

/**
 * GET /projects/:id/batches/:runId/export.xlsx — Ergebnistabelle als Excel.
 */
extractionProjectRoutes.get('/projects/:id/batches/:runId/export.xlsx', async (c) => {
  const projectId = c.req.param('id');
  const runId = c.req.param('runId');
  // `?format=flat` liefert EIN Blatt mit einer Zeile je Position und
  // wiederholten Kopfdaten — das Format, das nachgelagerte Systeme erwarten.
  const format: ExportFormat = c.req.query('format') === 'flat' ? 'flat' : 'grouped';

  const project = await getProject(projectId);
  if (!project) return c.json({ error: 'Profil nicht gefunden' }, 404);
  const result = await getBatchRun(projectId, runId);
  if (!result) return c.json({ error: 'Lauf nicht gefunden' }, 404);

  const sections = buildBatchExportSections(project, result.files, format);
  const buffer = await generateDocument(
    {
      title: `Batch-Extraktion — ${project.name}`,
      metadata: {
        Projekt: project.name,
        Dokumente: String(result.files.length),
        Lauf: runId,
        Format: format === 'flat' ? 'flach (eine Zeile je Position)' : 'gruppiert',
      },
      sections,
    },
    'xlsx',
  );

  return c.body(buffer as unknown as ArrayBuffer, 200, {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="batch-${runId}${format === 'flat' ? '-flach' : ''}.xlsx"`,
  });
});

/**
 * POST /projects/:id/batches/:runId/to-table — Ergebnisse in eine neue Tabelle schreiben.
 */
extractionProjectRoutes.post('/projects/:id/batches/:runId/to-table', async (c) => {
  const projectId = c.req.param('id');
  const runId = c.req.param('runId');
  const project = await getProject(projectId);
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

  const tableId = `extraktion-${projectId}-${Date.now().toString(36)}`;
  const table = await createTable({
    id: tableId,
    name: `Extraktion: ${project.name}`,
    description: `Batch-Lauf ${runId} (${result.files.length} Dokumente)`,
    columns,
  });

  let rowCount = 0;
  for (const file of result.files) {
    if (file.status !== 'completed' || !file.data) continue;
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
