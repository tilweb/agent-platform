/**
 * Heavy Extraction Pipeline — Types.
 *
 * Strategy-Pattern fuer Daten-Extraktion aus Dokumenten. Zielsetzung: keine
 * Truncation, per-Schema-konfigurierbares Verhalten, asynchron-faehig (Jobs).
 *
 * Architektur:
 *   ExtractionSchema  ──▶  Pipeline (waehlt Strategy aus extraction.strategy)
 *                              │
 *                              ▼
 *                         Strategy.run(files, schema, emit)  ──▶  StrategyResult
 *
 * Pipeline kennt keine App-spezifischen Begriffe (kein „Contract", kein
 * „Auftrag") — sie ist generisch und wird von App-Adaptern (z.B.
 * `contractSchemaToExtractionSchema`) gefuettert.
 */

import type { ExtractionProfile } from '../../extraction/types';

// ============== Strategy-Konfiguration (aus Schema-YAML) ==============

export type StrategyId =
  | 'single-pass'
  | 'long-text-chunked'
  | 'vision-per-page'
  | 'hybrid';

export type MergeStrategyId =
  | 'first-non-null'
  | 'majority-vote'
  | 'priority-by-section'
  | 'union';

/**
 * `extraction:`-Block im Schema-YAML. Alle Felder optional — die Pipeline
 * setzt Defaults beim Laden (siehe `applyExtractionDefaults`).
 */
export interface ExtractionConfig {
  strategy?: StrategyId;
  chunk_size_tokens?: number;
  chunk_overlap_tokens?: number;
  section_aware?: boolean;
  merge_strategy?: MergeStrategyId;
  confidence_threshold?: number;
  vision_fallback?: boolean;
  vision_detail?: 'low' | 'high';
  max_pages?: number;
  max_concurrent?: number;
  model_override?: {
    provider_id: string;
    model_id: string;
  } | null;
}

/**
 * Aufgeloestes ExtractionConfig (alle Defaults gesetzt). Wird intern von der
 * Pipeline verwendet.
 */
export interface ResolvedExtractionConfig {
  strategy: StrategyId;
  chunk_size_tokens: number;
  chunk_overlap_tokens: number;
  section_aware: boolean;
  merge_strategy: MergeStrategyId;
  confidence_threshold: number;
  vision_fallback: boolean;
  vision_detail: 'low' | 'high';
  max_pages: number;
  max_concurrent: number;
  model_override: { provider_id: string; model_id: string } | null;
}

// ============== Schema (Wrapper um ExtractionProfile + Config) ==============

/**
 * Ein ExtractionSchema kombiniert die Feld-Definitionen (`profile`, kompatibel
 * mit dem existing `backend/src/extraction/`-Builder) mit der Strategy-Config.
 * App-Adapter (z.B. fuer Vertragsmanagement) liefern dieses Objekt.
 */
export interface ExtractionSchema {
  id: string;
  name: string;
  profile: ExtractionProfile;        // Felder + Mapping (Library)
  config: ResolvedExtractionConfig;  // Strategy + Parameter
}

// ============== Inputs (Files & Source-Material) ==============

/**
 * Bereits-vorverarbeitetes File-Objekt (durch multiFileImporter laufen lassen).
 * Heavy-Pipeline arbeitet nicht mit Raw-Bytes — das Vorverarbeiten (Markitdown,
 * Vision-Description, XLSX-Reorder) lebt im shared Importer.
 *
 * `text` ist immer der Markdown-Text; `imageBuffer` ist nur bei Bild-Files
 * gesetzt (fuer Vision-Strategies).
 */
export interface PreparedFile {
  filename: string;
  text: string;
  mimeType: string;
  /** Optionaler Original-Buffer fuer Vision-Strategies (PDF/IMG). */
  rawBuffer?: Buffer;
  /** Optional: schon-extrahierte Page-Image-Refs (S3-Keys), falls Caller die hat. */
  pageImageKeys?: string[];
  /** Optional: Anzahl Seiten (PDF). Hilft estimateCost. */
  pageCount?: number;
}

// ============== Strategy-Vertrag ==============

export interface CostEstimate {
  tokens: number;
  calls: number;
  etaSeconds: number;
}

/**
 * Progress-Events, die eine Strategy emitten kann. Mapping auf SSE im
 * Job-Adapter (P5).
 */
