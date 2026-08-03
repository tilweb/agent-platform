/**
 * Learning Extraction - Public API
 */

export type { ExtractionProject, TrainingExample, ProjectField, ProjectItemField, ProjectFieldType, FieldType, LearningMetadata } from './types';
export { isListField } from './types';
export type { ReviewStatus, CalibrationState } from './types';
export type { ExtractionRule, SumRule, LookupRule, RuleIssue, RuleSeverity } from './types';
export { dedupeListItems } from './list-utils';
export { validateProjectFields, validateProjectRules } from './validators';
export { evaluateRules, hasBlockingIssue, describeRule } from './rules';
export { applyCatalogs, matchCatalogValue, renderCatalogHint, normalizeForMatch, levenshtein } from './catalog';
export type { CatalogValue, FieldCatalog } from './types';
export { computeReviewStatus, resolveReviewThreshold, updateCalibration } from './review';
export { getAllProjects, getProject, createProject, updateProject, deleteProject } from './projects';
export { getExamples, saveExample, deleteExample } from './examples';
export { extract, train, regenerateGuidelines, runGuidelineUpdate, runFullEval, evaluateProjectRules, ingestPlainText } from './service';
export { inferSchema, parseInferredFields, slugifyFieldId } from './schema-infer';
export type { InferredSchema } from './schema-infer';
export type { EvalScore, LearningEvalState, EvalRunAction } from './types';
export {
  createBatchRun,
  setRunStatus,
  upsertFileResult,
  listBatchRuns,
  getBatchRun,
  getBatchRunFileDetail,
  deleteBatchRun,
} from './batch-runs';
export type {
  BatchRunStatus,
  BatchRunSummary,
  BatchFileSummary,
  BatchFileDetail,
  FileResultPayload,
  FileAudit,
} from './batch-runs';
export { runBatchExtraction } from './batch-service';
export { readPageImage, savePageImages, deletePageImages } from './page-store';
export { cosine, rankBySimilarity, blendSelection } from './similarity';
export { embedDocument, isSimilarityEnabled } from './embeddings';
export type { StoredPageImage } from './page-store';
export { exportProject, importProject } from './transfer';
export type { ProjectBundle } from './transfer';
