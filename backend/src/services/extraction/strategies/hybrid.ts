/**
 * Hybrid Strategy — Text-Pass + selektives Vision-Fallback.
 *
 * Ablauf:
 *   1. Long-Text-Chunked auf den combinedText (alle Markdown-Texte aus den Files).
 *   2. Confidence-Scoring liefert pro Feld einen Score [0..1].
 *   3. Felder mit confidence < threshold sammeln. Wenn min. N solche Felder
 *      existieren UND eine PDF-Datei mit rawBuffer vorhanden ist UND
 *      vision_fallback im Schema true ist:
 *        - PDF zu Pages rendern (max max_pages)
 *        - vision-per-page-aehnlicher Pass auf alle gerenderten Seiten
 *        - Merge: Vision-Werte gewinnen fuer low-confidence-Felder; Text-Werte
 *          bleiben fuer high-confidence-Felder.
 *
 * Wenn vision-Pfad nicht ausgeloest oder pdftocairo fehlt → fallback nur
 * Text-Resultat (kein Crash).
 *
 * Cost: long-text-chunked + (optional) zusaetzlich Vision-Calls fuer alle
 * gerenderten Seiten. Bei kleinen Verträgen sehr aehnlich zu long-text-chunked.
 */

import { llmService, type Message, type ChatOptions, type ContentPart, type ImageContentPart } from '../../llm';
import type { UsageContext } from '../../usageTracking';
import { buildFunctionSchema, buildToolChoice } from '../../../extraction/schema-builder';
import { appendGuidelines } from './prompt';
import { validateExtraction } from '../../../extraction/validator';
import {
  StrategyExecutionError,
  type CostEstimate,
  type ExtractionStrategy,
  type FieldProvenance,
  type LLMResponseLog,
  type ProgressEmit,
  type StrategyInput,
  type StrategyResult,
} from '../types';
import { longTextChunkedStrategy } from './long-text-chunked';
import { isPdfRendererAvailable, renderPdfToImages, type PdfPageImage } from '../pdf';
import { mergeChunks, type ChunkExtraction } from '../merger';
import { scoreConfidences } from '../confidence';
import { HYBRID_VISION_MIN_LOW_CONFIDENCE_FIELDS_PER_PAGE } from '../defaults';

function detectMimeFromBuffer(buf: Buffer): string {
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  return 'image/png';
}

async function pLimit<T, R>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (true) {
      const idx = next;
      next += 1;
      if (idx >= items.length) return;
      results[idx] = await worker(items[idx]!, idx);
    }
  });
  await Promise.all(runners);
  return results;
}

interface VisionPagePass {
  pageNumber: number;
  data: Record<string, unknown>;
}

async function runVisionPass(
  input: StrategyInput,
  pages: PdfPageImage[],
  emit: ProgressEmit,
): Promise<{ pageData: VisionPagePass[]; llmCalls: number; logs: LLMResponseLog[] }> {
  const functionSchema = buildFunctionSchema(input.schema.profile);
  const toolChoice = buildToolChoice(input.schema.profile);

  const systemPrompt = appendGuidelines(`Du bist Daten-Extraktions-Spezialist mit Bildverstehen. Du siehst EINE Seite eines Dokuments und extrahierst alle sichtbaren Felder. Wenn ein Feld auf dieser Seite nicht zu sehen ist → null. Auch Handschrift, Stempel, Unterschriften erfassen.`, input.schema.profile);

  const options: ChatOptions = {
    userId: input.userId,
    toolChoice: toolChoice as ChatOptions['toolChoice'],
  };

  const usageContext: UsageContext = {
    userId: input.userId,
    source: 'extraction',
    operation: 'hybrid_vision_fallback',
  };

  const logs: LLMResponseLog[] = [];
  let logCounter = 0;

  const pageData = await pLimit(pages, input.schema.config.max_concurrent, async (page, idx) => {
    await emit({ phase: 'extracting', chunkIndex: idx, chunkTotal: pages.length, pageIndex: page.pageNumber, pageTotal: pages.length });

    const mimeType = detectMimeFromBuffer(page.pngBuffer);
    const base64 = page.pngBuffer.toString('base64');
    const dataUri = `data:${mimeType};base64,${base64}`;

    const imagePart: ImageContentPart = {
      type: 'image_url',
      image_url: { url: dataUri, detail: input.schema.config.vision_detail },
    };

    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: `Seite ${page.pageNumber}\n\nExtrahiere alle sichtbaren Felder.` } as ContentPart,
          imagePart,
        ],
      },
    ];

    const t0 = Date.now();
    const response = await llmService.chat(messages, [functionSchema], usageContext, options);
    const durationMs = Date.now() - t0;

    let data: Record<string, unknown> = {};
    if (response.tool_calls && response.tool_calls.length > 0) {
      const args = response.tool_calls[0]!.function.arguments;
      try { data = JSON.parse(args); } catch {
        console.warn(`[hybrid-vision-fallback] Seite ${page.pageNumber}: ungueltiges Function-Call-JSON.`);
      }
    } else if (response.content) {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { data = JSON.parse(jsonMatch[0]); } catch { /* noop */ }
      }
    }

    logCounter += 1;
    logs.push({ call: logCounter, phase: 'vision-fallback', duration_ms: durationMs, truncated: false });

    return { pageNumber: page.pageNumber, data };
  });

  return { pageData, llmCalls: pageData.length, logs };
}

