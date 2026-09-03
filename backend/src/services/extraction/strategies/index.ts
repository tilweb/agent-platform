/**
 * Strategy-Registry.
 *
 * Eine zentrale Stelle, an der alle Strategien einen Eintrag erhalten. Der
 * Orchestrator (`pipeline.ts`) sucht hier per ID.
 */

import type { ExtractionStrategy, StrategyId } from '../types';
import { singlePassStrategy } from './single-pass';
import { longTextChunkedStrategy } from './long-text-chunked';
import { visionPerPageStrategy } from './vision-per-page';
import { hybridStrategy } from './hybrid';
import { templateLabelmapStrategy } from './template-labelmap';

const REGISTRY: Map<StrategyId, ExtractionStrategy> = new Map();

function register(strategy: ExtractionStrategy): void {
  REGISTRY.set(strategy.id, strategy);
}

register(singlePassStrategy);
register(longTextChunkedStrategy);
register(visionPerPageStrategy);
register(hybridStrategy);
register(templateLabelmapStrategy);

export function getStrategy(id: StrategyId): ExtractionStrategy | undefined {
  return REGISTRY.get(id);
}

export function listStrategies(): StrategyId[] {
  return Array.from(REGISTRY.keys());
}
