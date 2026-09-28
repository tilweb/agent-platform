/**
 * Grundsicherung API-Wrapper (dünn über apiFetch). Alle Endpunkte unter /apps/grundsicherung.
 * Assistenz für Vollständigkeits- und Plausibilitätsprüfung von Anträgen auf Grundsicherung im
 * Alter und bei Erwerbsminderung (SGB XII, 4. Kapitel). Pfade/Formen wie die Wohngeld-App.
 */
import { apiGet, apiPost, apiPut, apiPatch, apiDelete, API_URL } from '../../utils/apiFetch';

const base = '/apps/grundsicherung';

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

/** Datei-Antwort als Browser-Download auslösen (Dateiname aus Content-Disposition, sonst Fallback). */
async function downloadAntwort(url, fallbackName) {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') || '';
  const m = cd.match(/filename="?([^"]+)"?/);
  const filename = m ? m[1] : fallbackName;
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(objectUrl);
}

let regelnCache = null;

export const grundsicherungApi = {
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
  /** Status setzen, optional mit Abschluss-Vermerk { ergebnis, bemerkung } (Vier-Augen opt-in). */
  setStatus: (id, payload) => apiPut(`${base}/vorgaenge/${id}/status`, payload).then(json).then((d) => d.vorgang),
  /** Aufbewahrungsfrist setzen/korrigieren (Owner). `null` entfernt die Frist. */
  setAufbewahrung: (id, aufbewahrungBis, expectedVersion) => apiPut(`${base}/vorgaenge/${id}/aufbewahrung`, { aufbewahrungBis, expectedVersion }).then(json).then((d) => d.vorgang),
  // Legal Hold setzen/aufheben (Owner). Verhindert die Löschung.
  setLegalHold: (id, legalHold, expectedVersion) => apiPut(`${base}/vorgaenge/${id}/legal-hold`, { legalHold, expectedVersion }).then(json).then((d) => d.vorgang),
  // Art. 18 — Verarbeitungs-Einschränkung setzen (Editor) / aufheben (Owner).
  setEinschraenkung: (id, eingeschraenkt, expectedVersion) => apiPut(`${base}/vorgaenge/${id}/einschraenkung`, { eingeschraenkt, expectedVersion }).then(json).then((d) => d.vorgang),
  // Löschfällige Vorgänge (Owner): Frist abgelaufen, kein Legal Hold.
  listLoeschfaellig: () => apiGet(`${base}/loeschfaellig`).then(json).then((d) => d.loeschfaellig),
  // Regel-Engine ausführen (Vollständigkeit, Plausibilität, Vorrang).
  pruefen: (id) => apiPost(`${base}/vorgaenge/${id}/pruefen`, {}).then(json),
  getKiVerbrauch: (id) => apiGet(`${base}/vorgaenge/${id}/ki-verbrauch`).then(json),
  // Bewilligungszeitraum-Vorschlag übernehmen (12 Monate ab Monatserster des Antragsmonats).
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
  updateDokument: (id, payload) => apiPut(`${base}/dokumente/${id}`, payload).then(json).then((d) => d.dokument),
  deleteDokument: (id) => apiDelete(`${base}/dokumente/${id}`).then(json),
  /** Dokument „ins Fachverfahren abgelegt" markieren (Metadaten-Patch, Editor-Gate). */
  ablegenDokument: (id, expectedVersion) => apiPut(`${base}/dokumente/${id}`, { abgelegt: true, expectedVersion }).then(json).then((d) => d.dokument),
  /** Nachreichung direkt am Vorgang — läuft durch dieselbe Erkennung wie der Posteingang. */
  uploadVorgangDokument: (vorgangId, file) => {
    const fd = new FormData();
    const list = Array.isArray(file) || file instanceof FileList ? Array.from(file) : [file];
    list.forEach((f) => fd.append('files', f));
    return postForm(`/vorgaenge/${vorgangId}/dokumente/upload`, fd).then(json).then((d) => d.dokumente);
  },
  dokumentVorschau: (id) => apiGet(`${base}/dokumente/${id}/vorschau`).then(json),
  dokumentSeiteUrl: (id, n) => `${API_URL}${base}/dokumente/${id}/seite/${n}`,
  /** URL des Datei-Endpunkts (für „In neuem Tab öffnen"). */
  dokumentDateiUrl: (id) => `${API_URL}${base}/dokumente/${id}/datei`,
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

  // Posteingang-Warteschlange (Kern-Routen)
  /** Intake: 1..n Dateien nur speichern (keine Auto-Auswertung). opts: { quelle, eingegangenAm, betreff }. */
  ingestPosteingang: (files, opts = {}) => {
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append('files', f));
    if (opts.quelle) fd.append('quelle', opts.quelle);
    if (opts.eingegangenAm) fd.append('eingegangenAm', opts.eingegangenAm);
    if (opts.betreff) fd.append('betreff', opts.betreff);
    return postForm('/posteingang/ingest', fd).then(json);
  },
  listPosteingang: (params = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.quelle) q.set('quelle', params.quelle);
    const qs = q.toString();
    return apiGet(`${base}/posteingang${qs ? `?${qs}` : ''}`).then(json).then((d) => d.posteingang);
  },
  getPosteingang: (id) => apiGet(`${base}/posteingang/${id}`).then(json).then((d) => d.posteingang),
  getPosteingangKiVerbrauch: (id) => apiGet(`${base}/posteingang/${id}/ki-verbrauch`).then(json),
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
  /** Seitenvorschau (serverseitig gerenderte Bilder). */
  posteingangVorschau: (id, idx) => apiGet(`${base}/posteingang/${id}/datei/${idx}/vorschau`).then(json),
  posteingangSeiteUrl: (id, idx, n) => `${API_URL}${base}/posteingang/${id}/datei/${idx}/seite/${n}`,

  // Prüfschritte
  listPruefschritte: (vorgangId) => apiGet(`${base}/vorgaenge/${vorgangId}/pruefschritte`).then(json).then((d) => d.pruefschritte),
  createPruefschritt: (vorgangId, payload) => apiPost(`${base}/vorgaenge/${vorgangId}/pruefschritte`, payload).then(json).then((d) => d.pruefschritt),
  updatePruefschritt: (id, payload) => apiPut(`${base}/pruefschritte/${id}`, payload).then(json).then((d) => d.pruefschritt),
  deletePruefschritt: (id) => apiDelete(`${base}/pruefschritte/${id}`).then(json),

  // Schreiben (Nachforderung § 60 SGB I mit Frist und Rechtsfolgenbelehrung § 66 SGB I)
  listSchreiben: (vorgangId) => apiGet(`${base}/vorgaenge/${vorgangId}/schreiben`).then(json).then((d) => d.schreiben),
  generiereSchreiben: (vorgangId, payload) => apiPost(`${base}/vorgaenge/${vorgangId}/schreiben/generieren`, payload).then(json).then((d) => d.schreiben),
  updateSchreiben: (id, payload) => apiPut(`${base}/schreiben/${id}`, payload).then(json).then((d) => d.schreiben),
  deleteSchreiben: (id) => apiDelete(`${base}/schreiben/${id}`).then(json),
  // Schreiben als versendet markieren (setzt Status + Frist/Wiedervorlage).
  markSchreibenVersendet: (vorgangId, sid) => apiPost(`${base}/vorgaenge/${vorgangId}/schreiben/${sid}/versendet`, {}).then(json).then((d) => d.vorgang),
  /** Schreiben als PDF oder Word (docx) herunterladen — löst einen Browser-Download aus. */
  exportSchreiben: (id, format) => downloadAntwort(`${API_URL}${base}/schreiben/${id}/export?format=${format}`, `Nachforderung.${format}`),

  // Aufgaben (offene Todos + Fristen/Wiedervorlagen über alle Vorgänge)
  listAufgaben: () => apiGet(`${base}/aufgaben`).then(json).then((d) => d.aufgaben),
  // Prüfregeln (aufrufbare Dokumentation) — einmal je Sitzung geladen.
  getRegeln: () => {
    regelnCache ??= apiGet(`${base}/regeln`).then(json).catch((e) => { regelnCache = null; throw e; });
    return regelnCache;
  },

  // Feld-Status (KI-Vorschlag-Bestätigung auf Feldebene)
  listFeldStatus: (vorgangId) => apiGet(`${base}/vorgaenge/${vorgangId}/feldstatus`).then(json).then((d) => d.feldStatus),
  bestaetigeFeld: (vorgangId, fsId) => apiPost(`${base}/vorgaenge/${vorgangId}/feldstatus/${fsId}/bestaetigen`, {}).then(json).then((d) => d.feldStatus),
  verwerfeFeld: (vorgangId, fsId) => apiPost(`${base}/vorgaenge/${vorgangId}/feldstatus/${fsId}/verwerfen`, {}).then(json),
  bestaetigeAlleFelder: (vorgangId) => apiPost(`${base}/vorgaenge/${vorgangId}/feldstatus/alle-bestaetigen`, {}).then(json).then((d) => d.feldStatus),

  // Textbausteine (pflegbare Snippets für Schreiben)
  listTextbausteine: () => apiGet(`${base}/textbausteine`).then(json).then((d) => d.textbausteine),
  createTextbaustein: (payload) => apiPost(`${base}/textbausteine`, payload).then(json).then((d) => d.textbaustein),
  updateTextbaustein: (id, payload) => apiPut(`${base}/textbausteine/${id}`, payload).then(json).then((d) => d.textbaustein),
  deleteTextbaustein: (id) => apiDelete(`${base}/textbausteine/${id}`).then(json),

  // Notizen (je Sektion/Person)
  listNotizen: (vorgangId) => apiGet(`${base}/vorgaenge/${vorgangId}/notizen`).then(json).then((d) => d.notizen),
  addNotiz: (vorgangId, payload) => apiPost(`${base}/vorgaenge/${vorgangId}/notizen`, payload).then(json).then((d) => d.notiz),
  deleteNotiz: (id) => apiDelete(`${base}/notizen/${id}`).then(json),

  // Protokoll (nur Owner)
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
  exportAudit: (filter = {}) => {
    const q = new URLSearchParams({ format: 'csv' });
    for (const [k, v] of Object.entries(filter)) {
      if (v != null && String(v).trim() !== '') q.set(k, String(v).trim());
    }
    return downloadAntwort(`${API_URL}${base}/audit/export?${q.toString()}`, 'Protokoll.csv');
  },

  // Betroffenen-Auskunft (Art. 15 DSGVO)
  /** Auskunft einer Person als PDF oder JSON herunterladen — löst einen Browser-Download aus. */
  exportAuskunft: (personId, format) => downloadAntwort(`${API_URL}${base}/personen/${personId}/auskunft/export?format=${format}`, `Auskunft.${format}`),
};

