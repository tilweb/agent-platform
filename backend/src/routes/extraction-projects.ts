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
  exportProject,
  importProject,
  validateProjectFields,
  runFullEval,
} from '../extraction/learning';
import type { ProjectField } from '../extraction/learning';
import { createTable, addRow } from '../tables';
import type { ColumnDefinition, ColumnType } from '../tables/types';
import { generateDocument } from '../services/documentGenerator';

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
    return c.json({ error: 'Projekt nicht gefunden' }, 404);
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

  const project = await createProject({
    name: body.name,
    description: body.description,
    fields: body.fields,
    instructions: body.instructions,
    extraction: body.extraction,
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

  const updated = await updateProject(id, {
    name: body.name,
    description: body.description,
    fields: body.fields,
    instructions: body.instructions,
    extraction: body.extraction,
  });

  if (!updated) {
    return c.json({ error: 'Projekt nicht gefunden' }, 404);
  }

  return c.json(updated);
});

/**
 * DELETE /projects/:id — Delete project with all examples
 */
extractionProjectRoutes.delete('/projects/:id', async (c) => {
  const deleted = await deleteProject(c.req.param('id'));
  if (!deleted) {
    return c.json({ error: 'Projekt nicht gefunden' }, 404);
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
 * GET /projects/:id/export — Projekt als portables JSON-Paket herunterladen.
 * `?examples=true` schließt die Trainingsbeispiele ein (enthält Originaldokumente/PII).
 */
extractionProjectRoutes.get('/projects/:id/export', async (c) => {
  const projectId = c.req.param('id');
  const includeExamples = c.req.query('examples') === 'true';
  const bundle = await exportProject(projectId, includeExamples);
  if (!bundle) return c.json({ error: 'Projekt nicht gefunden' }, 404);
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

/** Stringifiziert einen extrahierten Wert für CSV/XLSX-Zellen. */
function cellString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nein';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Excel-Sheet-Namen: max. 31 Zeichen, verbotene Zeichen ersetzen. */
function sanitizeSheetName(name: string): string {
  return name.replace(/[\[\]:*?/\\]/g, '-').substring(0, 31).trim() || 'Liste';
}

/**
 * POST /projects/:id/batches — Multi-Upload, Lauf anlegen, Hintergrund-Verarbeitung starten.
 * Antwortet sofort mit { runId } (fire-and-forget); Frontend pollt den Status.
 */
extractionProjectRoutes.post('/projects/:id/batches', async (c) => {
  const projectId = c.req.param('id');
  const project = await getProject(projectId);
  if (!project) return c.json({ error: 'Projekt nicht gefunden' }, 404);

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
  const detail = await getBatchRunFileDetail(c.req.param('id'), c.req.param('runId'), c.req.param('fileId'));
  if (!detail) return c.json({ error: 'Datei nicht gefunden' }, 404);
  return c.json(detail);
});

/**
 * GET /projects/:id/batches/:runId/export.xlsx — Ergebnistabelle als Excel.
 */
extractionProjectRoutes.get('/projects/:id/batches/:runId/export.xlsx', async (c) => {
  const projectId = c.req.param('id');
  const runId = c.req.param('runId');
  const project = await getProject(projectId);
  if (!project) return c.json({ error: 'Projekt nicht gefunden' }, 404);
  const result = await getBatchRun(projectId, runId);
  if (!result) return c.json({ error: 'Lauf nicht gefunden' }, 404);

  const fieldEntries = Object.entries(project.fields);
  const headers = ['Datei', 'Status', ...fieldEntries.map(([, f]) => f.label || '')];
  const rows = result.files.map((file) => [
    file.filename,
    file.status,
    ...fieldEntries.map(([fid, f]) => {
      const v = file.data?.[fid];
      // Listen im Hauptblatt nur als Zusammenfassung — die Positionen stehen
      // strukturiert im Zusatzblatt des jeweiligen Listen-Felds.
      if (f.type === 'list') {
        return Array.isArray(v) && v.length > 0 ? `${v.length} Positionen` : '';
      }
      return cellString(v);
    }),
  ]);

  const sections: Array<{ title: string; type: 'table'; content: { headers: string[]; rows: string[][] }; sheet?: string }> = [
    { title: 'Ergebnisse', type: 'table', content: { headers, rows } },
  ];

  // Pro Listen-Feld ein Zusatzblatt: eine Zeile je Position, Spalte "Datei" als Referenz.
  for (const [fid, f] of fieldEntries) {
    if (f.type !== 'list') continue;
    const itemEntries = Object.entries(f.item_fields ?? {});
    const itemHeaders = ['Datei', ...itemEntries.map(([, itf]) => itf.label || '')];
    const itemRows = result.files.flatMap((file) => {
      const items = file.data?.[fid];
      if (!Array.isArray(items)) return [];
      return items.map((item) => [
        file.filename,
        ...itemEntries.map(([iid]) =>
          cellString(item && typeof item === 'object' ? (item as Record<string, unknown>)[iid] : null),
        ),
      ]);
    });
    sections.push({
      title: f.label || fid,
      type: 'table',
      content: { headers: itemHeaders, rows: itemRows },
      sheet: sanitizeSheetName(f.label || fid),
    });
  }

  const buffer = await generateDocument(
    {
      title: `Batch-Extraktion — ${project.name}`,
      metadata: {
        Projekt: project.name,
        Dokumente: String(result.files.length),
        Lauf: runId,
      },
      sections,
    },
    'xlsx',
  );

  return c.body(buffer as unknown as ArrayBuffer, 200, {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="batch-${runId}.xlsx"`,
  });
});

/**
 * POST /projects/:id/batches/:runId/to-table — Ergebnisse in eine neue Tabelle schreiben.
 */
extractionProjectRoutes.post('/projects/:id/batches/:runId/to-table', async (c) => {
  const projectId = c.req.param('id');
  const runId = c.req.param('runId');
  const project = await getProject(projectId);
  if (!project) return c.json({ error: 'Projekt nicht gefunden' }, 404);
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
