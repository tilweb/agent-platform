/**
 * Vertragsmanagement → Heavy-Extraction-Pipeline-Adapter.
 *
 * Konvertiert ein `ContractSchema` (UI/YAML/DB-Schema mit `select`-Typ,
 * `mapping`-Block etc.) in ein `ExtractionSchema`, das die generische
 * Pipeline (`backend/src/services/extraction/`) versteht.
 *
 * Zwei Konvertierungen:
 *   1. ContractSchema.fields → ExtractionProfile.fields (`select` → `text` mit Hint)
 *   2. ContractSchema.extraction → ResolvedExtractionConfig (Defaults aus
 *      `extraction/defaults.ts`)
 *
 * Die `mapping`-Information (party_a, value, etc.) ist Vertragsmanagement-
 * spezifisch und bleibt im Vertragsmanagement-Storage — sie wird NICHT in
 * das ExtractionSchema reingezogen, weil sie fuer die Pipeline irrelevant ist.
 */

import type { ExtractionProfile, FieldDefinition, FieldGroup } from '../../extraction/types';
import {
  applyExtractionDefaults,
  type ExtractionSchema,
} from '../../services/extraction';
import type { ContractSchema } from '../types';

/**
 * ContractSchema.fields → ExtractionProfile.fields
 * Nahezu identisch zu `contractSchemaToProfile` aus import-service.ts —
 * extrahiert hier in den Adapter, damit beide Code-Pfade dasselbe machen.
 */
function buildProfile(schema: ContractSchema): ExtractionProfile {
  const fields: Record<string, FieldGroup> = {};
  for (const [groupName, groupFields] of Object.entries(schema.fields)) {
    const converted: Record<string, FieldDefinition> = {};
    for (const [fieldName, field] of Object.entries(groupFields)) {
      const def: FieldDefinition = {
        type: field.type === 'select' ? 'text' : field.type,
        required: field.required,
        label: field.label,
      };
      if (field.options && field.options.length > 0) {
        def.hint = `Moegliche Werte: ${field.options.join(', ')}`;
      }
      converted[fieldName] = def;
    }
    fields[groupName] = converted;
  }
  return {
    id: `vm-${schema.id}`,
    name: schema.name,
    description: `Heavy-Extraction-Profile fuer Vertragstyp ${schema.id}`,
    version: '2.0',
    detection: { keywords: [] },
    fields,
  };
}

/**
 * Adapter: ContractSchema → ExtractionSchema. Defaults fuer extraction-Config
 * werden via `applyExtractionDefaults` aufgeloest.
 */
export function contractSchemaToExtractionSchema(schema: ContractSchema): ExtractionSchema {
  return {
    id: schema.id,
    name: schema.name,
    profile: buildProfile(schema),
    config: applyExtractionDefaults(schema.extraction),
  };
}
