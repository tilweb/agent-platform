/**
 * Public-API-Functions der Dokumenten-Extraktion (Welle 5).
 *
 * Bisher war das Feature nur ueber die UI bedienbar — jede Verarbeitung
 * brauchte einen Menschen. Diese Functions machen dieselbe Strecke headless
 * aufrufbar (Bearer-Key, Scopes, Rate-Limit, Audit, OpenAPI kommen vom
 * Public-API-Framework) und stossen intern exakt den Pfad an, den auch der
 * "Verarbeiten"-Tab nutzt: createBatchRun + runBatchExtraction, inklusive
 * Review-Triage (W3), Audit (W2) und Pruefregeln (W5).
 *
 * Registriert ueber die virtuelle App `extraktion` (public-api/virtual-apps.ts),
 * NICHT ueber die App-Registry — die Extraktion hat keine App-Route und wuerde
 * sonst einen toten Sidebar-Eintrag erzeugen.
 *
 * Dokumente kommen als base64 im JSON-Body. Harte Deckel schuetzen vor
 * OOM-Bodies; wer groessere Stapel hat, nutzt den Posteingang in der UI.
 */

import { mkdir, rm } from 'fs/promises';
import { PublicFunctionError } from '../public-api/types';
import type { JsonSchema, PublicFunction } from '../public-api/types';
import {
  buildBatchExportSections,
  countExportRows,
  createBatchRun,
  extract,
  getAllProjects,
  getBatchRun,
  getProject,
  runBatchExtraction,
  type ExportFormat,
} from './learning';
import { generateDocument } from '../services/documentGenerator';
import { isDeliverableUrl } from './learning/webhook';

/** Maximale Dokumentenzahl je Batch-Anfrage. */
const MAX_DOCUMENTS = 20;
/** Maximale Groesse je Dokument (dekodiert). */
const MAX_DOC_BYTES = 10 * 1024 * 1024;
/** Maximale Gesamtgroesse (dekodiert) einer Anfrage. */
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;

interface DocumentInput {
  filename: string;
  content_base64: string;
}

const DOCUMENT_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    filename: { type: 'string', description: 'Dateiname inkl. Endung (bestimmt die Verarbeitung, z.B. .pdf).', minLength: 1, maxLength: 255 },
    content_base64: { type: 'string', description: 'Dateiinhalt base64-kodiert (max. 10 MB dekodiert).', minLength: 1 },
  },
  required: ['filename', 'content_base64'],
};

const VALIDATION_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    rule_id: { type: 'string' },
    type: { type: 'string', description: 'sum | lookup' },
    severity: { type: 'string', description: 'error erzwingt ein Review, warn ist ein Hinweis.' },
    message: { type: 'string' },
    fields: { type: 'array', items: { type: 'string' } },
  },
  required: ['rule_id', 'severity', 'message'],
};

/** base64 → Buffer mit Groessenpruefung. Wirft mit deutscher Meldung. */
export function decodeDocument(doc: DocumentInput, index: number): Buffer {
  let buffer: Buffer;
  try {
    buffer = Buffer.from(doc.content_base64, 'base64');
  } catch {
    throw new PublicFunctionError(`Dokument ${index + 1} (${doc.filename}): content_base64 ist kein gueltiges base64`);
  }
  if (buffer.length === 0) {
    throw new PublicFunctionError(`Dokument ${index + 1} (${doc.filename}): leerer Inhalt`);
  }
  if (buffer.length > MAX_DOC_BYTES) {
    throw new PublicFunctionError(
      `Dokument ${index + 1} (${doc.filename}): ${Math.round(buffer.length / 1024 / 1024)} MB ueberschreiten das Limit von 10 MB`,
      413,
      'payload_too_large',
    );
  }
  return buffer;
}

/** Dateiname fuer das Dateisystem entschaerfen (kein Pfad, keine Sonderzeichen). */
export function safeName(filename: string): string {
  return filename.split(/[\\/]/).pop()!.replace(/[^\w.\-]+/g, '_').slice(0, 120) || 'dokument';
}

