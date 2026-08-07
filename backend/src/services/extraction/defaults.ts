/**
 * Heavy Extraction Pipeline — Default-Werte fuer ExtractionConfig.
 *
 * Schemas duerfen jedes Feld einzeln setzen (z.B. nur `strategy:` ohne
 * `chunk_size_tokens`). Die Pipeline loest mit diesen Defaults auf.
 */

import type { ExtractionConfig, ResolvedExtractionConfig } from './types';

export const EXTRACTION_DEFAULTS: ResolvedExtractionConfig = {
  strategy: 'single-pass',
  chunk_size_tokens: 8000,
  chunk_overlap_tokens: 500,
  section_aware: true,
  merge_strategy: 'first-non-null',
  confidence_threshold: 0.6,
  vision_fallback: false,
  vision_detail: 'high',
  max_pages: 500,
  max_concurrent: 4,
  validation_repair: false,
  llm_confidence: true,
  model_override: null,
};

/**
 * Render-Aufloesung fuer den Vision-Pfad (vision-per-page + hybrid).
 * Bild-Token dominieren die Kosten (~95 %, quadratisch zur Aufloesung:
 * 200 dpi ≈ 3.720 Token je Seite, 150 dpi ≈ 2.150). Per ENV verstellbar,
 * damit die Qualitaet je Aufloesung MESSBAR ist statt geraten
 * (W9-DPI-Messung, siehe Standortbestimmung 2026-08-08).
 */
export function extractionVisionDpi(): number {
  const raw = Number(process.env.EXTRACTION_VISION_DPI);
  if (Number.isFinite(raw) && raw >= 72 && raw <= 300) return Math.round(raw);
  return 200;
}

/**
 * Schwelle fuer synchron-vs-Job-Entscheidung im Orchestrator.
 * estimateCost.tokens > SYNC_THRESHOLD_TOKENS → Job-Pfad.
 */
export const SYNC_THRESHOLD_TOKENS = 8000;

/**
 * Anteil des LLM-Kontexts, ab dem ein single-pass auf chunked eskaliert.
 * Schutz vor „Schema sagt single-pass aber Dokument ist 200 Seiten".
 */
export const CONTEXT_USAGE_THRESHOLD = 0.8;

/**
 * Hybrid-Strategy: Vision-Fallback wird pro Seite getriggert wenn mindestens
 * N Felder auf dieser Seite unter dem confidence-Threshold liegen. Verhindert,
 * dass jedes einzelne unsichere Feld einen eigenen Vision-Call ausloest
 * (Cost-Explosion).
 */
export const HYBRID_VISION_MIN_LOW_CONFIDENCE_FIELDS_PER_PAGE = 2;

/**
 * Kombiniert ein optionales ExtractionConfig mit den Defaults.
 */
export function applyExtractionDefaults(
  config: ExtractionConfig | undefined,
): ResolvedExtractionConfig {
  if (!config) return { ...EXTRACTION_DEFAULTS };
  return {
    strategy: config.strategy ?? EXTRACTION_DEFAULTS.strategy,
    chunk_size_tokens: config.chunk_size_tokens ?? EXTRACTION_DEFAULTS.chunk_size_tokens,
    chunk_overlap_tokens: config.chunk_overlap_tokens ?? EXTRACTION_DEFAULTS.chunk_overlap_tokens,
    section_aware: config.section_aware ?? EXTRACTION_DEFAULTS.section_aware,
    merge_strategy: config.merge_strategy ?? EXTRACTION_DEFAULTS.merge_strategy,
    confidence_threshold: config.confidence_threshold ?? EXTRACTION_DEFAULTS.confidence_threshold,
    vision_fallback: config.vision_fallback ?? EXTRACTION_DEFAULTS.vision_fallback,
    vision_detail: config.vision_detail ?? EXTRACTION_DEFAULTS.vision_detail,
    max_pages: config.max_pages ?? EXTRACTION_DEFAULTS.max_pages,
    max_concurrent: config.max_concurrent ?? EXTRACTION_DEFAULTS.max_concurrent,
    validation_repair: config.validation_repair ?? EXTRACTION_DEFAULTS.validation_repair,
    llm_confidence: config.llm_confidence ?? EXTRACTION_DEFAULTS.llm_confidence,
    model_override: config.model_override ?? EXTRACTION_DEFAULTS.model_override,
  };
}
