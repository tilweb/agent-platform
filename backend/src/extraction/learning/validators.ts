/**
 * Validators - Auto-correction helpers for flat field extraction
 * + strukturelle Validierung der Projekt-Felddefinitionen (POST/PUT/Import).
 *
 * Extracted from the original validator.ts for reuse.
 */

import type { ExtractionRule, FieldCatalog, ProjectField, SegmentTypeDef } from './types';
import { PROJECT_FIELD_GROUP } from './pipeline-adapter';
import { normalizeForMatch } from './catalog';
import { BUILTIN_SEGMENT_TYPES } from './types';

const SCALAR_TYPES = new Set(['text', 'number', 'date', 'boolean']);

/**
 * Strukturelle Pruefung einer kontrollierten Werteliste (Welle 6).
 * Liefert eine deutsche Fehlermeldung oder null.
 */
function validateCatalog(where: string, catalog: FieldCatalog | undefined): string | null {
  if (!catalog) return null;
  if (catalog.source !== 'list' && catalog.source !== 'table') {
    return `${where}: Werteliste braucht eine Quelle (Liste oder Tabellenspalte)`;
  }

  if (catalog.source === 'table') {
    if (!catalog.table_id || !catalog.column_id) {
      return `${where}: Werteliste aus einer Tabelle braucht Tabelle und Spalte`;
    }
    return null;
  }

  const values = catalog.values ?? [];
  const named = values.filter((v) => v?.value?.trim());
  if (named.length === 0) return `${where}: Werteliste enthaelt keinen Wert`;

  // Dubletten nach Normalisierung machen jede Zuordnung mehrdeutig — hier
  // abfangen statt spaeter bei jedem Dokument einen Befund zu erzeugen. Zwei
  // Schreibvarianten DESSELBEN Werts ("Stück"/"Stueck") sind dagegen nur
  // redundant, nicht mehrdeutig.
  const owner = new Map<string, string>();
  for (const entry of named) {
    const key = normalizeForMatch(entry.value);
    if (owner.has(key)) return `${where}: Wert "${entry.value}" ist doppelt in der Werteliste`;
    owner.set(key, entry.value);
  }
  for (const entry of named) {
    for (const synonym of entry.synonyms ?? []) {
      const key = normalizeForMatch(synonym);
      if (!key) continue;
      const existing = owner.get(key);
      if (existing !== undefined && existing !== entry.value) {
        return `${where}: Synonym "${synonym}" zeigt auf "${entry.value}", gehoert aber schon zu "${existing}"`;
      }
      owner.set(key, entry.value);
    }
  }
  return null;
}

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
        const columnCatalogError = validateCatalog(`Feld "${fieldId}", Spalte "${itemId}"`, itemField.catalog);
        if (columnCatalogError) return columnCatalogError;
      }
      // Eine Werteliste am Listen-Feld selbst ergibt keinen Sinn (der Wert ist ein Array).
      if (field.catalog) {
        return `Feld "${fieldId}": eine Werteliste gehoert an eine Spalte, nicht an die Liste selbst`;
      }
      continue;
    }
    if (!SCALAR_TYPES.has(field.type as string)) {
      return `Feld "${fieldId}": unbekannter Typ "${field.type}"`;
    }
    const catalogError = validateCatalog(`Feld "${fieldId}"`, field.catalog);
    if (catalogError) return catalogError;
  }
  return null;
}

/**
 * Strukturelle Validierung der fachlichen Pruefregeln (Welle 5) gegen die
 * Feldliste des Projekts. Liefert eine deutsche Fehlermeldung oder null.
 *
 * Regeln referenzieren Felder ueber IDs — wird ein Feld umbenannt/geloescht,
 * faellt das hier beim Speichern auf (zur Laufzeit gaebe es nur einen Befund).
 */
