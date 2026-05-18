/**
 * Vertragsmanagement Import Service — Multi-File-Pipeline mit Auto-Detection.
 *
 * Phasen:
 *   1+2 (shared): file-zu-text via multiFileImporter (Vision/Markitdown/xlsx-Reorder)
 *   2.5: Klassifikator-LLM-Call → detected contractType + per-file document_role
 *        Vorschlag, plus Confidence + Alternatives
 *   3:   Function-Calling-Extraktion mit dynamisch aus dem Vertragstyp-Schema
 *        gebauten ExtractionProfile
 *   4:   Validation + Auto-Correction (shared `validateExtraction`)
 *   5:   Multi-Attachment-Upload zu S3 + Contract anlegen mit attachments[],
 *        primary_attachment_id, type_detection, provenance
 *
 * Re-Extraktion (`reextractContract`): falls der User nach dem Import den
 * Vertragstyp aendert, wird Phase 3-5 mit dem neuen Schema nochmal ausgefuehrt.
 * Markdown bleibt im S3 cached — Phase 1+2 wird NICHT wiederholt. Alter Stand
 * (`extracted` + `contract_type`) wird in `extracted_history[]` archiviert.
 */

import { llmService, type Message } from '../../services/llm';
import type { UsageContext } from '../../services/usageTracking';
import { runPipeline, type PreparedFile } from '../../services/extraction';
import { contractSchemaToExtractionSchema } from './extraction-adapter';
import {
  processFilesToText,
  withHeartbeat,
  HEARTBEAT_MS,
  type FileImportEvent,
  type FileImportEventCallback,
  type FileImportReport,
  type ProcessedFile,
} from '../../services/multiFileImporter';
import {
  generateContractId,
  generateAttachmentId,
  saveContract,
  saveAttachmentWithBytes,
  getContract,
  getContractDocument,
  saveContractDocument,
  getSchemas,
  getSchema,
} from './storage';
import { computeDerivedFields, extractObligations } from './extraction';
import type {
  ContractMetadata,
  ContractAttachment,
  ContractDocumentRole,
  ContractTypeDetection,
  ContractSchema,
  ContractExtractionSnapshot,
} from '../types';

// ============== Types ==============

export interface ImportReport extends FileImportReport {
  fieldsExtracted: number;
}

export type ImportEvent =
  | FileImportEvent
  | { type: 'classifying';        data: { schemasCount: number } }
  | { type: 'classifying_progress'; data: { elapsedMs: number } }
  | { type: 'classifying_done';   data: { detected: string; confidence: number; durationMs: number } }
  | { type: 'extracting_started'; data: { textChars: number; contractType: string } }
  | { type: 'extracting_progress'; data: { elapsedMs: number } }
  | { type: 'extracting_done';    data: { fieldsExtracted: number; durationMs: number } }
  | { type: 'validating';         data: { warningCount: number } }
  | { type: 'storing';            data: { attachmentCount: number } }
  | { type: 'done';               data: { contract: ContractMetadata; report: ImportReport } }
  | { type: 'error';              data: { message: string } };

export type ImportEventCallback = (event: ImportEvent) => void | Promise<void>;

interface ClassificationResult {
  detected: string;
  confidence: number;
  alternatives: { type: string; confidence: number }[];
  fileRoles: Record<string, ContractDocumentRole>; // filename → role
}

// ============== Helpers ==============

function mergeReport(report: ImportReport, sub: FileImportReport): void {
  report.filesProcessed = sub.filesProcessed;
  report.filesFailed = sub.filesFailed;
  report.errors.push(...sub.errors);
  report.warnings.push(...sub.warnings);
}

// Helper `contractSchemaToProfile` ist nach P2 in `./extraction-adapter.ts`
// gezogen und wird via `contractSchemaToExtractionSchema` aufgerufen.

// ============== Phase 2.5: Klassifikator ==============

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  txt: 'text/plain',
  md: 'text/markdown',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

/**
 * LLM-Klassifikator: bestimmt Vertragstyp + Confidence + Alternativen + pro-File
 * Document-Role-Vorschlag. Robust gegen unbekannte/leere Antworten — fallback
 * auf das wahrscheinlichste verfuegbare Schema.
 */
