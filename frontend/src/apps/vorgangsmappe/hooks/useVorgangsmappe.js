/**
 * useVorgangsmappe — Hooks fuer die Vorgangsmappe-App
 *
 * Wichtig: `apiGet`/`apiPost` aus utils/apiFetch returnen ein Response-Objekt
 * (kein JSON). Die kleinen Helper unten kapseln das einheitlich — bei nicht-ok
 * Status wird der Server-`error` als Exception geworfen.
 */

import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../../utils/apiFetch';

async function unwrap(response) {
  let json = null;
  try { json = await response.json(); } catch { /* no body */ }
  if (!response.ok) {
    const msg = json?.error || `HTTP ${response.status}`;
    const err = new Error(msg);
    err.status = response.status;
    err.data = json;
    throw err;
  }
  return json;
}

export function useVorgangsmappeConfig() {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const data = await unwrap(await apiGet('/apps/vorgangsmappe/config'));
        if (!active) return;
        setConfig(data.config);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err?.message || 'Konfiguration konnte nicht geladen werden.');
        setConfig(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return { config, error, loading };
}

export function useVorgang(reference) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!reference) return;
    setLoading(true);
    setError(null);
    try {
      const res = await unwrap(await apiGet(`/apps/vorgangsmappe/vorgaenge/${encodeURIComponent(reference)}`));
      setData(res);
    } catch (err) {
      setError(err?.message || 'Vorgang konnte nicht geladen werden.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [reference]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, loading, reload };
}

export async function searchDocuments(payload) {
  return unwrap(await apiPost('/apps/vorgangsmappe/search', payload));
}

export async function previewNlu(query) {
  return unwrap(await apiPost('/apps/vorgangsmappe/nlu/preview', { query }));
}

/* ----------------------- Settings ----------------------- */

import { apiPut, apiDelete } from '../../../utils/apiFetch';

export async function listDocumentTypes() {
  const data = await unwrap(await apiGet('/apps/vorgangsmappe/settings/document-types'));
  return data.documentTypes || [];
}
export async function createDocumentType(payload) {
  return unwrap(await apiPost('/apps/vorgangsmappe/settings/document-types', payload));
}
export async function updateDocumentType(id, payload) {
  return unwrap(await apiPut(`/apps/vorgangsmappe/settings/document-types/${encodeURIComponent(id)}`, payload));
}
export async function deleteDocumentType(id) {
  return unwrap(await apiDelete(`/apps/vorgangsmappe/settings/document-types/${encodeURIComponent(id)}`));
}

export async function listIncoterms() {
  const data = await unwrap(await apiGet('/apps/vorgangsmappe/settings/incoterms'));
  return data.incoterms || [];
}
export async function createIncoterm(payload) {
  return unwrap(await apiPost('/apps/vorgangsmappe/settings/incoterms', payload));
}
export async function updateIncoterm(code, payload) {
  return unwrap(await apiPut(`/apps/vorgangsmappe/settings/incoterms/${encodeURIComponent(code)}`, payload));
}
export async function deleteIncoterm(code) {
  return unwrap(await apiDelete(`/apps/vorgangsmappe/settings/incoterms/${encodeURIComponent(code)}`));
}

export async function listMappings(filter) {
  const qs = new URLSearchParams();
  if (filter?.incoterm) qs.set('incoterm', filter.incoterm);
  if (filter?.geschaeftsart) qs.set('geschaeftsart', filter.geschaeftsart);
  const suffix = qs.toString() ? `?${qs}` : '';
  const data = await unwrap(await apiGet(`/apps/vorgangsmappe/settings/mappings${suffix}`));
  return data.mappings || [];
}
export async function replaceMappingsForKey(incoterm, geschaeftsart, documentTypeIds) {
  return unwrap(await apiPut(
    `/apps/vorgangsmappe/settings/mappings/${encodeURIComponent(incoterm)}/${encodeURIComponent(geschaeftsart)}`,
    { documentTypeIds },
  ));
}
