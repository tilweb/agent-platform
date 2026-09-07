import { validateSegmentPlan, segmentIdentity, segmentExamples } from './corrections';
/**
 * Gescopte Extraktion je Segment (W10.2).
 *
 * Ablauf (Konzept §5): Seiten klassifizieren (segmenter.ts) → je
 * `extract`-Segment ein Sub-PDF (buildPartPdf, poppler) durch die BESTEHENDE
 * Pipeline mit dem Sub-Schema des Segmenttyps → Ergebnisse aggregieren.
 * Es entsteht kein neuer Extraktionscode — Merger, OCR-Fusion, Boxen,
 * Konfidenzen, Kataloge gelten je Segment unveraendert.
 *
 * Namespaces im Ergebnis:
 *   data:             { <segId>: {..}, <repeatableId>: [{..}, ...] }
 *   fieldConfidences: "segId.feld" bzw. "segId[2].feld" (Instanz 1-basiert)
 *   boxes:            gleiche Schluessel, `page` ist ABSOLUT (Dokumentseite) —
 *                     Boxen sind normiert (0..1) und passen damit auf jede
 *                     Aufloesung derselben Seite.
 *
 * Paket C: segmentbezogene Beispielkontexte, gelernte Anweisungen und
 * inkrementelle Neuauslesung nach bestätigter Seitenzuordnung. Fachliche
 * lokale und dokumentweite Regeln werden im Service abschließend geprüft.
 */

