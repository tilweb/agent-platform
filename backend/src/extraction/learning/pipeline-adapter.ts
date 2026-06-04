/**
 * Extraktions-Projekte → Heavy-Extraction-Pipeline-Adapter.
 *
 * Konvertiert ein `ExtractionProject` (Learning/Few-Shot-Feature, flache Felder)
 * in ein `ExtractionSchema`, das die generische Pipeline
 * (`backend/src/services/extraction/`) versteht. Analog zu
 * `apps/vertragsmanagement/extraction-adapter.ts`.
 *
 * Zwei Besonderheiten gegenueber dem Vertragsmanagement-Adapter:
 *   1. Projekt-Felder sind FLACH (`Record<fieldId, ProjectField>`), waehrend
 *      `ExtractionProfile.fields` GRUPPIERT ist. Wir wickeln die flachen Felder
 *      in EINE synthetische Gruppe (`PROJECT_FIELD_GROUP`). Die Pipeline liefert
 *      dann dotted paths `felder.<id>`; der aufrufende Service entpackt das
 *      Praefix wieder zu flach.
 *   2. Das "Learning" (gelernte Guidelines + Few-Shot-Beispiele) wird in das
 *      optionale `profile.guidelines`-Feld gerendert. Die Strategien haengen es
 *      via `appendGuidelines()` an ihren System-Prompt an.
 */

import type { ExtractionProfile, FieldDefinition } from '../types';
import {
  applyExtractionDefaults,
  type ExtractionSchema,
} from '../../services/extraction';
import type { ExtractionProject, TrainingExample } from './types';

/** Name der synthetischen Gruppe, in die flache Projekt-Felder gewickelt werden. */
export const PROJECT_FIELD_GROUP = 'felder';

function sanitizeId(id: string): string {
  return id.replace(/[^a-z0-9_]/gi, '_');
}

/**
 * Rendert das "Learning" (Layer 3 + 4 aus dem alten `buildSystemPrompt`):
 * gelernte Extraktionsregeln + Few-Shot-Beispiele. Wird ins
 * `profile.guidelines`-Feld gelegt. Leerer String, wenn nichts vorhanden.
 */
export function buildLearningGuidelines(
  project: ExtractionProject,
  examples: TrainingExample[],
): string {
  const parts: string[] = [];

  if (project.guidelines && project.guidelines.trim()) {
    parts.push(
      'Gelernte Extraktionsregeln (aus bisherigen Korrekturen):',
      project.guidelines.trim(),
    );
  }

  if (examples.length > 0) {
    if (parts.length > 0) parts.push('');
    parts.push('Beispiele aus bisherigen Extraktionen:');
    for (const example of examples) {
      const docSnippet = example.document_text.substring(0, 500);
      const correctData = JSON.stringify(example.corrected_extraction, null, 2);
      parts.push('');
      parts.push(`Dokument (Auszug): "${docSnippet}${example.document_text.length > 500 ? '...' : ''}"`);
      parts.push(`Korrekte Extraktion: ${correctData}`);
      if (example.corrections.length > 0) {
        parts.push('Anmerkungen zu Korrekturen:');
        for (const c of example.corrections) {
          parts.push(`  - Feld "${c.field}": "${c.was}" war falsch, korrekt ist "${c.corrected_to}"`);
        }
      }
    }
  }

  return parts.join('\n');
}

function buildProfile(project: ExtractionProject, guidelines: string): ExtractionProfile {
  const fields: Record<string, FieldDefinition> = {};
  for (const [fieldId, field] of Object.entries(project.fields)) {
    const def: FieldDefinition = {
      type: field.type,
      required: field.required,
      label: field.label,
    };
    if (field.description) def.hint = field.description;
    fields[fieldId] = def;
  }

  return {
    id: `proj_${sanitizeId(project.id)}`,
    name: project.name,
    description: project.description || project.name,
    version: '1.0',
    detection: { keywords: [] },
    fields: { [PROJECT_FIELD_GROUP]: fields },
    guidelines: guidelines.trim() ? guidelines : undefined,
  };
}

/**
 * Adapter: ExtractionProject → ExtractionSchema.
 *
 * Default-Strategie ist `hybrid` (echte Confidence + Vision-Robustheit fuer
 * Scans/Bilder), sofern das Projekt keine eigene `extraction`-Config hat.
 */
export function extractionProjectToExtractionSchema(
  project: ExtractionProject,
  fewShotExamples: TrainingExample[] = [],
): ExtractionSchema {
  const guidelines = buildLearningGuidelines(project, fewShotExamples);
  const config = applyExtractionDefaults(project.extraction ?? { strategy: 'hybrid', vision_fallback: true });
  // Projekte behalten ihr altes Retry-mit-Validierungs-Feedback-Verhalten,
  // sofern nicht explizit abgeschaltet.
  config.validation_repair = project.extraction?.validation_repair ?? true;
  return {
    id: `proj_${sanitizeId(project.id)}`,
    name: project.name,
    profile: buildProfile(project, guidelines),
    config,
  };
}
