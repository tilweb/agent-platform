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
 * Bewusste W10.2-Grenzen (dokumentiert):
 *   - Few-Shot/Guidelines des Profils beziehen sich auf Gesamtdokumente und
 *     werden fuer Segment-Laeufe NICHT injiziert (nur `instructions`).
 *   - Pruefregeln (rules) haengen an Projekt-Feldern, nicht an Segmenten —
 *     fuer Segment-Profile laufen nur die Feld-Kataloge je Segment.
 */

import { writeFile, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type { ExtractionProject, SegmentInstance, SegmentTypeDef, RuleIssue } from '../learning/types';
import { extractionProjectToExtractionSchema } from '../learning/pipeline-adapter';
import { PROJECT_FIELD_GROUP } from '../learning/pipeline-adapter';
import { applyCatalogs } from '../learning/catalog';
import { dedupeListItems } from '../learning/list-utils';
import { runPipeline } from '../../services/extraction/pipeline';
import type { PreparedFile, FieldBox, PageImage } from '../../services/extraction/types';
import { renderPdfToImages } from '../../services/extraction/pdf';
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
): Promise<SegmentExtractionResult> {
  const defs = project.segments ?? {};

  // 1. Seiten rendern (150 dpi — Klassifikation vertraegt das, W9-Messung)
  //    + klassifizieren + Grenzen bilden.
  const pages = await renderPdfToImages(rawBuffer, { dpi: 150 });
  const classifications = await classifySegmentPages(
    pages.map((p) => ({ page: p.pageNumber, pngBuffer: p.pngBuffer })),
    defs,
  );
  const { segments, findings } = buildSegments(classifications, defs);
  let llmCalls = pages.length;

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

      // 3. Gescopter Pipeline-Lauf: Sub-PDF + Sub-Schema des Segmenttyps.
      const subPdf = await buildPartPdf(pdfPath, seg.pageFrom, seg.pageTo);
      const schema = extractionProjectToExtractionSchema(
        {
          ...project,
          fields: def.fields,
          segments: undefined,
          guidelines: '',           // Few-Shot/gelernte Regeln sind Gesamtdokument-bezogen
          learning: { ...project.learning, total_examples: 0 },
        },
        [],
      );
      const files: PreparedFile[] = [{
        filename: `${key}.pdf`,
        text: '',
        mimeType: 'application/pdf',
        rawBuffer: subPdf,
      }];
      const result = await runPipeline({ files, schema, userId });
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
        validations.push({ ...issue, message: `${def.label}: ${issue.message}` });
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

      // Verarbeitungs-Befunde des Segment-Laufs durchreichen.
      for (const i of result.processingIssues ?? []) {
        validations.push({ rule_id: 'verarbeitung', type: 'processing', severity: i.severity, message: `${def.label}: ${i.message}`, fields: [] });
      }
    }
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }

  return { segments, data, fieldConfidences, boxes, pageImages, validations, llmCalls };
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