// ── Label-Maps (Anzeige für Enums, passend zu backend/src/apps/grundsicherung/types.ts) ──

export const ANTRAGSART_LABEL = {
  erstantrag: 'Erstantrag',
  weiterbewilligung: 'Weiterbewilligungsantrag',
  aenderung: 'Änderungsantrag',
};

/** Anspruchsgrund (§ 41 Abs. 2/3 SGB XII). */
export const ANSPRUCHSGRUND_LABEL = {
  alter: 'Alter (Altersgrenze erreicht)',
  erwerbsminderung: 'Dauerhafte volle Erwerbsminderung',
};

/** Kurzform für Tabellen. */
export const ANSPRUCHSGRUND_KURZ = {
  alter: 'Alter',
  erwerbsminderung: 'Erwerbsminderung',
};

export const WOHNSITUATION_LABEL = {
  miete: 'Mietwohnung',
  untermiete: 'Untermiete',
  eigentum: 'Wohneigentum',
  bei_angehoerigen: 'Bei Angehörigen',
  einrichtung: 'Einrichtung / besondere Wohnform',
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

/** Ergebnis beim Abschluss (nur Vermerk — den Bescheid erstellt das Fachverfahren). */
export const ABSCHLUSS_ERGEBNIS_LABEL = {
  offen: 'Offen (Vorbereitung)',
  bewilligt: 'Bewilligt',
  abgelehnt: 'Abgelehnt',
  zurueckgenommen: 'Zurückgenommen',
  weitergeleitet: 'Weitergeleitet (andere Stelle)',
};

/** Finale Ergebnisse (Vier-Augen-pflichtig, falls aktiv). */
export const FINALE_ERGEBNISSE = ['bewilligt', 'abgelehnt', 'zurueckgenommen', 'weitergeleitet'];

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
  weiterleitung: 'Weiterleitung (andere Stelle)',
};

