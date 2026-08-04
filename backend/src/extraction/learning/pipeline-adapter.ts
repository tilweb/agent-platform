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

import type { ExtractionProfile, FieldDefinition, FieldGroup } from '../types';
import {
  applyExtractionDefaults,
  type ExtractionSchema,
} from '../../services/extraction';
import { fieldCatalogHint } from './catalog';
import { extractionModelConfig } from '../model';
import type { ExtractionProject, FieldType, TrainingExample } from './types';

/** Name der synthetischen Gruppe, in die flache Projekt-Felder gewickelt werden. */
export const PROJECT_FIELD_GROUP = 'felder';

function sanitizeId(id: string): string {
  return id.replace(/[^a-z0-9_]/gi, '_');
}

/** Korrektur-Werte fuer den Few-Shot-Prompt: Objekte/Arrays als JSON, Skalare in Quotes. */
function fmtCorrectionValue(v: unknown): string {
  if (v !== null && typeof v === 'object') return JSON.stringify(v);
  return `"${String(v)}"`;
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

  // Stabile, hand-gepflegte Domaenen-Anweisungen zuerst (vom Lern-Loop unberuehrt).
  if (project.instructions && project.instructions.trim()) {
    parts.push(project.instructions.trim());
  }

  if (project.guidelines && project.guidelines.trim()) {
    if (parts.length > 0) parts.push('');
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
          // Listen/Objekte als JSON rendern (statt "[object Object]"); bei
          // Listen-Korrekturen zusaetzlich den Positions-Zaehler als Signal.
          const countHint =
            Array.isArray(c.was) && Array.isArray(c.corrected_to)
              ? ` (${c.was.length} → ${c.corrected_to.length} Positionen)`
              : '';
          parts.push(
            `  - Feld "${c.field}": ${fmtCorrectionValue(c.was)} war falsch, korrekt ist ${fmtCorrectionValue(c.corrected_to)}${countHint}`,
          );
        }
      }
    }
  }

  return parts.join('\n');
}

function buildProfile(project: ExtractionProject, guidelines: string): ExtractionProfile {
  const scalarFields: Record<string, FieldDefinition> = {};
  const groups: Record<string, FieldGroup> = {};

  for (const [fieldId, field] of Object.entries(project.fields)) {
    if (field.type === 'list') {
      // Listen-Feld → EIGENE Array-Gruppe unter seiner fieldId (die Engine kann
      // Array-of-Objects nativ: schema-builder/merger/validator). Die Pipeline
      // liefert das Array dann direkt unter `result.extracted[fieldId]`.
      const itemFields: Record<string, FieldDefinition> = {};
      for (const [itemId, itemField] of Object.entries(field.item_fields ?? {})) {
        const def: FieldDefinition = {
          type: itemField.type,
          // Gleiche Begruendung wie unten bei den Skalarfeldern: kein `required`
          // im Function-Schema (Vision-Kollaps-Risiko). UI-Marker bleibt erhalten.
          required: false,
          label: itemField.label,
        };
        // Beschreibung + kontrollierte Werteliste (Welle 6) landen im selben
        // Hint — beide Prompt-Bauer (Function-Schema und Vision-JSON) rendern ihn.
        const itemHint = [itemField.description, fieldCatalogHint(itemField)].filter(Boolean).join(' ');
        if (itemHint) def.hint = itemHint;
        itemFields[itemId] = def;
      }
      groups[fieldId] = {
        _array: true,
        _item_fields: itemFields,
        _label: field.label,
        ...(field.description ? { _hint: field.description } : {}),
      };
      continue;
    }

    const def: FieldDefinition = {
      type: field.type as FieldType,
      // Bewusst KEINE `required`-Markierung im Function-Schema: Vision-Modelle
      // (z.B. Mistral 3 24B) erfuellen ein required-beschraenktes Schema unter
      // Last manchmal MINIMAL — sie liefern nur die Pflichtfelder und lassen alle
      // optionalen weg (beobachtet: Kollaps von 20 auf genau die 5 Pflichtfelder).
      // Ohne required extrahiert das Modell konsistent vollstaendig. Die
      // `field.required`-Info des Projekts bleibt fuers UI erhalten, fliesst aber
      // nicht in die Extraktion ein.
      required: false,
      label: field.label,
    };
    const hint = [field.description, fieldCatalogHint(field)].filter(Boolean).join(' ');
    if (hint) def.hint = hint;
    scalarFields[fieldId] = def;
  }

  return {
    id: `proj_${sanitizeId(project.id)}`,
    name: project.name,
    description: project.description || project.name,
    version: '1.0',
    detection: { keywords: [] },
    // Skalare in der synthetischen Gruppe `felder`, jede Liste als eigene
    // Array-Gruppe daneben. Reihenfolge: `felder` zuerst (stabil fuer Prompts).
    fields: { [PROJECT_FIELD_GROUP]: scalarFields, ...groups },
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
  // Die Extraktion bindet ihr Modell selbst (siehe extraction/model.ts) — die
  // Session-/Nutzerwahl darf sie nicht beeinflussen. Ein projekteigenes Modell
  // bleibt eine bewusste fachliche Entscheidung und schlaegt die Bindung.
  config.model_override = project.extraction?.model_override ?? extractionModelConfig();
  return {
    id: `proj_${sanitizeId(project.id)}`,
    name: project.name,
    profile: buildProfile(project, guidelines),
    config,
  };
}