async function classifyContract(
  combinedText: string,
  filenames: string[],
  schemas: ContractSchema[],
  userId?: string,
): Promise<ClassificationResult> {
  if (schemas.length === 0) {
    return { detected: 'unknown', confidence: 0, alternatives: [], fileRoles: {} };
  }

  const schemaList = schemas.map((s) => `- ${s.id}: ${s.name}`).join('\n');
  const fileList = filenames.map((f) => `- ${f}`).join('\n');

  const messages: Message[] = [
    {
      role: 'system',
      content: `Du bist ein Experte fuer Vertragsanalyse. Klassifiziere ehrlich — lieber eine niedrige Confidence als falsche Sicherheit.

Verfuegbare Vertragstypen (NUR diese sind erlaubt fuer "detected"):
${schemaList}

Confidence-Regeln (KRITISCH):
- 0.90-1.00: das Dokument nennt den Vertragstyp explizit ODER alle Charakteristika sind eindeutig (z.B. "Mietvertrag", Mieter+Vermieter, Mietzins, Kuendigungsfristen).
- 0.70-0.89: starke Indizien aber nicht im Titel genannt — typische Felder + Phrasing passen.
- 0.50-0.69: Mehrdeutigkeit, einer der definierten Typen passt am ehesten aber andere waeren auch denkbar.
- < 0.50: KEIN definierter Typ passt wirklich (z.B. AVV/DSGVO-Auftragsverarbeitung, Geheimhaltungs-Anhang, Werkvertrag wenn nicht definiert) — gib trotzdem den nahestehendsten Typ aber mit Confidence < 0.50 und nutze "alternatives" um andere mit aehnlich niedrigen Werten zu listen.

NIEMALS einen falschen Vertragstyp mit Confidence > 0.70 zurueckgeben nur weil "detected" Pflicht ist.

Verfuegbare Dokument-Rollen:
- hauptvertrag: das zentrale Vertragsdokument
- anhang: rechtsverbindliche Anlage (z.B. SLA, AGB, Preisliste, AVV)
- toolbox: Excel-Tools/Berechnungstabellen
- korrespondenz: Briefe, E-Mail-Auszuege, Begleitnachrichten
- sonstiges: alles andere

Antworte AUSSCHLIESSLICH mit gueltigem JSON nach diesem Schema (keine Markdown-Fences):
{
  "detected": "<schema-id>",
  "confidence": <0..1>,
  "alternatives": [{"type": "<schema-id>", "confidence": <0..1>}],
  "fileRoles": {"<filename>": "<rolle>", ...}
}`,
    },
    {
      role: 'user',
      content: `Folgende Dateien gehoeren zu einem Vertragswerk:
${fileList}

Hier der zusammengefuegte Inhalt (mit File-Markern):

${combinedText}

Bestimme:
1. Den wahrscheinlichsten Vertragstyp (detected) mit Confidence 0..1
2. Bis zu 2 Alternativen mit Confidence
3. Fuer jede Datei oben die wahrscheinlichste Dokument-Rolle`,
    },
  ];

  const usageContext: UsageContext = {
    userId,
    source: 'extraction',
    operation: 'contract_classify',
  };

  const response = await llmService.chat(messages, undefined, usageContext, { userId });
  const content = (response.content || '').trim();

  // JSON aus Antwort extrahieren — Tolerant gegenueber leichten Format-Abweichungen.
  let parsed: Partial<ClassificationResult> = {};
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      parsed = JSON.parse(jsonMatch[0]) as Partial<ClassificationResult>;
    } catch (err) {
      console.warn('[VM-Import] Klassifikator JSON-Parse fehlgeschlagen:', err);
    }
  }

  const validIds = new Set(schemas.map((s) => s.id));
  let detected = parsed.detected ?? '';
  if (!validIds.has(detected)) {
    // Fallback: erstes Schema mit hoechster confidence aus alternatives, sonst erstes überhaupt.
    const firstAlt = (parsed.alternatives ?? []).find((a) => validIds.has(a.type));
    detected = firstAlt?.type ?? schemas[0]!.id;
  }
  const confidence = typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5;
  const alternatives = (parsed.alternatives ?? [])
    .filter((a) => validIds.has(a.type) && a.type !== detected)
    .map((a) => ({ type: a.type, confidence: Math.max(0, Math.min(1, a.confidence ?? 0)) }))
    .slice(0, 3);

  const validRoles: ContractDocumentRole[] = ['hauptvertrag', 'anhang', 'toolbox', 'korrespondenz', 'sonstiges'];
  const fileRoles: Record<string, ContractDocumentRole> = {};
  for (const filename of filenames) {
    const suggested = parsed.fileRoles?.[filename];
    fileRoles[filename] = (suggested && validRoles.includes(suggested as ContractDocumentRole))
      ? (suggested as ContractDocumentRole)
      : 'sonstiges';
  }

  return { detected, confidence, alternatives, fileRoles };
}

