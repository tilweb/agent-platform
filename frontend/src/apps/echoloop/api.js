/**
 * Echo-Loop API-Wrapper (dünn über apiFetch). Alle Endpunkte unter /apps/echoloop.
 */
import { apiGet, apiPost, apiPut, apiDelete, API_URL } from '../../utils/apiFetch';

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
  // L-VAR-Explorer (Reiter 1 NK/Kopplung · 2 Steckbriefe · 3 CFG) einer Familie.
  getLvar: (prozessId) => apiGet(`${base}/prozesse/${prozessId}/lvar`).then(json).then((d) => d.lvar),
  // Menschlichen L-VAR-Arbeitsstand speichern (abhaken/Feedback/Status) — Optimistic-Locking.
  saveLvarStand: (prozessId, stand, expectedVersion) => apiPut(`${base}/prozesse/${prozessId}/lvar-stand`, { stand, expectedVersion }).then(json),
  // L-VAR-Export (Ziel 2) als JSON-Datei herunterladen (für Sebs lokalen Loop).
  exportLvar: async (prozessId) => {
    const res = await apiGet(`${base}/prozesse/${prozessId}/lvar-export`);
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || `HTTP ${res.status}`); }
    const blob = await res.blob();
    const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || 'echoloop-lvar-export.json';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    a.remove(); URL.revokeObjectURL(url);
  },

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
  // Live-Recompute: { kennzahlen, gates } (Vereinbarungs-Gates aus Dims + Nachweisen).
  scoring: (dimensionen, gateNachweise) => apiPost(`${base}/scoring`, { dimensionen, gateNachweise }).then(json),
  // K1-Report als selbsttragendes HTML (Browser: Drucken → PDF).
  reportUrl: (baustandId) => `${API_URL}${base}/baustaende/${baustandId}/report.html`,
};

/** Analyse-Tiefen (Seite-1-Prinzip) + Input-Inventar I1–I6 (identisch zum Backend). */
export const ANALYSE_TIEFEN = [
  { key: 'T-A', label: 'T-A', verspricht: 'hier KANN etwas schiefgehen — Struktur sicher, Verhalten ❓' },
  { key: 'T-B', label: 'T-B', verspricht: 'hier GEHT etwas schief — so oft, seit wann (Beweise + Zahlen)' },
  { key: 'T-C', label: 'T-C', verspricht: 'belegt vollständig, Soll geklärt' },
];
export const INPUT_INVENTAR = [
  { key: 'I1', label: 'Prozess-Exporte' },
  { key: 'I2', label: 'Betriebsdaten' },
  { key: 'I3', label: 'Run-Reports + Bilder' },
  { key: 'I4', label: 'Ordnerstruktur' },
  { key: 'I5', label: 'Briefing/Interview' },
  { key: 'I6', label: 'Video/Panel' },
];

/** Vereinbarungs-Gate-Status → Anzeige (Label + Ampel-Ton). */
export const GATE_STATUS_META = {
  nachgewiesen: { label: 'nachgewiesen', ton: 'ok' },
  papier: { label: 'Papier-Level', ton: 'err' },
  nicht_belegt: { label: 'unbelegt', ton: 'err' },
  ungeprueft: { label: 'ungeprüft ❓', ton: 'warn' },
  offen: { label: 'offen (Vereinbarung)', ton: 'warn' },
  nicht_relevant: { label: 'nicht relevant', ton: 'mut' },
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
