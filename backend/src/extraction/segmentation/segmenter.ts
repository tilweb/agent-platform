/**
 * Segmentierung (Welle 10): Seiten-Klassifikation + deterministische
 * Grenzbildung.
 *
 * Verfahren (Konzept §4, Reducto-Ansatz): JEDE Seite wird gegen die
 * Prosa-Beschreibungen der Segmenttypen des Profils klassifiziert (1
 * Vision-Call je Seite, 150 dpi — die Klassifikation vertraegt das, die
 * Feld-Extraktion nicht; W9-Messung). Grenzen sind eine ABLEITUNG:
 * Typwechsel ⇒ Grenze; gleicher Typ auf der Folgeseite ⇒ Fortsetzung, ausser
 * die Seite traegt einen Neustart-Marker (Briefkopf, "Seite 1 von N", eigene
 * Kennung) und der Typ ist `repeatable`.
 *
 * Erkenntnisse aus der Evaluation der 18 Beispiel-Dokumente (Konzept §10):
 *   - Einseiter sind der NORMALFALL (57 von 93 Segmenten) — die Glaettung
 *     greift nur bei niedriger Konfidenz UND gleichem Nachbartyp beidseits.
 *   - `leerseite` (Quasi-Leerseiten, Trennblaetter) ist ein eingebauter Typ:
 *     gehoert keinem Segment an, verschluckt keine Grenzen, alarmiert nicht.
 *   - `unbekannt` wird nie geraten, sondern ausgewiesen (Befund → Review).
 */

import type { SegmentTypeDef, SegmentInstance } from '../learning/types';
import { BUILTIN_SEGMENT_TYPES } from '../learning/types';
import { resolveModel } from '../../services/providers';
import { OpenAIAdapter } from '../../services/llm/adapters/openai';
import type { Message, ContentPart } from '../../services/llm';
import { EXTRACTION_PROVIDER_ID, EXTRACTION_MODEL_ID, extractionModelLabel } from '../model';
import { withTimeoutRetry, parseJsonObject, EXTRACTION_SAMPLING } from '../../services/extraction/extract-call';

// ============== Pure Grenzbildung (testbar ohne Modell) ==============

export interface PageClassification {
  page: number;          // 1-basiert
  type: string;          // Segmenttyp-ID | 'leerseite' | 'unbekannt'
  confidence: number;    // 0..1
  /** Beginnt auf dieser Seite sichtbar eine NEUE Instanz (Briefkopf, "Seite 1 von N", Kennung)? */
  neustart: boolean;
}

export interface SegmentationFinding {
  severity: 'error' | 'warn';
  message: string;
}

export interface SegmentationResult {
  segments: SegmentInstance[];
  findings: SegmentationFinding[];
  /** Die (ggf. geglaetteten) Seiten-Urteile — fuers Review/Debugging. */
  pages: PageClassification[];
}

const SMOOTHING_CONFIDENCE = 0.5;

/**
 * Baut aus Seiten-Urteilen Segment-Instanzen. Deterministisch, keine Modellaufrufe.
 */
