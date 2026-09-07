import { hasBlockingIssue } from './rules';
import { isRecord, validateProjectResult } from './result-validation';
import type { ExtractionProject, RuleIssue } from './types';

/** Pure boundary used before either training or persisting a human approval. */
export async function checkReview(
  project: ExtractionProject,
  corrected: unknown,
  previousIssues: RuleIssue[],
  evaluate: (project: ExtractionProject, data: Record<string, unknown>) => Promise<RuleIssue[]>,
): Promise<{ data: Record<string, unknown>; validations: RuleIssue[]; allowed: boolean }> {
  const data = isRecord(corrected) ? structuredClone(corrected) : {};
  const schemaIssues = validateProjectResult(project, data);
  const validations = [
    ...schemaIssues,
    // Missing pages, failed classification/rendering cannot be fixed by editing values.
    ...previousIssues.filter(i => i.severity === 'error' && ['verarbeitung', 'segmentierung'].includes(i.rule_id)),
    ...(schemaIssues.length ? [] : await evaluate(project, data)),
  ];
  return { data, validations, allowed: isRecord(corrected) && !hasBlockingIssue(validations) };
}
