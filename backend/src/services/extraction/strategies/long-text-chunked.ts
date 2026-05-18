/**
 * Long-Text-Chunked Strategy.
 *
 * Pipeline:
 *   1. Combine alle File-Texte (analog single-pass).
 *   2. Chunk via chunker.ts (section_aware oder hart).
 *   3. Pro Chunk LLM-Function-Call mit dem Profile. pLimit auf max_concurrent.
 *   4. Merge alle Chunk-Resultate via merger.ts (merge_strategy aus Schema).
 *   5. Confidence-Score per Heuristik (+ optional LLM-Self-Reflection).
 *
 * Cost: O(chunks) LLM-Calls + O(field-groups) Confidence-Calls. Bei 400-Seiten-
 * Doc und chunk_size=8000 Tokens → ~10-15 Chunks → ~12-17 LLM-Calls total.
 *
 * Truncation: NIEMALS. Der Combine-Step bekommt `unbounded: true` von der
 * Pipeline-Schicht, der Chunker schneidet nur am Token-Limit (mit Overlap),
 * der Merger verliert keine Information.
 */

import { llmService, type Message, type ChatOptions } from '../../llm';
import type { UsageContext } from '../../usageTracking';
import { buildFunctionSchema, buildToolChoice } from '../../../extraction/schema-builder';
import { validateExtraction } from '../../../extraction/validator';
import {
  StrategyExecutionError,
  type CostEstimate,
  type ExtractionStrategy,
  type LLMResponseLog,
  type ProgressEmit,
  type StrategyInput,
  type StrategyResult,
} from '../types';
import { approximateTokenCount } from '../tokenizer';
import { chunkText } from '../chunker';
import { mergeChunks, type ChunkExtraction } from '../merger';
import { scoreConfidences } from '../confidence';

function combineFilesText(files: StrategyInput['files']): string {
  const sorted = [...files].sort((a, b) => {
    const aImg = a.mimeType.startsWith('image/') ? 1 : 0;
    const bImg = b.mimeType.startsWith('image/') ? 1 : 0;
    return aImg - bImg;
  });
  return sorted.map((f) => `=== Datei: ${f.filename} ===\n${f.text}`).join('\n\n');
}

/**
 * Einfaches pLimit ohne Dependency (Pattern aus catalog-builder.ts).
 */
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

