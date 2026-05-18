/**
 * Heavy Extraction Pipeline — Public API.
 *
 * Konsumenten importieren von hier (`'../services/extraction'`), nicht von
 * den internen Modulen. So koennen wir die interne Struktur frei umstellen
 * ohne App-Code zu brechen.
 */

export { runPipeline, type RunPipelineInput } from './pipeline';
export { applyExtractionDefaults, EXTRACTION_DEFAULTS, SYNC_THRESHOLD_TOKENS } from './defaults';
export { approximateTokenCount, fitsInBudget, effectiveInputBudget } from './tokenizer';
export { getStrategy, listStrategies } from './strategies';

export type {
  ExtractionConfig,
  ResolvedExtractionConfig,
  ExtractionSchema,
  ExtractionStrategy,
  StrategyId,
  StrategyInput,
  StrategyResult,
  MergeStrategyId,
  PreparedFile,
  PipelineRunResult,
  ProgressEmit,
  ProgressEvent,
  CostEstimate,
  FieldProvenance,
  LLMResponseLog,
  JobStatus,
  JobEvent,
} from './types';

export { ContextOverflowError, StrategyExecutionError } from './types';
