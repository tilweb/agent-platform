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
import type { ExtractionProfile } from '../../extraction/types';

type ChatResponse = Awaited<ReturnType<typeof llmService.chat>>;
export type ChatFn = (
  messages: Message[],
  tools: ReturnType<typeof buildFunctionSchema>[],
  usageContext: UsageContext,
  options: ChatOptions,
) => Promise<ChatResponse>;

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