// ============== Phase 3: Extraktion ==============
//
// Vollstaendig in `backend/src/services/extraction/` ausgelagert (Phase D / P2).
// Die alte `extractWithSchema`-Funktion ist durch `runPipeline` ersetzt, die
// pro Schema die konfigurierte Strategy (single-pass / long-text-chunked / ...)
// waehlt. Truncation ist nicht mehr moeglich.

function countExtractedFields(data: Record<string, unknown>): number {
  let count = 0;
  for (const value of Object.values(data)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      count += value.length;
    } else if (typeof value === 'object') {
      count += countExtractedFields(value as Record<string, unknown>);
    } else if (typeof value === 'string' && value.trim() === '') {
      // empty string skip
    } else {
      count++;
    }
  }
  return count;
}

// ============== Phase 5: Persistierung ==============

/**
 * Persistiert ein File als Attachment: Storage-Layer (S3 oder YAML) kapselt
 * `saveAttachmentWithBytes`. Beide Worktrees teilen diese Signatur.
 */
async function persistAttachment(
  contractId: string,
  file: { buffer: Buffer; filename: string; mimeType: string },
  markdown: string | null,
  documentRole: ContractDocumentRole,
): Promise<ContractAttachment> {
  const ext = (file.filename.split('.').pop() || 'bin').toLowerCase();
  const contentType = file.mimeType || CONTENT_TYPE_BY_EXT[ext] || 'application/octet-stream';
  return saveAttachmentWithBytes(
    {
      id: generateAttachmentId(),
      contract_id: contractId,
      filename: file.filename,
      content_type: contentType,
      size_bytes: file.buffer.length,
      document_role: documentRole,
      uploaded_at: new Date().toISOString(),
    },
    file.buffer,
    markdown,
  );
}

// ============== Main: importContract ==============