export function buildSegments(
  pageClassifications: PageClassification[],
  defs: Record<string, SegmentTypeDef>,
): SegmentationResult {
  const findings: SegmentationFinding[] = [];
  const pages = pageClassifications.map((p) => ({ ...p })).sort((a, b) => a.page - b.page);

  // Unbekannte Typ-IDs (Modell haelt sich nicht ans Schema — bei guided_json
  // praktisch ausgeschlossen, beim Freitext-Fallback moeglich) → 'unbekannt'.
  const known = new Set([...Object.keys(defs), ...BUILTIN_SEGMENT_TYPES]);
  for (const p of pages) {
    if (!known.has(p.type)) {
      findings.push({ severity: 'warn', message: `Seite ${p.page}: unbekannter Segmenttyp "${p.type}" aus der Klassifikation — als 'unbekannt' behandelt.` });
      p.type = 'unbekannt';
      p.confidence = 0;
    }
  }

  // Glaettung: Einzelseiten-Ausreisser NUR bei niedriger Konfidenz und wenn
  // beide Nachbarn denselben (anderen) Typ tragen. Einseiter sind sonst normal.
  for (let i = 1; i < pages.length - 1; i += 1) {
    const prev = pages[i - 1]!, cur = pages[i]!, next = pages[i + 1]!;
    if (
      cur.confidence < SMOOTHING_CONFIDENCE &&
      prev.type === next.type &&
      prev.type !== cur.type &&
      prev.type !== 'leerseite' && prev.type !== 'unbekannt'
    ) {
      findings.push({
        severity: 'warn',
        message: `Seite ${cur.page}: unsicheres Urteil "${cur.type}" (${Math.round(cur.confidence * 100)}%) zwischen zwei "${prev.type}"-Seiten — der Seite wurde "${prev.type}" zugeordnet, bitte pruefen.`,
      });
      cur.type = prev.type;
      cur.neustart = false;
    }
  }

  // Gruppierung: Typwechsel ⇒ Grenze; Neustart-Marker trennt Instanzen
  // desselben Typs (zwei Zertifikate hintereinander), sofern `repeatable`.
  const segments: SegmentInstance[] = [];
  const instanceCounter = new Map<string, number>();
  let current: { type: string; from: number; to: number; confidence: number } | null = null;

  const flush = () => {
    if (!current) return;
    const n = (instanceCounter.get(current.type) ?? 0) + 1;
    instanceCounter.set(current.type, n);
    segments.push({
      type: current.type,
      instance: n,
      pageFrom: current.from,
      pageTo: current.to,
      confidence: current.confidence,
    });
    current = null;
  };

  for (const p of pages) {
    if (current && p.type === current.type) {
      const def = defs[p.type];
      if (p.neustart && p.type !== 'leerseite' && p.type !== 'unbekannt') {
        if (def?.repeatable) {
          flush();
          current = { type: p.type, from: p.page, to: p.page, confidence: p.confidence };
          continue;
        }
        // Nicht-repeatable: zusammenlassen, aber ausweisen — vermutlich ist
        // der Typ im Profil falsch modelliert oder die Seite gehoert woanders hin.
        findings.push({
          severity: 'warn',
          message: `Seite ${p.page}: sieht nach dem Beginn einer NEUEN "${def?.label ?? p.type}"-Instanz aus, der Typ ist aber nicht als wiederholbar markiert — Seiten wurden zusammengefasst.`,
        });
      }
      current.to = p.page;
      current.confidence = Math.min(current.confidence, p.confidence);
      continue;
    }
    flush();
    current = { type: p.type, from: p.page, to: p.page, confidence: p.confidence };
  }
  flush();

  // Befunde: unbekannt-Seiten + fehlende Pflicht-Segmente.
  for (const s of segments) {
    if (s.type === 'unbekannt') {
      findings.push({
        severity: 'error',
        message: `Seite${s.pageFrom === s.pageTo ? ` ${s.pageFrom}` : `n ${s.pageFrom}–${s.pageTo}`}: passt zu keinem beschriebenen Segmenttyp — bitte zuordnen.`,
      });
    }
  }
  for (const [segId, def] of Object.entries(defs)) {
    if (def.required && !segments.some((s) => s.type === segId)) {
      findings.push({ severity: 'error', message: `Pflicht-Segment "${def.label}" wurde im Dokument nicht gefunden.` });
    }
  }

  return { segments, findings, pages };
}

// ============== Seiten-Klassifikation (Vision) ==============

export interface SegmentPageInput {
  page: number;
  pngBuffer: Buffer;
}

