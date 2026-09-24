/**
 * Wohngeld API-Wrapper (dünn über apiFetch). Alle Endpunkte unter /apps/wohngeld.
 * Assistenz für Vollständigkeits- und Plausibilitätsprüfung von Wohngeldanträgen.
 */
import { apiGet, apiPost, apiPut, apiPatch, apiDelete, API_URL } from '../../utils/apiFetch';

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

let regelnCache = null;

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
  // GOV-5 — Legal Hold setzen/aufheben (Owner). Verhindert die Löschung.
  setLegalHold: (id, legalHold, expectedVersion) => apiPut(`${base}/vorgaenge/${id}/legal-hold`, { legalHold, expectedVersion }).then(json).then((d) => d.vorgang),
  // GOV-5 / Art. 18 — Verarbeitungs-Einschränkung setzen (Editor) / aufheben (Owner).
  setEinschraenkung: (id, eingeschraenkt, expectedVersion) => apiPut(`${base}/vorgaenge/${id}/einschraenkung`, { eingeschraenkt, expectedVersion }).then(json).then((d) => d.vorgang),
  // GOV-5 — Löschfällige Vorgänge (Owner): Frist abgelaufen, kein Legal Hold.
  listLoeschfaellig: () => apiGet(`${base}/loeschfaellig`).then(json).then((d) => d.loeschfaellig),
  // Regel-Engine ausführen (Vollständigkeit + Plausibilität).
  pruefen: (id) => apiPost(`${base}/vorgaenge/${id}/pruefen`, {}).then(json),
  // § 13-Gesamteinkommen (read-only, angenommene §16-Abzugskategorien).
  getEinkommen: (id) => apiGet(`${base}/vorgaenge/${id}/einkommen`).then(json).then((d) => d.einkommen),
  // KI-Nutzung je Vorgang (GOV-3 — Transparenz über eingesetzte KI-Assistenz)
  getKiNutzung: (id) => apiGet(`${base}/vorgaenge/${id}/ki-nutzung`).then(json).then((d) => d.eintraege),
  // Bewilligungszeitraum-Vorschlag übernehmen (12 Monate ab Antragsmonat, §22/§25).
  bwzVorschlagUebernehmen: (id) => apiPost(`${base}/vorgaenge/${id}/bwz-vorschlag-uebernehmen`, {}).then(json).then((d) => d.vorgang),

  // Personen
  listPersonen: (vorgangId) => apiGet(`${base}/vorgaenge/${vorgangId}/personen`).then(json).then((d) => d.personen),
  createPerson: (vorgangId, payload) => apiPost(`${base}/vorgaenge/${vorgangId}/personen`, payload).then(json).then((d) => d.person),
  /** Auswahlliste der Sachbearbeitung (Nutzer mit Bearbeitungsrecht) + eigene Nutzer-ID. */
  getSachbearbeitung: () => apiGet(`${base}/sachbearbeitung`).then(json),
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
  /** Zuordnungs-Vorschlag: identifizierende Daten gegen bestehende Vorgänge abgleichen → { kandidaten }. */
  matchPosteingang: (payload) => apiPost(`${base}/posteingang/match`, payload).then(json).then((d) => d.kandidaten),

  // Posteingang-Warteschlange (persistent, multi-antragsfähig)
  /** Intake: 1..n Dateien nur speichern (kein Auto-Analyse). opts: { quelle, eingegangenAm, betreff }. */
  ingestPosteingang: (files, opts = {}) => {
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append('files', f));
    if (opts.quelle) fd.append('quelle', opts.quelle);
    if (opts.eingegangenAm) fd.append('eingegangenAm', opts.eingegangenAm);
    if (opts.betreff) fd.append('betreff', opts.betreff);
    return postForm('/posteingang/ingest', fd).then(json);
  },
  /** Queue laden (Filter status/quelle). */
  listPosteingang: (params = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.quelle) q.set('quelle', params.quelle);
    const qs = q.toString();
    return apiGet(`${base}/posteingang${qs ? `?${qs}` : ''}`).then(json).then((d) => d.posteingang);
  },
  getPosteingang: (id) => apiGet(`${base}/posteingang/${id}`).then(json).then((d) => d.posteingang),
  /** Auswertung starten (einzeln oder Sammel) — läuft im Hintergrund → { gestartet, abgelehnt }. */
  analysierePosteingang: (ids) => apiPost(`${base}/posteingang/analysieren`, { ids }).then(json),
  /** Zuordnung: { akteId?|neueAkte?, vorgangId?, pruefen?, viaVorschlag?, matchLevel?, stammdaten? }. */
  zuordnenPosteingang: (id, payload) => apiPost(`${base}/posteingang/${id}/zuordnen`, payload).then(json),
  verwerfenPosteingang: (id, grund) => apiPost(`${base}/posteingang/${id}/verwerfen`, { grund }).then(json).then((d) => d.posteingang),
  trennePosteingang: (id, hash, startSeiten) => apiPost(`${base}/posteingang/${id}/trennung`, { hash, startSeiten }).then(json).then((d) => d.posteingang),
  patchPosteingang: (id, payload) => apiPatch(`${base}/posteingang/${id}`, payload).then(json).then((d) => d.posteingang),
  deletePosteingang: (id) => apiDelete(`${base}/posteingang/${id}`).then(json),
  /** URL einer Umschlag-Datei (inline-Vorschau). */
  posteingangDateiUrl: (id, idx) => `${API_URL}${base}/posteingang/${id}/datei/${idx}`,
  /** Datei eines Eingangs als Blob laden (credentials) → { url, contentType }. Aufrufer gibt objectURL frei. */
  loadPosteingangDatei: async (id, idx) => {
    const res = await fetch(`${API_URL}${base}/posteingang/${id}/datei/${idx}`, { credentials: 'include' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    return { url: URL.createObjectURL(blob), contentType: res.headers.get('Content-Type') || blob.type || '' };
  },
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
  // Prüfregeln (aufrufbare Dokumentation) — einmal je Sitzung geladen.
  getRegeln: () => {
    regelnCache ??= apiGet(`${base}/regeln`).then(json).catch((e) => { regelnCache = null; throw e; });
    return regelnCache;
  },
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
  /** Gesetz nachschlagen: Fundstellen im Wortlaut (kein Streaming). Liefert { frage, antwort }. */
  gesetzFrage: (vorgangId, message) => apiPost(`${base}/vorgaenge/${vorgangId}/chat/gesetz`, { message }).then(json),
  /** Alle Absätze des Paragraphen einer Fundstelle. */
  getParagraph: (fundstellenId) => apiGet(`${base}/recht/paragraph/${encodeURIComponent(fundstellenId)}`).then(json).then((d) => d.absaetze),
  /** Chat-Verlauf eines Modus ('antrag' | 'gesetz') zurücksetzen. */
  resetChat: (vorgangId, modus) => apiDelete(`${base}/vorgaenge/${vorgangId}/chat?modus=${modus}`).then(json),
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

  // Admin/DSB-Protokoll (GOV-4 — nur Owner)
  /** Gesamt-Protokoll mit Filtern laden → { eintraege, gesamt }. */
  listAudit: (filter = {}) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(filter)) {
      if (v != null && String(v).trim() !== '') q.set(k, String(v).trim());
    }
    const qs = q.toString();
    return apiGet(`${base}/audit${qs ? `?${qs}` : ''}`).then(json);
  },
  /** Protokoll als CSV exportieren — löst einen Browser-Download aus. */
  exportAudit: async (filter = {}) => {
    const q = new URLSearchParams({ format: 'csv' });
    for (const [k, v] of Object.entries(filter)) {
      if (v != null && String(v).trim() !== '') q.set(k, String(v).trim());
    }
    const res = await fetch(`${API_URL}${base}/audit/export?${q.toString()}`, { credentials: 'include' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const cd = res.headers.get('Content-Disposition') || '';
    const m = cd.match(/filename="?([^"]+)"?/);
    const filename = m ? m[1] : 'Protokoll.csv';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  },

  // Betroffenen-Auskunft (Art. 15 DSGVO — GOV-4)
  /** Auskunft einer Person als PDF oder JSON herunterladen — löst einen Browser-Download aus. */
  exportAuskunft: async (personId, format) => {
    const res = await fetch(`${API_URL}${base}/personen/${personId}/auskunft/export?format=${format}`, { credentials: 'include' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const cd = res.headers.get('Content-Disposition') || '';
    const m = cd.match(/filename="?([^"]+)"?/);
    const filename = m ? m[1] : `Auskunft.${format}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
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

/** Status eines Posteingangs (Warteschlange). */
export const POSTEINGANG_STATUS_LABEL = {
  eingegangen: 'Eingegangen',
  in_analyse: 'In Auswertung',
  analysiert: 'Ausgewertet',
  fehler: 'Fehler',
  zugeordnet: 'Zugeordnet',
  verworfen: 'Verworfen',
};

/** Anzeigereihenfolge der Posteingang-Status (Filter-Tabs). */
export const POSTEINGANG_STATUS_ORDER = [
  'eingegangen', 'in_analyse', 'analysiert', 'fehler', 'zugeordnet', 'verworfen',
];

/** Einlieferungs-Kanal eines Posteingangs. */
export const POSTEINGANG_QUELLE_LABEL = {
  manuell: 'Manuell',
  scan: 'Scan',
  email: 'E-Mail',
  import: 'Import',
};

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

/** Geschlecht (Person). Gespeicherter Wert = Enum-Key aus types.ts. */
export const GESCHLECHT_LABEL = {
  maennlich: 'Männlich',
  weiblich: 'Weiblich',
  divers: 'Divers',
};

/**
 * Familienstand (Person). Als Freitext behandelt, aber Select angeboten.
 * Werte = Enum-Keys; Legacy-Freitext bleibt lesbar (Fallback auf Rohwert bei Anzeige).
 */
export const FAMILIENSTAND_LABEL = {
  ledig: 'Ledig',
  verheiratet: 'Verheiratet',
  eingetragene_lebenspartnerschaft: 'Eingetragene Lebenspartnerschaft',
  getrennt_lebend: 'Getrennt lebend',
  geschieden: 'Geschieden',
  verwitwet: 'Verwitwet',
};

/** Art einer Einkommensposition (§14 WoGG). Werte = gespeicherte Enum-Keys. */
export const EINKOMMENSART_LABEL = {
  lohn_gehalt: 'Lohn / Gehalt',
  rente: 'Rente',
  kapitalertraege: 'Kapitalerträge',
  v_und_v: 'Vermietung & Verpachtung',
  selbststaendig: 'Selbstständige Tätigkeit',
  alg1: 'Arbeitslosengeld I',
  krankengeld: 'Krankengeld',
  elterngeld: 'Elterngeld',
  unterhalt: 'Unterhalt',
  sonstiges: 'Sonstiges',
};

/** Schwerbehinderungsgrad (GdB) — Auswahlwerte (leer = ohne). */
export const GDB_OPTIONS = ['', '20', '30', '40', '50', '60', '70', '80', '90', '100'];

/** Pflegegrad — Auswahlwerte (leer = ohne). */
export const PFLEGEGRAD_OPTIONS = ['', '1', '2', '3', '4', '5'];

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

/** Empfänger-Kategorien der Unterhaltsverpflichtung (§ 18 WoGG) — Legacy-Shape. */
export const UNTERHALT_KATEGORIE_LABEL = {
  auswaertige_ausbildung: 'Auswärtige Ausbildung',
  kind_anderer_elternteil: 'Kind (anderer Elternteil)',
  ehegatte_getrennt: 'Getrennt lebender Ehegatte',
  sonstige: 'Sonstige',
};

/** Zahlungsfrequenz einer Betragsangabe (forml-Feldset, Welle 2). */
export const FREQUENZ_LABEL = {
  taeglich: 'täglich',
  woechentlich: 'wöchentlich',
  vierzehntaegig: '14-täglich',
  monatlich: 'monatlich',
  vierteljaehrlich: 'vierteljährlich',
  jaehrlich: 'jährlich',
  einmalig: 'einmalig',
  schwankend: 'schwankend',
  sonstige: 'sonstige',
};

/** Verwandtschaftsverhältnis Empfänger einer Unterhaltsverpflichtung (forml-Feldset). */
export const VERWANDTSCHAFT_LABEL = {
  kind: 'Kind',
  ehegatte_getrennt: 'Getrennt lebender/früherer Ehegatte/Lebenspartner',
  elternteil: 'Elternteil',
  auswaertige_ausbildung: 'Person in auswärtiger Ausbildung',
  sonstige: 'Sonstige',
};

/** Ausschluss-Grund nach § 7 WoGG (forml-Feldset, Welle 2). */
export const AUSSCHLUSS_GRUND_LABEL = {
  sgb2_buergergeld: 'Leistung nach SGB II (Bürgergeld)',
  grundsicherung_alter_em: 'Grundsicherung im Alter/bei Erwerbsminderung',
  hilfe_lebensunterhalt_sgb12: 'Hilfe zum Lebensunterhalt (SGB XII)',
  ergaenzende_hilfe_bvg: 'Ergänzende Hilfe zum Lebensunterhalt (nach BVG)',
  hilfe_stationaer: 'Hilfe in einer stationären Einrichtung zum Lebensunterhalt',
  kinder_jugendhilfe_sgb8: 'Leistungen der Kinder- und Jugendhilfe (SGB VIII)',
  asylblg: 'Grundleistungen nach dem AsylbLG',
  ausbildungsfoerderung: 'Ausbildungsförderung (BAföG/BAB, § 20 Abs. 2 WoGG)',
  sonstiger_grund: 'Sonstiger Grund',
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
  'vorgang.legal_hold_gesetzt': 'Löschsperre (Legal Hold) gesetzt',
  'vorgang.legal_hold_aufgehoben': 'Löschsperre (Legal Hold) aufgehoben',
  'vorgang.einschraenkung_gesetzt': 'Verarbeitung eingeschränkt (Art. 18)',
  'vorgang.einschraenkung_aufgehoben': 'Einschränkung aufgehoben',
  'akte.erstellt': 'Akte erstellt',
  'akte.geaendert': 'Akte geändert',
  'akte.geloescht': 'Akte gelöscht',
  'person.erstellt': 'Person angelegt',
  'person.geaendert': 'Person geändert',
  'person.geloescht': 'Person gelöscht',
  'dokument.erstellt': 'Dokument erfasst',
  'dokument.hochgeladen': 'Dokument(e) hochgeladen',
  'dokument.zugeordnet': 'Dokument(e) per Vorschlag zugeordnet',
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
  'chat.gesetzfrage': 'Gesetz nachgeschlagen',
  'chat.zurueckgesetzt': 'Chat-Verlauf zurückgesetzt',
  'protokoll.exportiert': 'Protokoll exportiert',
  'person.auskunft_exportiert': 'Betroffenen-Auskunft exportiert',
  'posteingang.eingegangen': 'Posteingang: Eingang erfasst',
  'posteingang.dublette_ignoriert': 'Posteingang: Doppel-Einlieferung erkannt',
  'posteingang.datei_gelesen': 'Posteingang: Datei angesehen',
  'posteingang.analysiert': 'Posteingang: ausgewertet',
  'posteingang.analyse_fehler': 'Posteingang: Auswertung fehlgeschlagen',
  'posteingang.getrennt': 'Posteingang: Sammel-PDF getrennt',
  'posteingang.trennung_aufgehoben': 'Posteingang: als ein Dokument festgelegt',
  'posteingang.zugeordnet': 'Posteingang: zugeordnet',
  'posteingang.verworfen': 'Posteingang: verworfen',
  'posteingang.geaendert': 'Posteingang: korrigiert',
  'posteingang.geloescht': 'Posteingang: gelöscht',
};

/** Lesbares Label einer Audit-Aktion (mit Rohwert-Fallback). */
export function aktionLabel(aktion) {
  return AKTION_LABEL[aktion] || aktion;
}

/**
 * Lesbarer Zweck eines KI-Nutzungseintrags (GOV-3). Mappt operation, sonst source.
 * Fallback: Rohwert.
 */
export const KI_ZWECK_LABEL = {
  wohngeld_fall_chat: 'Fall-Chat (Frage zum Vorgang)',
  wohngeld_gesetz_nachschlagen: 'Gesetz nachschlagen (Auswahl der Fundstellen)',
  wohngeld_klassifikation: 'Dokument-Klassifikation & Extraktion',
  chat: 'Chat',
  document_analysis: 'Dokumentanalyse',
};
export function kiZweckLabel(eintrag) {
  return KI_ZWECK_LABEL[eintrag?.operation] || KI_ZWECK_LABEL[eintrag?.source] || eintrag?.operation || eintrag?.source || 'KI-Nutzung';
}

/** App-Akzentfarbe (ruhiges Blau), konsistent über alle Wohngeld-Seiten. */
export const ACCENT = '#2563EB';
export const ACCENT_LIGHT = '#EFF4FE';
