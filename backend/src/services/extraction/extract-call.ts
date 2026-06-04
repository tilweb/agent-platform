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
