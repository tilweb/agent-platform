/**
 * Heavy Extraction Pipeline — Orchestrator.
 *
 * Verantwortlichkeiten:
 *   1. Strategy ausgehend von `schema.config.strategy` waehlen.
 *   2. Bei `ContextOverflowError` automatisch auf `long-text-chunked`
 *      eskalieren (Single-Pass sprengt den Modell-Kontext).
 *   3. `strategy.run()` aufrufen, Progress weiterreichen.
 *   4. Result anreichern (Wallzeit, ggf. originalStrategy).
 *
 * Bewusst generisch: kein Wissen ueber Vertraege, Auftraege oder Ideen.
 * App-Adapter wandeln App-Schema → ExtractionSchema und rufen `runPipeline`.
 */

import {
  ContextOverflowError,
  StrategyExecutionError,
  type ExtractionSchema,
  type PipelineRunResult,
  type PreparedFile,
  type ProgressEmit,
  type StrategyId,
} from './types';
import { getStrategy } from './strategies';
import { repairExtraction } from './extract-call';
import type { ChatOptions } from '../llm';

export interface RunPipelineInput {
  files: PreparedFile[];
  schema: ExtractionSchema;
  userId: string;
  emit?: ProgressEmit;
  modelOverride?: { providerId: string; modelId: string } | null;
}

/**
 * Versucht eine Strategy, eskaliert bei `ContextOverflowError` auf die naechst-
 * groessere. Die Eskalations-Kette ist hart-kodiert:
 *
 *   single-pass  →  long-text-chunked  →  (Fail)
 *   vision-per-page                    →  (Fail; Vision skaliert ueber Pages)
 *   hybrid                             →  (Fail; Hybrid skaliert eh schon)
 */
const ESCALATION_PATH: Record<StrategyId, StrategyId | null> = {
  'single-pass': 'long-text-chunked',
  'long-text-chunked': null,
  'vision-per-page': null,
  'hybrid': null,
};

const noopEmit: ProgressEmit = () => undefined;

export async function runPipeline(input: RunPipelineInput): Promise<PipelineRunResult> {
  const startedAt = Date.now();
  const emit = input.emit ?? noopEmit;

  const initialStrategyId = input.schema.config.strategy;
  let currentId: StrategyId = initialStrategyId;
  let escalatedFrom: StrategyId | undefined;

  // Maximal eine Eskalation pro Run (single-pass → chunked). Mehrfaches Springen
  // sollte nicht passieren — wenn doch, will man's eher als Bug erkennen.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const strategy = getStrategy(currentId);
    if (!strategy) {
      throw new StrategyExecutionError(
        `Keine Strategy registriert fuer ID "${currentId}". Verfuegbar: ${input.schema.config.strategy}`,
      );
    }

    try {
      const result = await strategy.run(
        {
          files: input.files,
          schema: input.schema,
          userId: input.userId,
          modelOverride: input.modelOverride ?? null,
        },
        emit,
      );

      // Optionaler Validierungs-Repair (opt-in via `config.validation_repair`).
      // Korrigiert das gemergte Ergebnis bei Validierungsfehlern in einem
      // gezielten, TEXT-basierten LLM-Call.
      //
      // NICHT bei `vision-per-page`: dort ist das Dokument rein visuell, und der
      // `text` der PreparedFile ist leer oder (bei gescannten PDFs via Markitdown)
      // unbrauchbar. Ein Text-Repair wuerde die guten Vision-Ergebnisse durch eine
      // Re-Extraktion aus Muell-Text ersetzen. Format-Auto-Korrektur (DE-Daten/
      // -Zahlen) passiert ohnehin bereits in der Strategy via `validateExtraction`.
      let finalExtracted = result.extracted;
      let finalWarnings = result.warnings;
      let extraCalls = 0;
      if (input.schema.config.validation_repair && result.strategyUsed !== 'vision-per-page') {
        const documentText = input.files.map((f) => f.text).filter((t) => t && t.trim()).join('\n\n');
        const chatOptions: ChatOptions = { userId: input.userId };
        const override = input.modelOverride
          ?? (input.schema.config.model_override
            ? { providerId: input.schema.config.model_override.provider_id, modelId: input.schema.config.model_override.model_id }
            : undefined);
        if (override) chatOptions.modelOverride = override;
        const repair = await repairExtraction({
          extracted: result.extracted,
          profile: input.schema.profile,
          documentText,
          userId: input.userId,
          chatOptions,
        });
        finalExtracted = repair.extracted;
        finalWarnings = repair.warnings;
        extraCalls = repair.calls;
        if (extraCalls > 0) await emit({ phase: 'validating', warningCount: finalWarnings.length });
      }

      return {
        extracted: finalExtracted,
        fieldConfidences: result.fieldConfidences,
        provenance: result.provenance,
        boxes: result.boxes,
        pageImages: result.pageImages,
        warnings: finalWarnings,
        llmCalls: result.llmCalls + extraCalls,
        strategyUsed: result.strategyUsed,
        strategyOriginal: escalatedFrom ?? (initialStrategyId !== result.strategyUsed ? initialStrategyId : undefined),
        durationMs: Date.now() - startedAt,
      };
    } catch (err) {
      if (err instanceof ContextOverflowError) {
        const nextId = ESCALATION_PATH[currentId];
        if (!nextId) {
          throw new StrategyExecutionError(
            `Dokument zu gross fuer Strategy "${currentId}", keine Eskalation moeglich.`,
            err,
          );
        }
        const nextStrategy = getStrategy(nextId);
        if (!nextStrategy) {
          // Eskalations-Ziel nicht in der Registry — sollte nicht passieren,
          // da alle Strategien registriert sind. Konsumenten kriegen einen
          // klaren Fehler (manuell chunking machen oder kuerzere Files schicken).
          throw new StrategyExecutionError(
            `Dokument zu gross fuer "${currentId}". Eskalations-Ziel "${nextId}" ist nicht registriert.`,
            err,
          );
        }
        await emit({
          phase: 'fallback',
          reason: `Dokument benoetigt ${err.requiredTokens} Tokens, Modell bietet ${err.availableTokens} — eskaliere zu "${nextId}".`,
        });
        escalatedFrom = currentId;
        currentId = nextId;
        continue;
      }
      throw err;
    }
  }

  throw new StrategyExecutionError(
    'Pipeline hat das Eskalations-Limit ueberschritten — sollte nie passieren.',
  );
}
