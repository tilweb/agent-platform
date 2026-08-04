/**
 * Posteingang (Welle 4) — Dokumentgrenzen-Erkennung in Sammel-Scans.
 *
 * Je Seitenuebergang (letzte Seite des laufenden Dokuments = "Page A", erste
 * Seite des naechsten = "Page B") beurteilt ein Vision-Call, ob dort ein
 * Schnitt liegt. Der Prompt ist mit tools/document-split-test.ts gegen echte
 * Scans erprobt (Quelle: docs/document-split/prompt.md — hier als Konstante
 * eingebettet, weil das Railway-Image kein docs/ enthaelt).
 *
 * Konservatives Verhalten: nur ein klares "true" trennt; unklare Antworten und
 * Call-Fehler bedeuten "kein Schnitt" (falsch zusammengelassene Dokumente sind
 * im Ziel-Projekt per W3-Review korrigierbar, falsch getrennte nicht).
 */

import { resolveModel } from '../../services/providers';
import { EXTRACTION_MODEL_ID, EXTRACTION_PROVIDER_ID, extractionModelLabel } from '../model';
import { OpenAIAdapter } from '../../services/llm/adapters/openai';
import { createImageContent, type ContentPart, type Message } from '../../services/llm';
import { withTimeoutRetry } from '../../services/extraction/extract-call';
import type { PdfPageImage } from '../../services/extraction/pdf';

const SPLIT_CONCURRENCY = parseInt(process.env.INBOX_SPLIT_CONCURRENCY || '2', 10);

/** Erprobter Split-Prompt (siehe docs/document-split/prompt.md). */
export const SPLIT_PROMPT = `You are an expert document routing and classification system. Your sole task is to determine whether a proposed boundary split between two scanned pages represents a correct separation between two distinct documents.

You will be given two images:
* Page A: The final page of the current document cluster.
* Page B: The first page of the subsequent document cluster.

Documents that are contextually RELATED (same person/case/topic) MUST still be split if they are distinct functional entities (e.g. cover letter -> form; invoice -> remittance slip; letter -> ID scan; contract -> separate annex/signature sheet).

Verification indicators:
- Pagination/metadata: page numbering ("Seite 3 von 3" on A, "Seite 1"/unnumbered on B), changing header/footer, distinct case IDs or dates.
- Structural/layout shifts: paper type, background, formatting (typed letter -> dense form grid), margins/orientation.
- Content/linguistic: A ends with sign-off/signature/legal footer; B begins with new salutation ("Sehr geehrte..."), new subject ("Betreff:"), or document title ("Rechnung", "Bescheinigung").

Output: EXACTLY one lowercase word, either "true" or "false", no punctuation or whitespace.
- "true"  = cut CORRECT (A and B are separate documents)
- "false" = cut INCORRECT (A and B are the same continuous document)`;

/**
 * Grenz-Urteile → Seitenbereiche. `boundaries[i]` = Schnitt zwischen Seite i+1
 * und Seite i+2 (Laenge pageCount-1; ueberzaehlige Eintraege werden ignoriert,
 * fehlende gelten als "kein Schnitt").
 */
export function rangesFromBoundaries(
  pageCount: number,
  boundaries: boolean[],
): Array<{ from: number; to: number }> {
  if (pageCount <= 0) return [];
  const ranges: Array<{ from: number; to: number }> = [];
  let start = 1;
  for (let page = 1; page < pageCount; page += 1) {
    if (boundaries[page - 1] === true) {
      ranges.push({ from: start, to: page });
      start = page + 1;
    }
  }
  ranges.push({ from: start, to: pageCount });
  return ranges;
}

/**
 * Vision-Antwort → Urteil. Nur ein klares "true" (ggf. mit Punkt/Whitespace)
 * trennt; alles andere (auch leer/unparsebar) ist konservativ "kein Schnitt".
 */
export function parseBoundaryVerdict(content: string | null | undefined): boolean {
  if (!content) return false;
  const normalized = content.trim().toLowerCase().replace(/[."'`\s]+$/g, '');
  return normalized === 'true';
}

/** Worker-Pool (Muster batch-service.ts). */
async function pLimit<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, idx: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const idx = next++;
      if (idx >= items.length) return;
      await worker(items[idx]!, idx);
    }
  });
  await Promise.all(runners);
}

function pageDataUri(page: PdfPageImage): string {
  return `data:image/png;base64,${page.pngBuffer.toString('base64')}`;
}

/**
 * Beurteilt alle Seitenuebergaenge eines gerenderten PDFs. Rueckgabe:
 * boolean[] der Laenge pages.length-1. Call-Fehler → false (fail-soft, Log).
 */
export async function judgeBoundaries(
  pages: PdfPageImage[],
  userId?: string,
): Promise<boolean[]> {
  if (pages.length < 2) return [];

  // Festes Extraktions-Modell (siehe extraction/model.ts) — die Eingangsstrecke
  // darf nicht davon abhaengen, welches Modell im Chat eingestellt ist.
  const visionModel = await resolveModel(EXTRACTION_PROVIDER_ID, EXTRACTION_MODEL_ID);
  if (!visionModel) {
    throw new Error(`Extraktions-Modell ${extractionModelLabel()} nicht verfuegbar (EXTRACTION_LLM_PROVIDER / EXTRACTION_LLM_MODEL)`);
  }
  const adapter = new OpenAIAdapter({
    baseUrl: visionModel.base_url,
    apiKey: visionModel.api_key || null,
    defaultModel: visionModel.model.id,
  });

  const verdicts: boolean[] = new Array(pages.length - 1).fill(false);
  const indices = Array.from({ length: pages.length - 1 }, (_, i) => i);

  await pLimit(indices, SPLIT_CONCURRENCY, async (i) => {
    const pageA = pages[i]!;
    const pageB = pages[i + 1]!;
    const content: ContentPart[] = [
      { type: 'text', text: 'Page A (final page of current cluster):' },
      createImageContent(pageDataUri(pageA), 'image/png'),
      { type: 'text', text: 'Page B (first page of subsequent cluster):' },
      createImageContent(pageDataUri(pageB), 'image/png'),
    ];
    const messages: Message[] = [
      { role: 'system', content: SPLIT_PROMPT },
      { role: 'user', content },
    ];
    try {
      const response = await withTimeoutRetry(
        () => adapter.chat(messages, visionModel.model.id),
        { timeoutMs: 45000, retries: 1, label: `inbox-split ${pageA.pageNumber}/${pageB.pageNumber}` },
      );
      verdicts[i] = parseBoundaryVerdict(response.content);
    } catch (err) {
      console.warn(
        `[inbox] Split-Urteil Seite ${pageA.pageNumber}->${pageB.pageNumber} fehlgeschlagen (kein Schnitt angenommen):`,
        err instanceof Error ? err.message : err,
      );
      verdicts[i] = false;
    }
  });

  return verdicts;
}
