/**
 * Extraction Validator
 *
 * Validates extracted data against the profile schema.
 * Auto-corrects common issues (date formats, number formats).
 */

import type { ExtractionProfile, FieldDefinition, FieldGroup, ArrayGroupDefinition, ValidationReport, ValidationError } from './types';
import { isArrayGroup } from './types';

import { correctNumber, correctDate } from './value-parsers';

/**
 * Validate a single field value against its definition
 */
function validateField(
  fieldName: string,
  value: unknown,
  definition: FieldDefinition,
  parentPath: string,
  errors: ValidationError[],
  corrected: string[],
  data: Record<string, unknown>
): void {
  const path = parentPath ? `${parentPath}.${fieldName}` : fieldName;

  // LLMs liefern manchmal den String "null" / "n/a" / "-" statt echtem null. Normalisieren.
  if (typeof value === 'string') {
    const stripped = value.trim().toLowerCase();
    if (stripped === 'null' || stripped === 'n/a' || stripped === 'none' || stripped === '-' || stripped === '') {
      data[fieldName] = null;
      value = null;
    }
  }

  // Required check
  if (definition.required && (value === null || value === undefined || value === '')) {
    errors.push({ field: path, message: 'Pflichtfeld fehlt', value });
    return;
  }

  // If not required and empty, skip type checks
  if (value === null || value === undefined || value === '') return;

  // Type validation + auto-correction
  switch (definition.type) {
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        const correctedValue = correctNumber(value);
        if (correctedValue !== null) {
          data[fieldName] = correctedValue;
          corrected.push(path);
        } else {
          errors.push({ field: path, message: `Erwarteter Typ: Zahl, erhalten: "${value}"`, value });
        }
      }
      break;
    }
    case 'date': {
      if (typeof value === 'string') {
        if (!correctDate(value) || correctDate(value) !== value) {
          const correctedValue = correctDate(value);
          if (correctedValue) {
            data[fieldName] = correctedValue;
            corrected.push(path);
          } else {
            errors.push({ field: path, message: `Ungültiges Datumsformat: "${value}" (erwartet: YYYY-MM-DD)`, value });
          }
        }
      } else {
        errors.push({ field: path, message: `Erwarteter Typ: Datum (String), erhalten: ${typeof value}`, value });
      }
      break;
    }
    case 'boolean': {
      if (typeof value !== 'boolean') {
        // Auto-correct string booleans
        if (typeof value === 'string') {
          const lower = value.toLowerCase();
          if (['true', 'ja', 'yes', '1'].includes(lower)) {
            data[fieldName] = true;
            corrected.push(path);
          } else if (['false', 'nein', 'no', '0'].includes(lower)) {
            data[fieldName] = false;
            corrected.push(path);
          } else {
            errors.push({ field: path, message: `Erwarteter Typ: Boolean, erhalten: "${value}"`, value });
          }
        } else {
          errors.push({ field: path, message: 'Erwarteter Typ: Boolean', value });
        }
      }
      break;
    }
    case 'text': {
      if (typeof value !== 'string') {
        // Auto-correct numbers to strings
        if (typeof value === 'number') {
          data[fieldName] = String(value);
          corrected.push(path);
        } else {
          errors.push({ field: path, message: `Erwarteter Typ: Text, erhalten: ${typeof value}`, value });
        }
      }
      break;
    }
  }
}

/**
 * Validate extracted data against a profile
 */
export function validateExtraction(
  data: Record<string, unknown>,
  profile: ExtractionProfile
): ValidationReport {
  const errors: ValidationError[] = [];
  const corrected: string[] = [];

  for (const [groupName, group] of Object.entries(profile.fields)) {
    const groupData = data[groupName];

    if (isArrayGroup(group)) {
      const arrayGroup = group as ArrayGroupDefinition;

      if (!Array.isArray(groupData)) {
        // Check if any item field is required
        const hasRequired = Object.values(arrayGroup._item_fields).some(f => f.required);
        if (hasRequired || groupData != null) {
          errors.push({ field: groupName, message: 'Erwartetes Array fehlt' });
        }
        continue;
      }

      // Validate each item in the array
      for (let i = 0; i < groupData.length; i++) {
        const item = groupData[i] as Record<string, unknown>;
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          errors.push({ field: `${groupName}[${i}]`, message: 'Erwartetes Positionsobjekt fehlt', value: item });
          continue;
        }

        for (const [fieldName, fieldDef] of Object.entries(arrayGroup._item_fields)) {
          validateField(
            fieldName,
            item[fieldName],
            fieldDef,
            `${groupName}[${i}]`,
            errors,
            corrected,
            item
          );
        }
      }
    } else {
      // Object group
      const objData = groupData as Record<string, unknown> | undefined;

      if (!objData || typeof objData !== 'object') {
        // Check if any field in this group is required
        const hasRequired = Object.values(group as Record<string, FieldDefinition>).some(f => f.required);
        if (hasRequired) {
          errors.push({ field: groupName, message: 'Erwartete Feldgruppe fehlt' });
        }
        continue;
      }

      for (const [fieldName, fieldDef] of Object.entries(group as Record<string, FieldDefinition>)) {
        validateField(
          fieldName,
          objData[fieldName],
          fieldDef,
          groupName,
          errors,
          corrected,
          objData
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    corrected,
  };
}

/**
 * Format validation errors as a string for LLM retry feedback
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  return errors
    .map(e => `- Feld "${e.field}": ${e.message}`)
    .join('\n');
}