import { writeFile, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type { ExtractionProject, SegmentInstance, SegmentTypeDef, RuleIssue, TrainingExample } from '../learning/types';
import { extractionProjectToExtractionSchema } from '../learning/pipeline-adapter';
import { PROJECT_FIELD_GROUP } from '../learning/pipeline-adapter';
import { applyCatalogs } from '../learning/catalog';
import { dedupeListItems } from '../learning/list-utils';
import { runPipeline } from '../../services/extraction/pipeline';
import type { PreparedFile, FieldBox, PageImage } from '../../services/extraction/types';
import { registerPdfView, renderPdfToImages, countPdfPages, pdfToLayoutText } from '../../services/extraction/pdf';
import { buildPartPdf } from '../../services/extraction/pdf-split';
import { classifySegmentPages, buildSegments } from './segmenter';

export interface SegmentExtractionResult {
  segments: SegmentInstance[];
  data: Record<string, unknown>;
  fieldConfidences: Record<string, number>;
  boxes: Record<string, FieldBox>;
  pageImages: PageImage[];
  validations: RuleIssue[];
  llmCalls: number;
  segmentContexts?: Record<string, string>;
}

/** "segId" bzw. "segId[2]" — Instanz-Namespace nur fuer repeatable-Typen. */
function segKey(seg: SegmentInstance, def: SegmentTypeDef | undefined): string {
  return def?.repeatable ? `${seg.type}[${seg.instance}]` : seg.type;
}

export async function extractWithSegments(
  project: ExtractionProject,
  rawBuffer: Buffer,
  userId: string,
  resolveCatalogValues: Parameters<typeof applyCatalogs>[2],
  examples: TrainingExample[] = [],
  correction?: { segments: unknown; previous: SegmentExtractionResult; run?: typeof runPipeline },
): Promise<SegmentExtractionResult> {
  const defs = project.segments ?? {};

  // 1. Seiten rendern (150 dpi — Klassifikation vertraegt das, W9-Messung)
  //    + klassifizieren + Grenzen bilden.
  const pageCount = await countPdfPages(rawBuffer);
  const limit = project.extraction?.max_pages ?? 500;
  if (pageCount > limit) throw new Error(`Segmentierung unvollständig: ${pageCount} Seiten überschreiten das Limit ${limit}.`);
  const pages = await renderPdfToImages(rawBuffer, { dpi: 150, maxPages: limit });
  if (pages.length !== pageCount) throw new Error('Nicht alle Seiten konnten für die Segmentierung gelesen werden.');
  const proposed = correction ? { segments: validateSegmentPlan(project, correction.segments, pageCount), findings: [] }
    : buildSegments(await classifySegmentPages(pages.map(p => ({ page: p.pageNumber, pngBuffer: p.pngBuffer })), defs, { model: project.extraction?.model_override ?? undefined }), defs);
  const { segments, findings } = proposed;
  let llmCalls = correction ? 0 : pages.length;
  const segmentContexts: Record<string, string> = {};

  const validations: RuleIssue[] = findings.map((f) => ({
    rule_id: 'segmentierung',
    type: 'segment',
    severity: f.severity,
    message: f.message,
    fields: [],
  }));

  // Seitenbilder fuers Review (alle Seiten, inkl. classify-only/leerseite).
  const pageImages: PageImage[] = pages.map((p) => ({
    page: p.pageNumber,
    dataUri: `data:image/png;base64,${p.pngBuffer.toString('base64')}`,
    width: p.width,
    height: p.height,
  }));

  const data: Record<string, unknown> = {};
  const fieldConfidences: Record<string, number> = {};
  const boxes: Record<string, FieldBox> = {};

  // 2. Sub-PDF-Quelle einmal auf Platte (buildPartPdf arbeitet dateibasiert).
  const tmpDir = await mkdtemp(join(tmpdir(), 'segment-extract-'));
  const pdfPath = join(tmpDir, 'dokument.pdf');
  await writeFile(pdfPath, rawBuffer);

  try {
    for (const seg of segments) {
      const def = defs[seg.type];
      if (!def) continue;  // leerseite/unbekannt: nur ausweisen, nichts extrahieren

      const key = segKey(seg, def);

      // classify-only (oder ohne Feldsatz): Kurzbeleg aus der Klassifikation —
      // bewusst OHNE zusaetzlichen Modellaufruf (Konzept §5).
      if (def.mode === 'classify-only' || !def.fields || Object.keys(def.fields).length === 0) {
        seg.summary = `${def.label}, Seite${seg.pageFrom === seg.pageTo ? ` ${seg.pageFrom}` : `n ${seg.pageFrom}–${seg.pageTo}`}`;
        appendData(data, seg, def, { _beleg: seg.summary });
        continue;
      }

      const unchanged = correction?.previous.segments.find(old => segmentIdentity(old) === segmentIdentity(seg));
      if (unchanged) {
        const oldKey = segKey(unchanged, def);
        const oldData = correction!.previous.data[seg.type];
        const values = def.repeatable ? (oldData as Record<string, unknown>[])?.[unchanged.instance - 1] : oldData;
        if (values && typeof values === 'object') {
          appendData(data, seg, def, structuredClone(values as Record<string, unknown>));
          for (const [path, value] of Object.entries(correction!.previous.fieldConfidences)) if (path.startsWith(`${oldKey}.`)) fieldConfidences[`${key}${path.slice(oldKey.length)}`] = value;
          for (const [path, value] of Object.entries(correction!.previous.boxes)) if (path.startsWith(`${oldKey}.`)) boxes[`${key}${path.slice(oldKey.length)}`] = value;
          for (const issue of correction!.previous.validations) if ((issue.rule_id === 'verarbeitung' || issue.rule_id === 'ocr-abgleich') && issue.fields.some(field => field === oldKey || field.startsWith(`${oldKey}.`))) validations.push({ ...issue, fields: issue.fields.map(field => field.startsWith(oldKey) ? `${key}${field.slice(oldKey.length)}` : field) });
          segmentContexts[key] = correction!.previous.segmentContexts?.[oldKey] ?? '';
          continue;
        }
      }

      // 3. Gescopter Pipeline-Lauf: Sub-PDF + Sub-Schema des Segmenttyps.
      const subPdf = await buildPartPdf(pdfPath, seg.pageFrom, seg.pageTo);
      registerPdfView(subPdf, rawBuffer, seg.pageFrom, seg.pageTo, limit);
      try { segmentContexts[key] = await pdfToLayoutText(subPdf); } catch { segmentContexts[key] = ''; }
      const schema = extractionProjectToExtractionSchema(
        {
          ...project,
          fields: def.fields,
          segments: undefined,
          guidelines: project.guidelines,
          instructions: `${project.instructions ?? ''}\nEs wird ausschließlich Abschnitt ${seg.type} (${def.label}) ausgelesen. Andere Abschnittstypen und ihre Regeln ignorieren.`,
          learning: { ...project.learning, total_examples: 0 },
        },
        segmentExamples(project, seg.type, examples),
      );
      const files: PreparedFile[] = [{
        filename: `${key}.pdf`,
        text: '',
        mimeType: 'application/pdf',
        rawBuffer: subPdf,
      }];
      const result = await (correction?.run ?? runPipeline)({ files, schema, userId });
      llmCalls += result.llmCalls;

      // 4. Entpacken (synthetische Gruppe aufloesen) + Listen-Dedupe wie im
      //    segmentlosen Pfad.
      const segData: Record<string, unknown> = {
        ...((result.extracted[PROJECT_FIELD_GROUP] ?? {}) as Record<string, unknown>),
      };
      for (const [fieldId, field] of Object.entries(def.fields)) {
        if (field.type !== 'list') continue;
        const raw = result.extracted[fieldId];
        segData[fieldId] = dedupeListItems(Array.isArray(raw) ? raw : [], field.item_fields ?? {});
      }

      // Kataloge je Segment (Welle 6 gilt je Segment weiter).
      const catalogIssues = await applyCatalogs(
        { ...project, fields: def.fields } as ExtractionProject,
        segData,
        resolveCatalogValues,
      );
      for (const issue of catalogIssues) {
        validations.push({ ...issue, fields: issue.fields.map(field => `${key}.${field}`), message: `${def.label}: ${issue.message}` });
      }

      appendData(data, seg, def, segData);

      // 5. Konfidenzen + Boxen in den Namespace heben; Box-Seiten auf
      //    ABSOLUTE Dokumentseiten mappen (Sub-PDF Seite 1 = seg.pageFrom).
      const prefix = `${PROJECT_FIELD_GROUP}.`;
      for (const [path, conf] of Object.entries(result.fieldConfidences)) {
        const flat = path.startsWith(prefix) ? path.slice(prefix.length) : path;
        fieldConfidences[`${key}.${flat}`] = conf;
      }
      for (const [path, box] of Object.entries(result.boxes ?? {})) {
        const flat = path.startsWith(prefix) ? path.slice(prefix.length) : path;
        boxes[`${key}.${flat}`] = { ...box, page: box.page + seg.pageFrom - 1 };
      }

      for (const finding of result.fusionFindings ?? []) {
        validations.push({ rule_id: 'ocr-abgleich', type: 'ocr', severity: 'warn', message: `${def.label}: ${finding.message}`, fields: [`${key}.${finding.path}`] });
      }
      // Verarbeitungs-Befunde des Segment-Laufs durchreichen.
      for (const i of result.processingIssues ?? []) {
        validations.push({ rule_id: i.code ? `verarbeitung-${i.code}` : 'verarbeitung', type: 'processing', severity: i.severity, message: `${def.label}: ${i.message}`, fields: [key] });
      }
    }
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }

  return { segments, data, fieldConfidences, boxes, pageImages, validations, llmCalls, segmentContexts };
}

/** Haengt Segment-Daten an: repeatable als Array (Instanz-Reihenfolge), sonst Objekt. */
function appendData(
  data: Record<string, unknown>,
  seg: SegmentInstance,
  def: SegmentTypeDef,
  segData: Record<string, unknown>,
): void {
  if (def.repeatable) {
    const arr = (data[seg.type] as unknown[]) ?? [];
    arr.push(segData);
    data[seg.type] = arr;
  } else {
    data[seg.type] = segData;
  }
}
