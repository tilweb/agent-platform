/**
 * Single-Pass Strategy — ein LLM-Call ueber das gesamte Dokument.
 *
 * Verhalten ist bewusst kompatibel zur existierenden Implementation in
 * `vertragsmanagement/import-service.ts:extractWithSchema`: Function-Calling
 * mit dem Profile, JSON-Antwort parsen. Aber:
 *
 *   - Kein Char-Budget. Wenn das Dokument den Modell-Kontext sprengt,
 *     wirft die Strategy `ContextOverflowError`. Der Orchestrator eskaliert
 *     dann auf `long-text-chunked`.
 *   - LLM-Modell ist ueberschreibbar (Schema oder Job-Option).
 *   - Provenance ist trivial: alle Felder kommen aus „chunk:0" (gesamtes Doc).
 *   - Confidence ist nicht modelliert — Strategy gibt 1.0 fuer alle gesetzten
 *     Felder und 0.0 fuer null/undefined zurueck. Confidence-Scoring kommt
 *     in P1 als separater Schritt im Orchestrator.
 */

import { llmService, type Message, type ChatOptions } from '../../llm';
import type { UsageContext } from '../../usageTracking';
import { buildFunctionSchema, buildToolChoice } from '../../../extraction/schema-builder';
import { validateExtraction } from '../../../extraction/validator';
import {
  ContextOverflowError,
  StrategyExecutionError,
  type CostEstimate,
  type ExtractionStrategy,
  type FieldProvenance,
  type ProgressEmit,
  type StrategyInput,
  type StrategyResult,
} from '../types';
import {
  approximateTokenCount,
  fitsInBudget,
  effectiveInputBudget,
} from '../tokenizer';

function combineFilesText(files: StrategyInput['files']): string {
  // Reihenfolge: nicht-Bilder zuerst (analog multiFileImporter.combineTexts),
  // damit strukturierte Dokumente vor Bild-Beschreibungen im Prompt liegen.
  const sorted = [...files].sort((a, b) => {
    const aImg = a.mimeType.startsWith('image/') ? 1 : 0;
    const bImg = b.mimeType.startsWith('image/') ? 1 : 0;
    return aImg - bImg;
  });
  return sorted
    .map((f) => `=== Datei: ${f.filename} ===\n${f.text}`)
    .join('\n\n');
}

/**
 * Iteriert rekursiv durch das extrahierte Objekt und sammelt Pfad → Wert.
 * `null`/`undefined`/leere Strings werden als unbesetzt behandelt.
 */
function collectFieldPaths(obj: unknown, prefix = ''): Array<{ path: string; value: unknown }> {
  const result: Array<{ path: string; value: unknown }> = [];
  if (obj === null || obj === undefined) return result;
  if (typeof obj !== 'object') {
    if (typeof obj === 'string' && obj.trim() === '') return result;
    result.push({ path: prefix, value: obj });
    return result;
  }
  if (Array.isArray(obj)) {
    // Arrays werden als ein Feld behandelt (z.B. stakeholder_list[]).
    result.push({ path: prefix, value: obj });
    return result;
  }
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const nextPath = prefix ? `${prefix}.${key}` : key;
    if (value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)) {
      result.push(...collectFieldPaths(value, nextPath));
    } else if (value !== null && value !== undefined) {
      if (typeof value === 'string' && value.trim() === '') continue;
      result.push({ path: nextPath, value });
    }
  }
  return result;
}

export const singlePassStrategy: ExtractionStrategy = {
  id: 'single-pass',

  estimateCost(input: StrategyInput): CostEstimate {
    const combined = combineFilesText(input.files);
    const tokens = approximateTokenCount(combined);
    return { tokens, calls: 1, etaSeconds: Math.max(3, Math.ceil(tokens / 2000)) };
  },

  async run(input: StrategyInput, emit: ProgressEmit): Promise<StrategyResult> {
    const combinedText = combineFilesText(input.files);

    // Hard-Constraint: passt der gesamte Text in den effektiven Input-Budget
    // des aktiven Modells? Wenn nicht — Eskalations-Signal an den Orchestrator.
    if (!fitsInBudget(combinedText)) {
      const required = approximateTokenCount(combinedText);
      throw new ContextOverflowError(
        required,
        effectiveInputBudget(),
        'single-pass',
      );
    }

    await emit({ phase: 'preparing' });

    const functionSchema = buildFunctionSchema(input.schema.profile);
    const toolChoice = buildToolChoice(input.schema.profile);

    const systemPrompt = `Du bist Daten-Extraktions-Spezialist. Extrahiere strukturierte Daten aus dem ${input.schema.name}.

Allgemeine Regeln:
- Datumsangaben immer im Format YYYY-MM-DD
- Fehlende Werte als null setzen, NICHT erfinden
- Zahlen als numerische Werte (nicht als String)
- Text exakt aus den Dokumenten uebernehmen
- Informationen aus allen Dokumenten zusammenfuehren`;

    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Extrahiere die strukturierten Daten:\n\n${combinedText}` },
    ];

    const usageContext: UsageContext = {
      userId: input.userId,
      source: 'extraction',
      operation: 'single_pass_extract',
    };

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

    await emit({ phase: 'extracting', chunkIndex: 0, chunkTotal: 1 });

    const t0 = Date.now();
    const response = await llmService.chat(messages, [functionSchema], usageContext, options);
    const durationMs = Date.now() - t0;

    let extracted: Record<string, unknown> = {};
    if (response.tool_calls && response.tool_calls.length > 0) {
      const args = response.tool_calls[0]!.function.arguments;
      try {
        extracted = JSON.parse(args);
      } catch (err) {
        throw new StrategyExecutionError(
          `Ungueltiges JSON in Function-Call: ${args.substring(0, 200)}`,
          err,
        );
      }
    } else if (response.content) {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          extracted = JSON.parse(jsonMatch[0]);
        } catch (err) {
          throw new StrategyExecutionError('LLM-Antwort enthielt kein gueltiges JSON', err);
        }
      } else {
        throw new StrategyExecutionError('LLM hat keine strukturierten Daten zurueckgegeben');
      }
    } else {
      throw new StrategyExecutionError('LLM hat keine Antwort zurueckgegeben');
    }

    // Validation analog vertragsmanagement-Pfad — Warnings (nicht Errors).
    const validation = validateExtraction(extracted, input.schema.profile);
    const warnings = validation.errors.map((e) => `${e.field}: ${e.message}`);

    // Provenance: alle gesetzten Felder kommen aus „chunk:0".
    const paths = collectFieldPaths(extracted);
    const provenance: FieldProvenance[] = paths.map((p) => ({
      field: p.path,
      value: p.value,
      source: 'c:0',
      confidence: 1.0,
    }));
    const fieldConfidences: Record<string, number> = {};
    for (const p of paths) fieldConfidences[p.path] = 1.0;

    await emit({ phase: 'validating', warningCount: warnings.length });

    return {
      extracted,
      fieldConfidences,
      provenance,
      warnings,
      llmCalls: 1,
      strategyUsed: 'single-pass',
      raw_responses: [{
        call: 1,
        phase: 'extract',
        duration_ms: durationMs,
        truncated: false,
      }],
    };
  },
};
