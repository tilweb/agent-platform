/**
 * Learning Extraction - Type Definitions
 *
 * Flat, intent-based extraction with learning from corrections.
 */

import type { ExtractionConfig } from '../../services/extraction';

export type FieldType = 'text' | 'number' | 'date' | 'boolean';

export interface ProjectField {
  type: FieldType;
  required: boolean;
  label: string;
  description?: string;
}

export interface LearningMetadata {
  total_examples: number;
  accuracy_estimate: number;
  guideline_version: number;
}

export interface ExtractionProject {
  id: string;
  name: string;
  description: string;
  created: string;
  updated: string;
  fields: Record<string, ProjectField>;
  guidelines: string;
  learning: LearningMetadata;
  /**
   * Optionale Heavy-Pipeline-Konfiguration (Strategie + Parameter). Wenn nicht
   * gesetzt, nutzt der Adapter Default `hybrid`. Pro-Projekt in den
   * Projekt-Settings konfigurierbar.
   */
  extraction?: ExtractionConfig;
}

export interface TrainingExample {
  id: string;
  created: string;
  source_filename: string;
  document_text: string;
  initial_extraction: Record<string, unknown>;
  corrected_extraction: Record<string, unknown>;
  corrections: Array<{
    field: string;
    was: unknown;
    corrected_to: unknown;
  }>;
  confirmed_correct: boolean;
}