function findPdfFile(input: StrategyInput): { buffer: Buffer; filename: string } | null {
  for (const f of input.files) {
    if (!f.rawBuffer) continue;
    const isPdf = f.mimeType === 'application/pdf' || f.filename.toLowerCase().endsWith('.pdf');
    if (isPdf) return { buffer: f.rawBuffer, filename: f.filename };
  }
  return null;
}

/**
 * Sammelt alle Felder, deren confidence unter dem schwellwert liegt.
 * Returnt einen Set von dotted paths.
 */
function collectLowConfidenceFields(
  confidences: Record<string, number>,
  threshold: number,
): Set<string> {
  const set = new Set<string>();
  for (const [path, score] of Object.entries(confidences)) {
    if (score < threshold) set.add(path);
  }
  return set;
}

/**
 * Merged: Vision-Werte gewinnen fuer low-confidence-Felder; Text-Werte bleiben
 * fuer high-confidence-Felder.
 */
function mergeTextAndVision(
  textResult: Record<string, unknown>,
  visionPages: VisionPagePass[],
  lowConfidenceFields: Set<string>,
  profile: StrategyInput['schema']['profile'],
): { merged: Record<string, unknown>; provenance: FieldProvenance[] } {
  // Vision-Daten via Merger ueber Pages (union fuer Arrays, first-non-null fuer Skalare)
  const visionChunks: ChunkExtraction[] = visionPages.map((p) => ({
    chunkIndex: p.pageNumber,
    data: p.data,
  }));
  const { merged: visionMerged, provenance: visionProvenance } = mergeChunks(visionChunks, profile, 'first-non-null');

  // Resultat: Text-Werte fuer high-confidence-Felder + Vision fuer low-confidence
  const result = JSON.parse(JSON.stringify(textResult)) as Record<string, unknown>;
  const provenance: FieldProvenance[] = [];

  function pickValue(obj: unknown, path: string[]): unknown {
    let cursor: unknown = obj;
    for (const k of path) {
      if (cursor === null || cursor === undefined || typeof cursor !== 'object') return undefined;
      cursor = (cursor as Record<string, unknown>)[k];
    }
    return cursor;
  }
  function setValue(obj: Record<string, unknown>, path: string[], value: unknown): void {
    let cursor: Record<string, unknown> = obj;
    for (let i = 0; i < path.length - 1; i += 1) {
      const key = path[i]!;
      if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {};
      cursor = cursor[key] as Record<string, unknown>;
    }
    cursor[path[path.length - 1]!] = value;
  }

  // Iteriere ueber alle Felder im Profile
  for (const [groupName, groupSpec] of Object.entries(profile.fields)) {
    const isArray = '_array' in groupSpec && groupSpec._array === true;
    if (isArray) {
      const textValue = pickValue(textResult, [groupName]);
      const visionValue = pickValue(visionMerged, [groupName]);
      const fieldPath = groupName;
      if (lowConfidenceFields.has(fieldPath) && visionValue !== undefined && visionValue !== null) {
        setValue(result, [groupName], visionValue);
        const visProv = visionProvenance.find((p) => p.field === fieldPath);
        provenance.push({
          field: fieldPath,
          value: visionValue,
          source: visProv?.source.replace(/^c:/, 'p:') ?? 'p:vision',
          confidence: 0.85,  // Vision-Override gibt einen Standard-Boost
        });
      } else if (textValue !== undefined && textValue !== null) {
        provenance.push({ field: fieldPath, value: textValue, source: 'text', confidence: 1.0 });
      }
      continue;
    }
    const group = groupSpec as Record<string, unknown>;
    for (const fieldName of Object.keys(group)) {
      const path = [groupName, fieldName];
      const fieldPath = path.join('.');
      const textValue = pickValue(textResult, path);
      const visionValue = pickValue(visionMerged, path);
      if (lowConfidenceFields.has(fieldPath) && visionValue !== undefined && visionValue !== null && visionValue !== '') {
        setValue(result, path, visionValue);
        const visProv = visionProvenance.find((p) => p.field === fieldPath);
        provenance.push({
          field: fieldPath,
          value: visionValue,
          source: visProv?.source.replace(/^c:/, 'p:') ?? 'p:vision',
          confidence: 0.85,
        });
      } else if (textValue !== undefined && textValue !== null && textValue !== '') {
        provenance.push({ field: fieldPath, value: textValue, source: 'text', confidence: 1.0 });
      }
    }
  }

  return { merged: result, provenance };
}

