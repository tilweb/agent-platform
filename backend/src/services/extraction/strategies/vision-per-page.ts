/**
 * Vision-Per-Page Strategy.
 *
 * Fuer gescannte / handschriftliche Dokumente. Jede Seite des PDFs wird zu
 * einem PNG gerendert (pdftocairo) und an die Vision-LLM geschickt. Die
 * Antworten pro Seite werden via Merger konsolidiert.
 *
 * Verarbeitete File-Typen:
 *   - PDF (mit rawBuffer): pdftocairo → 1 PNG pro Seite → Vision-LLM pro Seite
 *   - Bild (image/*): direkt als 1 Page → Vision-LLM
 *   - Text/Markdown: ignoriert (Vision-Strategy braucht visuelle Quellen)
 *
 * Fehler-Pfad:
 *   - pdftocairo nicht installiert → PdfRenderError. Vision-per-page hat keine
 *     Eskalation (ESCALATION_PATH = null); der Fehler propagiert mit klarem
 *     Installations-Hinweis an den Aufrufer.
 *
 * Cost: O(pages) Vision-Calls. Bei 50-Seiten-Lieferschein: 50 Calls.
 * max_concurrent steuert die Parallelitaet.
 */

import { llmService, type Message, type ChatOptions, type ContentPart, type ImageContentPart } from '../../llm';
import type { UsageContext } from '../../usageTracking';
import { validateExtraction } from '../../../extraction/validator';
import { appendGuidelines } from './prompt';
import { withTimeoutRetry, buildVisionJsonInstruction, parseJsonObject, EXTRACTION_SAMPLING, guidedJsonBody } from '../extract-call';
import { fuseWithOcr, applyFusionToConfidences } from '../fusion';
import { extractionVisionDpi } from '../defaults';
import {
  StrategyExecutionError,
  type CostEstimate,
  type ExtractionStrategy,
  type LLMResponseLog,
  type ProgressEmit,
  type StrategyInput,
  type StrategyResult,
  type FieldBox,
  type PageImage,
} from '../types';
import { mergeChunks, type ChunkExtraction } from '../merger';
import { scoreConfidences } from '../confidence';
import { renderPdfToImages, isPdfRendererAvailable, PdfRenderError, pngDimensions, countPdfPages, type PdfPageImage } from '../pdf';

/**
 * Liefert alle Pages (als PNG-Buffer) ueber alle Files. Pro Page wird ein
 * `pageId` gebaut, der filename + page-number zusammenfasst (fuer Provenance).
 */