export const projectsListFunction: PublicFunction<Record<string, never>, unknown> = {
  id: 'projects.list',
  description:
    'Listet die verfuegbaren Extraktionsprojekte mit ihren Feldern. Damit findet ein Integrator die project_id und weiss, welche Felder er im Ergebnis erwarten kann.',
  input: { type: 'object', properties: {} },
  output: {
    type: 'object',
    properties: {
      projects: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            fields: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  label: { type: 'string' },
                  type: { type: 'string', description: 'text | number | date | boolean | list' },
                  required: { type: 'boolean' },
                },
                required: ['id', 'label', 'type'],
              },
            },
          },
          required: ['id', 'name', 'fields'],
        },
      },
    },
    required: ['projects'],
  },
  defaultRateLimit: { requests: 60, windowSec: 60 },
  async handler() {
    const projects = await getAllProjects();
    return {
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        fields: Object.entries(p.fields).map(([id, f]) => ({
          id,
          label: f.label,
          type: f.type,
          required: !!f.required,
          // Kontrollierte Werteliste (Welle 6): der Integrator soll wissen,
          // welche Werte erlaubt sind. Tabellen-Kataloge werden nicht
          // ausgerollt (koennen sehr gross sein) — nur die Quelle benannt.
          ...(f.catalog
            ? { allowed_values: f.catalog.source === 'list' ? (f.catalog.values ?? []).map((v) => v.value) : `table:${f.catalog.table_id}.${f.catalog.column_id}` }
            : {}),
          ...(f.type === 'list'
            ? {
                item_fields: Object.entries(f.item_fields ?? {}).map(([iid, itf]) => ({
                  id: iid,
                  label: itf.label,
                  type: itf.type,
                  ...(itf.catalog
                    ? { allowed_values: itf.catalog.source === 'list' ? (itf.catalog.values ?? []).map((v) => v.value) : `table:${itf.catalog.table_id}.${itf.catalog.column_id}` }
                    : {}),
                })),
              }
            : {}),
        })),
      })),
    };
  },
};

export const extractFunction: PublicFunction<
  { project_id: string; text?: string; document?: DocumentInput },
  unknown
