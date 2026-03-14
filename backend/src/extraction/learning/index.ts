/**
 * Learning Extraction - Public API
 */

export type { ExtractionProject, TrainingExample, ProjectField, FieldType, LearningMetadata } from './types';
export { getAllProjects, getProject, createProject, updateProject, deleteProject } from './projects';
export { getExamples, saveExample, deleteExample } from './examples';
export { extract, train, regenerateGuidelines } from './service';
