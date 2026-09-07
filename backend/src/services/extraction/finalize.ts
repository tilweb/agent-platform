import { validateExtraction } from '../../extraction/validator';
import type { ExtractionProfile } from '../../extraction/types';
import type { StrategyResult } from './types';

/** Validate the final value, never attach pre-repair evidence to changed data. */
export function finalizeResult(result: StrategyResult, before: Record<string, unknown>, profile: ExtractionProfile): StrategyResult {
  const validation = validateExtraction(result.extracted, profile);
  const changed: string[] = [];
  for (const [group, definition] of Object.entries(profile.fields)) {
    if ('_array' in definition) {
      if (JSON.stringify(before[group]) !== JSON.stringify(result.extracted[group])) changed.push(group);
    } else {
      for (const field of Object.keys(definition)) {
        const old = (before[group] as Record<string, unknown> | undefined)?.[field];
        const current = (result.extracted[group] as Record<string, unknown> | undefined)?.[field];
        if (JSON.stringify(old) !== JSON.stringify(current)) changed.push(`${group}.${field}`);
      }
    }
  }
  const affected = (path: string) => changed.some(p => path === p || path.startsWith(`${p}[`) || path.startsWith(`${p}.`));
  const confidences = { ...result.fieldConfidences };
  const boxes = { ...result.boxes };
  for (const path of Object.keys(confidences)) if (affected(path)) confidences[path] = 0;
  for (const path of changed) confidences[path] = 0;
  for (const path of Object.keys(boxes)) if (affected(path)) delete boxes[path];
  return {
    ...result, fieldConfidences: confidences, boxes,
    provenance: result.provenance.filter(p => !affected(p.field)),
    processingIssues: [
      ...(result.processingIssues ?? []),
      ...validation.errors.map(e => ({ severity: 'error' as const, code: 'validation' as const, message: `${e.field}: ${e.message}` })),
      ...(changed.length ? [{ severity: 'error' as const, code: 'changed' as const, message: `Nach Validierung/Reparatur veränderte Werte erneut prüfen: ${changed.join(', ')}` }] : []),
    ],
    warnings: [...result.warnings, ...validation.errors.map(e => `${e.field}: ${e.message}`)],
  };
}
