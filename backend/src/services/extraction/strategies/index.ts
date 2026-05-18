/**
 * Strategy-Registry.
 *
 * Eine zentrale Stelle, an der alle Strategien einen Eintrag erhalten. Der
 * Orchestrator (`pipeline.ts`) sucht hier per ID. Spaetere Phasen registrieren
 * `long-text-chunked`, `vision-per-page`, `hybrid`.
 */

import type { ExtractionStrategy, StrategyId } from '../types';
import { singlePassStrategy } from './single-pass';

const REGISTRY: Map<StrategyId, ExtractionStrategy> = new Map();

function register(strategy: ExtractionStrategy): void {
  REGISTRY.set(strategy.id, strategy);
}

register(singlePassStrategy);
// P1: register(longTextChunkedStrategy);
// P3: register(visionPerPageStrategy);
// P4: register(hybridStrategy);

export function getStrategy(id: StrategyId): ExtractionStrategy | undefined {
  return REGISTRY.get(id);
}

export function listStrategies(): StrategyId[] {
  return Array.from(REGISTRY.keys());
}
