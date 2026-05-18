/**
 * Heavy Extraction Pipeline — Orchestrator.
 *
 * Verantwortlichkeiten:
 *   1. Strategy ausgehend von `schema.config.strategy` waehlen.
 *   2. estimateCost ausfuehren — wenn Single-Pass den Modell-Kontext
 *      sprengen wuerde, automatisch auf `long-text-chunked` eskalieren
 *      (sobald P1 implementiert ist).
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
 *
 * Long-Text-Chunked + Vision-Per-Page + Hybrid kommen in P1/P3/P4 dazu.
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

      return {
        extracted: result.extracted,
        fieldConfidences: result.fieldConfidences,
        provenance: result.provenance,
        warnings: result.warnings,
        llmCalls: result.llmCalls,
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
          // Eskalations-Ziel noch nicht implementiert (z.B. long-text-chunked in P0).
          // Konsumenten kriegen einen klaren Fehler, koennen darauf reagieren
          // (manuell chunking machen oder kuerzere Files schicken).
          throw new StrategyExecutionError(
            `Dokument zu gross fuer "${currentId}". Eskalations-Ziel "${nextId}" ist noch nicht verfuegbar (P1).`,
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
