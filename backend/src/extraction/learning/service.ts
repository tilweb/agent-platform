import { extractionVisionDpi } from '../../services/extraction/defaults';
import { withDocumentRuntime, modelWork } from '../../services/extraction/runtime';
import { ruleFields, ruleData } from './rule-scope';
/**
 * Learning Extraction Service
 *
 * Orchestrates: extract (using ingest/vision from existing code), train, regenerate guidelines.
 */

import { type Message, createImageContent, type ContentPart } from '../../services/llm';
import { resolveModel } from '../../services/providers';
import { OpenAIAdapter } from '../../services/llm/adapters/openai';
import type { ExtractionSource } from '../types';
import { attachmentsService } from '../../services/attachments';
import { runPipeline, type PreparedFile } from '../../services/extraction';
import { createSnapshot, profileHash, stableHash, type ExtractionSnapshot } from './snapshot';
import { createHash } from 'crypto';
import { getProject, updateProject, mutateProject } from './projects';
import { getExamples, saveExample, selectFewShotExamples } from './examples';
import { generateGuidelines } from './guideline-generator';
import { extractionProjectToExtractionSchema, PROJECT_FIELD_GROUP } from './pipeline-adapter';
import { validateProjectResult, modelReviewIssue } from './result-validation';
import { dedupeListItems } from './list-utils';
import { runEval, decideAcceptance, evalModelLabel } from './eval';
import { updateCalibration } from './review';
import { evaluateRules, normalizeLookupValue, type LoadAllowedValues } from './rules';
import { applyCatalogs, type ResolveCatalog } from './catalog';
import { EXTRACTION_MODEL_ID, EXTRACTION_PROVIDER_ID, extractionModelLabel } from '../model';
import { getTableWithData } from '../../tables';
import type { TrainingExample, ExtractionProject, LearningEvalState, EvalScore, RuleIssue, SegmentInstance } from './types';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { extname, resolve } from 'path';
import { EXTRACTION_SAMPLING } from '../../services/extraction/extract-call';
import { extractWithSegments } from '../segmentation/segment-extract';
import { convertDocument } from '../../services/documentConverter';
import { pdfToLayoutText, renderPdfToImages, countPdfPages } from '../../services/extraction/pdf';


// ============== Document Ingestion (reused from existing pipeline) ==============

export async function ingest(
  source: ExtractionSource,
  opts: {
    /**
     * PDF-Konverter (Markitdown, ~Sekunden je Datei via HTTP) ueberspringen.
     * Fuer deterministische, textlayer-basierte Strategien (template-labelmap),
     * die `PreparedFile.text` gar nicht nutzen, sondern `pdftotext` auf dem
     * rawBuffer fahren — der Markitdown-Text waere reiner Overhead.
     */
    skipPdfConvert?: boolean;
  } = {},
): Promise<{
  text?: string;
  imageBase64?: string;
  imageMimeType?: string;
  /** Roh-Bytes fuer Vision-Strategien (vision-per-page/hybrid), z.B. bei PDFs. */
  rawBuffer?: Buffer;
  rawMimeType?: string;
}> {
  switch (source.type) {
    case 'text':
      return { text: source.content };

    case 'base64_image':
      return { imageBase64: source.data, imageMimeType: source.mime_type };

    case 'attachment': {
      const attachment = await attachmentsService.getAttachment(
        source.attachment_id,
        source.session_id
      );
      if (!attachment) {
        throw new Error(`Attachment "${source.attachment_id}" nicht gefunden`);
      }
      if (attachment.type === 'document') {
        return { text: attachment.markdownContent || '' };
      }
      if (attachment.type === 'image') {
        return { imageBase64: attachment.base64Data || '', imageMimeType: attachment.mimeType };
      }
      throw new Error(`Attachment-Typ "${attachment.type}" wird nicht unterstuetzt`);
    }

    case 'file': {
      const filePath = resolve(source.path);
      if (!existsSync(filePath)) {
        throw new Error(`Datei nicht gefunden: ${source.path}`);
      }

      const ext = extname(source.filename).toLowerCase();
      const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

      if (imageExts.includes(ext)) {
        const buffer = await readFile(filePath);
        const base64 = buffer.toString('base64');
        const mimeType = ext === '.png' ? 'image/png' :
                         ext === '.webp' ? 'image/webp' :
                         ext === '.gif' ? 'image/gif' : 'image/jpeg';
        return { imageBase64: base64, imageMimeType: mimeType };
      }

      const textExts = ['.txt', '.md'];
      if (textExts.includes(ext)) {
        const content = await readFile(filePath, 'utf-8');
        return { text: content };
      }

      // PDFs: Die Roh-Bytes sind die PRIMAERE Quelle fuer die Vision-Strategien
      // (vision-per-page/hybrid). Markitdown liefert nur Bonus-Text (document_text
      // fuer den Learning-Loop) und ist bei gescannten PDFs ohnehin unzuverlaessig.
      // Daher best-effort mit Timeout — ein langsamer/fehlender Markitdown-Dienst
      // darf die Vision-Extraktion NICHT blockieren oder scheitern lassen.
      if (ext === '.pdf') {
        const rawBuffer = await readFile(filePath);
        let text = '';
        if (!opts.skipPdfConvert) {
          try {
            // Zentraler Konverter (W8), best-effort: die Vision-Extraktion darf
            // an einem Konverter-Ausfall nicht scheitern.
            text = await convertDocument({ buffer: rawBuffer, filename: source.filename }, { timeoutMs: 15000 });
          } catch (err) {
            console.warn('[Extraction] Konverter nicht erreichbar fuer PDF — fahre nur mit Vision fort:', err instanceof Error ? err.message : err);
          }
        }
        return { text, rawBuffer, rawMimeType: 'application/pdf' };
      }

      // Andere Dokumenttypen (docx/xlsx/…) haben keinen Vision-Fallback — hier
      // ist der Konverter die einzige Quelle und daher Pflicht (W8: zentral).
      const officeBuffer = await readFile(filePath);
      return { text: await convertDocument({ buffer: officeBuffer, filename: source.filename }) };
    }

    default:
      throw new Error('Unbekannter Quelltyp');
  }
}