export type ProgressEvent =
  | { phase: 'preparing'; message?: string }
  | { phase: 'extracting'; chunkIndex: number; chunkTotal: number; pageIndex?: number; pageTotal?: number }
  | { phase: 'merging'; fieldsMerged: number; fieldsTotal: number }
  | { phase: 'scoring'; fieldsScored: number; fieldsTotal: number }
  | { phase: 'validating'; warningCount: number }
  | { phase: 'fallback'; reason: string; pageCount?: number }
  | { phase: 'heartbeat'; elapsedMs: number };

export type ProgressEmit = (event: ProgressEvent) => void | Promise<void>;

export interface StrategyInput {
  files: PreparedFile[];
  schema: ExtractionSchema;
  userId: string;
  /** Per-Job-Override des Schema-Konfig-Models. */
  modelOverride?: { providerId: string; modelId: string } | null;
}

/**
 * Eine einzelne Quelle, die ein Feld geliefert hat (fuer Provenance + Re-Extract).
 */
export interface FieldProvenance {
  field: string;                   // dotted path, z.B. "vertragspartner.vermieter"
  value: unknown;
  /** Wo ist der Wert hergekommen? `c:N` Chunk-Index, `p:N` Page-Index. */
  source: string;
  confidence?: number;
}

export interface StrategyResult {
  extracted: Record<string, unknown>;
  fieldConfidences: Record<string, number>;   // dotted path → [0..1]
  provenance: FieldProvenance[];
  warnings: string[];
  /** Wie viele LLM-Calls hat die Strategy gemacht (fuer Cost-Tracking). */
  llmCalls: number;
  /** Die genutzte Strategy-ID (kann von Schema-Config abweichen wenn auto-eskaliert). */
  strategyUsed: StrategyId;
  /** Bei auto-eskalation: was war der ursprueeglich konfigurierte Strategy. */
  strategyOriginal?: StrategyId;
  /** Optional: kompakter Trace fuer Debug-UI. */
  raw_responses?: LLMResponseLog[];
}

export interface LLMResponseLog {
  call: number;                    // 1-basiert
  phase: string;                   // 'extract' | 'merge' | 'confidence' | 'classify' ...
  prompt_tokens?: number;
  completion_tokens?: number;
  duration_ms: number;
  truncated?: boolean;             // Pipeline soll niemals truncieren — Flag dient als Defense-in-Depth
}

// ============== Strategy-Interface ==============

export interface ExtractionStrategy {
  id: StrategyId;
  /**
   * Kosten-Schaetzung BEVOR ein LLM-Call passiert. Wird vom Orchestrator
   * benutzt um sync-vs-async und Auto-Eskalation zu entscheiden.
   */
  estimateCost(input: StrategyInput): CostEstimate;
  /**
   * Eigentliche Ausfuehrung. Strategy MUSS alle Inputs verarbeiten — kein
   * Truncation, kein Skippen. Bei Hard-Constraint-Verletzung (z.B. Model-
   * Kontext zu klein fuer Single-Pass) wirft die Strategy einen
   * `ContextOverflowError`, den der Orchestrator auf eine groessere Strategy
   * eskaliert.
   */
  run(input: StrategyInput, emit: ProgressEmit): Promise<StrategyResult>;
}

// ============== Errors ==============

export class ContextOverflowError extends Error {
  constructor(
    public readonly requiredTokens: number,
    public readonly availableTokens: number,
    public readonly strategyId: StrategyId,
  ) {
    super(
      `Strategy "${strategyId}" benoetigt ${requiredTokens} Tokens, Modell-Kontext bietet nur ${availableTokens}. Eskalieren auf chunking-faehige Strategy.`,
    );
    this.name = 'ContextOverflowError';
  }
}

export class StrategyExecutionError extends Error {
  public readonly underlyingCause?: unknown;
  constructor(message: string, underlyingCause?: unknown) {
    super(message);
    this.name = 'StrategyExecutionError';
    this.underlyingCause = underlyingCause;
  }
}

// ============== Pipeline-Result ==============

export interface PipelineRunResult {
  extracted: Record<string, unknown>;
  fieldConfidences: Record<string, number>;
  provenance: FieldProvenance[];
  warnings: string[];
  llmCalls: number;
  strategyUsed: StrategyId;
  strategyOriginal?: StrategyId;
  durationMs: number;
}

// ============== Job-Events (P5 SSE) ==============

export type JobStatus =
  | 'queued'
  | 'preparing'
  | 'extracting'
  | 'merging'
  | 'validating'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface JobEvent {
  jobId: string;
  status: JobStatus;
  progress?: ProgressEvent;
  result?: PipelineRunResult;
  error?: string;
}
