/**
 * Docuware Structured Search — Wrapper um DialogExpression.
 *
 * Shared zwischen Tool (`docuware_search_documents_structured`) und
 * Backend-Route (`POST /api/connections/docuware/cabinets/:id/search`).
 *
 * Verstaendnis der Value-Semantik (aus den Probes gegen den Adacor-Tenant):
 *   - Ein-Element-Value ohne `*`         → exact match (z.B. ["Vertrag"])
 *   - Ein-Element-Value mit `*`          → wildcard (z.B. ["WIANCO*"], ["*meier*"])
 *   - Zwei-Elemente bei Date/Numeric/Decimal → Range (start, end)
 *   - Mehrere Elemente bei Text          → OR within the condition (any-of)
 *
 * `operation` (And/Or) verknuepft die Conditions untereinander.
 */

import { getDialogExpressionSearchUrl } from './config';
import { resolveSearchDialog, type DocuwareFieldDescriptor } from './dialogs';

export interface StructuredSearchFilter {
  field: string;        // DBFieldName, e.g. "ART_DES_DOKUMENTES"
  values: string[];     // see Value-Semantik above
}

export interface StructuredSearchInput {
  cabinetId: string;
  filters: StructuredSearchFilter[];
  operation?: 'And' | 'Or';
  count?: number;
  dialogHint?: string;
}

export interface StructuredSearchHit {
  id: number | string;
  title: string;
  fileSize: number;
  fields: Record<string, unknown>;
}

export interface StructuredSearchResult {
  dialogId: string;
  dialogName: string;
  total: number | null;
  count: number;
  items: StructuredSearchHit[];
}

const DEFAULT_COUNT = 20;
const MAX_COUNT = 100;
const MAX_FILTERS = 20;

/**
 * Validate a filter list against a dialog's field descriptors. Throws with
 * a human-readable message if anything is off. Liefert die normalisierten
 * Conditions zurueck, sortiert wie in der Eingabe.
 */
function buildConditions(
  filters: StructuredSearchFilter[],
  fieldMap: Map<string, DocuwareFieldDescriptor>,
): Array<{ DBName: string; Value: string[] }> {
  if (filters.length > MAX_FILTERS) {
    throw new Error(`Too many filters (max ${MAX_FILTERS}).`);
  }
  return filters.map((f) => {
    if (!f.field || !Array.isArray(f.values) || f.values.length === 0) {
      throw new Error(`Filter for "${f.field || '?'}" needs a non-empty values array.`);
    }
    const def = fieldMap.get(f.field);
    if (!def) {
      throw new Error(
        `Field "${f.field}" not found in search dialog. Use docuware_list_cabinet_fields to discover valid fields.`,
      );
    }
    if (!def.allowFiltering) {
      throw new Error(`Field "${f.field}" is not filterable.`);
    }
    // Range nur bei Date/DateTime/Numeric/Decimal mit genau 2 Werten.
    if (f.values.length === 2) {
      const isRangeType = ['Date', 'DateTime', 'Numeric', 'Decimal'].includes(def.type);
      if (!isRangeType) {
        // 2 Strings bei Text = OR — ok, kein Fehler.
      }
    }
    // Sicherheits-Cap fuer Wert-Laengen
    const cleaned = f.values.map((v) => {
      const s = String(v);
      if (s.length > 1024) throw new Error(`Value too long for field "${f.field}".`);
      return s;
    });
    return { DBName: def.dbFieldName, Value: cleaned };
  });
}

export async function executeStructuredSearch(
  apiDomain: string | undefined,
  accessToken: string,
  input: StructuredSearchInput,
): Promise<StructuredSearchResult> {
  const dialog = await resolveSearchDialog(
    apiDomain,
    input.cabinetId,
    accessToken,
    input.dialogHint,
  );
  const fieldMap = new Map(dialog.fields.map((f) => [f.dbFieldName, f]));

  const conditions = buildConditions(input.filters, fieldMap);
  const operation = input.operation || 'And';
  const count = Math.max(1, Math.min(input.count || DEFAULT_COUNT, MAX_COUNT));

  const url = getDialogExpressionSearchUrl(apiDomain, input.cabinetId, dialog.id, count);
  const body = {
    Count: count,
    Condition: conditions,
    Operation: operation,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Docuware search failed: ${res.status} - ${text.slice(0, 400)}`);
  }

  const data = (await res.json()) as any;
  const rawItems = (data.Items || []) as any[];

  const items: StructuredSearchHit[] = rawItems.map((doc) => {
    const fieldsArr = (doc.Fields || []) as any[];
    const flat: Record<string, unknown> = {};
    for (const fld of fieldsArr) {
      const name = fld.FieldName || fld.fieldName;
      const val = fld.Item ?? fld.item;
      if (name && val !== undefined && val !== null && val !== '') flat[name] = val;
    }
    return {
      id: doc.Id,
      title: doc.Title || `Document ${doc.Id}`,
      fileSize: doc.FileSize ?? doc.ContentSize ?? 0,
      fields: flat,
    };
  });

  return {
    dialogId: dialog.id,
    dialogName: dialog.displayName,
    total:
      typeof data.Count?.Value === 'number'
        ? data.Count.Value
        : typeof data.Count === 'number'
        ? data.Count
        : null,
    count: items.length,
    items,
  };
}
