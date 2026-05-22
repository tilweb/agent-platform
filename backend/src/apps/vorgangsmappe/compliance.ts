/**
 * Vorgangsmappe — Pflicht-Doku-Check (DB-basiert).
 *
 * Pipeline:
 *   1. Aus den Dokumenten den Vorgangs-INCOTERM + -GESCHAFTSART ermitteln
 *      (DocuWare-Index-Feld pro Doc).
 *   2. Aus der DB die Pflicht-Mappings fuer (INCOTERM × GESCHAFTSART) lesen.
 *   3. Pro gemapptes Document-Type pruefen, ob mindestens ein Doc passt
 *      (Match gegen `document_type_field` mit den Strings aus `matchAny`).
 *
 * Wenn INCOTERM oder GESCHAFTSART nicht ermittelbar sind → `overall: no_rule`
 * mit Note. Compliance-Items sind dann leer.
 *
 * Wildcards in `matchAny` (`*Rechnung*`) werden in case-insensitive Regex
 * umgesetzt.
 */

import type { StructuredSearchHit } from '../../connections/providers/docuware/search';
import {
  listMappings,
  listDocumentTypes,
  type DocumentType,
} from './settings-storage';
import type { ComplianceItem, ComplianceReport, VorgangsmappeConfig } from './types';

function wildcardToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const regexBody = escaped.replace(/\*/g, '.*');
  return new RegExp(`^${regexBody}$`, 'i');
}

function matchesDocType(value: unknown, matchAny: string[]): boolean {
  if (typeof value !== 'string' || value.trim() === '') return false;
  for (const cand of matchAny) {
    if (!cand) continue;
    if (cand.includes('*')) {
      if (wildcardToRegex(cand).test(value)) return true;
    } else if (cand.toLowerCase() === value.toLowerCase()) {
      return true;
    }
  }
  return false;
}

function pickFirstFieldValue(
  docs: StructuredSearchHit[],
  fieldName: string | null | undefined,
): string | null {
  if (!fieldName) return null;
  for (const doc of docs) {
    const raw = doc.fields[fieldName];
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
  }
  return null;
}

/**
 * Compliance-Check auf Basis der DB-Mappings.
 */
export async function computeCompliance(
  documents: StructuredSearchHit[],
  config: VorgangsmappeConfig,
  override?: { incoterm?: string; geschaeftsart?: string },
): Promise<ComplianceReport> {
  // 1. INCOTERM + GESCHAFTSART ermitteln
  let incoterm = override?.incoterm
    || pickFirstFieldValue(documents, config.incoterm_field || 'INCOTERM');
  let geschaeftsart = override?.geschaeftsart
    || pickFirstFieldValue(documents, config.geschaeftsart_field || 'GESCHAFTSART');

  // Normalisieren: Incoterm = uppercase Buchstaben-only, Geschaeftsart = lower
  if (incoterm) incoterm = incoterm.toUpperCase().replace(/[^A-Z]/g, '');
  if (geschaeftsart) geschaeftsart = geschaeftsart.toLowerCase();

  if (!incoterm || !geschaeftsart) {
    const missing: string[] = [];
    if (!incoterm) missing.push('INCOTERM');
    if (!geschaeftsart) missing.push('GESCHAFTSART');
    return {
      ruleSet: 'none',
      ruleSetName: 'Kein Regelwerk',
      items: [],
      overall: 'no_rule',
      source: {
        incoterm: incoterm || undefined,
        geschaeftsart: geschaeftsart || undefined,
        note: `Pflicht-Doku-Check nicht moeglich — folgende Felder fehlen im Vorgang: ${missing.join(', ')}.`,
      },
    };
  }

  // 2. Pflicht-Mappings + Doc-Types aus DB laden
  const [mappings, allDocTypes] = await Promise.all([
    listMappings({ incoterm, geschaeftsart }),
    listDocumentTypes(),
  ]);
  const docTypeMap = new Map<string, DocumentType>();
  for (const dt of allDocTypes) docTypeMap.set(dt.id, dt);

  if (mappings.length === 0) {
    return {
      ruleSet: `${incoterm}_${geschaeftsart}`,
      ruleSetName: `${incoterm} / ${geschaeftsart}`,
      items: [],
      overall: 'no_rule',
      source: {
        incoterm,
        geschaeftsart,
        note: `Fuer ${incoterm}/${geschaeftsart} ist noch keine Pflicht-Doku-Liste hinterlegt. Bitte in den Einstellungen pflegen.`,
      },
    };
  }

  // 3. Matching: pro gemapptes Document-Type pruefen
  const items: ComplianceItem[] = mappings.map((m) => {
    const dt = docTypeMap.get(m.documentTypeId);
    if (!dt) {
      // Mapping verweist auf einen geloeschten Doc-Type — defensive
      return {
        id: m.documentTypeId,
        label: `(unbekannter Doc-Type: ${m.documentTypeId})`,
        required: m.required,
        status: m.required ? 'missing' as const : 'optional_missing' as const,
        matchedDocIds: [],
      };
    }
    const matched: Array<number | string> = [];
    for (const doc of documents) {
      if (matchesDocType(doc.fields[config.document_type_field], dt.matchAny)) {
        matched.push(doc.id);
      }
    }
    const hasMatch = matched.length > 0;
    let status: ComplianceItem['status'];
    if (hasMatch) status = 'ok';
    else if (m.required) status = 'missing';
    else status = 'optional_missing';
    return {
      id: dt.id,
      label: dt.label,
      required: m.required,
      status,
      matchedDocIds: matched,
    };
  });

  // Sortierung: nach Doc-Type.sortOrder
  items.sort((a, b) => {
    const sa = docTypeMap.get(a.id)?.sortOrder ?? 9999;
    const sb = docTypeMap.get(b.id)?.sortOrder ?? 9999;
    return sa - sb;
  });

  const requiredMissing = items.some((i) => i.required && i.status === 'missing');
  const someOk = items.some((i) => i.status === 'ok');
  let overall: ComplianceReport['overall'];
  if (!requiredMissing) overall = 'complete';
  else if (someOk) overall = 'partial';
  else overall = 'incomplete';

  return {
    ruleSet: `${incoterm}_${geschaeftsart}`,
    ruleSetName: `${incoterm} / ${geschaeftsart}`,
    items,
    overall,
    source: { incoterm, geschaeftsart },
  };
}