interface PageSource {
  pageId: string;            // z.B. "lieferschein.pdf:3"
  pageLabel: string;         // z.B. "Lieferschein.pdf — Seite 3 von 5"
  pngBuffer: Buffer;
  filename: string;
  pageNumber: number;
  width: number;             // Pixel (0 = unbekannt)
  height: number;            // Pixel
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

async function collectPages(
  input: StrategyInput,
  dpi: number,
  maxPages: number,
  issues: Array<{ severity: 'error' | 'warn'; message: string }>,
): Promise<PageSource[]> {
  const out: PageSource[] = [];

  for (const file of input.files) {
    if (!file.rawBuffer) continue;

    const isPdf = file.mimeType === 'application/pdf' || file.filename.toLowerCase().endsWith('.pdf');
    const isImage = file.mimeType.startsWith('image/');

    if (isPdf) {
      const pages = await renderPdfToImages(file.rawBuffer, { dpi, maxPages: maxPages - out.length });
      // Gekappte Seiten wurden bisher STILL verworfen — als Befund melden,
      // sonst liest das Zielsystem ein scheinbar vollstaendiges Ergebnis.
      try {
        const total = await countPdfPages(file.rawBuffer);
        if (total > pages.length) {
          issues.push({
            severity: 'error',
            message: `${file.filename}: nur ${pages.length} von ${total} Seiten verarbeitet (max_pages=${maxPages}) — die restlichen Seiten fehlen im Ergebnis.`,
          });
        }
      } catch { /* pdfinfo nicht verfuegbar — keine Aussage moeglich */ }
      for (const p of pages) {
        out.push({
          pageId: `${file.filename}:${p.pageNumber}`,
          pageLabel: `${file.filename} — Seite ${p.pageNumber} von ${pages.length}`,
          pngBuffer: p.pngBuffer,
          filename: file.filename,
          pageNumber: p.pageNumber,
          width: p.width,
          height: p.height,
        });
      }
    } else if (isImage) {
      // Maße nur fuer PNG bekannt (IHDR); andere Formate → 0 (dann keine Boxen,
      // Bild wird aber trotzdem angezeigt).
      const isPng = file.rawBuffer[0] === 0x89 && file.rawBuffer[1] === 0x50;
      const dims = isPng ? pngDimensions(file.rawBuffer) : { width: 0, height: 0 };
      out.push({
        pageId: `${file.filename}:1`,
        pageLabel: `${file.filename}`,
        pngBuffer: file.rawBuffer,
        filename: file.filename,
        pageNumber: 1,
        width: dims.width,
        height: dims.height,
      });
    }
    // Text/Markdown-Files werden in dieser Strategy nicht beruecksichtigt —
    // Vision braucht visuelle Quellen.
    if (out.length >= maxPages) break;
  }

  return out;
}

function detectMimeFromBuffer(buf: Buffer): string {
  // Magic bytes: PNG = 89 50 4E 47, JPEG = FF D8 FF
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  return 'image/png';
}

export const visionPerPageStrategy: ExtractionStrategy = {
  id: 'vision-per-page',

  estimateCost(input: StrategyInput): CostEstimate {
    // Heuristik: 1 Vision-Call pro Seite. Bei PDFs nehmen wir `pageCount` aus
    // PreparedFile falls vorhanden, sonst eine konservative Schaetzung.
    let pages = 0;
    for (const f of input.files) {
      if (f.pageCount) pages += f.pageCount;
      else if (f.mimeType.startsWith('image/')) pages += 1;
      else if (f.mimeType === 'application/pdf' || f.filename.toLowerCase().endsWith('.pdf')) {
        // Konservative Annahme: 10 Seiten falls nicht bekannt.
        pages += 10;
      }
    }
    pages = Math.min(pages, input.schema.config.max_pages);
    return {
      tokens: pages * 2000,   // Vision-Calls haben hohen Image-Token-Aufschlag
      calls: pages,
      etaSeconds: pages * 12,
    };
  },

  async run(input: StrategyInput, emit: ProgressEmit): Promise<StrategyResult> {
    if (!(await isPdfRendererAvailable())) {
      const anyPdf = input.files.some((f) =>
        f.mimeType === 'application/pdf' || f.filename.toLowerCase().endsWith('.pdf'),
      );
      if (anyPdf) {
        throw new StrategyExecutionError(
          'PDF-Renderer (pdftocairo) ist nicht installiert. Installiere poppler-utils, oder waehle eine text-basierte Strategy.',
        );
      }
    }

    await emit({ phase: 'preparing' });

    const processingIssues: Array<{ severity: 'error' | 'warn'; message: string }> = [];
    let pages: PageSource[];
    try {
      pages = await collectPages(input, extractionVisionDpi(), input.schema.config.max_pages, processingIssues);
    } catch (err) {
      if (err instanceof PdfRenderError) {
        throw new StrategyExecutionError(`PDF-Render fehlgeschlagen: ${err.message}`, err);
      }
      throw err;
    }

    if (pages.length === 0) {
      throw new StrategyExecutionError(
        'Keine visuelle Quelle gefunden (kein PDF, kein Bild). Vision-Per-Page benoetigt eine Bild- oder PDF-Datei.',
      );
    }

    // Freitext-JSON statt erzwungenem Function-Calling: Vision-Modelle auf dem
    // vLLM-Serving haengen/scheitern bei Forced-Function-Calling auf Bildern.
    // Freitext-JSON ist zuverlaessig + schnell (siehe extract-call.ts).
    // Das Modell liefert nur WERTE — die Bounding-Boxes kommen via OCR (ocr.ts).
    const jsonInstruction = buildVisionJsonInstruction(input.schema.profile);
    // Serverseitig erzwungenes JSON-Schema (null = Kill-Switch aktiv).
    const guidedBody = guidedJsonBody(input.schema.profile);

    const systemPrompt = appendGuidelines(`Du bist Daten-Extraktions-Spezialist mit Bildverstehen. Du bekommst EINE Seite eines mehrseitigen ${input.schema.name}-Dokuments und extrahierst alle Felder, die du auf dieser Seite sehen kannst.

Wichtig:
- Felder, die auf dieser Seite NICHT zu sehen sind, gib als null zurueck — NICHT erfinden.
- Lies auch handschriftliche Eintraege, Stempel, Unterschriften.
- Tabellen-Zeilen genau erfassen — Reihenfolge bewahren.
- Datumsangaben im Format YYYY-MM-DD.
- Andere Seiten decken den Rest ab; sie werden nach Merger zusammengefuehrt.`, input.schema.profile);

    const options: ChatOptions = {
      userId: input.userId,
      ...EXTRACTION_SAMPLING,
      // Der Request selbst bricht jetzt ab (W9.3) — vorher lief er nach dem
      // Promise.race-Timeout unsichtbar weiter und band einen vLLM-Slot.
      timeoutMs: 45_000,
    };
    // Vision-Per-Page nutzt das Vision-Profile (active.vision in providers.yaml)
    // statt des aktiven Chat-Modells. Schema oder Job-Override kann das aufheben.
    const override = input.modelOverride
      ?? (input.schema.config.model_override
        ? { providerId: input.schema.config.model_override.provider_id, modelId: input.schema.config.model_override.model_id }
        : undefined);
    if (override) options.modelOverride = override;

    const usageContext: UsageContext = {
      userId: input.userId,
      source: 'extraction',
      operation: 'vision_per_page',
    };

    const logs: LLMResponseLog[] = [];
    let logCounter = 0;

    const results = await pLimit(
      pages,
      input.schema.config.max_concurrent,
      async (page, idx) => {
        await emit({ phase: 'extracting', chunkIndex: idx, chunkTotal: pages.length, pageIndex: page.pageNumber, pageTotal: pages.length });

        const mimeType = detectMimeFromBuffer(page.pngBuffer);
        const base64 = page.pngBuffer.toString('base64');
        const dataUri = `data:${mimeType};base64,${base64}`;

        // ImageContentPart manuell bauen, damit wir `detail` aus dem Schema
        // setzen koennen (createImageContent setzt hart 'auto').
        const imagePart: ImageContentPart = {
          type: 'image_url',
          image_url: {
            url: dataUri,
            detail: input.schema.config.vision_detail,
          },
        };

        const userContent: ContentPart[] = [
          { type: 'text', text: `${page.pageLabel}\n\n${jsonInstruction}` },
          imagePart,
        ];

        const messages: Message[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ];

        const t0 = Date.now();
        let response;
        try {
          // KEINE Tools/Function-Schema — Function-Calling haengt auf dem
          // vLLM-Serving mit Bildern. Stattdessen serverseitig erzwungenes
          // JSON (response_format json_schema): Versuch 1 mit Schema, bei
          // Fehlschlag Versuch 2 als Freitext-JSON — das deckt zugleich
          // transiente Endpoint-Haenger ab (vorher: 2 identische Versuche).
          if (guidedBody) {
            try {
              response = await withTimeoutRetry(
                () => llmService.chat(messages, undefined, usageContext, { ...options, extraBody: guidedBody }),
                { timeoutMs: 45000, retries: 0, label: `vision-per-page ${page.pageId} (guided)` },
              );
            } catch {
              response = await withTimeoutRetry(
                () => llmService.chat(messages, undefined, usageContext, options),
                { timeoutMs: 45000, retries: 0, label: `vision-per-page ${page.pageId} (fallback)` },
              );
            }
          } else {
            response = await withTimeoutRetry(
              () => llmService.chat(messages, undefined, usageContext, options),
              { timeoutMs: 45000, retries: 1, label: `vision-per-page ${page.pageId}` },
            );
          }
        } catch (err) {
          // Seite gibt nach Timeout + Retries keine Antwort (Endpoint-Hänger).
          // Nicht die ganze Extraktion scheitern lassen — Seite ueberspringen,
          // andere Seiten/Felder bleiben erhalten.
          console.warn(`[vision-per-page] Seite ${page.pageId}: keine Antwort nach Retries (${err instanceof Error ? err.message : String(err)}) — uebersprungen.`);
          processingIssues.push({
            severity: 'error',
            message: `Seite ${page.pageNumber} (${page.filename}): keine Antwort vom Modell nach 2 Versuchen — Inhalte dieser Seite fehlen im Ergebnis.`,
          });
          logCounter += 1;
          logs.push({ call: logCounter, phase: 'vision-extract', duration_ms: Date.now() - t0, truncated: false });
          return {
            chunkIndex: idx,
            heading: page.pageLabel,
            data: {},
            _pageImage: { page: page.pageNumber, dataUri, width: page.width, height: page.height } as PageImage,
          };
        }
        const durationMs = Date.now() - t0;

        const parsed = parseJsonObject(response.content);
        const data: Record<string, unknown> = parsed ?? {};
        if (parsed === null) {
          console.warn(`[vision-per-page] Seite ${page.pageId}: kein JSON in der Antwort parsebar.`);
          processingIssues.push({
            severity: 'error',
            message: `Seite ${page.pageNumber} (${page.filename}): Modellantwort nicht als JSON lesbar — Inhalte dieser Seite fehlen im Ergebnis.`,
          });
        }

        logCounter += 1;
        logs.push({
          call: logCounter,
          phase: 'vision-extract',
          duration_ms: durationMs,
          truncated: false,
        });

        return {
          chunkIndex: idx,
          heading: page.pageLabel,
          data,
          _pageImage: { page: page.pageNumber, dataUri, width: page.width, height: page.height } as PageImage,
        };
      },
    );

    // Werte fuer den Merger; Boxen/Seitenbilder separat sammeln.
    const extracts: ChunkExtraction[] = results.map((r) => ({ chunkIndex: r.chunkIndex, heading: r.heading, data: r.data }));

    // Merge ueber Seiten: bei `union` werden Tabellen-Zeilen konkateniert.
    await emit({ phase: 'merging', fieldsMerged: 0, fieldsTotal: Object.keys(input.schema.profile.fields).length });
    const { merged, provenance } = mergeChunks(extracts, input.schema.profile, input.schema.config.merge_strategy);

    // OCR-Fusion (W7): Tesseract-Woerter liefern Fundstellen-Boxen (inkl.
    // Listen-Zeilen) UND verifizieren die extrahierten Werte deterministisch —
    // unbelegte Zahlen werden zur Pruefung markiert, belegte Felder brauchen
    // kein LLM-Konfidenz-Urteil mehr.
    const fusion = await fuseWithOcr(
      pages.map((p) => ({ pngBuffer: p.pngBuffer, width: p.width, height: p.height, pageNumber: p.pageNumber })),
      merged,
      input.schema.profile,
    );
    const boxes: Record<string, FieldBox> = fusion.boxes;
    const pageImages: PageImage[] = results
      .map((r) => r._pageImage)
      .filter((p): p is PageImage => !!p)
      .sort((a, b) => a.page - b.page);

    // Pretty-up Provenance: Source `c:N` → `p:<pageNumber>`
    for (const p of provenance) {
      // Source enthaelt z.B. "c:0+1+3". Wir mappen die Chunk-Indizes auf Page-Labels.
      const indices = p.source.replace(/^c:/, '').split('+').map((n) => parseInt(n, 10)).filter(Number.isFinite);
      const labels = indices.map((i) => pages[i]?.pageId).filter(Boolean);
      p.source = labels.length > 0 ? `p:${labels.join('+')}` : p.source;
    }

    await emit({ phase: 'scoring', fieldsScored: 0, fieldsTotal: provenance.length });
    const { confidences, llmCalls: confidenceCalls } = await scoreConfidences(
      extracts,
      merged,
      input.schema.profile,
      input.userId,
      // Abschaltbar via config (z.B. Eval-Laeufe) — Default true.
      // Konfidenz-Call laeuft auf demselben Modell wie die Extraktion.
      {
        useLLM: input.schema.config.llm_confidence,
        exclude: fusion.decidedPaths,
        ...(options.modelOverride ? { modelOverride: options.modelOverride } : {}),
      },
    );
    // Fusion-Urteile anwenden: verified hebt an, unbelegte Zahlen deckeln
    // unter die Review-Schwelle.
    applyFusionToConfidences(confidences, fusion);
    for (const p of provenance) {
      p.confidence = confidences[p.field] ?? 0;
    }

    const validation = validateExtraction(merged, input.schema.profile);
    const warnings = validation.errors.map((e) => `${e.field}: ${e.message}`);
    warnings.push(...fusion.findings.map((f) => f.message));
    await emit({ phase: 'validating', warningCount: warnings.length });

    return {
      extracted: merged,
      fieldConfidences: confidences,
      provenance,
      boxes,
      pageImages,
      warnings,
      fusionFindings: fusion.findings,
      processingIssues,
      llmCalls: pages.length + confidenceCalls,
      strategyUsed: 'vision-per-page',
      raw_responses: logs,
    };
  },
};