async function prepareVision(
  imageBase64: string,
  imageMimeType: string,
  userId?: string
): Promise<string> {
  console.log('[Extraction] Using Vision LLM to describe image...');

  // Festes Extraktions-Modell statt aktivem Vision-Modell — sonst haengt die
  // Bild-Beschreibung wieder an der Session-Wahl des Nutzers.
  const visionModel = await resolveModel(EXTRACTION_PROVIDER_ID, EXTRACTION_MODEL_ID);
  if (!visionModel) {
    throw new Error(`Extraktions-Modell ${extractionModelLabel()} nicht verfuegbar (EXTRACTION_LLM_PROVIDER / EXTRACTION_LLM_MODEL)`);
  }

  const visionAdapter = new OpenAIAdapter({
    baseUrl: visionModel.base_url,
    apiKey: visionModel.api_key || null,
    defaultModel: visionModel.model.id,
  });

  const contentParts: ContentPart[] = [
    {
      type: 'text',
      text: `Beschreibe dieses Dokument detailliert. Extrahiere ALLEN sichtbaren Text vollstaendig und woertlich.
Behalte die Struktur bei (Tabellen, Listen, Kopfdaten).
Gib den Text in der Originalsprache wieder.
Antworte NUR mit dem extrahierten Inhalt, keine eigenen Kommentare.`,
    },
    createImageContent(imageBase64, imageMimeType),
  ];

  const messages: Message[] = [
    { role: 'user', content: contentParts },
  ];

  const result = await modelWork(`${EXTRACTION_PROVIDER_ID}/${visionModel.model.id}`, () => visionAdapter.chat(messages, visionModel.model.id, undefined, undefined, { ...EXTRACTION_SAMPLING, timeoutMs: 45_000 }));

  if (!result.content) {
    throw new Error('Vision-LLM hat keinen Text zurueckgegeben');
  }

  console.log(`[Extraction] Vision extracted ${result.content.length} chars`);
  return result.content;
}

/**
 * Dokument → reiner Text, auch fuer Scans (Welle 5, Schema-Inferenz).
 *
 * Reihenfolge: Markitdown-Text (falls brauchbar) → Bild via Vision → gescanntes
 * PDF: erste Seiten rendern und per Vision beschreiben. Wird von der
 * Schema-Inferenz genutzt, die keine Feld-Definitionen kennt und deshalb nicht
 * durch die Pipeline gehen kann.
 */
export async function ingestPlainText(
  source: ExtractionSource,
  userId?: string,
  maxScanPages = 2,
): Promise<string> {
  const ingested = await ingest(source);
  if (ingested.text && ingested.text.trim().length > 40) return ingested.text;

  if (ingested.imageBase64 && ingested.imageMimeType) {
    return prepareVision(ingested.imageBase64, ingested.imageMimeType, userId);
  }

  if (ingested.rawBuffer && ingested.rawMimeType === 'application/pdf') {
    // Kein Textlayer (gescanntes PDF): die ersten Seiten reichen fuer einen
    // Feldvorschlag — mehr waere teuer ohne Mehrwert.
    const { renderPdfToImages } = await import('../../services/extraction/pdf');
    const pages = await renderPdfToImages(ingested.rawBuffer, { dpi: 150, maxPages: maxScanPages });
    const parts: string[] = [];
    for (const page of pages.slice(0, maxScanPages)) {
      parts.push(await prepareVision(page.pngBuffer.toString('base64'), 'image/png', userId));
    }
    return parts.join('\n\n');
  }

  return ingested.text ?? '';
}

// ============== Fachliche Pruefregeln (Welle 5) ==============

/**
 * Wertequelle fuer Stammdaten-Regeln: eine Spalte einer Tabelle (Tables-Feature)
 * als normalisiertes Set. Fehler werden NICHT geworfen — die Regel-Auswertung
 * macht daraus einen `warn`-Befund ("nicht pruefbar").
 */
/**
 * Rohwerte einer Tabellen-Spalte in Original-Schreibweise, dublettenfrei.
 * Gemeinsame Basis der Regel-Pruefung (braucht nur die Menge) und der
 * kontrollierten Wertelisten (brauchen die Schreibweise zum Angleichen).
 */
