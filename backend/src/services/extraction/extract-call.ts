/**
 * Validierungs-getriebener Repair-Pass.
 *
 * Wird vom Orchestrator (`pipeline.ts`) NACH der Strategy aufgerufen, wenn
 * `config.validation_repair` gesetzt ist. Validiert das (gemergte) Ergebnis
 * gegen das Profil; bei Fehlern macht ein gezielter LLM-Call (max. `maxPasses`)
 * eine Korrektur der bemaengelten Felder.
 *
 * Strategie-agnostisch — funktioniert fuer jeden Konsumenten. Faithful Port des
 * alten Retry-mit-Feedback aus dem Extraktions-Projekte-Feature
 * (`extraction/learning/service.ts`, vor der Pipeline-Migration).
 *
 * Hinweis: `validateExtraction` korrigiert Format-Issues (DE-Zahlen/Daten/
 * Boolean) bereits in-place — der LLM-Call faellt also nur bei echten Fehlern
 * an (fehlende Pflichtfelder, nicht-korrigierbare Typen). Ohne Dokumenttext
 * (z.B. reine Bildquelle) wird kein Call gemacht, die Warnings durchgereicht.
 */

import { llmService, type Message, type ChatOptions } from '../llm';
import type { UsageContext } from '../usageTracking';
import { buildFunctionSchema, buildToolChoice } from '../../extraction/schema-builder';
import { validateExtraction, formatValidationErrors } from '../../extraction/validator';
import type { ExtractionProfile, FieldDefinition } from '../../extraction/types';
import { isArrayGroup } from '../../extraction/types';

type ChatResponse = Awaited<ReturnType<typeof llmService.chat>>;
export type ChatFn = (
  messages: Message[],
  tools: ReturnType<typeof buildFunctionSchema>[],
  usageContext: UsageContext,
  options: ChatOptions,
) => Promise<ChatResponse>;

/**
 * Wickelt einen async-Call mit Timeout + Retry. Der adacor-Inferenz-Endpoint
 * blockiert intermittierend einzelne Vision-Requests (beobachtet: ~290s ohne
 * Antwort). Der Timeout bricht das Warten ab (der zugrundeliegende Request laeuft
 * ggf. ins Leere weiter, wird aber ignoriert) und ein Retry holt meist ein gutes
 * Ergebnis. Wirft den letzten Fehler, wenn alle Versuche scheitern.
 */
export async function withTimeoutRetry<T>(
  fn: () => Promise<T>,
  opts: { timeoutMs: number; retries: number; label?: string },
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= opts.retries; attempt += 1) {
    try {
      return await Promise.race([
        fn(),
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout nach ${opts.timeoutMs}ms`)), opts.timeoutMs),
        ),
      ]);
    } catch (err) {
      lastErr = err;
      if (attempt < opts.retries) {
        console.warn(
          `[extraction] ${opts.label ?? 'LLM-Call'}: Versuch ${attempt + 1}/${opts.retries + 1} fehlgeschlagen (${err instanceof Error ? err.message : String(err)}) — neuer Versuch.`,
        );
      }
    }
  }
  throw lastErr;
}

/**
 * Baut eine Freitext-JSON-Extraktions-Anweisung aus dem Profil (Skelett mit
 * Gruppen + Feldern + Typ-/Label-Hinweisen).
 *
 * Hintergrund: Vision-Modelle auf dem vLLM-Serving HAENGEN/scheitern bei
 * erzwungenem Function-Calling auf Bildern (grammatik-constrainter JSON-Decode
 * + Vision). Freitext-JSON ist zuverlaessig (bestaetigt: 19/21 in ~5s vs.
 * Function-Call TIMEOUT). Die Struktur spiegelt `profile.fields`, damit Merger/
 * Provenance unveraendert funktionieren.
 */
export function buildVisionJsonInstruction(profile: ExtractionProfile, withBbox = false): string {
  const typeHint = (f: FieldDefinition): string => {
    switch (f.type) {
      case 'boolean': return 'true|false|null';
      case 'number': return 'Zahl|null';
      case 'date': return '"YYYY-MM-DD"|null';
      default: return '"Text"|null';
    }
  };
  const fieldValue = (f: FieldDefinition): string =>
    withBbox ? `{ "value": ${typeHint(f)}, "bbox": [x_min,y_min,x_max,y_max] }` : typeHint(f);
  const lines: string[] = ['{'];
  const groups = Object.entries(profile.fields);
  groups.forEach(([groupName, group], gi) => {
    const groupComma = gi < groups.length - 1 ? ',' : '';
    if (isArrayGroup(group)) {
      lines.push(`  "${groupName}": []${groupComma}`);
      return;
    }
    lines.push(`  "${groupName}": {`);
    const fields = Object.entries(group as Record<string, FieldDefinition>);
    fields.forEach(([fid, f], fi) => {
      const comma = fi < fields.length - 1 ? ',' : '';
      const label = f.label ? `  // ${f.label}${f.hint ? ' — ' + f.hint : ''}` : '';
      lines.push(`    "${fid}": ${fieldValue(f)}${comma}${label}`);
    });
    lines.push(`  }${groupComma}`);
  });
  lines.push('}');
  const bboxNote = withBbox
    ? ' Pro Feld zusaetzlich eine "bbox" [x_min,y_min,x_max,y_max] in Pixeln des Bildes, die zeigt, WO der Wert im Bild steht.'
    : '';
  return `Extrahiere die sichtbaren Felder aus dem Bild und antworte AUSSCHLIESSLICH mit genau diesem JSON-Objekt — keine Erklaerung, kein Markdown-Codeblock. Felder, die auf dem Bild nicht erkennbar sind, als null.${bboxNote}\n${lines.join('\n')}`;
}