function buildSystemPrompt(defs: Record<string, SegmentTypeDef>): string {
  const typeLines = Object.entries(defs)
    .map(([id, d]) => `- "${id}" (${d.label}): ${d.description}`)
    .join('\n');
  return `Du klassifizierst EINE Seite eines mehrteiligen Dokuments (Sammel-Scan). Ordne die Seite genau einem der folgenden Segmenttypen zu:

${typeLines}
- "leerseite": (praktisch) leere Seite, reine Trennseite, Seite nur mit Barcode/Datamatrix-Code, oder ein Trennblatt mit blosser Ueberschrift.
- "unbekannt": passt zu KEINER der Beschreibungen. Nicht raten.

Zusaetzlich: "neustart" = true, wenn auf dieser Seite sichtbar eine NEUE Einheit BEGINNT — z.B. eigener Briefkopf/Logo-Kopf, Anrede/Betreff am Anfang, eine interne Zaehlung, die neu startet ("Seite 1 von N", "1/2"), eine eigene Dokument-Kennung oder ein Titel. Fortsetzungsseiten (laufender Text, fortlaufende Zaehlung wie "Seite 3 von 8") haben neustart = false.

WICHTIG: "neustart" entscheidet, ob zwei AUFEINANDERFOLGENDE Seiten desselben Typs getrennt werden. neustart = true, wenn EINES dieser Signale zutrifft — der Aussteller muss dafuer NICHT wechseln:
- die Seite beginnt mit einer eigenen Titel-Ueberschrift (auch beim gleichen Aussteller: mehrere Einwilligungserklaerungen einer Schule, mehrere Anlagen eines Versorgers — jede beginnt mit ihrer eigenen Ueberschrift)
- der Aussteller wechselt (anderes Logo, anderer Firmen-/Behoerdenname im Kopf, anderes Layout)
- eine interne Zaehlung oder Kennung startet neu ("Seite 1 von N", "1/2", eigene Berichts-/Dokumentnummer)
- die vorige Einheit war sichtbar abgeschlossen (Unterschriftenblock, "Ende des ...") und diese Seite beginnt etwas Neues
Nur ECHTE Fortsetzungen (laufender Text/Tabelle ohne neuen Titel, fortlaufende Zaehlung) haben neustart = false.

"confidence" = deine Sicherheit der Typzuordnung (0..1).`;
}

function guidedSchema(defs: Record<string, SegmentTypeDef>): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      type: { type: 'string', enum: [...Object.keys(defs), ...BUILTIN_SEGMENT_TYPES] },
      neustart: { type: 'boolean' },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
    },
    required: ['type', 'neustart', 'confidence'],
    additionalProperties: false,
  };
}

/**
 * Klassifiziert alle Seiten (1 Vision-Call je Seite, Parallelitaet 3).
 * Festes Extraktions-Modell (Modellbindung); guided_json erzwingt das Schema,
 * Freitext-Fallback wie im Vision-Pfad. Eine Seite ohne verwertbare Antwort
 * wird 'unbekannt' (Konfidenz 0) — die Grenzbildung macht daraus einen Befund.
 */
export async function classifySegmentPages(
  pages: SegmentPageInput[],
  defs: Record<string, SegmentTypeDef>,
  opts: { concurrency?: number } = {},
): Promise<PageClassification[]> {
  const visionModel = await resolveModel(EXTRACTION_PROVIDER_ID, EXTRACTION_MODEL_ID);
  if (!visionModel) {
    throw new Error(`Extraktions-Modell ${extractionModelLabel()} nicht verfuegbar`);
  }
  const adapter = new OpenAIAdapter({
    baseUrl: visionModel.base_url,
    apiKey: visionModel.api_key || null,
    defaultModel: visionModel.model.id,
  });

  const systemPrompt = buildSystemPrompt(defs);
  const extraBody = {
    response_format: { type: 'json_schema', json_schema: { name: 'segment', schema: guidedSchema(defs) } },
  };

  const results: PageClassification[] = new Array(pages.length);
  let next = 0;
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 3, pages.length));
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < pages.length) {
      const idx = next++;
      const p = pages[idx]!;
      const dataUri = `data:image/png;base64,${p.pngBuffer.toString('base64')}`;
      const content: ContentPart[] = [
        { type: 'text', text: `Seite ${p.page} des Dokuments:` },
        { type: 'image_url', image_url: { url: dataUri, detail: 'high' } },
      ];
      const messages: Message[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ];
      try {
        const response = await withTimeoutRetry(
          () => adapter.chat(messages, visionModel.model.id, undefined, undefined, {
            ...EXTRACTION_SAMPLING,
            timeoutMs: 45_000,
            extraBody,
          }),
          { timeoutMs: 45_000, retries: 1, label: `segment-classify Seite ${p.page}` },
        );
        const parsed = parseJsonObject(response.content) as { type?: string; neustart?: boolean; confidence?: number } | null;
        results[idx] = {
          page: p.page,
          type: typeof parsed?.type === 'string' ? parsed.type : 'unbekannt',
          neustart: parsed?.neustart === true,
          confidence: typeof parsed?.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0,
        };
      } catch (err) {
        console.warn(`[segmenter] Seite ${p.page}: keine Antwort (${err instanceof Error ? err.message : String(err)}) — als 'unbekannt' markiert.`);
        results[idx] = { page: p.page, type: 'unbekannt', neustart: false, confidence: 0 };
      }
    }
  }));
  return results;
}
