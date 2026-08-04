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
import { getProject, updateProject } from './projects';
import { getExamples, saveExample, selectFewShotExamples } from './examples';
import { generateGuidelines } from './guideline-generator';
import { extractionProjectToExtractionSchema, PROJECT_FIELD_GROUP } from './pipeline-adapter';
import { dedupeListItems } from './list-utils';
import { runEval, evalSetHash, decideAcceptance, evalModelLabel } from './eval';
import { updateCalibration } from './review';
import { evaluateRules, normalizeLookupValue, type LoadAllowedValues } from './rules';
import { applyCatalogs, type ResolveCatalog } from './catalog';
import { EXTRACTION_MODEL_ID, EXTRACTION_PROVIDER_ID, extractionModelLabel } from '../model';
import { getTableWithData } from '../../tables';
import type { TrainingExample, ExtractionProject, LearningEvalState, EvalScore, RuleIssue } from './types';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { extname, resolve } from 'path';

const MARKITDOWN_URL = process.env.MARKITDOWN_API_URL || 'https://api.adacor.ai/v1/documentMarkdown/';
const MARKITDOWN_API_KEY = process.env.ADACOR_AI_API_KEY || '';

// ============== Document Ingestion (reused from existing pipeline) ==============

export async function ingest(source: ExtractionSource): Promise<{
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
        try {
          const file = Bun.file(filePath);
          const formData = new FormData();
          formData.append('document', file, source.filename);
          const response = await fetch(MARKITDOWN_URL, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${MARKITDOWN_API_KEY}` },
            body: formData,
            signal: AbortSignal.timeout(15000),
          });
          if (response.ok) {
            text = await response.text();
          } else {
            console.warn(`[Extraction] Markitdown ${response.status} fuer PDF — fahre nur mit Vision fort.`);
          }
        } catch (err) {
          console.warn('[Extraction] Markitdown nicht erreichbar fuer PDF — fahre nur mit Vision fort:', err instanceof Error ? err.message : err);
        }
        return { text, rawBuffer, rawMimeType: 'application/pdf' };
      }

      // Andere Dokumenttypen (docx/xlsx/…) haben keinen Vision-Fallback — hier ist
      // Markitdown die einzige Quelle und daher Pflicht.
      const file = Bun.file(filePath);
      const formData = new FormData();
      formData.append('document', file, source.filename);

      const response = await fetch(MARKITDOWN_URL, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${MARKITDOWN_API_KEY}` },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Markitdown-Konvertierung fehlgeschlagen: ${response.status} - ${errorText}`);
      }

      return { text: await response.text() };
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

  const result = await visionAdapter.chat(messages, visionModel.model.id);

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

/**
 * Fachliche Pruefregeln eines Projekts gegen einen Datensatz pruefen — mit der
 * Tables-Wertequelle verdrahtet. Wird ausserhalb von `extract()` z.B. nach einer
 * menschlichen Korrektur genutzt (Befunde neu bewerten).
 */
export async function evaluateProjectRules(
  project: ExtractionProject,
  data: Record<string, unknown>,
): Promise<RuleIssue[]> {
  // Kataloge zuerst (gleichen an), dann die Regeln — wie im Extraktionspfad.
  const catalogIssues = await applyCatalogs(project, data, resolveCatalogValues);
  const ruleIssues = await evaluateRules(project, data, loadTableColumnValues);
  return [...catalogIssues, ...ruleIssues];
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
export async function extract(
  projectId: string,
  source: ExtractionSource,
  userId?: string
): Promise<{
  success: boolean;
  data: Record<string, unknown>;
  document_text: string;
  fieldConfidences?: Record<string, number>;
  boxes?: Record<string, { page: number; x: number; y: number; w: number; h: number }>;
  pageImages?: { page: number; dataUri: string; width: number; height: number }[];
  strategyUsed?: string;
  /** Audit-Metadaten: mit welchem Regel-Stand/Modell/Strategie extrahiert wurde. */
  audit?: { guideline_version: number; model: string; strategy?: string };
  /** Befunde der fachlichen Pruefregeln (Welle 5); leer, wenn keine Regeln definiert. */
  validations?: RuleIssue[];
  error?: string;
}> {
  try {
    // Load project
    const project = await getProject(projectId);
    if (!project) {
      throw new Error(`Projekt "${projectId}" nicht gefunden`);
    }

    // Ingest document
    console.log(`[Extraction] Ingesting document for project ${projectId}...`);
    const ingested = await ingest(source);

    // PreparedFile(s) fuer die Pipeline bauen. document_text wird zusaetzlich
    // gesichert — der Learning-Loop (train/Few-Shot) braucht den Dokumenttext.
    let documentText: string;
    const files: PreparedFile[] = [];
    if (ingested.rawBuffer && ingested.rawMimeType) {
      // Vision-faehige Quelle (z.B. PDF): Roh-Bytes fuer vision-per-page/hybrid.
      // Markitdown-Text (falls vorhanden) bleibt als document_text fuer den
      // Learning-Loop; die eigentliche Extraktion macht die Pipeline ueber die
      // gerenderten Seiten.
      documentText = ingested.text ?? '';
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
      // Bild: Vision-Beschreibung NUR fuer document_text (Learning-Loop). Die
      // eigentliche Extraktion macht die Pipeline ueber den rawBuffer
      // (vision-per-page / hybrid rendern das Bild selbst).
      documentText = await prepareVision(ingested.imageBase64, ingested.imageMimeType, userId);
      files.push({
        filename: 'image',
        text: '',
        mimeType: ingested.imageMimeType,
        rawBuffer: Buffer.from(ingested.imageBase64, 'base64'),
      });
    } else {
      throw new Error('Kein Dokumenttext oder Bild vorhanden');
    }

    // Few-Shot + Schema fuer die Heavy-Pipeline
    // Few-Shot: Aehnlichkeit zum aktuellen Dokument mischt sich in die Auswahl (Welle 5).
    const fewShotExamples = await selectFewShotExamples(projectId, documentText);
    const schema = extractionProjectToExtractionSchema(project, fewShotExamples);

    const result = await runPipeline({
      files,
      schema,
      userId: userId ?? '',
    });

    // Synthetische Gruppe (`felder.<id>`) wieder zu flach entpacken.
    const data: Record<string, unknown> = {
      ...((result.extracted[PROJECT_FIELD_GROUP] ?? {}) as Record<string, unknown>),
    };
    // Listen-Felder liegen als eigene Array-Gruppen unter ihrer fieldId. Union-
    // Merge der Engine kann Duplikate erzeugen (Chunk-Overlap, Seiten-Merge) —
    // exakte Duplikate hier entfernen. Fehlende Liste → immer [] (nie null).
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
    const catalogIssues = await applyCatalogs(project, data, resolveCatalogValues);
    const ruleIssues = await evaluateRules(project, data, loadTableColumnValues);
    const validations = [...catalogIssues, ...ruleIssues];
    if (validations.length > 0) {
      console.log(`[Extraction] ${projectId}: ${validations.length} Regel-Befund(e)`);
    }

    console.log(`[Extraction] Done for ${projectId} via ${result.strategyUsed} (${result.llmCalls} calls, ${result.warnings.length} warnings)`);
    return {
      success: true,
      data,
      document_text: documentText,
      fieldConfidences,
      boxes,
      pageImages: result.pageImages,
      strategyUsed: result.strategyUsed,
      validations,
      audit: {
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

// ============== Training & Eval-Orchestrierung (Welle 2) ==============

/** Max. Beispiele je Eval-Lauf (neueste zuerst). */
const EVAL_CAP = parseInt(process.env.EXTRACTION_EVAL_CAP || '20', 10);

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
  alsoUpdate?: (project: ExtractionProject) => { guidelines?: string; guideline_version?: number },
): Promise<void> {
  const project = await getProject(projectId);
  if (!project) return; // Projekt waehrenddessen geloescht — nichts zu schreiben
  const evalState = mutate(project, project.learning.eval ?? { status: 'idle' });
  const extra = alsoUpdate?.(project) ?? {};
  await updateProject(projectId, {
    ...(extra.guidelines !== undefined ? { guidelines: extra.guidelines } : {}),
    learning: {
      ...project.learning,
      ...(extra.guideline_version !== undefined ? { guideline_version: extra.guideline_version } : {}),
      eval: evalState,
    },
  });
}

/**
 * Champion/Challenger-Guideline-Update (Hintergrund): neuen Guidelines-Kandidaten
 * generieren, gegen die Trainingsbeispiele messen und nur bei >= Champion-Accuracy
 * uebernehmen. Bei Eval-Fehlern bleibt der Champion unveraendert (sicherer Default).
 */
export async function runGuidelineUpdate(projectId: string, userId?: string): Promise<void> {
  if (evalLocks.has(projectId)) return;
  evalLocks.add(projectId);
  try {
    const project = await getProject(projectId);
    if (!project) return;

    const allExamples = (await getExamples(projectId)).filter(
      (e) => e.document_text && e.document_text.trim(),
    );
    if (allExamples.length < 1) return;
    const evalSet = allExamples.slice(0, EVAL_CAP); // getExamples sortiert neueste zuerst
    const model = evalModelLabel(project);
    const setHash = evalSetHash(evalSet.map((e) => e.id), model, EVAL_CAP);

    await persistEvalState(projectId, (_p, s) => ({
      ...s,
      status: 'running',
      started_at: new Date().toISOString(),
    }));

    console.log(`[Extraction] Guideline-Update fuer ${projectId} (${evalSet.length} Eval-Beispiele)...`);

    // 1) Kandidat generieren (aus ALLEN Beispielen, wie bisher).
    const candidate = await generateGuidelines(project, allExamples, userId);

    // 2) Champion-Score: Cache nutzen, wenn Eval-Set + Version unveraendert.
    const cached = project.learning.eval?.champion;
    let champion: EvalScore | null = null;
    if (
      cached &&
      cached.eval_set_hash === setHash &&
      cached.guideline_version === project.learning.guideline_version
    ) {
      champion = cached;
    } else {
      const measured = await runEval(project, project.guidelines, evalSet, userId);
      if (measured.failed) {
        await finishWithError(projectId, evalSet.length, measured.failures);
        return;
      }
      champion = measured;
    }

    // 3) Challenger messen.
    const challenger = await runEval(project, candidate, evalSet, userId);
    const decision = decideAcceptance(champion?.overall ?? null, challenger);
    const now = new Date().toISOString();

    if (decision.reason === 'error') {
      await finishWithError(projectId, evalSet.length, challenger.failures);
      return;
    }

    if (decision.accept) {
      await persistEvalState(
        projectId,
        (p, s) => ({
          status: 'idle',
          champion: {
            overall: challenger.overall,
            by_field: challenger.by_field,
            examples: challenger.examples,
            eval_set_hash: setHash,
            guideline_version: p.learning.guideline_version + 1,
            model,
            at: now,
          },
          last_run: {
            at: now,
            action: decision.reason === 'no-champion' ? 'initial' : 'accepted',
            challenger_overall: challenger.overall,
            champion_overall: champion?.overall,
            examples: challenger.examples,
          },
          history: pushHistory(s, {
            at: now,
            action: decision.reason === 'no-champion' ? 'initial' : 'accepted',
            champion: champion?.overall,
            challenger: challenger.overall,
            examples: challenger.examples,
            version: p.learning.guideline_version + 1,
          }),
        }),
        (p) => ({ guidelines: candidate, guideline_version: p.learning.guideline_version + 1 }),
      );
      console.log(`[Extraction] Guidelines ${projectId} uebernommen (${challenger.overall}% vs. ${champion?.overall ?? '—'}%)`);
    } else {
      await persistEvalState(projectId, (p, s) => ({
        status: 'idle',
        // Frisch gemessenen Champion-Score cachen (auch bei Ablehnung wertvoll).
        champion: champion
          ? {
              overall: champion.overall,
              by_field: champion.by_field,
              examples: champion.examples,
              eval_set_hash: setHash,
              guideline_version: p.learning.guideline_version,
              model,
              at: now,
            }
          : s.champion,
        last_run: {
          at: now,
          action: 'rejected',
          challenger_overall: challenger.overall,
          champion_overall: champion?.overall,
          examples: challenger.examples,
        },
        history: pushHistory(s, {
          at: now,
          action: 'rejected',
          champion: champion?.overall,
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
async function finishWithError(projectId: string, total: number, failures: number): Promise<void> {
  const now = new Date().toISOString();
  const message = `${failures} von ${total} Eval-Extraktionen fehlgeschlagen — Regeln unveraendert`;
  console.warn(`[Extraction] Eval ${projectId}: ${message}`);
  await persistEvalState(projectId, (_p, s) => ({
    ...s,
    status: 'idle',
    last_run: { at: now, action: 'error', message },
    history: pushHistory(s, { at: now, action: 'error' }),
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
  const examples = (await getExamples(projectId)).filter((e) => e.document_text?.trim());
  if (examples.length < 1) throw new Error('Mindestens 1 Trainingsbeispiel benoetigt');

  void (async () => {
    evalLocks.add(projectId);
    try {
      const evalSet = examples.slice(0, EVAL_CAP);
      const model = evalModelLabel(project);
      const setHash = evalSetHash(evalSet.map((e) => e.id), model, EVAL_CAP);
      await persistEvalState(projectId, (_p, s) => ({
        ...s,
        status: 'running',
        started_at: new Date().toISOString(),
      }));
      const measured = await runEval(project, project.guidelines, evalSet, userId);
      const now = new Date().toISOString();
      if (measured.failed) {
        await finishWithError(projectId, evalSet.length, measured.failures);
        return;
      }
      await persistEvalState(projectId, (p, s) => ({
        status: 'idle',
        champion: {
          overall: measured.overall,
          by_field: measured.by_field,
          examples: measured.examples,
          eval_set_hash: setHash,
          guideline_version: p.learning.guideline_version,
          model,
          at: now,
        },
        last_run: { at: now, action: 'measured', champion_overall: measured.overall, examples: measured.examples },
        history: pushHistory(s, {
          at: now,
          action: 'measured',
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
  // Save example
  const example = await saveExample(projectId, {
    source_filename: data.source_filename,
    document_text: data.document_text,
    initial_extraction: data.initial_extraction,
    corrected_extraction: data.corrected_extraction,
  });

  // Update project learning metadata
  const allExamples = await getExamples(projectId);
  const totalExamples = allExamples.length;
  const correctExamples = allExamples.filter(e => e.confirmed_correct).length;
  const accuracyEstimate = totalExamples > 0 ? Math.round((correctExamples / totalExamples) * 100) : 0;

  const project = await getProject(projectId);
  if (!project) {
    throw new Error(`Projekt "${projectId}" nicht gefunden`);
  }

  // Kalibrierung fortschreiben (Welle 3), wenn Konfidenzen mitkamen.
  const calibration =
    data.field_confidences && Object.keys(data.field_confidences).length > 0
      ? updateCalibration(
          project.learning.calibration,
          project,
          data.initial_extraction,
          data.corrected_extraction,
          data.field_confidences,
        )
      : project.learning.calibration;

  await updateProject(projectId, {
    learning: {
      ...project.learning, // eval-Zustand + guideline_version erhalten
      total_examples: totalExamples,
      accuracy_estimate: accuracyEstimate,
      ...(calibration ? { calibration } : {}),
    },
  });

  // Guideline-Update im Hintergrund (fire-and-forget) — Eval dauert zu lang
  // fuer den HTTP-Request. Das UI pollt learning.eval.status.
  let guidelinesUpdate: 'started' | 'none' = 'none';
  if (totalExamples >= 3 && !example.confirmed_correct && !evalLocks.has(projectId)) {
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