/**
 * Normalisiert eine vom Modell gelieferte bbox `[x_min,y_min,x_max,y_max]` zu
 * Bruchteilen (0..1) relativ zur Bildgroesse. Robust gegen die ueblichen
 * Konventionen: 0..1 (direkt), 0..1000 (Qwen-VL), oder Pixel.
 */
export function normalizeBbox(coords: unknown, w: number, h: number): { x: number; y: number; w: number; h: number } | null {
  if (!Array.isArray(coords) || coords.length !== 4 || coords.some((n) => typeof n !== 'number' || !Number.isFinite(n))) return null;
  if (!(w > 0) || !(h > 0)) return null;
  let [x0, y0, x1, y1] = coords as [number, number, number, number];
  const maxv = Math.max(x0, y0, x1, y1);
  if (maxv <= 1.0) { /* normalisiert 0..1 */ }
  else if (maxv <= 1000 && w > 1000) { x0 /= 1000; y0 /= 1000; x1 /= 1000; y1 /= 1000; }
  else { x0 /= w; x1 /= w; y0 /= h; y1 /= h; }
  const X0 = Math.max(0, Math.min(x0, x1)), X1 = Math.min(1, Math.max(x0, x1));
  const Y0 = Math.max(0, Math.min(y0, y1)), Y1 = Math.min(1, Math.max(y0, y1));
  if (X1 <= X0 || Y1 <= Y0) return null;
  return { x: X0, y: Y0, w: X1 - X0, h: Y1 - Y0 };
}

/**
 * Robustes Parsen eines JSON-Objekts aus einer Freitext-LLM-Antwort: entfernt
 * Markdown-Fences und schneidet das aeusserste `{...}` heraus.
 */
export function parseJsonObject(content: string | undefined | null): Record<string, unknown> | null {
  if (!content) return null;
  let s = content.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) return null;
  try {
    return JSON.parse(s.slice(first, last + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function parseExtractionResponse(response: ChatResponse): Record<string, unknown> | null {
  if (response.tool_calls && response.tool_calls.length > 0) {
    try {
      return JSON.parse(response.tool_calls[0]!.function.arguments) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (response.content) {
    const match = response.content.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
  }
  return null;
}

export interface RepairOptions {
  extracted: Record<string, unknown>;
  profile: ExtractionProfile;
  documentText: string;
  userId: string;
  chatOptions?: ChatOptions;
  maxPasses?: number;
  /** Dependency-Injection fuer Tests. Default: llmService.chat. */
  chat?: ChatFn;
}

export interface RepairResult {
  extracted: Record<string, unknown>;
  warnings: string[];
  calls: number;
}

export async function repairExtraction(opts: RepairOptions): Promise<RepairResult> {
  const chat: ChatFn = opts.chat ?? ((m, t, u, o) => llmService.chat(m, t, u, o));
  const maxPasses = opts.maxPasses ?? 1;
  let current = opts.extracted;
  let calls = 0;

  for (let pass = 0; pass < maxPasses; pass += 1) {
    // Validierung korrigiert Format-Issues in-place (mutiert `current`).
    const validation = validateExtraction(current, opts.profile);
    if (validation.valid) {
      return { extracted: current, warnings: [], calls };
    }
    if (!opts.documentText.trim()) {
      return {
        extracted: current,
        warnings: validation.errors.map((e) => `${e.field}: ${e.message}`),
        calls,
      };
    }

    const functionSchema = buildFunctionSchema(opts.profile);
    const toolChoice = buildToolChoice(opts.profile);
    const systemPrompt = `Du bist Daten-Extraktions-Spezialist. Eine vorherige Extraktion hatte Validierungsfehler. Korrigiere die bemaengelten Felder anhand des Dokuments und gib das VOLLSTAENDIGE korrigierte Objekt zurueck.

Fehler:
${formatValidationErrors(validation.errors)}

Regeln:
- Datumsangaben im Format YYYY-MM-DD
- Zahlen als numerische Werte (nicht als String)
- Nur belegbare Werte uebernehmen; fehlende Werte als null`;
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Bisherige Extraktion:\n${JSON.stringify(current, null, 2)}\n\nDokument:\n${opts.documentText}` },
    ];
    const usageContext: UsageContext = {
      userId: opts.userId,
      source: 'extraction',
      operation: 'validation_repair',
    };
    const chatOptions: ChatOptions = {
      ...(opts.chatOptions ?? {}),
      userId: opts.userId,
      toolChoice: toolChoice as ChatOptions['toolChoice'],
    };

    const response = await chat(messages, [functionSchema], usageContext, chatOptions);
    calls += 1;
    const repaired = parseExtractionResponse(response);
    if (!repaired) {
      return {
        extracted: current,
        warnings: validation.errors.map((e) => `${e.field}: ${e.message}`),
        calls,
      };
    }
    current = repaired;
  }

  const finalValidation = validateExtraction(current, opts.profile);
  return {
    extracted: current,
    warnings: finalValidation.errors.map((e) => `${e.field}: ${e.message}`),
    calls,
  };
}
