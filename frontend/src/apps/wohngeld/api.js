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
  // § 13-Gesamteinkommen (read-only, angenommene §16-Abzugskategorien).
  getEinkommen: (id) => apiGet(`${base}/vorgaenge/${id}/einkommen`).then(json).then((d) => d.einkommen),
  // Bewilligungszeitraum-Vorschlag übernehmen (12 Monate ab Antragsmonat, §22/§25).
  bwzVorschlagUebernehmen: (id) => apiPost(`${base}/vorgaenge/${id}/bwz-vorschlag-uebernehmen`, {}).then(json).then((d) => d.vorgang),

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
  // Schreiben als versendet markieren (WP7 — setzt Status + Frist/Wiedervorlage).
  markSchreibenVersendet: (vorgangId, sid) => apiPost(`${base}/vorgaenge/${vorgangId}/schreiben/${sid}/versendet`, {}).then(json).then((d) => d.vorgang),
  // Assistenz-Text an das jüngste Schreiben anhängen (C3 — legt bei Bedarf ein neues an).
  anhaengenSchreibenText: (vorgangId, text) => apiPost(`${base}/vorgaenge/${vorgangId}/schreiben/text-anhaengen`, { text }).then(json).then((d) => d.schreiben),

  // Wiedervorlage / Fristen (WP7 — offene Fristen über alle Vorgänge)
  listWiedervorlage: () => apiGet(`${base}/wiedervorlage`).then(json).then((d) => d.wiedervorlage),

  // Aufgaben (WP9 — offene Todos + fällige Fristen über alle Vorgänge)
  listAufgaben: () => apiGet(`${base}/aufgaben`).then(json).then((d) => d.aufgaben),

  // Dokumente-Datei (WP10 — Serving/Vorschau/Ablage)
  /** URL des Datei-Endpunkts (nur für Referenz — Vorschau nutzt loadDokumentDatei wegen credentials). */
  dokumentDateiUrl: (id) => `${API_URL}${base}/dokumente/${id}/datei`,
  /** Datei als Blob laden (credentials) → { url, contentType, blob }. Aufrufer gibt objectURL wieder frei. */
  loadDokumentDatei: async (id) => {
    const res = await fetch(`${API_URL}${base}/dokumente/${id}/datei`, { credentials: 'include' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    return { url: URL.createObjectURL(blob), contentType: res.headers.get('Content-Type') || blob.type || '', blob };
  },
  /** Datei als Download auslösen. */
  downloadDokumentDatei: async (id, filename) => {
    const res = await fetch(`${API_URL}${base}/dokumente/${id}/datei`, { credentials: 'include' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename || `dokument-${id}`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  },
  /** Dokument „ins Fachverfahren abgelegt" markieren (Editor-Gate). */
  ablegenDokument: (id) => apiPost(`${base}/dokumente/${id}/ablegen`, {}).then(json).then((d) => d.dokument),

  // Verfügung (WP11)
  /** Entscheidung + Bemerkung speichern → Status entscheidung. */
  saveVerfuegung: (id, payload) => apiPut(`${base}/vorgaenge/${id}/verfuegung`, payload).then(json).then((d) => d.vorgang),
  /** Verfügung als PDF/Word herunterladen — löst einen Browser-Download aus. */
  exportVerfuegung: async (id, format) => {
    const res = await fetch(`${API_URL}${base}/vorgaenge/${id}/verfuegung/export?format=${format}`, { credentials: 'include' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const cd = res.headers.get('Content-Disposition') || '';
    const m = cd.match(/filename="?([^"]+)"?/);
    const filename = m ? m[1] : `Verfuegung.${format}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  },

  // Feld-Status (WP3 — KI-Vorschlag-Bestätigung auf Feldebene)
  listFeldStatus: (vorgangId) => apiGet(`${base}/vorgaenge/${vorgangId}/feldstatus`).then(json).then((d) => d.feldStatus),
  bestaetigeFeld: (vorgangId, fsId) => apiPost(`${base}/vorgaenge/${vorgangId}/feldstatus/${fsId}/bestaetigen`, {}).then(json).then((d) => d.feldStatus),
  verwerfeFeld: (vorgangId, fsId) => apiPost(`${base}/vorgaenge/${vorgangId}/feldstatus/${fsId}/verwerfen`, {}).then(json),
  bestaetigeAlleFelder: (vorgangId) => apiPost(`${base}/vorgaenge/${vorgangId}/feldstatus/alle-bestaetigen`, {}).then(json).then((d) => d.feldStatus),

  // Textbausteine (WP6 — pflegbare Snippets für Anforderungsschreiben)
  listTextbausteine: () => apiGet(`${base}/textbausteine`).then(json).then((d) => d.textbausteine),
  createTextbaustein: (payload) => apiPost(`${base}/textbausteine`, payload).then(json).then((d) => d.textbaustein),
  updateTextbaustein: (id, payload) => apiPut(`${base}/textbausteine/${id}`, payload).then(json).then((d) => d.textbaustein),
  deleteTextbaustein: (id) => apiDelete(`${base}/textbausteine/${id}`).then(json),

  // Notizen (WP4 — Kommentare je Sektion/Person)
  listNotizen: (vorgangId) => apiGet(`${base}/vorgaenge/${vorgangId}/notizen`).then(json).then((d) => d.notizen),
  addNotiz: (vorgangId, payload) => apiPost(`${base}/vorgaenge/${vorgangId}/notizen`, payload).then(json).then((d) => d.notiz),
  deleteNotiz: (id) => apiDelete(`${base}/notizen/${id}`).then(json),

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
      else if (event === 'done') onDone?.(parsed.message, parsed.actions || []);
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

/** Empfänger-Kategorien der Unterhaltsverpflichtung (§ 18 WoGG). */
export const UNTERHALT_KATEGORIE_LABEL = {
  auswaertige_ausbildung: 'Auswärtige Ausbildung',
  kind_anderer_elternteil: 'Kind (anderer Elternteil)',
  ehegatte_getrennt: 'Getrennt lebender Ehegatte',
  sonstige: 'Sonstige',
};

/** Entscheidung der Verfügung (WP11). */
export const VERFUEGUNG_ENTSCHEIDUNG_LABEL = {
  offen: 'Offen',
  bewilligt: 'Bewilligt',
  teilweise: 'Teilweise bewilligt',
  abgelehnt: 'Abgelehnt',
};

/** Wirksame App-Rolle im Protokoll (GOV-1). */
export const APP_ROLE_LABEL = {
  owner: 'Owner',
  editor: 'Bearbeiter',
  viewer: 'Leser',
};

/**
 * Lesbare Labels der Audit-Aktionen (GOV-1 Fall-Protokoll).
 * Fallback in `aktionLabel()`: unbekannte Aktion → Rohwert.
 */
export const AKTION_LABEL = {
  'vorgang.geoeffnet': 'Fall geöffnet',
  'vorgang.erstellt': 'Vorgang erstellt',
  'vorgang.geaendert': 'Vorgang geändert',
  'vorgang.geloescht': 'Vorgang gelöscht',
  'akte.erstellt': 'Akte erstellt',
  'akte.geaendert': 'Akte geändert',
  'akte.geloescht': 'Akte gelöscht',
  'person.erstellt': 'Person angelegt',
  'person.geaendert': 'Person geändert',
  'person.geloescht': 'Person gelöscht',
  'dokument.erstellt': 'Dokument erfasst',
  'dokument.hochgeladen': 'Dokument(e) hochgeladen',
  'dokument.geaendert': 'Dokument geändert',
  'dokument.geloescht': 'Dokument gelöscht',
  'dokument.abgelegt': 'Dokument ins Fachverfahren abgelegt',
  'dokument.heruntergeladen': 'Dokument heruntergeladen',
  'dokument.vorschau': 'Dokument angesehen',
  'feld.bestaetigt': 'KI-Vorschlag bestätigt',
  'feld.verworfen': 'KI-Vorschlag verworfen',
  'feld.alle_bestaetigt': 'Alle KI-Vorschläge bestätigt',
  'pruefung.ausgefuehrt': 'Prüfung ausgeführt',
  'pruefschritt.angelegt': 'Prüfschritt angelegt',
  'pruefschritt.status_geaendert': 'Prüfschritt-Status geändert',
  'pruefschritt.geaendert': 'Prüfschritt geändert',
  'pruefschritt.geloescht': 'Prüfschritt gelöscht',
  'schreiben.generiert': 'Anforderungsschreiben generiert',
  'schreiben.geaendert': 'Schreiben geändert',
  'schreiben.versendet': 'Schreiben versendet',
  'schreiben.exportiert': 'Schreiben exportiert',
  'schreiben.text_angehaengt': 'Text ins Schreiben übernommen',
  'schreiben.geloescht': 'Schreiben gelöscht',
  'verfuegung.gespeichert': 'Verfügung gespeichert',
  'verfuegung.exportiert': 'Verfügung exportiert',
  'bwz.uebernommen': 'Bewilligungszeitraum übernommen',
  'notiz.erstellt': 'Notiz angelegt',
  'notiz.geloescht': 'Notiz gelöscht',
  'textbaustein.erstellt': 'Textbaustein angelegt',
  'textbaustein.geaendert': 'Textbaustein geändert',
  'textbaustein.geloescht': 'Textbaustein gelöscht',
  'chat.frage': 'Chat-Frage gestellt',
};

/** Lesbares Label einer Audit-Aktion (mit Rohwert-Fallback). */
export function aktionLabel(aktion) {
  return AKTION_LABEL[aktion] || aktion;
}

/** App-Akzentfarbe (ruhiges Blau), konsistent über alle Wohngeld-Seiten. */
export const ACCENT = '#2563EB';
export const ACCENT_LIGHT = '#EFF4FE';