export const longTextChunkedStrategy: ExtractionStrategy = {
  id: 'long-text-chunked',

  estimateCost(input: StrategyInput): CostEstimate {
    const combined = combineFilesText(input.files);
    const tokens = approximateTokenCount(combined);
    // Anzahl Chunks ≈ tokens / chunk_size (vereinfacht, ohne Overlap-Korrektur)
    const chunkSize = input.schema.config.chunk_size_tokens;
    const chunks = Math.max(1, Math.ceil(tokens / chunkSize));
    const confidenceCalls = Math.max(1, Object.keys(input.schema.profile.fields).length);
    const calls = chunks + confidenceCalls;
    // ETA: ~15s pro Chunk (LLM + Netzwerk), Confidence-Calls schneller
    const etaSeconds = chunks * 15 + confidenceCalls * 5;
    return { tokens, calls, etaSeconds };
  },

  async run(input: StrategyInput, emit: ProgressEmit): Promise<StrategyResult> {
    const combined = combineFilesText(input.files);
    await emit({ phase: 'preparing' });

    const chunks = chunkText(combined, {
      chunkSizeTokens: input.schema.config.chunk_size_tokens,
      chunkOverlapTokens: input.schema.config.chunk_overlap_tokens,
      sectionAware: input.schema.config.section_aware,
    });

    if (chunks.length === 0) {
      throw new StrategyExecutionError('Chunker hat keinen Chunk geliefert (leerer Text?).');
    }

    const functionSchema = buildFunctionSchema(input.schema.profile);
    const toolChoice = buildToolChoice(input.schema.profile);

    const systemPrompt = `Du bist Daten-Extraktions-Spezialist fuer ${input.schema.name}. Du bekommst EINEN Ausschnitt eines laengeren Dokuments — extrahiere alle Felder, die du in DIESEM Ausschnitt findest.

Wichtig:
- Felder, die in diesem Ausschnitt nicht enthalten sind, MUSST du als null zurueckgeben — NICHT erfinden.
- Datumsangaben im Format YYYY-MM-DD.
- Zahlen als numerische Werte.
- Andere Chunks decken den Rest des Dokuments ab; sie werden danach gemergt.`;

    const options: ChatOptions = {
      userId: input.userId,
      toolChoice: toolChoice as ChatOptions['toolChoice'],
    };
    if (input.modelOverride || input.schema.config.model_override) {
      const override = input.modelOverride
        ?? (input.schema.config.model_override
          ? { providerId: input.schema.config.model_override.provider_id, modelId: input.schema.config.model_override.model_id }
          : undefined);
      if (override) options.modelOverride = override;
    }

    const usageContext: UsageContext = {
      userId: input.userId,
      source: 'extraction',
      operation: 'long_text_chunked',
    };

    const logs: LLMResponseLog[] = [];
    let chunkLogCounter = 0;

    const extracts: ChunkExtraction[] = await pLimit(
      chunks,
      input.schema.config.max_concurrent,
      async (chunk) => {
        await emit({ phase: 'extracting', chunkIndex: chunk.index, chunkTotal: chunks.length });

        const messages: Message[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Ausschnitt ${chunk.index + 1} von ${chunks.length}${chunk.heading ? ` (Sektion: ${chunk.heading})` : ''}:\n\n${chunk.text}` },
        ];

        const t0 = Date.now();
        const response = await llmService.chat(messages, [functionSchema], usageContext, options);
        const durationMs = Date.now() - t0;

        let data: Record<string, unknown> = {};
        if (response.tool_calls && response.tool_calls.length > 0) {
          const args = response.tool_calls[0]!.function.arguments;
          try {
            data = JSON.parse(args);
          } catch {
            // Bei Parse-Fehler: leeres Objekt — Chunk traegt nichts bei, aber blockiert nicht.
            console.warn(`[long-text-chunked] Chunk ${chunk.index}: Ungueltiges Function-Call-JSON, ignoriere.`);
          }
        } else if (response.content) {
          const jsonMatch = response.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              data = JSON.parse(jsonMatch[0]);
            } catch {
              console.warn(`[long-text-chunked] Chunk ${chunk.index}: Content-JSON nicht parsebar.`);
            }
          }
        }

        chunkLogCounter += 1;
        logs.push({
          call: chunkLogCounter,
          phase: 'extract',
          duration_ms: durationMs,
          truncated: false,
        });

        return {
          chunkIndex: chunk.index,
          heading: chunk.heading,
          data,
        };
      },
    );

    // ============== Merge ==============
    await emit({ phase: 'merging', fieldsMerged: 0, fieldsTotal: Object.keys(input.schema.profile.fields).length });
    const { merged, provenance } = mergeChunks(extracts, input.schema.profile, input.schema.config.merge_strategy);

    // ============== Confidence-Score ==============
    await emit({ phase: 'scoring', fieldsScored: 0, fieldsTotal: provenance.length });
    const { confidences, llmCalls: confidenceCalls } = await scoreConfidences(
      extracts,
      merged,
      input.schema.profile,
      input.userId,
      { useLLM: true },
    );

    // Provenance um Confidence anreichern
    for (const p of provenance) {
      p.confidence = confidences[p.field] ?? 0;
    }

    // ============== Validation ==============
    const validation = validateExtraction(merged, input.schema.profile);
    const warnings = validation.errors.map((e) => `${e.field}: ${e.message}`);
    await emit({ phase: 'validating', warningCount: warnings.length });

    return {
      extracted: merged,
      fieldConfidences: confidences,
      provenance,
      warnings,
      llmCalls: chunks.length + confidenceCalls,
      strategyUsed: 'long-text-chunked',
      raw_responses: logs,
    };
  },
};