export const hybridStrategy: ExtractionStrategy = {
  id: 'hybrid',

  estimateCost(input: StrategyInput): CostEstimate {
    // Text-Pass + (worst case) Vision-Pass auf alle Pages
    const textCost = longTextChunkedStrategy.estimateCost(input);
    const pdf = findPdfFile(input);
    if (!pdf) return textCost;
    const estimatedPages = Math.min(input.schema.config.max_pages, 20);
    return {
      tokens: textCost.tokens + estimatedPages * 2000,
      calls: textCost.calls + estimatedPages,
      etaSeconds: textCost.etaSeconds + estimatedPages * 12,
    };
  },

  async run(input: StrategyInput, emit: ProgressEmit): Promise<StrategyResult> {
    // ============== Pass 1: long-text-chunked ==============
    await emit({ phase: 'preparing' });
    const textResult = await longTextChunkedStrategy.run(input, emit);

    // ============== Entscheidung: Vision-Fallback noetig? ==============
    const threshold = input.schema.config.confidence_threshold;
    const lowConfidenceFields = collectLowConfidenceFields(textResult.fieldConfidences, threshold);

    if (lowConfidenceFields.size === 0) {
      // Alles ok, kein Fallback noetig
      return { ...textResult, strategyUsed: 'hybrid' };
    }

    const visionFallbackEnabled = input.schema.config.vision_fallback;
    const pdf = findPdfFile(input);
    if (!visionFallbackEnabled || !pdf) {
      // Fallback aus oder kein PDF → Text-Resultat behalten, aber als hybrid markieren
      return { ...textResult, strategyUsed: 'hybrid' };
    }

    if (!(await isPdfRendererAvailable())) {
      console.warn('[hybrid] Vision-Fallback gewuenscht, aber pdftocairo nicht installiert. Behalte Text-Resultat.');
      return { ...textResult, strategyUsed: 'hybrid' };
    }

    // ============== Pass 2: Vision-Fallback ==============
    await emit({ phase: 'fallback', reason: `${lowConfidenceFields.size} Felder unter Confidence ${threshold} — starte Vision-Fallback.` });

    let pages: PdfPageImage[];
    try {
      pages = await renderPdfToImages(pdf.buffer, {
        dpi: 200,
        maxPages: input.schema.config.max_pages,
      });
    } catch (err) {
      console.warn('[hybrid] PDF-Render fehlgeschlagen, behalte Text-Resultat:', err instanceof Error ? err.message : err);
      return { ...textResult, strategyUsed: 'hybrid' };
    }

    if (pages.length === 0) {
      return { ...textResult, strategyUsed: 'hybrid' };
    }

    const visionPass = await runVisionPass(input, pages, emit);

    // ============== Merge: Text + Vision ==============
    await emit({ phase: 'merging', fieldsMerged: 0, fieldsTotal: lowConfidenceFields.size });
    const { merged, provenance } = mergeTextAndVision(
      textResult.extracted,
      visionPass.pageData,
      lowConfidenceFields,
      input.schema.profile,
    );

    // ============== Re-Score Confidence ==============
    // Vision-Overrides bekommen 0.85-Standard; ungenutzte Vision-Felder behalten ihre Text-Confidence.
    const visionChunks: ChunkExtraction[] = visionPass.pageData.map((p) => ({
      chunkIndex: p.pageNumber,
      data: p.data,
    }));
    const { confidences: newConfidences, llmCalls: confidenceCalls } = await scoreConfidences(
      visionChunks,
      merged,
      input.schema.profile,
      input.userId,
      { useLLM: false },  // Reine Heuristik — wir haben schon Text-Confidences als Baseline
    );

    // Heuristik allein reicht hier nicht — wir behalten Text-Confidence wo Vision NICHT eingegriffen hat,
    // und 0.85 (Vision-Override-Default) wo Vision uebernommen hat.
    const finalConfidences: Record<string, number> = { ...textResult.fieldConfidences };
    for (const p of provenance) {
      if (p.source.startsWith('p:vision') || p.source.startsWith('p:')) {
        finalConfidences[p.field] = 0.85;
      } else {
        finalConfidences[p.field] = textResult.fieldConfidences[p.field] ?? newConfidences[p.field] ?? 0.5;
      }
    }

    // Provenance um Confidence anreichern
    for (const p of provenance) {
      p.confidence = finalConfidences[p.field] ?? p.confidence;
    }

    const validation = validateExtraction(merged, input.schema.profile);
    const warnings = validation.errors.map((e) => `${e.field}: ${e.message}`);
    await emit({ phase: 'validating', warningCount: warnings.length });

    return {
      extracted: merged,
      fieldConfidences: finalConfidences,
      provenance,
      warnings,
      llmCalls: textResult.llmCalls + visionPass.llmCalls + confidenceCalls,
      strategyUsed: 'hybrid',
      raw_responses: [...(textResult.raw_responses ?? []), ...visionPass.logs],
    };
  },
};

// HYBRID_VISION_MIN_LOW_CONFIDENCE_FIELDS_PER_PAGE wird heute nicht direkt
// benutzt — wir rendern immer alle (begrenzten) Pages und ueberlassen dem Merger
// die Entscheidung, welches Feld uebernommen wird. Die Konstante wird in einer
// spaeteren Optimierung verwendet (selektive Page-Rendering).
void HYBRID_VISION_MIN_LOW_CONFIDENCE_FIELDS_PER_PAGE;
