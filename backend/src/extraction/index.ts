/**
 * Document Extraction Pipeline
 *
 * Configurable pipeline for extracting structured data from documents
 * using LLM function calling and YAML-based extraction profiles.
 */

// Types
export type {
  ExtractionProfile,
  ExtractionResult,
  ExtractionRequest,
  ExtractionSource,
  FieldDefinition,
  FieldGroup,
  FieldType,
  ValidationReport,
  ValidationError,
} from './types';

// Profile management
export {
  loadProfiles,
  getAllProfiles,
  getProfile,
  saveProfile,
  deleteProfile,
  detectProfile,
} from './profiles';

// Schema builder
export { buildFunctionSchema, buildToolChoice } from './schema-builder';

// Validator
export { validateExtraction, formatValidationErrors } from './validator';

// Service (pipeline)
export { extract, detectProfileFromText, generateProfile } from './service';
