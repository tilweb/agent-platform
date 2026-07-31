/**
 * Echo-Loop API-Wrapper (dünn über apiFetch). Alle Endpunkte unter /apps/echoloop.
 */
import { apiGet, apiPost, apiPut, apiDelete, apiPostForm, API_URL } from '../../utils/apiFetch';

const base = '/apps/echoloop';

async function json(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return res.json();
}

export const echoloopApi = {
  // Kunden
  listKunden: () => apiGet(`${base}/kunden`).then(json).then((d) => d.kunden),
  getKunde: (id) => apiGet(`${base}/kunden/${id}`).then(json).then((d) => d.kunde),
  createKunde: (payload) => apiPost(`${base}/kunden`, payload).then(json).then((d) => d.kunde),
  updateKunde: (id, payload) => apiPut(`${base}/kunden/${id}`, payload).then(json).then((d) => d.kunde),
  deleteKunde: (id) => apiDelete(`${base}/kunden/${id}`).then(json),
  listProzesse: (kundeId) => apiGet(`${base}/kunden/${kundeId}/prozesse`).then(json).then((d) => d.prozesse),

  // Prozesse
  getProzess: (id) => apiGet(`${base}/prozesse/${id}`).then(json).then((d) => d.prozess),
  createProzess: (payload) => apiPost(`${base}/prozesse`, payload).then(json).then((d) => d.prozess),
  updateProzess: (id, payload) => apiPut(`${base}/prozesse/${id}`, payload).then(json).then((d) => d.prozess),
  deleteProzess: (id) => apiDelete(`${base}/prozesse/${id}`).then(json),
  listBaustaende: (prozessId) => apiGet(`${base}/prozesse/${prozessId}/baustaende`).then(json).then((d) => d.baustaende),

  // Analyse (Upload) — SSE-Stream mit Phasen-Fortschritt.
  // onEvent(phase, data) je Zwischenschritt; Rückgabe = fertiger Baustand.
  analyseStream: async (prozessId, formData, onEvent) => {
    const res = await fetch(`${API_URL}${base}/prozesse/${prozessId}/analyse`, {
      method: 'POST', credentials: 'include', body: formData,
    });
    if (!res.ok || !res.body) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let result = null;
    let errorMsg = null;
    const handleBlock = (block) => {
      let event = 'message';
      let data = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) return;
      let parsed;
      try { parsed = JSON.parse(data); } catch { return; }
      if (event === 'done') result = parsed.baustand;
      else if (event === 'error') errorMsg = parsed.message || 'Analyse fehlgeschlagen';
      else onEvent?.(event === 'progress' ? parsed.phase : event, parsed);
    };
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        handleBlock(buffer.slice(0, idx));
        buffer = buffer.slice(idx + 2);
      }
    }
    if (buffer.trim()) handleBlock(buffer);
    if (errorMsg) throw new Error(errorMsg);
    return result;
  },

  // Narrativ-Synthese (Reasoning, on-demand) — SSE mit Heartbeat. onEvent(type,data): 'heartbeat'|'start'.
  narrativStream: async (baustandId, onEvent) => {
    const res = await fetch(`${API_URL}${base}/baustaende/${baustandId}/narrativ`, { method: 'POST', credentials: 'include' });
    if (!res.ok || !res.body) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let result = null;
    let errorMsg = null;
    const handleBlock = (block) => {
      let event = 'message';
      let data = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) return;
      let parsed;
      try { parsed = JSON.parse(data); } catch { return; }
      if (event === 'done') result = parsed.baustand;
      else if (event === 'error') errorMsg = parsed.message || 'Narrativ-Synthese fehlgeschlagen';
      else onEvent?.(event, parsed);
    };
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        handleBlock(buffer.slice(0, idx));
        buffer = buffer.slice(idx + 2);
      }
    }
    if (buffer.trim()) handleBlock(buffer);
    if (errorMsg) throw new Error(errorMsg);
    return result;
  },

  // Baustände
  getBaustand: (id) => apiGet(`${base}/baustaende/${id}`).then(json).then((d) => d.baustand),
  updateBaustand: (id, payload) => apiPut(`${base}/baustaende/${id}`, payload).then(json).then((d) => d.baustand),
  freigabe: (id, expectedVersion) => apiPost(`${base}/baustaende/${id}/freigabe`, { expectedVersion }).then(json).then((d) => d.baustand),
  generateBauanleitung: (id, zielLevel) => apiPost(`${base}/baustaende/${id}/bauanleitung`, { zielLevel }).then(json).then((d) => d.baustand),
  deleteBaustand: (id) => apiDelete(`${base}/baustaende/${id}`).then(json),
  scoring: (dimensionen) => apiPost(`${base}/scoring`, { dimensionen }).then(json).then((d) => d.kennzahlen),
};

/** Dimensions-Metadaten (Anzeige-Reihenfolge + Labels, identisch zum Backend). */
export const DIMENSIONEN = [
  { key: 'd1', label: 'Wahrnehmung/Anker' },
  { key: 'd2', label: 'Timing/Sync' },
  { key: 'd3', label: 'Fehler/Ausgänge' },
  { key: 'd4', label: 'Selbstheilung/Wiederanlauf' },
  { key: 'd5', label: 'Idempotenz/Konsistenz' },
  { key: 'd6', label: 'Konfiguration' },
  { key: 'd6b', label: 'Datenfluss (Zusatz)' },
  { key: 'd7', label: 'Messung/Beobachtbarkeit' },
  { key: 'd8', label: 'Sicherheit/Compliance' },
  { key: 'd9', label: 'Modularität' },
  { key: 'd10', label: 'Portabilität' },
];

/** Reifegrad-Level-Rampe L0…L5 (YNEO-Lila-Familie, Design-System §57). */
export const LEVEL_COLORS = ['#E9E9EF', '#D9D2EC', '#C4B5E0', '#9F8BCF', '#6E55A8', '#452C71'];
export const LEVEL_TEXT = ['#452C71', '#452C71', '#452C71', '#ffffff', '#ffffff', '#ffffff'];

/** Schweregrad → Farbe (für Befund-Badges). */
export const SCHWERE_META = {
  kritisch: { label: 'kritisch', icon: '🔴' },
  hoch: { label: 'hoch', icon: '🔶' },
  mittel: { label: 'mittel', icon: '🟡' },
  frage: { label: 'Panel-Frage', icon: '❓' },
  niedrig: { label: 'ok', icon: '⚪' },
};