export const PRIORITAET_LABEL = {
  niedrig: 'Niedrig',
  normal: 'Normal',
  hoch: 'Hoch',
};

/** Rolle: Einsatzgemeinschaft (Antragsteller + Partner) oder Haushaltsangehörige(r). */
export const ROLLE_LABEL = {
  antragsteller: 'Antragsteller/in',
  partner: 'Partner/in (Einsatzgemeinschaft)',
  haushaltsangehoerig: 'Haushaltsangehörige/r',
};

export const FAMILIENSTAND_LABEL = {
  ledig: 'Ledig',
  verheiratet: 'Verheiratet',
  getrennt_lebend: 'Getrennt lebend',
  geschieden: 'Geschieden',
  verwitwet: 'Verwitwet',
  lebenspartnerschaft: 'Eingetragene Lebenspartnerschaft',
  eheaehnlich: 'Eheähnliche Gemeinschaft',
};

/** Rechtliche Vertretung. */
export const BETREUUNG_LABEL = {
  keine: 'Keine',
  betreuung: 'Rechtliche Betreuung',
  vollmacht: 'Vollmacht',
};

export const KV_ART_LABEL = {
  pflicht: 'Pflichtversichert',
  familie: 'Familienversichert',
  freiwillig: 'Freiwillig gesetzlich versichert',
  privat: 'Privat versichert',
  keine: 'Nicht versichert',
};

