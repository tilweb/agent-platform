/**
 * Learning Extraction - Type Definitions
 *
 * Flat, intent-based extraction with learning from corrections.
 */

import type { ExtractionConfig } from '../../services/extraction';

export type FieldType = 'text' | 'number' | 'date' | 'boolean';

/** Projekt-Feldtypen: Skalare plus Listen (Positionsdaten, z.B. Rechnungspositionen). */
export type ProjectFieldType = FieldType | 'list';

/**
 * Spalte einer Positions-Tabelle (list-Feld). Bewusst KEIN 'list' als Typ —
 * Listen sind genau eine Ebene tief (keine Verschachtelung).
 */
export interface ProjectItemField {
  type: FieldType;
  label: string;
  required?: boolean;
  description?: string;
}

export interface ProjectField {
  type: ProjectFieldType;
  required: boolean;
  label: string;
  description?: string;
  /** Nur bei type === 'list': Spalten der Positions-Tabelle (1 Ebene tief). */
  item_fields?: Record<string, ProjectItemField>;
}

/** Type-Guard: ist das Projekt-Feld eine Positions-Liste? */
export function isListField(f: ProjectField): boolean {
  return f.type === 'list';
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
  /**
   * Hand-gepflegte Domaenen-Anweisungen. Stabil — wird vom Lern-Loop NICHT
   * ueberschrieben (anders als `guidelines`). Wird im Vision-/Extraktions-Prompt
   * VOR den gelernten Guidelines + Few-Shot gerendert.
   */
  instructions?: string;
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
