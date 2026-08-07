/**
 * Posteingang (Welle 4) — Klassifikation von Teil-Dokumenten.
 *
 * Ein Vision-Call auf die erste Seite eines Teils entscheidet, zu welchem
 * Extraktionsprojekt es gehoert. Prompt-Aufbau nach dem erprobten Muster von
 * apps/vertragsmanagement/import-service.ts (classifyContract): Kandidaten-
 * Katalog + strenge Confidence-Regeln ("lieber niedrige Confidence als falsche
 * Sicherheit"), Antwort als Freitext-JSON.
 */

import { resolveModel } from '../../services/providers';
import { EXTRACTION_MODEL_ID, EXTRACTION_PROVIDER_ID, extractionModelLabel } from '../model';
import { OpenAIAdapter } from '../../services/llm/adapters/openai';
import { createImageContent, type ContentPart, type Message } from '../../services/llm';
import { withTimeoutRetry, parseJsonObject, EXTRACTION_SAMPLING } from '../../services/extraction/extract-call';
import type { ExtractionProject } from '../learning/types';

export interface PartClassification {
  project_id: string | null;
  confidence: number;
  alternatives: Array<{ project_id: string; confidence: number }>;
}

/** Kandidaten-Katalog + Confidence-Regeln als System-Prompt. */
export function buildClassifyPrompt(projects: ExtractionProject[]): string {
  const catalog = projects
    .map((p) => {
      const fieldLabels = Object.values(p.fields)
        .map((f) => f.label)
        .filter(Boolean)
        .slice(0, 15)
        .join(', ');
      return `- ${p.id}: ${p.name}${p.description ? ` — ${p.description}` : ''}${fieldLabels ? ` (Felder: ${fieldLabels})` : ''}`;
    })
    .join('\n');

  return `Du bist ein Dokumenten-Router. Ordne das gezeigte Dokument (erste Seite) einem der folgenden Extraktionsprojekte zu. Klassifiziere ehrlich — lieber eine niedrige Confidence als falsche Sicherheit.

Verfuegbare Projekte (NUR diese IDs sind erlaubt fuer "project_id"):
${catalog}

Confidence-Regeln (KRITISCH):
- 0.90-1.00: der Dokumenttyp ist eindeutig erkennbar (Titel/Struktur/Felder passen klar zu genau einem Projekt).
- 0.70-0.89: starke Indizien, aber nicht voellig eindeutig.
- 0.50-0.69: mehrdeutig — eines der Projekte passt am ehesten, andere waeren denkbar.
- < 0.50: KEIN Projekt passt wirklich — gib das nahestehendste Projekt mit Confidence < 0.50 (oder project_id null, wenn gar nichts passt) und liste Alternativen.

NIEMALS ein falsches Projekt mit Confidence > 0.70 zurueckgeben, nur weil eine Antwort verlangt ist.

Antworte AUSSCHLIESSLICH mit gueltigem JSON nach diesem Schema (keine Markdown-Fences):
{
  "project_id": "<projekt-id oder null>",
  "confidence": <0..1>,
  "alternatives": [{"project_id": "<projekt-id>", "confidence": <0..1>}]
}`;
}

function clamp01(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * Antwort-Parsing mit Fallbacks: unbekannte project_id → null; Confidence auf
 * [0,1] geklemmt; Alternativen auf valide IDs gefiltert (max. 3); Parse-Fehler
 * → { project_id: null, confidence: 0 }.
 */
export function parseClassification(
  raw: string | null | undefined,
  validIds: string[],
): PartClassification {
  const empty: PartClassification = { project_id: null, confidence: 0, alternatives: [] };
  const obj = parseJsonObject(raw);
  if (!obj) return empty;

  const valid = new Set(validIds);
  const rawId = obj.project_id;
  const projectId = typeof rawId === 'string' && valid.has(rawId) ? rawId : null;

  const alternatives = (Array.isArray(obj.alternatives) ? obj.alternatives : [])
    .filter(
      (a): a is { project_id: string; confidence?: unknown } =>
        !!a && typeof a === 'object' && typeof (a as Record<string, unknown>).project_id === 'string' &&
        valid.has((a as Record<string, unknown>).project_id as string),
    )
    .map((a) => ({ project_id: a.project_id, confidence: clamp01(a.confidence) }))
    .filter((a) => a.project_id !== projectId)
    .slice(0, 3);

  return {
    project_id: projectId,
    confidence: projectId ? clamp01(obj.confidence) : Math.min(clamp01(obj.confidence), 0.49),
    alternatives,
  };
}

/** Dateiname eines Teils: `<basis>-teil-<n>.pdf` (sanitisiert). */
export function partFilename(original: string, n: number): string {
  const base = original
    .replace(/\.pdf$/i, '')
    .replace(/[^\w.\- ]+/g, '_')
    .trim() || 'dokument';
  return `${base}-teil-${n}.pdf`;
}

/** Klassifiziert ein Teil-Dokument anhand seiner ersten Seite (1 Vision-Call). */
export async function classifyPart(
  firstPageDataUri: string,
  projects: ExtractionProject[],
  userId?: string,
): Promise<PartClassification> {
  if (projects.length === 0) return { project_id: null, confidence: 0, alternatives: [] };

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

  const content: ContentPart[] = [
    { type: 'text', text: 'Erste Seite des Dokuments:' },
    createImageContent(firstPageDataUri, 'image/png'),
  ];
  const messages: Message[] = [
    { role: 'system', content: buildClassifyPrompt(projects) },
    { role: 'user', content },
  ];

  const response = await withTimeoutRetry(
    () => adapter.chat(messages, visionModel.model.id, undefined, undefined, { ...EXTRACTION_SAMPLING, timeoutMs: 45_000 }),
    { timeoutMs: 45000, retries: 1, label: 'inbox-classify' },
  );
  return parseClassification(response.content, projects.map((p) => p.id));
}
