/**
 * ContractSchema-Validation.
 *
 * Schemas haben einen `fields:`-Block (verschachtelte Feld-Definitionen) und
 * einen `mapping:`-Block (party_a/party_b/start_date/end_date/value). Der
 * Mapping zeigt mit Pfaden wie `vertragspartner.vermieter` auf Felder im
 * `fields:`-Block. Wenn die Pfade nicht uebereinstimmen, kann
 * `computeDerivedFields` keine Werte ausrechnen → Vertrag erscheint im UI
 * ohne Name + Vertragsparteien.
 *
 * Diese Datei stellt einen leichten Validator bereit. Wird beim Save-Schema-
 * Endpoint aufgerufen, um diese Fehlerklasse fruehzeitig zu erkennen.
 */

import type { ContractSchema } from '../types';

export interface SchemaValidationIssue {
  field: 'party_a' | 'party_b' | 'start_date' | 'end_date' | 'value';
  path: string;
  message: string;
}

/**
 * Loest einen dotted-path gegen die `fields:`-Struktur auf. Returnt true, wenn
 * der Pfad ein existierendes Feld trifft. Mathe-Ausdruecke wie
 * `finanzen.kaltmiete_monatlich * 12` werden auf den Teil vor `*` reduziert
 * (der Multiplier ist eine Zahl, nicht ein Feld).
 */
function pathExists(fields: ContractSchema['fields'], rawPath: string): boolean {
  const path = rawPath.includes('*') ? rawPath.split('*')[0]!.trim() : rawPath;
  const parts = path.split('.').filter(Boolean);
  if (parts.length === 0) return false;

  let cursor: unknown = fields;
  for (const part of parts) {
    if (!cursor || typeof cursor !== 'object') return false;
    cursor = (cursor as Record<string, unknown>)[part];
    if (cursor === undefined) return false;
  }
  // Cursor sollte am Ende eine FieldDefinition sein (Objekt mit 'type'-Key)
  // oder eine FieldGroup (Objekt mit verschachtelten Feldern). Beides ok —
  // wir checken nur dass der Pfad nicht „dangling" ist.
  return cursor !== undefined && cursor !== null;
}

/**
 * Validiert ein ContractSchema: alle mapping-Pfade muessen auf existierende
 * Felder zeigen. Returnt eine Liste an Issues (leer = OK).
 */
export function validateContractSchema(schema: ContractSchema): SchemaValidationIssue[] {
  const issues: SchemaValidationIssue[] = [];
  if (!schema.mapping) {
    return [{
      field: 'party_a',
      path: '',
      message: 'Schema enthaelt keinen `mapping:`-Block — ohne den koennen die Basisdaten nicht abgeleitet werden.',
    }];
  }

  const requiredMappings: Array<SchemaValidationIssue['field']> = [
    'party_a', 'party_b', 'start_date', 'end_date', 'value',
  ];

  for (const key of requiredMappings) {
    const path = schema.mapping[key];
    if (!path || typeof path !== 'string' || path.trim().length === 0) {
      issues.push({
        field: key,
        path: String(path ?? ''),
        message: `Mapping fuer "${key}" fehlt oder ist leer.`,
      });
      continue;
    }
    if (!pathExists(schema.fields, path)) {
      issues.push({
        field: key,
        path,
        message: `Mapping fuer "${key}" verweist auf "${path}", aber dieser Pfad existiert nicht im fields:-Block. Pruefe Schreibweise und Gruppen-/Feldnamen.`,
      });
    }
  }

  return issues;
}

/**
 * Formatiert die Issues fuer einen kurzen Error-String — geeignet als
 * API-Response-Body.
 */
export function formatSchemaIssues(issues: SchemaValidationIssue[]): string {
  return issues.map((i) => `[${i.field}] ${i.message}`).join('\n');
}