export async function importContract(
  files: { buffer: Buffer; filename: string; mimeType: string }[],
  userId: string,
  onEvent?: ImportEventCallback,
): Promise<{ contract: ContractMetadata; report: ImportReport }> {
  const report: ImportReport = {
    filesProcessed: 0,
    filesFailed: 0,
    fieldsExtracted: 0,
    errors: [],
    warnings: [],
  };
  const emit = onEvent ?? (async () => { /* noop */ });

  console.log(`[VM-Import] Starting import with ${files.length} files`);

  // Phasen 1+2 (shared): file-zu-text + combine
  const { processedFiles, combinedText, report: subReport } = await processFilesToText(files, {
    userId,
    emit: emit as FileImportEventCallback,
    logPrefix: 'VM-Import',
  });
  mergeReport(report, subReport);

  // Phase 2.5: Klassifikator
  const schemas = await getSchemas();
  await emit({ type: 'classifying', data: { schemasCount: schemas.length } });
  const classStart = Date.now();
  const classification = await withHeartbeat(
    classifyContract(combinedText, processedFiles.map((f) => f.filename), schemas, userId),
    HEARTBEAT_MS,
    async (elapsedMs) => { await emit({ type: 'classifying_progress', data: { elapsedMs } }); },
  );
  await emit({
    type: 'classifying_done',
    data: { detected: classification.detected, confidence: classification.confidence, durationMs: Date.now() - classStart },
  });

  // Phase 3: Extraktion via Heavy-Extraction-Pipeline (Phase D / P2).
  // Pipeline waehlt selbst die Strategy aus dem Schema (`extraction.strategy`)
  // und eskaliert bei Bedarf single-pass → long-text-chunked automatisch.
  // Truncation: niemals — Pipeline arbeitet auf processedFiles[].text (volle
  // per-File-Texte), nicht auf dem 30k-gekuerzten combinedText.
  const schema = await getSchema(classification.detected);
  if (!schema) {
    throw new Error(`Klassifikator schlug "${classification.detected}" vor, aber kein Schema gefunden.`);
  }

  const extractionSchema = contractSchemaToExtractionSchema(schema);
  const preparedFiles: PreparedFile[] = processedFiles.map((pf, idx) => ({
    filename: pf.filename,
    text: pf.text,
    mimeType: files[idx]?.mimeType ?? (pf.isImage ? 'image/png' : 'text/plain'),
    rawBuffer: files[idx]?.buffer,
  }));

  await emit({ type: 'extracting_started', data: { textChars: combinedText.length, contractType: schema.id } });
  const extractStart = Date.now();
  const pipelineResult = await runPipeline({
    files: preparedFiles,
    schema: extractionSchema,
    userId,
    emit: async (ev) => {
      // Pipeline-Events → VM-Import-Events mappen.
      if (ev.phase === 'extracting') {
        await emit({
          type: 'extracting_progress',
          data: { elapsedMs: Date.now() - extractStart },
        });
      } else if (ev.phase === 'fallback') {
        report.warnings.push(`Strategy-Eskalation: ${ev.reason}`);
      }
    },
  });
  const extracted = pipelineResult.extracted;
  // Provenance + fieldConfidences werden in P4 persistiert + im UI angezeigt.
  // Heute (P2) verwerfen wir sie — der Roundtrip wurde schon gemacht, nur die
  // Storage- + UI-Anbindung fehlt.

  // Phase 4: Pipeline-Warnings ins Report-Object einsortieren (Pipeline ruft
  // validateExtraction intern auf; wir doppeln nicht).
  for (const w of pipelineResult.warnings) {
    report.warnings.push(`Validierung: ${w}`);
  }
  await emit({ type: 'validating', data: { warningCount: pipelineResult.warnings.length } });

  report.fieldsExtracted = countExtractedFields(extracted);
  await emit({
    type: 'extracting_done',
    data: { fieldsExtracted: report.fieldsExtracted, durationMs: Date.now() - extractStart },
  });

  // Phase 5: Persistierung — Reihenfolge ist wichtig:
  //   a) Skeleton-Contract anlegen (sonst FK-Constraint von attachments greift,
  //      und auf demo/messe ruft saveAttachmentWithBytes→getContract).
  //   b) Attachments persistieren (Bytes + Metadata).
  //   c) Final-Update mit attachments[], primary_attachment_id, type_detection,
  //      computed, obligations, extracted, provenance.
  await emit({ type: 'storing', data: { attachmentCount: files.length } });

  const contractId = generateContractId();
  const computed = computeDerivedFields(extracted, schema);
  const obligations = await extractObligations(
    combinedText,
    { party_a: computed.party_a, party_b: computed.party_b },
    userId,
  );

  // a) Skeleton-Contract — Pflichtfelder fuer FK + spaetere Lookups. Wird
  //    direkt am Ende mit dem finalen Stand ueberschrieben.
  const nowIso = new Date().toISOString();
  const skeleton: ContractMetadata = {
    id: contractId,
    contract_type: schema.id,
    upload_filename: files[0]?.filename ?? 'multi-file-import',
    uploaded_at: nowIso,
    uploaded_by: userId,
    extracted: {},
    computed: {
      party_a: '',
      party_b: '',
      start_date: '',
      end_date: '',
      annual_value: 0,
      status: 'active',
      days_to_expiry: null,
    },
    obligations: [],
    attachments: [],
    primary_attachment_id: null,
    type_detection: null,
    provenance: null,
    extracted_history: [],
  };
  await saveContract(skeleton);

  // Combined markdown ist Quelle fuer Re-Extraktion (ohne Phase 1+2 zu wiederholen).
  await saveContractDocument(contractId, combinedText);

  // b) Attachments persistieren (sequentiell — auf demo/messe wird die
  //    metadata.yaml inkrementell upgedated, parallel waere Race-Condition).
  const filenameToBuffer = new Map(files.map((f) => [f.filename, f]));
  const attachments: ContractAttachment[] = [];
  let primaryAttachmentId: string | null = null;
  for (const proc of processedFiles) {
    const original = filenameToBuffer.get(proc.filename);
    if (!original) continue;
    const role = classification.fileRoles[proc.filename] ?? 'sonstiges';
    const att = await persistAttachment(contractId, original, proc.text, role);
    attachments.push(att);
    if (role === 'hauptvertrag' && !primaryAttachmentId) {
      primaryAttachmentId = att.id;
    }
  }
  if (!primaryAttachmentId && attachments.length > 0) {
    primaryAttachmentId = attachments[0]!.id;
  }

  const typeDetection: ContractTypeDetection = {
    detected: classification.detected,
    confidence: classification.confidence,
    alternatives: classification.alternatives,
    user_corrected: false,
    corrected_at: null,
  };

  // Provenance: pragmatischer Default — alle Hauptvertrag-/Anhang-IDs als
  // Quelle fuer den Gesamtdatensatz. Pro-Feld-Granularitaet kommt mit
  // erweitertem Function-Schema in einer spaeteren Iteration.
  const provenance: Record<string, string[]> = {};
  const sourceAttachmentIds = attachments
    .filter((a) => a.document_role === 'hauptvertrag' || a.document_role === 'anhang')
    .map((a) => a.id);
  if (sourceAttachmentIds.length > 0) {
    provenance['_all'] = sourceAttachmentIds;
  }

  // c) Final-Update mit allem Inhalt.
  const contract: ContractMetadata = {
    ...skeleton,
    upload_filename: attachments.find((a) => a.id === primaryAttachmentId)?.filename
      ?? files[0]?.filename
      ?? 'multi-file-import',
    extracted,
    computed,
    obligations,
    attachments,
    primary_attachment_id: primaryAttachmentId,
    type_detection: typeDetection,
    provenance,
  };
  await saveContract(contract);

  await emit({ type: 'done', data: { contract, report } });
  return { contract, report };
}