> = {
  id: 'extract',
  description:
    'Extrahiert ein EINZELNES Dokument synchron durch ein angelerntes Projekt. Liefert die Feldwerte, Konfidenzen je Feld, den Review-Vorschlag und die Befunde der fachlichen Pruefregeln. Fuer mehrere Dokumente batch.create verwenden.',
  input: {
    type: 'object',
    properties: {
      project_id: { type: 'string', description: 'Id des Extraktionsprojekts (siehe projects.list).', minLength: 1 },
      text: { type: 'string', description: 'Dokumenttext als Klartext — Alternative zu document.' },
      document: DOCUMENT_SCHEMA,
    },
    required: ['project_id'],
  },
  output: {
    type: 'object',
    properties: {
      data: { type: 'object', description: 'Feldwerte, Schluessel = Feld-Id des Projekts.' },
      field_confidences: { type: 'object', description: 'Konfidenz 0..1 je Feld.' },
      review_status: { type: 'string', description: 'auto_ok | needs_review' },
      validations: { type: 'array', items: VALIDATION_SCHEMA },
      strategy: { type: 'string' },
      document_text: { type: 'string' },
    },
    required: ['data'],
  },
  defaultRateLimit: { requests: 30, windowSec: 60 },
  async handler(input, ctx) {
    const project = await getProject(input.project_id);
    if (!project) throw new PublicFunctionError(`Projekt "${input.project_id}" nicht gefunden`, 404, 'not_found');

    const { computeReviewStatus } = await import('./learning');

    if (input.text && input.text.trim()) {
      const result = await extract(input.project_id, { type: 'text', content: input.text });
      if (!result.success) throw new PublicFunctionError(result.error || 'Extraktion fehlgeschlagen', 422, 'extraction_failed');
      return {
        data: result.data,
        field_confidences: result.fieldConfidences ?? {},
        review_status: computeReviewStatus(project, result.data, result.fieldConfidences, result.validations),
        validations: result.validations ?? [],
        ...(result.segments ? { segments: result.segments } : {}),
        strategy: result.strategyUsed,
        document_text: result.document_text,
      };
    }

    if (!input.document) throw new PublicFunctionError('text oder document erforderlich');
    const buffer = decodeDocument(input.document, 0);

    const tmpDir = `/tmp/extraction-api/${Date.now().toString(36)}_${ctx.requestId}`;
    await mkdir(tmpDir, { recursive: true });
    const tmpPath = `${tmpDir}/${safeName(input.document.filename)}`;
    try {
      await Bun.write(tmpPath, buffer);
      const result = await extract(input.project_id, {
        type: 'file',
        path: tmpPath,
        filename: input.document.filename,
      });
      if (!result.success) throw new PublicFunctionError(result.error || 'Extraktion fehlgeschlagen', 422, 'extraction_failed');
      return {
        data: result.data,
        field_confidences: result.fieldConfidences ?? {},
        review_status: computeReviewStatus(project, result.data, result.fieldConfidences, result.validations),
        validations: result.validations ?? [],
        ...(result.segments ? { segments: result.segments } : {}),
        strategy: result.strategyUsed,
        document_text: result.document_text,
      };
    } finally {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  },
};

export const batchCreateFunction: PublicFunction<
  { project_id: string; documents: DocumentInput[]; callback_url?: string },
  unknown
> = {
  id: 'batch.create',
  description:
    'Startet einen Stapel-Lauf (bis 20 Dokumente) und antwortet SOFORT mit der run_id — die Verarbeitung laeuft im Hintergrund. Ergebnis abholen per batch.get oder ueber callback_url (Webhook, HMAC-SHA256-signiert mit dem Projekt-Schluessel).',
  input: {
    type: 'object',
    properties: {
      project_id: { type: 'string', minLength: 1 },
      documents: { type: 'array', items: DOCUMENT_SCHEMA, description: 'Bis zu 20 Dokumente, zusammen max. 25 MB dekodiert.' },
      callback_url: { type: 'string', description: 'Optionale http(s)-URL fuer die Ergebnis-Zustellung; ueberschreibt den Projekt-Default.' },
    },
    required: ['project_id', 'documents'],
  },
  output: {
    type: 'object',
    properties: {
      run_id: { type: 'string' },
      file_count: { type: 'integer' },
    },
    required: ['run_id', 'file_count'],
  },
  defaultRateLimit: { requests: 20, windowSec: 60 },
  async handler(input, ctx) {
    const project = await getProject(input.project_id);
    if (!project) throw new PublicFunctionError(`Projekt "${input.project_id}" nicht gefunden`, 404, 'not_found');

    const documents = Array.isArray(input.documents) ? input.documents : [];
    if (documents.length === 0) throw new PublicFunctionError('documents darf nicht leer sein');
    if (documents.length > MAX_DOCUMENTS) {
      throw new PublicFunctionError(`Zu viele Dokumente (${documents.length}) — maximal ${MAX_DOCUMENTS} je Anfrage`, 413, 'payload_too_large');
    }
    if (input.callback_url && !isDeliverableUrl(input.callback_url)) {
      throw new PublicFunctionError('callback_url muss eine http(s)-URL sein');
    }

    const buffers = documents.map((doc, i) => decodeDocument(doc, i));
    const total = buffers.reduce((sum, b) => sum + b.length, 0);
    if (total > MAX_TOTAL_BYTES) {
      throw new PublicFunctionError(`Anfrage zu gross (${Math.round(total / 1024 / 1024)} MB) — maximal 25 MB je Anfrage`, 413, 'payload_too_large');
    }

    const tmpDir = `/tmp/extraction-batch/${Date.now().toString(36)}_${ctx.requestId}`;
    await mkdir(tmpDir, { recursive: true });
    const saved: { filename: string; tempPath: string }[] = [];
    for (let i = 0; i < documents.length; i += 1) {
      const tempPath = `${tmpDir}/${i}_${safeName(documents[i]!.filename)}`;
      await Bun.write(tempPath, buffers[i]!);
      saved.push({ filename: documents[i]!.filename, tempPath });
    }

    const { runId, files } = await createBatchRun(
      input.project_id,
      saved.map((s) => s.filename),
      input.callback_url,
    );
    const inputFiles = files.map((f, i) => ({
      fileId: f.id,
      filename: f.filename,
      tempPath: saved[i]!.tempPath,
    }));

    // Fire-and-forget — identisch zur UI-Route.
    void runBatchExtraction(input.project_id, runId, inputFiles).catch((err) =>
      console.error('[extraction-api] runBatchExtraction error:', err),
    );

    return { run_id: runId, file_count: inputFiles.length };
  },
};

export const batchGetFunction: PublicFunction<{ project_id: string; run_id: string }, unknown> = {
  id: 'batch.get',
  description:
    'Liefert Status und Ergebnisse eines Stapel-Laufs (Polling-Alternative zum Webhook). Solange status "processing" ist, sind einzelne Dateien noch ohne Daten.',
  input: {
    type: 'object',
    properties: {
      project_id: { type: 'string', minLength: 1 },
      run_id: { type: 'string', minLength: 1 },
    },
    required: ['project_id', 'run_id'],
  },
  output: {
    type: 'object',
    properties: {
      run_id: { type: 'string' },
      status: { type: 'string', description: 'pending | processing | completed | failed' },
      file_count: { type: 'integer' },
      completed: { type: 'integer' },
      failed: { type: 'integer' },
      needs_review: { type: 'integer' },
      files: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            filename: { type: 'string' },
            status: { type: 'string' },
            data: { type: 'object' },
            field_confidences: { type: 'object' },
            review_status: { type: 'string' },
            validations: { type: 'array', items: VALIDATION_SCHEMA },
            error: { type: 'string' },
          },
          required: ['filename', 'status'],
        },
      },
    },
    required: ['run_id', 'status', 'files'],
  },
  defaultRateLimit: { requests: 120, windowSec: 60 },
  async handler(input) {
    const result = await getBatchRun(input.project_id, input.run_id);
    if (!result) throw new PublicFunctionError(`Lauf "${input.run_id}" nicht gefunden`, 404, 'not_found');
    return {
      run_id: result.run.id,
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
  },
};

