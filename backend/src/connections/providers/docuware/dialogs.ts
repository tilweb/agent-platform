/**
 * Docuware Dialog-Resolver
 *
 * DocuWare bietet pro Cabinet mehrere „Dialogs" (Search, Store, ResultList,
 * InfoDialog). Fuer die strukturierte Suche brauchen wir den richtigen
 * Search-Dialog mit seiner Feldauswahl. Dieses Modul kapselt:
 *
 *   - die Auswahl des passenden Search-Dialogs (DisplayName-Hint > Default)
 *   - das Caching der Dialog-Details (in-memory, 10min TTL)
 *   - die Normalisierung der Feldliste in eine API-stabile Shape
 *
 * Caching ist wichtig, weil sowohl die Felder-Route als auch die Such-Route
 * den Dialog jedes Mal braeuchten — und der Detail-Call kostet 100–300ms.
 */

import { getCabinetDialogsUrl, getDialogDetailUrl } from './config';

export interface DocuwareFieldDescriptor {
  dbFieldName: string;
  label: string;
  type: string;
  length: number;
  notEmpty: boolean;
  readOnly: boolean;
  visible: boolean;
  allowFiltering: boolean;
  hasSelectList: boolean;
}

export interface ResolvedDialog {
  id: string;
  displayName: string;
  type: string;
  isDefault: boolean;
  fields: DocuwareFieldDescriptor[];
}

interface CacheEntry {
  expiresAt: number;
  byKey: Map<string, ResolvedDialog>; // cabinetId+dialogHint -> dialog
}

// userId+cabinetId -> { dialogHint -> ResolvedDialog }. Token-bound nutzen
// wir bewusst nicht, weil ein Token-Refresh keine Dialog-Aenderung impliziert.
const cache = new Map<string, CacheEntry>();
const TTL_MS = 10 * 60 * 1000;

function cacheKey(cabinetId: string, dialogHint?: string): string {
  return `${cabinetId}::${dialogHint || ''}`;
}

function getEntry(cabinetId: string): CacheEntry | null {
  const e = cache.get(cabinetId);
  if (!e) return null;
  if (e.expiresAt < Date.now()) {
    cache.delete(cabinetId);
    return null;
  }
  return e;
}

/**
 * Resolve a search dialog for a cabinet. Picks by:
 *   1. dialogHint (matches Id, DisplayName or contains-substring on DisplayName, case-insensitive)
 *   2. dialog with `IsDefault === true` of type Search
 *   3. first dialog with type Search
 */
export async function resolveSearchDialog(
  apiDomain: string | undefined,
  cabinetId: string,
  accessToken: string,
  dialogHint?: string,
): Promise<ResolvedDialog> {
  // Cache hit?
  const cached = getEntry(cabinetId);
  const hit = cached?.byKey.get(cacheKey(cabinetId, dialogHint));
  if (hit) return hit;

  const listRes = await fetch(getCabinetDialogsUrl(apiDomain, cabinetId), {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!listRes.ok) {
    throw new Error(`Failed to list dialogs (status ${listRes.status}): ${await listRes.text()}`);
  }
  const listJson = (await listRes.json()) as any;
  const dialogs = (listJson.Dialog || listJson.Dialogs || []) as any[];
  if (!dialogs.length) {
    throw new Error('Cabinet has no dialogs configured.');
  }

  const searchDialogs = dialogs.filter((d) => d.Type === 'Search');
  if (!searchDialogs.length) {
    throw new Error('Cabinet has no search dialog configured.');
  }

  let picked: any | undefined;
  if (dialogHint) {
    const hint = dialogHint.toLowerCase();
    picked =
      searchDialogs.find((d) => d.Id?.toLowerCase() === hint) ||
      searchDialogs.find((d) => d.DisplayName?.toLowerCase() === hint) ||
      searchDialogs.find((d) => d.DisplayName?.toLowerCase().includes(hint));
  }
  if (!picked) picked = searchDialogs.find((d) => d.IsDefault) || searchDialogs[0];
  if (!picked) {
    throw new Error(`No matching search dialog (hint: ${dialogHint || 'none'})`);
  }

  const detailRes = await fetch(
    getDialogDetailUrl(apiDomain, cabinetId, picked.Id, 'Search'),
    { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } },
  );
  if (!detailRes.ok) {
    throw new Error(`Failed to load dialog detail (status ${detailRes.status})`);
  }
  const detailJson = (await detailRes.json()) as any;
  const rawFields = (detailJson.Fields || []) as any[];

  const fields: DocuwareFieldDescriptor[] = rawFields
    .filter((f) => f.DBFieldName) // System-Felder ohne DBFieldName ignorieren
    .map((f) => ({
      dbFieldName: f.DBFieldName,
      label: f.DlgLabel || f.DBFieldName,
      type: f.DWFieldType || 'Text',
      length: typeof f.Length === 'number' ? f.Length : -1,
      notEmpty: !!f.NotEmpty,
      readOnly: !!f.ReadOnly,
      visible: f.Visible !== false,
      allowFiltering: f.AllowFiltering !== false,
      hasSelectList: !!f.SelectListsAssigned,
    }));

  const resolved: ResolvedDialog = {
    id: picked.Id,
    displayName: picked.DisplayName || 'Search',
    type: picked.Type || 'Search',
    isDefault: !!picked.IsDefault,
    fields,
  };

  // Persist
  let entry = getEntry(cabinetId);
  if (!entry) {
    entry = { expiresAt: Date.now() + TTL_MS, byKey: new Map() };
    cache.set(cabinetId, entry);
  }
  entry.byKey.set(cacheKey(cabinetId, dialogHint), resolved);
  return resolved;
}

/**
 * Manuelles Invalidieren — z.B. wenn ein neuer Dialog im DocuWare-Admin
 * angelegt wird. Heute kein UI-Trigger, aber Reload-Hook fuer spaeter.
 */
export function clearDialogCache(cabinetId?: string): void {
  if (cabinetId) cache.delete(cabinetId);
  else cache.clear();
}