async function readTableColumn(
  tableId: string,
  columnId: string,
): Promise<{ values: string[] } | { error: string }> {
  try {
    const table = await getTableWithData(tableId);
    if (!table) return { error: `Tabelle "${tableId}" nicht gefunden` };
    if (!table.columns.some((col) => col.id === columnId)) {
      return { error: `Spalte "${columnId}" existiert in "${table.name}" nicht` };
    }
    const seen = new Set<string>();
    const values: string[] = [];
    for (const row of table.data?.rows ?? []) {
      const value = row[columnId];
      if (value === null || value === undefined) continue;
      const raw = String(value).trim();
      const normalized = normalizeLookupValue(raw);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      values.push(raw);
    }
    return { values };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

const loadTableColumnValues: LoadAllowedValues = async (tableId, columnId) => {
  const result = await readTableColumn(tableId, columnId);
  if ('error' in result) return result;
  return { values: new Set(result.values.map(normalizeLookupValue)) };
};

/** Wertequelle der kontrollierten Wertelisten (Welle 6). */
const resolveCatalogValues: ResolveCatalog = async (catalog) => {
  if (catalog.source !== 'table' || !catalog.table_id || !catalog.column_id) {
    return { error: 'Keine Tabellenspalte hinterlegt' };
  }
  const result = await readTableColumn(catalog.table_id, catalog.column_id);
  if ('error' in result) return result;
  return { values: result.values.map((value) => ({ value })) };
};

export async function captureSnapshot(project: ExtractionProject, examples: TrainingExample[]): Promise<ExtractionSnapshot> {
  const snapshot = createSnapshot(project, examples);
  const references: NonNullable<ExtractionSnapshot['references']> = {};
  const refs: Array<[string, string]> = [];
  const fields = (defs: ExtractionProject['fields']) => {
    for (const field of Object.values(defs)) {
      for (const f of [field, ...Object.values(field.item_fields ?? {})]) {
        const c = f.catalog;
        if (c?.source === 'table' && c.table_id && c.column_id) refs.push([c.table_id, c.column_id]);
      }
    }
  };
  fields(project.fields);
  for (const segment of Object.values(project.segments ?? {})) fields(segment.fields ?? {});
  for (const rule of [...(project.rules ?? []), ...Object.values(project.segments ?? {}).flatMap(def => def.rules ?? [])]) if (rule.type === 'lookup') refs.push([rule.table_id, rule.column_id]);
  for (const [table, column] of refs) {
    const key = JSON.stringify([table, column]);
    if (!references[key]) references[key] = await readTableColumn(table, column);
  }
  snapshot.references = references;
  snapshot.hash = stableHash({ hash: snapshot.hash, references });
  return snapshot;
}

function snapshotResolvers(snapshot?: ExtractionSnapshot): { catalog: ResolveCatalog; lookup: LoadAllowedValues } {
  const read = (table: string, column: string) => snapshot?.references?.[JSON.stringify([table, column])] ?? { error: 'Referenzwerte fehlen im gespeicherten Profilstand' };
  return !snapshot ? { catalog: resolveCatalogValues, lookup: loadTableColumnValues } : {
    catalog: async c => {
      const result = read(c.table_id ?? '', c.column_id ?? '');
      return 'error' in result ? result : { values: result.values.map(value => ({ value })) };
    },
    lookup: async (table, column) => {
      const result = read(table, column);
      return 'error' in result ? result : { values: new Set(result.values.map(normalizeLookupValue)) };
    },
  };
}

/**
 * Fachliche Pruefregeln eines Projekts gegen einen Datensatz pruefen — mit der
 * Tables-Wertequelle verdrahtet. Wird ausserhalb von `extract()` z.B. nach einer
 * menschlichen Korrektur genutzt (Befunde neu bewerten).
 */
export async function evaluateProjectRules(
  project: ExtractionProject,
  data: Record<string, unknown>,
  snapshot?: ExtractionSnapshot,
): Promise<RuleIssue[]> {
  // Kataloge zuerst (gleichen an), dann die Regeln — wie im Extraktionspfad.
  const resolvers = snapshotResolvers(snapshot);
  if (project.segments && Object.keys(project.segments).length) {
    const issues: RuleIssue[] = [];
    for (const [type, def] of Object.entries(project.segments)) {
      const raw = data[type];
      const instances = def.repeatable ? (Array.isArray(raw) ? raw : []) : raw ? [raw] : [];
      for (let index = 0; index < instances.length; index++) {
        const key = def.repeatable ? `${type}[${index + 1}]` : type;
        if (def.mode === 'classify-only') continue;
        const local = await evaluateProjectRules({ ...project, fields: def.fields ?? {}, rules: def.rules, segments: undefined }, instances[index] as Record<string, unknown>, snapshot);
        issues.push(...local.map(issue => ({ ...issue, fields: issue.fields.map(field => `${key}.${field}`), message: `${def.label}: ${issue.message}` })));
      }
    }
    issues.push(...await evaluateRules({ ...project, fields: ruleFields(project), segments: undefined }, ruleData(project, data), resolvers.lookup));
    return [...issues, ...validateProjectResult(project, data)];
  }
  const catalogIssues = await applyCatalogs(project, data, resolvers.catalog);
  const ruleIssues = await evaluateRules(project, data, resolvers.lookup);
  return [...catalogIssues, ...ruleIssues, ...validateProjectResult(project, data)];
}

// ============== Extraction ==============

/**
 * Extract data from document using project definition + learned knowledge.
 *
 * Engine ist die generische Heavy-Pipeline (`services/extraction/runPipeline`).
 * Das Projekt-Schema wird via `extractionProjectToExtractionSchema` adaptiert;
 * gelernte Guidelines + Few-Shot landen in `profile.guidelines`. Strategie kommt
 * aus `project.extraction` (Default `hybrid`).
 */
async function extractInternal(
  projectId: string,
  source: ExtractionSource,
  userId?: string,
  snapshot?: ExtractionSnapshot,
): Promise<{
  segmentContexts?: Record<string, string>;
  original?: import('./types').OriginalDocument;
  snapshot?: ExtractionSnapshot;
  success: boolean;
  data: Record<string, unknown>;
  document_text: string;
  fieldConfidences?: Record<string, number>;
  boxes?: Record<string, { page: number; x: number; y: number; w: number; h: number }>;
  pageImages?: { page: number; dataUri: string; width: number; height: number }[];
  strategyUsed?: string;
  /** Audit-Metadaten: mit welchem Regel-Stand/Modell/Strategie extrahiert wurde. */
  audit?: { performance?: import("../../services/extraction/runtime").RuntimeMetrics; guideline_version: number; model: string; strategy?: string; profile_hash?: string; snapshot_hash?: string };
  /** Befunde der fachlichen Pruefregeln (Welle 5); leer, wenn keine Regeln definiert. */
  validations?: RuleIssue[];
  /** Segment-Instanzen (Welle 10) — nur bei Profilen mit `segments`. */
  segments?: SegmentInstance[];
  error?: string;
}> {
  try {
    // Every operation in this extraction uses the same immutable profile and example pool.
    const loaded = snapshot?.project ?? await getProject(projectId);
    const frozen = snapshot ?? (loaded ? await captureSnapshot(loaded, await getExamples(projectId)) : undefined);
    const project = frozen?.project;
    if (!project) {
      throw new Error(`Projekt "${projectId}" nicht gefunden`);
    }

    let original: import('./types').OriginalDocument | undefined;
    if (source.type === 'file') {
      const bytes = await readFile(source.path);
      original = { base64: bytes.toString('base64'), filename: source.filename, sha256: createHash('sha256').update(bytes).digest('hex') };
    }
    const resolvers = snapshotResolvers(frozen);
    // Ingest document. Deterministische Textlayer-Strategien (template-labelmap)
    // nutzen `PreparedFile.text` (Markitdown) nicht — den ~sekundenlangen
    // Konverter-HTTP-Call daher ueberspringen und document_text unten guenstig
    // aus `pdftotext` fuellen.
    const skipPdfConvert = project.extraction?.strategy === 'template-labelmap';
    console.log(`[Extraction] Ingesting document for project ${projectId}...`);
    const warmPixels = source.type === 'file' && source.filename.toLowerCase().endsWith('.pdf') && project.extraction?.strategy === 'vision-per-page'
      ? readFile(source.path).then(bytes => renderPdfToImages(bytes, { dpi: extractionVisionDpi(), maxPages: project.extraction?.max_pages ?? 500 })).catch(() => undefined) : undefined;
    const ingested = await ingest(source, { skipPdfConvert });
    await warmPixels;

    // PreparedFile(s) fuer die Pipeline bauen. document_text wird zusaetzlich
    // gesichert — der Learning-Loop (train/Few-Shot) braucht den Dokumenttext.
    let documentText: string;
    const files: PreparedFile[] = [];
    if (ingested.rawBuffer && ingested.rawMimeType) {
      // Vision-faehige Quelle (z.B. PDF): Roh-Bytes fuer vision-per-page/hybrid.
      // Markitdown-Text (falls vorhanden) bleibt als document_text fuer den
      // Learning-Loop; die eigentliche Extraktion macht die Pipeline ueber die
      // gerenderten Seiten.
      // Konverter uebersprungen (born-digital, template-labelmap): document_text
      // guenstig aus dem Textlayer (~10 ms via pdftotext) statt aus Markitdown.
      if (skipPdfConvert && !ingested.text && ingested.rawMimeType === 'application/pdf') {
        try {
          documentText = await pdfToLayoutText(ingested.rawBuffer);
        } catch {
          documentText = '';
        }
      } else {
        documentText = ingested.text ?? '';
      }
      files.push({
        filename: 'document',
        text: ingested.text ?? '',
        mimeType: ingested.rawMimeType,
        rawBuffer: ingested.rawBuffer,
      });
    } else if (ingested.text && ingested.text.trim()) {
      documentText = ingested.text;
      files.push({ filename: 'document', text: ingested.text, mimeType: 'text/plain' });
    } else if (ingested.imageBase64 && ingested.imageMimeType) {
      // Preserve the learning transcript when available; failures must not stop pixel extraction.
      try {
        documentText = await prepareVision(ingested.imageBase64, ingested.imageMimeType, userId);
      } catch {
        documentText = '';
      }
      files.push({
        filename: 'image',
        text: '',
        mimeType: ingested.imageMimeType,
        rawBuffer: Buffer.from(ingested.imageBase64, 'base64'),
      });
    } else {
      throw new Error('Kein Dokumenttext oder Bild vorhanden');
    }

    // Segment-Profil (Welle 10): eigener Pfad — Seiten klassifizieren, je
    // Segment gescopte Extraktion ueber die bestehende Pipeline. Nur fuer
    // visuelle Quellen (PDF); alles andere laeuft wie bisher monolithisch.
    if (project.segments && Object.keys(project.segments).length > 0 && ingested.rawBuffer && ingested.rawMimeType === 'application/pdf') {
      const segResult = await extractWithSegments(project, ingested.rawBuffer, userId ?? '', resolvers.catalog, frozen!.examples);
      console.log(`[Extraction] ${projectId}: ${segResult.segments.length} Segment(e), ${segResult.llmCalls} LLM-Calls, ${segResult.validations.length} Befund(e)`);
      return {
        success: true, original, snapshot: frozen, segmentContexts: segResult.segmentContexts,
        data: segResult.data,
        document_text: documentText,
        fieldConfidences: segResult.fieldConfidences,
        boxes: segResult.boxes,
        pageImages: segResult.pageImages,
        strategyUsed: 'segmented',
        validations: [...segResult.validations, ...await evaluateProjectRules(project, segResult.data, frozen), ...modelReviewIssue('segmented')],
        segments: segResult.segments,
        audit: {
          profile_hash: profileHash(project), snapshot_hash: frozen!.hash,
        guideline_version: project.learning.guideline_version,
          model: evalModelLabel(project),
          strategy: 'segmented',
        },
      };
    }

    // Few-Shot + Schema fuer die Heavy-Pipeline
    // Few-Shot: Aehnlichkeit zum aktuellen Dokument mischt sich in die Auswahl (Welle 5).
    const fewShotExamples = await selectFewShotExamples(projectId, documentText, 5, 4000, frozen!.examples);
    const schema = extractionProjectToExtractionSchema(project, fewShotExamples);

    const result = await runPipeline({
      files,
      schema,
      userId: userId ?? '',
    });

    // A text-only decision still needs the original pages for human verification.
    if (!result.pageImages?.length && ingested.rawBuffer && ingested.rawMimeType === 'application/pdf') {
      try {
        const pages = await renderPdfToImages(ingested.rawBuffer, { dpi: 200, maxPages: schema.config.max_pages });
        result.pageImages = pages.map(page => ({ page: page.pageNumber, dataUri: `data:image/png;base64,${page.pngBuffer.toString('base64')}`, width: page.width, height: page.height }));
        if (pages.length !== await countPdfPages(ingested.rawBuffer)) throw new Error('Seiten fehlen');
      } catch {
        result.processingIssues = [...(result.processingIssues ?? []), { severity: 'error', message: 'Vollständige Originalansicht nicht verfügbar — erneut verarbeiten.' }];
      }
    }

    // Synthetische Gruppe (`felder.<id>`) wieder zu flach entpacken.
    const data: Record<string, unknown> = {
      ...((result.extracted[PROJECT_FIELD_GROUP] ?? {}) as Record<string, unknown>),
    };
    // Preserve all row identities; ambiguous overlap is a review finding.
    // Missing lists remain [] and are checked by the final business schema.
    for (const [fieldId, field] of Object.entries(project.fields)) {
      if (field.type !== 'list') continue;
      const raw = result.extracted[fieldId];
      data[fieldId] = dedupeListItems(Array.isArray(raw) ? raw : [], field.item_fields ?? {});
    }
    const prefix = `${PROJECT_FIELD_GROUP}.`;
    const fieldConfidences: Record<string, number> = {};
    for (const [path, conf] of Object.entries(result.fieldConfidences)) {
      fieldConfidences[path.startsWith(prefix) ? path.slice(prefix.length) : path] = conf;
    }
    // Boxen ebenfalls auf flache Feld-IDs entpacken (felder.<id> → <id>).
    const boxes: Record<string, { page: number; x: number; y: number; w: number; h: number }> = {};
    for (const [path, box] of Object.entries(result.boxes ?? {})) {
      boxes[path.startsWith(prefix) ? path.slice(prefix.length) : path] = box;
    }

    // Kontrollierte Wertelisten (Welle 6) gleichen eindeutige Treffer an, BEVOR
    // die fachlichen Pruefregeln (Welle 5) laufen — die sollen den bereinigten
    // Stand sehen (z.B. ein Stammdaten-Lookup auf dem angeglichenen Wert).
    const catalogIssues = await applyCatalogs(project, data, resolvers.catalog);
    const ruleIssues = await evaluateRules(project, data, resolvers.lookup);
    // OCR-Fusion (W7): unbelegte Zahlenwerte aus der Engine als Warn-Befunde —
    // die Konfidenz ist bereits gedeckelt (Review-Triage greift), der Befund
    // erklaert dem Pruefer WARUM.
    const prefixFlat = (path: string) => path.startsWith(prefix) ? path.slice(prefix.length) : path;
    const fusionIssues: RuleIssue[] = (result.fusionFindings ?? []).map((f) => ({
      rule_id: 'ocr-abgleich',
      type: 'ocr',
      severity: 'warn',
      message: f.message,
      fields: [prefixFlat(f.path).split(/[[.]/, 1)[0] ?? ''],
    }));
    // Verarbeitungs-Befunde (uebersprungene Seiten, unlesbare Antworten,
    // gekappte Seiten): severity 'error' erzwingt "Zu pruefen".
    const processingIssues: RuleIssue[] = (result.processingIssues ?? []).map((i) => ({
      rule_id: i.code ? `verarbeitung-${i.code}` : 'verarbeitung',
      type: 'processing',
      severity: i.severity,
      message: i.message,
      fields: [],
    }));
    const validations = [...catalogIssues, ...ruleIssues, ...fusionIssues, ...processingIssues, ...validateProjectResult(project, data), ...modelReviewIssue(result.strategyUsed)];
    if (validations.length > 0) {
      console.log(`[Extraction] ${projectId}: ${validations.length} Regel-Befund(e)`);
    }

    console.log(`[Extraction] Done for ${projectId} via ${result.strategyUsed} (${result.llmCalls} calls, ${result.warnings.length} warnings)`);
    return {
      success: true, original, snapshot: frozen,
      data,
      document_text: documentText,
      fieldConfidences,
      boxes,
      pageImages: result.pageImages,
      strategyUsed: result.strategyUsed,
      validations,
      audit: {
        profile_hash: profileHash(project), snapshot_hash: frozen!.hash,
        guideline_version: project.learning.guideline_version,
        model: evalModelLabel(project),
        strategy: result.strategyUsed,
      },
    };
  } catch (error: any) {
    console.error(`[Extraction] Error for project ${projectId}:`, error.message);
    return { success: false, data: {}, document_text: '', error: error.message };
  }
}

/** Persist exact test sources, truths and execution inputs before exposing a score. */
async function measureEvaluation(project: ExtractionProject, guidelines: string, tests: TrainingExample[], userId: string | undefined,
  training: TrainingExample[], snapshot: ExtractionSnapshot) {
  const score = await runEval(project, guidelines, tests, userId, training, snapshot);
  const { saveEvaluation } = await import('./evaluation-store');
  const candidateSnapshot = createSnapshot({ ...snapshot.project, guidelines }, training);
  candidateSnapshot.references = structuredClone(snapshot.references);
  candidateSnapshot.hash = stableHash({ hash: candidateSnapshot.hash, references: candidateSnapshot.references });
  const id = await saveEvaluation(project.id, { score, snapshot: candidateSnapshot, tests });
  const { dataset_manifest, case_results, ...summary } = score;
  return { ...summary, evaluation_id: id };
}

// ============== Training & Eval-Orchestrierung (Welle 2) ==============


/**
 * In-Memory-Lock: pro Projekt hoechstens ein Guideline-/Eval-Lauf gleichzeitig
 * (Backend ist single-process). Der persistierte `learning.eval.status` ist nur
 * Anzeige fuers UI; nach einem Crash bleibt er ggf. auf 'running' — der naechste
 * Lauf ueberschreibt ihn einfach (UI ignoriert running mit altem started_at).
 */
const evalLocks = new Set<string>();

/** History-Eintrag vorn anfuegen, Cap 20. */
function pushHistory(
  state: LearningEvalState | undefined,
  entry: NonNullable<LearningEvalState['history']>[number],
): NonNullable<LearningEvalState['history']> {
  return [entry, ...(state?.history ?? [])].slice(0, 20);
}

/** learning.eval am Projekt aktualisieren (frisch laden, Rest von learning erhalten). */
async function persistEvalState(
  projectId: string,
  mutate: (project: ExtractionProject, evalState: LearningEvalState) => LearningEvalState,
  alsoUpdate?: (project: ExtractionProject) => { guidelines?: string; guideline_version?: number; approved_example_ids?: string[] },
): Promise<void> {
  await mutateProject(projectId, project => {
    const evalState = mutate(project, project.learning.eval ?? { status: 'idle' });
    const extra = alsoUpdate?.(project) ?? {};
    return { ...(extra.guidelines !== undefined ? { guidelines: extra.guidelines } : {}),
      learning: { ...project.learning, ...(extra.approved_example_ids ? { approved_example_ids: extra.approved_example_ids } : {}), ...(extra.guideline_version !== undefined ? { guideline_version: extra.guideline_version } : {}), eval: evalState } };
  });
}

/**
 * Champion/Challenger-Guideline-Update (Hintergrund): neuen Guidelines-Kandidaten
 * generieren, gegen unabhängige Testbeispiele messen und nur bei >= Champion-Accuracy
 * uebernehmen. Bei Eval-Fehlern bleibt der Champion unveraendert (sicherer Default).
 */
export async function runGuidelineUpdate(projectId: string, userId?: string): Promise<void> {
  if (evalLocks.has(projectId)) return;
  evalLocks.add(projectId);
  try {
    const project = await getProject(projectId);
    if (!project) return;

    const allExamples = (await getExamples(projectId)).filter(
      (e) => e.dataset?.purpose === 'test' || e.document_text?.trim() || e.dataset?.visual?.length || e.dataset?.segment_contexts,
    );
    const trainingSet = allExamples.filter(e => e.dataset?.purpose !== 'test');
    const evalSet = allExamples.filter(e => e.dataset?.purpose === 'test');
    if (!trainingSet.length || !evalSet.length) throw new Error('Zum Ableiten werden getrennte Lern- und Testbeispiele benötigt. Testbeispiele beim Prüfen neuer Dokumente speichern.');
    const evaluationSnapshot = await captureSnapshot(project, trainingSet);
    const model = evalModelLabel(project);
    const setHash = stableHash({ set: evalSet, training: trainingSet, profile: profileHash(project), references: evaluationSnapshot.references });

    await persistEvalState(projectId, (_p, s) => ({
      ...s,
      status: 'running',
      started_at: new Date().toISOString(),
    }));

    console.log(`[Extraction] Guideline-Update fuer ${projectId} (${evalSet.length} Eval-Beispiele)...`);

    // Kandidaten sehen ausschließlich den Lernbestand.
    const candidate = await generateGuidelines(project, trainingSet, userId);

    // 2) Champion-Score: Cache nutzen, wenn Eval-Set + Version unveraendert.
    const cached = project.learning.eval?.champion;
    let champion: EvalScore | null = null;
    if (
      cached && !cached.stale && !cached.failures && cached.aligned === true &&
      cached.eval_set_hash === setHash &&
      cached.guideline_version === project.learning.guideline_version
    ) {
      champion = cached;
    } else {
      const measured = await measureEvaluation(project, project.guidelines, evalSet, userId, trainingSet, evaluationSnapshot);
      if (measured.failed) {
        await finishWithError(projectId, evalSet.length, measured.failures, measured.evaluation_id);
        return;
      }
      champion = measured;
    }

    // 3) Challenger messen.
    const candidateProject = { ...project, learning: { ...project.learning, approved_example_ids: trainingSet.map(e => e.id) } };
    const candidateSnapshot = await captureSnapshot(candidateProject, trainingSet);
    candidateSnapshot.references = structuredClone(evaluationSnapshot.references);
    const challenger = await measureEvaluation(candidateProject, candidate, evalSet, userId, trainingSet, candidateSnapshot);
    const decision = decideAcceptance(champion, challenger);
    const now = new Date().toISOString();

    if (decision.reason === 'error') {
      await finishWithError(projectId, evalSet.length, challenger.failures, challenger.evaluation_id);
      return;
    }

    if (decision.accept) {
      await persistEvalState(
        projectId,
        (p, s) => ({
          status: 'idle',
          champion: {
            ...challenger,
            eval_set_hash: setHash,
            guideline_version: p.learning.guideline_version + 1,
            model,
            at: now,
          },
          last_run: {
            at: now,
            action: decision.reason === 'no-champion' ? 'initial' : 'accepted',
            evaluation_id: challenger.evaluation_id,
            challenger_overall: challenger.overall,
            champion_overall: champion?.overall,
            examples: challenger.examples,
          },
          history: pushHistory(s, {
            at: now,
            action: decision.reason === 'no-champion' ? 'initial' : 'accepted',
            champion: champion?.overall,
            evaluation_id: challenger.evaluation_id,
            challenger: challenger.overall,
            examples: challenger.examples,
            version: p.learning.guideline_version + 1,
          }),
        }),
        (p) => {
          if (p.learning.guideline_version !== project.learning.guideline_version || profileHash(p) !== profileHash(project) || (p.learning.dataset_version ?? 0) !== (project.learning.dataset_version ?? 0)) throw new Error('Profil wurde während der Messung geändert. Bitte erneut messen.');
          return { guidelines: candidate, guideline_version: p.learning.guideline_version + 1, approved_example_ids: trainingSet.map(e => e.id) };
        },
      );
      console.log(`[Extraction] Guidelines ${projectId} uebernommen (${challenger.overall}% vs. ${champion?.overall ?? '—'}%)`);
    } else {
      await persistEvalState(projectId, (p, s) => ({
        status: 'idle',
        // Frisch gemessenen Champion-Score cachen (auch bei Ablehnung wertvoll).
        champion: champion
          ? {
              ...champion,
              eval_set_hash: setHash,
              guideline_version: project.learning.guideline_version,
              model,
              at: now,
            }
          : s.champion,
        last_run: {
          at: now,
          action: 'rejected',
          evaluation_id: challenger.evaluation_id,
          challenger_overall: challenger.overall,
          champion_overall: champion?.overall,
          examples: challenger.examples,
        },
        history: pushHistory(s, {
          at: now,
          action: 'rejected',
          champion: champion?.overall,
          evaluation_id: challenger.evaluation_id,
          challenger: challenger.overall,
          examples: challenger.examples,
          version: p.learning.guideline_version,
        }),
      }));
      console.log(`[Extraction] Guidelines ${projectId} verworfen (${challenger.overall}% < ${champion?.overall}%)`);
    }
  } catch (error: any) {
    console.error(`[Extraction] Guideline-Update fehlgeschlagen (${projectId}):`, error.message);
    await persistEvalState(projectId, (_p, s) => ({
      ...s,
      status: 'idle',
      last_run: { at: new Date().toISOString(), action: 'error', message: error.message },
      history: pushHistory(s, { at: new Date().toISOString(), action: 'error' }),
    })).catch(() => {});
  } finally {
    evalLocks.delete(projectId);
  }
}

/** Fehler-Abschluss: zu viele Eval-Beispiele gescheitert — Champion bleibt. */
async function finishWithError(projectId: string, total: number, failures: number, evaluationId?: string): Promise<void> {
  const now = new Date().toISOString();
  const message = `${failures} von ${total} Eval-Extraktionen fehlgeschlagen — Regeln unveraendert`;
  console.warn(`[Extraction] Eval ${projectId}: ${message}`);
  await persistEvalState(projectId, (_p, s) => ({
    ...s,
    status: 'idle',
    last_run: { at: now, action: 'error', message, evaluation_id: evaluationId },
    history: pushHistory(s, { at: now, action: 'error', evaluation_id: evaluationId }),
  }));
}

/**
 * Voll-Eval (Hintergrund): misst NUR die aktuellen Guidelines (Champion) neu —
 * kein Kandidat, keine Uebernahme-Entscheidung.
 */
export async function runFullEval(projectId: string, userId?: string): Promise<{ started: boolean }> {
  if (evalLocks.has(projectId)) return { started: false };
  const project = await getProject(projectId);
  if (!project) throw new Error(`Projekt "${projectId}" nicht gefunden`);
  const examples = await getExamples(projectId);
  const trainingSet = examples.filter(e => e.dataset?.purpose !== 'test');
  const tests = examples.filter(e => e.dataset?.purpose === 'test');
  if (!tests.length) throw new Error('Mindestens ein unabhängiges Testbeispiel mit Original benötigt. Beim Prüfen eines neuen Dokuments als Testbeispiel speichern.');

  if (evalLocks.has(projectId)) return { started: false };
  evalLocks.add(projectId);
  void (async () => {
    try {
      const evalSet = tests;
      const evaluationSnapshot = await captureSnapshot(project, trainingSet);
      const model = evalModelLabel(project);
      const setHash = stableHash({ set: evalSet, training: trainingSet, profile: profileHash(project), references: evaluationSnapshot.references });
      await persistEvalState(projectId, (_p, s) => ({
        ...s,
        status: 'running',
        started_at: new Date().toISOString(),
      }));
      const measured = await measureEvaluation(project, project.guidelines, evalSet, userId, trainingSet, evaluationSnapshot);
      const now = new Date().toISOString();
      await persistEvalState(projectId, (p, s) => ({
        status: 'idle',
        champion: {
          ...measured,
          eval_set_hash: setHash,
          guideline_version: project.learning.guideline_version,
          model,
          at: now,
        },
        last_run: { at: now, action: 'measured', evaluation_id: measured.evaluation_id, champion_overall: measured.overall, examples: measured.examples },
        history: pushHistory(s, {
          at: now,
          action: 'measured',
          evaluation_id: measured.evaluation_id,
          champion: measured.overall,
          examples: measured.examples,
          version: p.learning.guideline_version,
        }),
      }));
    } catch (error: any) {
      console.error(`[Extraction] Voll-Eval fehlgeschlagen (${projectId}):`, error.message);
      await persistEvalState(projectId, (_p, s) => ({
        ...s,
        status: 'idle',
        last_run: { at: new Date().toISOString(), action: 'error', message: error.message },
      })).catch(() => {});
    } finally {
      evalLocks.delete(projectId);
    }
  })();

  return { started: true };
}

/**
 * Save a training example. Ab 3 Beispielen (und wenn korrigiert wurde) startet
 * im Hintergrund das Champion/Challenger-Guideline-Update (`runGuidelineUpdate`).
 */
export async function train(
  projectId: string,
  data: {
    dataset?: import('./types').ExampleDataset;
    source_filename: string;
    document_text: string;
    initial_extraction: Record<string, unknown>;
    corrected_extraction: Record<string, unknown>;
    /** Konfidenzen der initialen Extraktion — speist die Kalibrierung (Welle 3). */
    field_confidences?: Record<string, number>;
  },
  userId?: string
): Promise<{
  example: TrainingExample;
  guidelines_update: 'started' | 'none';
}> {
  const trainingProject = await getProject(projectId);
  if (!trainingProject) throw new Error('Profil nicht gefunden');
  const trainingIssues = await evaluateProjectRules(trainingProject, data.corrected_extraction);
  if (trainingIssues.some(i => i.severity === 'error' || i.status === 'not_evaluated')) {
    throw new Error(trainingIssues.map(i => i.message).join('; '));
  }
  // Save only schema-valid, checked corrections.
  const example = await saveExample(projectId, {
    dataset: { ...data.dataset, purpose: data.dataset?.purpose ?? 'train', ...(data.dataset?.purpose !== 'test' ? { activation: 'candidate' as const } : {}) },
    source_filename: data.source_filename,
    document_text: data.document_text,
    initial_extraction: data.initial_extraction,
    corrected_extraction: data.corrected_extraction,
  });

  // Update project learning metadata
  const allExamples = (await getExamples(projectId)).filter(e => e.dataset?.purpose !== 'test');
  const totalExamples = allExamples.length;

  const project = await getProject(projectId);
  if (!project) {
    throw new Error(`Projekt "${projectId}" nicht gefunden`);
  }

  await mutateProject(projectId, current => ({ learning: {
    ...current.learning,
    ...(data.dataset?.purpose !== 'test' && data.field_confidences ? { calibration: updateCalibration(current.learning.calibration, current,
      data.initial_extraction, data.corrected_extraction, data.field_confidences) } : {}),
  } }));

  // Guideline-Update im Hintergrund (fire-and-forget) — Eval dauert zu lang
  // fuer den HTTP-Request. Das UI pollt learning.eval.status.
  let guidelinesUpdate: 'started' | 'none' = 'none';
  if (data.dataset?.purpose !== 'test' && (await getExamples(projectId)).some(e => e.dataset?.purpose === 'test') && totalExamples >= 3 && !evalLocks.has(projectId)) {
    guidelinesUpdate = 'started';
    void runGuidelineUpdate(projectId, userId).catch((err) =>
      console.error('[Extraction] runGuidelineUpdate error:', err instanceof Error ? err.message : err),
    );
  }

  return { example, guidelines_update: guidelinesUpdate };
}

/**
 * Regeln neu ableiten (Button): laeuft jetzt als Hintergrund-Champion/Challenger-
 * Lauf. Antwortet sofort; `started:false` wenn bereits ein Lauf aktiv ist.
 */
export async function regenerateGuidelines(
  projectId: string,
  userId?: string
): Promise<{ started: boolean }> {
  const project = await getProject(projectId);
  if (!project) {
    throw new Error(`Projekt "${projectId}" nicht gefunden`);
  }

  const examples = await getExamples(projectId);
  if (examples.length < 1) {
    throw new Error('Mindestens 1 Trainingsbeispiel benoetigt');
  }

  if (evalLocks.has(projectId)) return { started: false };
  void runGuidelineUpdate(projectId, userId).catch((err) =>
    console.error('[Extraction] runGuidelineUpdate error:', err instanceof Error ? err.message : err),
  );
  return { started: true };
}

async function correctSegmentationInternal(snapshot: ExtractionSnapshot, original: Buffer, plan: unknown, previous: import('../segmentation/segment-extract').SegmentExtractionResult) {
  const project = snapshot.project;
  const resolvers = snapshotResolvers(snapshot);
  // Legacy findings with no segment scope cannot safely be reused.
  const reusable = previous.validations.some(issue => issue.severity === 'error' && issue.rule_id.startsWith('verarbeitung') && !issue.fields.length)
    ? { ...previous, segments: [] } : previous;
  const result = await extractWithSegments(project, original, '', resolvers.catalog, snapshot.examples, { segments: plan, previous: reusable });
  result.validations.push(...await evaluateProjectRules(project, result.data, snapshot), ...modelReviewIssue('segmented'));
  return result;
}

export async function extract(...args: Parameters<typeof extractInternal>): Promise<Awaited<ReturnType<typeof extractInternal>>> {
  const { value, metrics } = await withDocumentRuntime(() => extractInternal(...args));
  if (value.audit) value.audit = { ...value.audit, performance: metrics };
  return value;
}

export async function correctSegmentation(...args: Parameters<typeof correctSegmentationInternal>) {
  return (await withDocumentRuntime(() => correctSegmentationInternal(...args))).value;
}
