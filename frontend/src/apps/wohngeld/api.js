/**
 * Wohngeld API-Wrapper (dünn über apiFetch). Alle Endpunkte unter /apps/wohngeld.
 * Assistenz für Vollständigkeits- und Plausibilitätsprüfung von Wohngeldanträgen.
 */
import { apiGet, apiPost, apiPut, apiDelete, API_URL } from '../../utils/apiFetch';

const base = '/apps/wohngeld';

/** Multipart-Upload (kein JSON-Content-Type — Browser setzt Boundary selbst). */
async function postForm(endpoint, formData) {
  const res = await fetch(`${API_URL}${base}${endpoint}`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  return res;
}

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

export const wohngeldApi = {
  // Akten
  listAkten: () => apiGet(`${base}/akten`).then(json).then((d) => d.akten),
  getAkte: (id) => apiGet(`${base}/akten/${id}`).then(json).then((d) => d.akte),
  listAkteVorgaenge: (id) => apiGet(`${base}/akten/${id}/vorgaenge`).then(json).then((d) => d.vorgaenge),
  createAkte: (payload) => apiPost(`${base}/akten`, payload).then(json).then((d) => d.akte),
  updateAkte: (id, payload) => apiPut(`${base}/akten/${id}`, payload).then(json).then((d) => d.akte),
  deleteAkte: (id) => apiDelete(`${base}/akten/${id}`).then(json),

  // Vorgänge
  listVorgaenge: (params = {}) => {
    const q = new URLSearchParams();
    if (params.akteId) q.set('akteId', params.akteId);
    if (params.status) q.set('status', params.status);
    const qs = q.toString();
    return apiGet(`${base}/vorgaenge${qs ? `?${qs}` : ''}`).then(json).then((d) => d.vorgaenge);
  },
  getVorgang: (id) => apiGet(`${base}/vorgaenge/${id}`).then(json).then((d) => d.vorgang),
  // Haupt-Endpoint der Detailseite: alles gebündelt.
  getVorgangDetail: (id) => apiGet(`${base}/vorgaenge/${id}/detail`).then(json),
  createVorgang: (payload) => apiPost(`${base}/vorgaenge`, payload).then(json).then((d) => d.vorgang),
  updateVorgang: (id, payload) => apiPut(`${base}/vorgaenge/${id}`, payload).then(json).then((d) => d.vorgang),
  deleteVorgang: (id) => apiDelete(`${base}/vorgaenge/${id}`).then(json),
  // Regel-Engine ausführen (Vollständigkeit + Plausibilität).
  pruefen: (id) => apiPost(`${base}/vorgaenge/${id}/pruefen`, {}).then(json),

  // Personen
  listPersonen: (vorgangId) => apiGet(`${base}/vorgaenge/${vorgangId}/personen`).then(json).then((d) => d.personen),
  createPerson: (vorgangId, payload) => apiPost(`${base}/vorgaenge/${vorgangId}/personen`, payload).then(json).then((d) => d.person),
  updatePerson: (id, payload) => apiPut(`${base}/personen/${id}`, payload).then(json).then((d) => d.person),
  deletePerson: (id) => apiDelete(`${base}/personen/${id}`).then(json),

  // Dokumente
  listDokumente: (vorgangId) => apiGet(`${base}/vorgaenge/${vorgangId}/dokumente`).then(json).then((d) => d.dokumente),
  createDokument: (vorgangId, payload) => apiPost(`${base}/vorgaenge/${vorgangId}/dokumente`, payload).then(json).then((d) => d.dokument),
  updateDokument: (id, payload) => apiPut(`${base}/dokumente/${id}`, payload).then(json).then((d) => d.dokument),
  deleteDokument: (id) => apiDelete(`${base}/dokumente/${id}`).then(json),

  // Posteingang (Upload + Klassifikation + Verteilung)
  uploadPosteingang: (files) => {
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append('files', f));
    return postForm('/posteingang/upload', fd).then(json).then((d) => d.previews);
  },
  verteilePosteingang: (payload) => apiPost(`${base}/posteingang/verteilen`, payload).then(json),
  uploadVorgangDokument: (vorgangId, file) => {
    const fd = new FormData();
    const list = Array.isArray(file) || file instanceof FileList ? Array.from(file) : [file];
    list.forEach((f) => fd.append('files', f));
    return postForm(`/vorgaenge/${vorgangId}/dokumente/upload`, fd).then(json).then((d) => d.dokumente);
  },

  // Prüfschritte
  listPruefschritte: (vorgangId) => apiGet(`${base}/vorgaenge/${vorgangId}/pruefschritte`).then(json).then((d) => d.pruefschritte),
  createPruefschritt: (vorgangId, payload) => apiPost(`${base}/vorgaenge/${vorgangId}/pruefschritte`, payload).then(json).then((d) => d.pruefschritt),
  updatePruefschritt: (id, payload) => apiPut(`${base}/pruefschritte/${id}`, payload).then(json).then((d) => d.pruefschritt),
  deletePruefschritt: (id) => apiDelete(`${base}/pruefschritte/${id}`).then(json),

  // Schreiben
  listSchreiben: (vorgangId) => apiGet(`${base}/vorgaenge/${vorgangId}/schreiben`).then(json).then((d) => d.schreiben),
  generiereSchreiben: (vorgangId, payload) => apiPost(`${base}/vorgaenge/${vorgangId}/schreiben/generieren`, payload).then(json).then((d) => d.schreiben),
  updateSchreiben: (id, payload) => apiPut(`${base}/schreiben/${id}`, payload).then(json).then((d) => d.schreiben),
  deleteSchreiben: (id) => apiDelete(`${base}/schreiben/${id}`).then(json),

  // Fall-Chat (grounded Fall-Q&A, Stufe C1)
  /** Chat-Verlauf eines Vorgangs laden. */
  getChat: (vorgangId) => apiGet(`${base}/vorgaenge/${vorgangId}/chat`).then(json).then((d) => d.messages),

  /**
   * Frage stellen und Antwort als SSE-Stream konsumieren.
   * Callbacks: onDelta(textChunk), onSources(sources[]), onDone(message), onError(msg).
   */
  streamChat: async (vorgangId, message, { onDelta, onSources, onDone, onError } = {}) => {
    let res;
    try {
      res = await fetch(`${API_URL}${base}/vorgaenge/${vorgangId}/chat`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
    } catch {
      onError?.('Verbindung fehlgeschlagen');
      return;
    }
    if (!res.ok || !res.body) {
      const body = await res.json().catch(() => ({}));
      onError?.(body.error || `HTTP ${res.status}`);
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
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
      if (event === 'delta') onDelta?.(parsed.content || '');
      else if (event === 'sources') onSources?.(parsed.sources || []);
      else if (event === 'done') onDone?.(parsed.message);
      else if (event === 'error') onError?.(parsed.message || 'Antwort fehlgeschlagen');
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
  },

  /** Schreiben als PDF oder Word (docx) herunterladen — löst einen Browser-Download aus. */
  exportSchreiben: async (id, format) => {
    const res = await fetch(`${API_URL}${base}/schreiben/${id}/export?format=${format}`, { credentials: 'include' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const cd = res.headers.get('Content-Disposition') || '';
    const m = cd.match(/filename="?([^"]+)"?/);
    const filename = m ? m[1] : `Anforderungsschreiben.${format}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  },
};

// ── Label-Maps (Anzeige für Enums) ──────────────────────────────────────────

export const WOHNGELDART_LABEL = {
  mietzuschuss: 'Mietzuschuss',
  lastenzuschuss: 'Lastenzuschuss',
};

export const ANTRAGSART_LABEL = {
  erstantrag: 'Erstantrag',
  weiterleistungsantrag: 'Weiterleistungsantrag',
  erhoehungsantrag: 'Erhöhungsantrag',
  aenderungsantrag: 'Änderungsantrag',
};

export const STATUS_LABEL = {
  posteingang: 'Posteingang',
  sachbearbeitung: 'In Bearbeitung',
  warte_auf_rueckmeldung: 'Wartet auf Rückmeldung',
  entscheidung: 'Entscheidung',
  abgeschlossen: 'Abgeschlossen',
};

// Anzeigereihenfolge der Status (für Filter-Tabs).
export const STATUS_ORDER = [
  'posteingang',
  'sachbearbeitung',
  'warte_auf_rueckmeldung',
  'entscheidung',
  'abgeschlossen',
];

export const PRIORITAET_LABEL = {
  niedrig: 'Niedrig',
  normal: 'Normal',
  hoch: 'Hoch',
};

export const ROLLE_LABEL = {
  antragsteller: 'Antragsteller/in',
  ehegatte: 'Ehegatte/-gattin',
  lebenspartner: 'Lebenspartner/in',
  kind: 'Kind',
  haushaltsmitglied: 'Haushaltsmitglied',
};

export const ERWERBSSTATUS_LABEL = {
  angestellt: 'Angestellt',
  selbststaendig: 'Selbstständig',
  rente_pension: 'Rente / Pension',
  arbeitslos: 'Arbeitslos',
  ausbildung_studium: 'Ausbildung / Studium',
  ohne_erwerb: 'Ohne Erwerb',
  sonstiges: 'Sonstiges',
};

export const PRUEF_KATEGORIE_LABEL = {
  vollstaendigkeit: 'Vollständigkeit',
  plausibilitaet: 'Plausibilität',
};

export const PRUEF_TYP_LABEL = {
  anforderung: 'Anforderung',
  info: 'Info',
};

export const PRUEF_STATUS_LABEL = {
  offen: 'Offen',
  erledigt: 'Erledigt',
  verworfen: 'Verworfen',
};

export const SCHREIBEN_ART_LABEL = {
  erstanforderung: 'Erstanforderung',
  erinnerung: 'Erinnerung',
  zweitanforderung: 'Zweitanforderung',
  sonstiges: 'Sonstiges',
};

export const DOKUMENT_TYP_LABEL = {
  wohngeldantrag: 'Wohngeldantrag',
  personalausweis: 'Personalausweis',
  mietvertrag: 'Mietvertrag',
  mietbescheinigung: 'Mietbescheinigung',
  rentenbescheid: 'Rentenbescheid',
  verdienstbescheinigung: 'Verdienstbescheinigung',
  gehaltsabrechnung: 'Gehaltsabrechnung',
  kontoauszug: 'Kontoauszug',
  kv_pv_nachweis: 'KV-/PV-Nachweis',
  schwerbehindertenausweis: 'Schwerbehindertenausweis',
  pflegenachweis: 'Pflegenachweis',
  kindergeldnachweis: 'Kindergeldnachweis',
  unterhaltsnachweis: 'Unterhaltsnachweis',
  transferleistungsbescheid: 'Transferleistungsbescheid',
  vermoegensnachweis: 'Vermögensnachweis',
  sonstiges: 'Sonstiges',
};

/** App-Akzentfarbe (ruhiges Blau), konsistent über alle Wohngeld-Seiten. */
export const ACCENT = '#2563EB';
export const ACCENT_LIGHT = '#EFF4FE';