export const WARMWASSER_LABEL = {
  zentral: 'Zentral (über die Heizung)',
  dezentral: 'Dezentral (z. B. Durchlauferhitzer)',
};

/** Vorheriger Leistungsbezug (Vorgang.vorbezug.leistung). */
export const VORBEZUG_LEISTUNG_LABEL = {
  buergergeld: 'Bürgergeld / Grundsicherungsgeld (SGB II)',
  hilfe_zum_lebensunterhalt: 'Hilfe zum Lebensunterhalt (SGB XII)',
  wohngeld: 'Wohngeld',
  sonstige: 'Sonstige Leistung',
};

/** Einkommensarten (Person.einkommen[].art) — Vokabular der Regel-Engine (EINKOMMENS_ARTEN). */
export const EINKOMMENSART_LABEL = {
  altersrente: 'Altersrente',
  em_rente: 'Erwerbsminderungsrente',
  hinterbliebenenrente: 'Hinterbliebenenrente',
  rente: 'Rente (sonstige gesetzliche)',
  betriebsrente: 'Betriebsrente',
  zusatzversorgung: 'Zusatzversorgung (z. B. VBL)',
  pension: 'Pension',
  private_rente: 'Private Rente',
  wohngeld: 'Wohngeld',
  unterhalt: 'Unterhalt',
  erwerbseinkommen: 'Erwerbseinkommen',
  minijob: 'Minijob',
  kapitalertraege: 'Kapitalerträge',
  vermietung: 'Vermietung / Verpachtung',
  zuwendung: 'Zuwendung Dritter',
  krankengeld: 'Krankengeld',
  arbeitslosengeld: 'Arbeitslosengeld',
  grundsicherungsgeld: 'Grundsicherungsgeld (SGB II)',
  sozialleistung: 'Sonstige Sozialleistung',
  selbstaendig: 'Selbständige Tätigkeit',
  wfbm_entgelt: 'Entgelt Werkstatt (WfbM)',
  sonstiges: 'Sonstiges',
};

/** Vermögensarten (Person.vermoegen[].art) — Vokabular der Regel-Engine (VERMOEGENS_ARTEN). */
export const VERMOEGENSART_LABEL = {
  girokonto: 'Girokonto',
  sparkonto: 'Sparkonto',
  sparbuch: 'Sparbuch',
  tagesgeld: 'Tagesgeld',
  festgeld: 'Festgeld',
  depot: 'Wertpapierdepot',
  bausparvertrag: 'Bausparvertrag',
  lebensversicherung: 'Lebensversicherung',
  kapitalversicherung: 'Kapitalversicherung',
  riester: 'Riester-Vertrag',
  bestattungsvorsorge: 'Bestattungsvorsorge',
  sterbegeldversicherung: 'Sterbegeldversicherung',
  eigenheim: 'Selbst genutztes Wohneigentum',
  immobilie: 'Sonstige Immobilie',
  kfz: 'Kraftfahrzeug',
  hausrat: 'Hausrat',
  sonstiges: 'Sonstiges',
};

/** Schwerbehinderungsgrad (GdB) — Auswahlwerte (leer = ohne). */
export const GDB_OPTIONS = ['', '20', '30', '40', '50', '60', '70', '80', '90', '100'];

/** Merkzeichen im Schwerbehindertenausweis. */
export const MERKZEICHEN_OPTIONS = ['G', 'aG', 'H', 'Bl', 'Gl', 'TBl', 'B', 'RF'];

export const SCHREIBEN_ART_LABEL = {
  erstanforderung: 'Erstanforderung',
  erinnerung: 'Erinnerung',
  zweitanforderung: 'Zweitanforderung',
  sonstiges: 'Sonstiges',
};

