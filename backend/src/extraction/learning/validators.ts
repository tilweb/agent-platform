/**
 * Validators - Auto-correction helpers for flat field extraction
 * + strukturelle Validierung der Projekt-Felddefinitionen (POST/PUT/Import).
 *
 * Extracted from the original validator.ts for reuse.
 */

import type { ProjectField } from './types';
import { PROJECT_FIELD_GROUP } from './pipeline-adapter';

const SCALAR_TYPES = new Set(['text', 'number', 'date', 'boolean']);

/**
 * Strukturelle Validierung der Projekt-Felder (fuer POST/PUT /projects und
 * Bundle-Import). Liefert eine deutsche Fehlermeldung oder null, wenn valide.
 *
 * Regeln fuer Listen-Felder:
 *  - `item_fields` muss vorhanden und nicht leer sein
 *  - jede Spalte hat einen skalaren Typ + Label (keine Listen in Listen)
 *  - die fieldId einer Liste darf nicht `felder` heissen (Namespace-Kollision
 *    mit der synthetischen Skalar-Gruppe der Pipeline)
 */
export function validateProjectFields(fields: Record<string, ProjectField>): string | null {
  for (const [fieldId, field] of Object.entries(fields)) {
    if (!field || typeof field !== 'object') {
      return `Feld "${fieldId}": ungueltige Definition`;
    }
    if (field.type === 'list') {
      if (fieldId === PROJECT_FIELD_GROUP) {
        return `Feld "${fieldId}": dieser Name ist fuer Listen-Felder reserviert — bitte anders benennen`;
      }
      const itemEntries = Object.entries(field.item_fields ?? {});
      if (itemEntries.length === 0) {
        return `Feld "${fieldId}": eine Liste braucht mindestens eine Positions-Spalte`;
      }
      for (const [itemId, itemField] of itemEntries) {
        if (!itemField || typeof itemField !== 'object' || !SCALAR_TYPES.has(itemField.type as string)) {
          return `Feld "${fieldId}", Spalte "${itemId}": ungueltiger Typ (erlaubt: Text, Zahl, Datum, Ja/Nein)`;
        }
        if (!itemField.label || !String(itemField.label).trim()) {
          return `Feld "${fieldId}", Spalte "${itemId}": Label fehlt`;
        }
      }
      continue;
    }
    if (!SCALAR_TYPES.has(field.type as string)) {
      return `Feld "${fieldId}": unbekannter Typ "${field.type}"`;
    }
  }
  return null;
}

/**
 * Auto-correct German number format: "1.234,56" → 1234.56
 */
export function correctNumber(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return null;

  let str = value.trim();
  if (!str) return null;

  // German format: 1.234,56 → remove dots, replace comma with dot
  if (str.includes(',') && str.includes('.')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }

  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

/**
 * Auto-correct date formats to YYYY-MM-DD
 */
export function correctDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const str = value.trim();
  if (!str) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // DD.MM.YYYY (German format)
  const germanMatch = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (germanMatch) {
    const [, day, month, year] = germanMatch;
    return `${year}-${month!.padStart(2, '0')}-${day!.padStart(2, '0')}`;
  }

  // DD/MM/YYYY
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${month!.padStart(2, '0')}-${day!.padStart(2, '0')}`;
  }

  // Try native Date parsing
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0]!;
  }

  return null;
}