// ============== Re-Extraktion ==============

/**
 * Aendert nachtraeglich den Vertragstyp und re-extrahiert mit dem neuen
 * Schema. Phase 1+2 wird NICHT wiederholt (Markdown ist gecached). Alter
 * Stand wird in `extracted_history[]` archiviert.
 */
export async function reextractContract(
  contractId: string,
  newContractType: string,
  userId: string,
  onEvent?: ImportEventCallback,
): Promise<ContractMetadata> {
  const emit = onEvent ?? (async () => { /* noop */ });
  const existing = await getContract(contractId);
  if (!existing) throw new Error(`Vertrag nicht gefunden: ${contractId}`);

  const newSchema = await getSchema(newContractType);
  if (!newSchema) throw new Error(`Vertragstyp nicht gefunden: ${newContractType}`);

  // Markdown aus S3 laden (combined-Text aus dem urspruenglichen Import)
  const combinedText = await getContractDocument(contractId);
  if (!combinedText) throw new Error(`Kein gecachter Vertragstext fuer ${contractId} — Re-Extraktion nicht moeglich.`);

  // Heavy-Extraction-Pipeline (Phase D / P2): re-Extraktion nutzt denselben
  // Strategy-Path wie importContract. Wenn das neue Schema z.B. long-text-chunked
  // verlangt und das gecachte Markdown lang ist, geht es automatisch via Chunking.
  const extractionSchema = contractSchemaToExtractionSchema(newSchema);
  const preparedFiles: PreparedFile[] = [{
    filename: `${contractId}.md`,
    text: combinedText,
    mimeType: 'text/markdown',
  }];

  await emit({ type: 'extracting_started', data: { textChars: combinedText.length, contractType: newSchema.id } });
  const extractStart = Date.now();
  const pipelineResult = await runPipeline({
    files: preparedFiles,
    schema: extractionSchema,
    userId,
    emit: async (ev) => {
      if (ev.phase === 'extracting') {
        await emit({
          type: 'extracting_progress',
          data: { elapsedMs: Date.now() - extractStart },
        });
      }
    },
  });
  const extracted = pipelineResult.extracted;

  await emit({ type: 'validating', data: { warningCount: pipelineResult.warnings.length } });

  const fieldsExtracted = countExtractedFields(extracted);
  await emit({ type: 'extracting_done', data: { fieldsExtracted, durationMs: Date.now() - extractStart } });

  // Alter Stand archivieren
  const archive: ContractExtractionSnapshot = {
    contract_type: existing.contract_type,
    extracted: existing.extracted,
    archived_at: new Date().toISOString(),
  };
  const history = [...(existing.extracted_history ?? []), archive];

  // Type-Detection aktualisieren — als user_corrected markieren
  const typeDetection: ContractTypeDetection = {
    detected: existing.type_detection?.detected ?? newContractType,
    confidence: existing.type_detection?.confidence ?? 0,
    alternatives: existing.type_detection?.alternatives ?? [],
    user_corrected: true,
    corrected_at: new Date().toISOString(),
  };

  const computed = computeDerivedFields(extracted, newSchema);
  const obligations = await extractObligations(
    combinedText,
    { party_a: computed.party_a, party_b: computed.party_b },
    userId,
  );

  const updated: ContractMetadata = {
    ...existing,
    contract_type: newSchema.id,
    extracted,
    computed,
    obligations,
    type_detection: typeDetection,
    extracted_history: history,
  };
  await saveContract(updated);

  const report: ImportReport = {
    filesProcessed: 0,
    filesFailed: 0,
    fieldsExtracted,
    errors: [],
    warnings: pipelineResult.warnings.map((w) => `Validierung: ${w}`),
  };
  await emit({ type: 'done', data: { contract: updated, report } });

  return updated;
}