/** Dokumenttypen (erster Wurf) — Labels wie im Backend (types.ts DOKUMENT_TYP_LABEL). */
export const DOKUMENT_TYP_LABEL = {
  grundsicherungsantrag: 'Antrag auf Grundsicherung',
  personalausweis: 'Personalausweis / Pass',
  betreuerausweis: 'Betreuerausweis / Vollmacht',
  rentenbescheid: 'Rentenbescheid',
  rentenanpassungsmitteilung: 'Rentenanpassungsmitteilung',
  em_feststellung_rv: 'Feststellung Erwerbsminderung (Rentenversicherung)',
  betriebsrente_mitteilung: 'Mitteilung Betriebsrente / Zusatzversorgung',
  kontoauszug: 'Kontoauszug',
  mietvertrag: 'Mietvertrag',
  vermieterbescheinigung: 'Vermieterbescheinigung',
  nebenkostenabrechnung: 'Nebenkostenabrechnung',
  energieabrechnung: 'Heiz-/Energiekostenabrechnung',
  eigentum_nachweis: 'Nachweis Wohneigentum / Hauslasten',
  vermoegensnachweis: 'Vermögensnachweis',
  bestattungsvorsorge: 'Bestattungsvorsorgevertrag',
  kv_pv_nachweis: 'Kranken-/Pflegeversicherungsnachweis',
  schwerbehindertenausweis: 'Schwerbehindertenausweis',
  aerztliche_bescheinigung: 'Ärztliche Bescheinigung',
  wohngeldbescheid: 'Wohngeldbescheid',
  transferleistungsbescheid: 'Bescheid über andere Sozialleistungen',
  sonstiges: 'Sonstiges',
};

/** Wirksame App-Rolle im Protokoll. */
export const APP_ROLE_LABEL = {
  owner: 'Owner',
  editor: 'Bearbeiter',
  viewer: 'Leser',
};

/**
 * Lesbare Labels der Audit-Aktionen (Fall-Protokoll).
 * Fallback in `aktionLabel()`: unbekannte Aktion → Rohwert.
 */
export const AKTION_LABEL = {
  'vorgang.geoeffnet': 'Fall geöffnet',
  'vorrang_grunddaten.gelesen': 'Grunddaten für die Vorrangprüfung abgerufen',
  'vorgang.erstellt': 'Vorgang erstellt',
  'vorgang.geaendert': 'Vorgang geändert',
  'vorgang.status_geaendert': 'Status geändert',
  'vorgang.geloescht': 'Vorgang gelöscht',
  'vorgang.aufbewahrung_geaendert': 'Aufbewahrungsfrist geändert',
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
  'person.auskunft_exportiert': 'Betroffenen-Auskunft exportiert',
  'dokument.hochgeladen': 'Dokument(e) hochgeladen',
  'dokument.zugeordnet': 'Dokument(e) per Vorschlag zugeordnet',
  'dokument.geaendert': 'Dokument geändert',
  'dokument.geloescht': 'Dokument gelöscht',
  'dokument.heruntergeladen': 'Dokument heruntergeladen',
  'dokument.angesehen': 'Dokument angesehen (Vorschau)',
  'feld.bestaetigt': 'KI-Vorschlag bestätigt',
  'feld.verworfen': 'KI-Vorschlag verworfen',
  'feld.alle_bestaetigt': 'Alle KI-Vorschläge bestätigt',
  'pruefung.ausgefuehrt': 'Prüfung ausgeführt',
  'pruefschritt.angelegt': 'Prüfschritt angelegt',
  'pruefschritt.status_geaendert': 'Prüfschritt-Status geändert',
  'pruefschritt.geaendert': 'Prüfschritt geändert',
  'pruefschritt.geloescht': 'Prüfschritt gelöscht',
  'schreiben.generiert': 'Nachforderungsschreiben erzeugt',
  'schreiben.geaendert': 'Schreiben geändert',
  'schreiben.versendet': 'Schreiben versendet',
  'schreiben.exportiert': 'Schreiben exportiert',
  'schreiben.geloescht': 'Schreiben gelöscht',
  'bwz.uebernommen': 'Bewilligungszeitraum übernommen',
  'notiz.erstellt': 'Notiz angelegt',
  'notiz.geloescht': 'Notiz gelöscht',
  'textbaustein.erstellt': 'Textbaustein angelegt',
  'textbaustein.geaendert': 'Textbaustein geändert',
  'textbaustein.geloescht': 'Textbaustein gelöscht',
  'protokoll.exportiert': 'Protokoll exportiert',
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

/** App-Akzentfarbe und Prüfschritt-Labels kommen aus dem Antrags-Kern. */
export { ACCENT, ACCENT_LIGHT, PRUEF_KATEGORIE_LABEL, PRUEF_TYP_LABEL, PRUEF_STATUS_LABEL } from '../_antrag-kern/konstanten';
