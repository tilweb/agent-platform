/**
 * Learning Extraction - Public API
 */

export type { ExtractionProject, TrainingExample, ProjectField, ProjectItemField, ProjectFieldType, FieldType, LearningMetadata } from './types';
export { isListField } from './types';
export { dedupeListItems } from './list-utils';
export { validateProjectFields } from './validators';
export { getAllProjects, getProject, createProject, updateProject, deleteProject } from './projects';
export { getExamples, saveExample, deleteExample } from './examples';
export { extract, train, regenerateGuidelines, runGuidelineUpdate, runFullEval } from './service';
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
export { exportProject, importProject } from './transfer';
export type { ProjectBundle } from './transfer';