export function validateProjectRules(
  fields: Record<string, ProjectField>,
  rules: ExtractionRule[] | undefined,
): string | null {
  if (!rules) return null;
  if (!Array.isArray(rules)) return 'Pruefregeln muessen eine Liste sein';

  const seen = new Set<string>();
  for (const rule of rules) {
    if (!rule || typeof rule !== 'object' || !rule.id) {
      return 'Pruefregel ohne Id';
    }
    if (seen.has(rule.id)) return `Pruefregel "${rule.id}": Id doppelt vergeben`;
    seen.add(rule.id);

    if (rule.type === 'sum') {
      const listField = fields[rule.list_field];
      if (!listField) return `Pruefregel "${rule.id}": Listen-Feld "${rule.list_field}" existiert nicht`;
      if (listField.type !== 'list') return `Pruefregel "${rule.id}": "${rule.list_field}" ist kein Listen-Feld`;
      const column = listField.item_fields?.[rule.item_field];
      if (!column) return `Pruefregel "${rule.id}": Spalte "${rule.item_field}" existiert nicht`;
      if (column.type !== 'number') return `Pruefregel "${rule.id}": Spalte "${rule.item_field}" muss vom Typ Zahl sein`;
      const target = fields[rule.target_field];
      if (!target) return `Pruefregel "${rule.id}": Zielfeld "${rule.target_field}" existiert nicht`;
      if (target.type !== 'number') return `Pruefregel "${rule.id}": Zielfeld "${rule.target_field}" muss vom Typ Zahl sein`;
      if (rule.tolerance !== undefined && (typeof rule.tolerance !== 'number' || !(rule.tolerance >= 0))) {
        return `Pruefregel "${rule.id}": Toleranz muss eine Zahl >= 0 sein`;
      }
      continue;
    }

    if (rule.type === 'lookup') {
      const field = fields[rule.field];
      if (!field) return `Pruefregel "${rule.id}": Feld "${rule.field}" existiert nicht`;
      if (field.type === 'list') return `Pruefregel "${rule.id}": Stammdaten-Abgleich geht nicht auf Listen-Feldern`;
      if (!rule.table_id || !rule.column_id) {
        return `Pruefregel "${rule.id}": Tabelle und Spalte sind erforderlich`;
      }
      continue;
    }

    return `Pruefregel "${(rule as ExtractionRule).id}": unbekannter Typ "${(rule as { type?: string }).type}"`;
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

/**
 * Strukturelle Validierung der Segmenttypen (Welle 10). Deutsche Fehlermeldung
 * oder null. Die Feld-Definitionen je Segment laufen durch dieselbe Pruefung
 * wie Projekt-Felder.
 */
export function validateProjectSegments(segments: Record<string, SegmentTypeDef> | undefined): string | null {
  if (segments === undefined) return null;
  const entries = Object.entries(segments);
  if (entries.length === 0) {
    return 'Segmente: mindestens ein Segmenttyp noetig (oder das Feld weglassen)';
  }
  for (const [segId, seg] of entries) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(segId)) {
      return `Segment "${segId}": ID bitte klein-alphanumerisch mit Bindestrichen`;
    }
    if ((BUILTIN_SEGMENT_TYPES as readonly string[]).includes(segId)) {
      return `Segment "${segId}": dieser Typ ist eingebaut und kann nicht deklariert werden`;
    }
    if (!seg || typeof seg !== 'object') {
      return `Segment "${segId}": ungueltige Definition`;
    }
    if (!seg.label || !String(seg.label).trim()) {
      return `Segment "${segId}": Label fehlt`;
    }
    if (!seg.description || String(seg.description).trim().length < 20) {
      return `Segment "${segId}": die Beschreibung traegt die Seiten-Klassifikation — bitte ausfuehrlich beschreiben (mind. 20 Zeichen)`;
    }
    if (seg.mode !== undefined && seg.mode !== 'extract' && seg.mode !== 'classify-only') {
      return `Segment "${segId}": mode muss 'extract' oder 'classify-only' sein`;
    }
    if (seg.mode === 'classify-only' && seg.fields && Object.keys(seg.fields).length > 0) {
      return `Segment "${segId}": classify-only-Segmente haben keine Felder`;
    }
    if (seg.fields) {
      const fieldError = validateProjectFields(seg.fields);
      if (fieldError) return `Segment "${segId}" — ${fieldError}`;
    }
  }
  return null;
}
