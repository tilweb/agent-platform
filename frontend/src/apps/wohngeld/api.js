/**
 * Wohngeld API-Wrapper (dünn über apiFetch). Alle Endpunkte unter /apps/wohngeld.
 * Assistenz für Vollständigkeits- und Plausibilitätsprüfung von Wohngeldanträgen.
 */
import { apiGet, apiPost, apiPut, apiDelete } from '../../utils/apiFetch';

const base = '/apps/wohngeld';

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
