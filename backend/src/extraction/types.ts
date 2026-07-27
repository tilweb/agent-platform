/**
 * Document Extraction Pipeline - Type Definitions
 */

// ============== Field Definitions ==============

export type FieldType = 'text' | 'number' | 'date' | 'boolean';

export interface FieldDefinition {
  type: FieldType;
  required?: boolean;
  label?: string;
  hint?: string;
}

export interface ArrayGroupDefinition {
  _array: true;
  _item_fields: Record<string, FieldDefinition>;
  /** Optionales Label der Liste (fuer die Schema-Description im LLM-Prompt). */
  _label?: string;
  /** Optionaler Hinweis an das LLM, was ein Listen-Eintrag ist (und was nicht). */
  _hint?: string;
}

export type FieldGroup = Record<string, FieldDefinition> | ArrayGroupDefinition;

function isArrayGroup(group: FieldGroup): group is ArrayGroupDefinition {
  return '_array' in group && group._array === true;
}

export { isArrayGroup };

// ============== Extraction Profile ==============

export interface ExtractionProfile {
  id: string;
  name: string;
  description: string;
  version: string;
  detection: {
    keywords: string[];
    description?: string;
  };
  fields: Record<string, FieldGroup>;
  guidelines?: string;
}

// ============== Extraction Result ==============

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export interface ValidationReport {
  valid: boolean;
  errors: ValidationError[];
  corrected: string[];  // Fields that were auto-corrected
}

export interface ExtractionResult {
  success: boolean;
  profile_id: string;
  profile_name: string;
  data: Record<string, unknown>;
  validation: ValidationReport;
  retries: number;
  error?: string;
}

// ============== Pipeline Input ==============

export type ExtractionSource =
  | { type: 'attachment'; attachment_id: string; session_id?: string }
  | { type: 'file'; path: string; filename: string }
  | { type: 'text'; content: string }
  | { type: 'base64_image'; data: string; mime_type: string };

export interface ExtractionRequest {
  source: ExtractionSource;
  profile_id?: string;  // If omitted, auto-detect
  user_id?: string;
}