export const batchExportFunction: PublicFunction<
  { project_id: string; run_id: string; format?: ExportFormat },
  unknown
> = {
  id: 'batch.export',
  description:
    'Liefert die Ergebnisse eines Stapel-Laufs als Excel-Datei (base64). Format "flat" (Default) gibt EIN Blatt mit einer Zeile je Position und wiederholten Belegdaten — direkt zeilenweise einlesbar; "flat-wide" gibt EINE Zeile je Dokument mit den Positionslisten als nummerierten Spalten (ein Datensatz je Beleg); "grouped" gibt ein Hauptblatt je Dokument plus ein Zusatzblatt je Positionsliste.',
  input: {
    type: 'object',
    properties: {
      project_id: { type: 'string', minLength: 1 },
      run_id: { type: 'string', minLength: 1 },
      format: { type: 'string', enum: ['flat', 'flat-wide', 'grouped'], description: 'Default: flat' },
    },
    required: ['project_id', 'run_id'],
  },
  output: {
    type: 'object',
    properties: {
      filename: { type: 'string' },
      content_base64: { type: 'string', description: 'XLSX-Datei, base64-kodiert.' },
      rows: { type: 'integer', description: 'Anzahl Datenzeilen im Export.' },
      format: { type: 'string' },
    },
    required: ['filename', 'content_base64', 'rows'],
  },
  defaultRateLimit: { requests: 60, windowSec: 60 },
  async handler(input) {
    const project = await getProject(input.project_id);
    if (!project) throw new PublicFunctionError(`Projekt "${input.project_id}" nicht gefunden`, 404, 'not_found');
    const result = await getBatchRun(input.project_id, input.run_id);
    if (!result) throw new PublicFunctionError(`Lauf "${input.run_id}" nicht gefunden`, 404, 'not_found');

    const format: ExportFormat =
      input.format === 'grouped' ? 'grouped' : input.format === 'flat-wide' ? 'flat-wide' : 'flat';
    const sections = buildBatchExportSections(project, result.files, format);
    const formatLabel = format === 'grouped'
      ? 'gruppiert'
      : format === 'flat-wide'
        ? 'breit (eine Zeile je Dokument, Listen als Spalten)'
        : 'flach (eine Zeile je Position)';
    const suffix = format === 'flat' ? '-flach' : format === 'flat-wide' ? '-breit' : '';
    const buffer = await generateDocument(
      {
        title: `Batch-Extraktion — ${project.name}`,
        metadata: {
          Projekt: project.name,
          Dokumente: String(result.files.length),
          Lauf: input.run_id,
          Format: formatLabel,
        },
        sections,
      },
      'xlsx',
    );

    return {
      filename: `batch-${input.run_id}${suffix}.xlsx`,
      content_base64: Buffer.from(buffer as unknown as Uint8Array).toString('base64'),
      rows: countExportRows(sections),
      format,
    };
  },
};

export const extractionPublicFunctions = [
  projectsListFunction,
  extractFunction,
  batchCreateFunction,
  batchGetFunction,
  batchExportFunction,
];
