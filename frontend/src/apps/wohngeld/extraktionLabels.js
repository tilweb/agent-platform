/**
 * Fachliche Angaben (Wohngeld) für den generischen Extraktions-Baum des Antrags-Kerns.
 * Aufrufer übergeben `EXTRAKTION_BAUM_PROPS` per Spread an `ExtraktionsBaum`.
 */

// ── Fallback-Formatierung (Analyse → Label/Wert) ────────────────────────────
export const ANALYSE_LABEL = {
  miete: 'Miete laut Dokument',
  wohnflaeche_qm: 'Wohnfläche laut Dokument',
  unterschrift_vorhanden: 'Unterschrift',
  datum_vorhanden: 'Datum',
  rentenart_vorhanden: 'Rentenart',
  grundrentenzeiten_vorhanden: 'Grundrentenzeiten',
  mietzahlung_erkannt: 'Mietzahlung erkannt',
  erkannte_einkuenfte: 'Erkannte Einkünfte',
  betrag: 'Betrag',
};
export const EINKUNFTSART_LABEL = { kapitalertraege: 'Kapitalerträge', v_und_v: 'Vermietung/Verpachtung' };
export const VORHANDEN_FELDER = new Set(['unterschrift_vorhanden', 'datum_vorhanden', 'rentenart_vorhanden', 'grundrentenzeiten_vorhanden']);
export const EURO_FELDER = new Set(['miete', 'betrag']);

function fmtEuro(v) {
  if (v == null || Number.isNaN(v)) return null;
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}
export function analyseWert(feld, v) {
  if (v == null) return null;
  if (EURO_FELDER.has(feld)) return fmtEuro(v);
  if (feld === 'wohnflaeche_qm') return `${v.toLocaleString('de-DE')} m²`;
  if (feld === 'erkannte_einkuenfte') return Array.isArray(v) && v.length ? v.map((x) => EINKUNFTSART_LABEL[x] ?? x).join(', ') : null;
  if (VORHANDEN_FELDER.has(feld)) return v === true ? 'vorhanden' : v === false ? 'fehlt' : null;
  if (feld === 'mietzahlung_erkannt') return v === true ? 'ja' : v === false ? 'nein' : null;
  return String(v);
}

/** Pflichtangaben des Antrags je Gruppe (Label wie im Extraktions-Baum). */
export const ANTRAG_PFLICHT = {
  Antragsteller: ['Vorname', 'Nachname', 'Geburtsdatum'],
  Adresse: ['Straße', 'Hausnummer', 'PLZ', 'Ort'],
  Wohnung: ['Bruttokaltmiete', 'Wohnfläche'],
  Antrag: ['Antragsdatum'],
};
/** Ein Dokument gilt als Antrag, wenn es Werte in einer dieser Gruppen hat. */
export const ANTRAG_ERKENNUNGS_GRUPPEN = ['Antragsteller', 'Adresse'];

/** Offene Prüfhinweise → betroffenes Feld (Label im Baum). */
export const REGEL_ZU_FELD = {
  'plausi-miethoehe-abweichung': ['Miete laut Dokument', 'Bruttokaltmiete'],
  'plausi-wohnflaeche-abweichung': ['Wohnfläche laut Dokument', 'Wohnfläche'],
  'plausi-mietvertrag-unsigniert': ['Unterschrift'],
  'plausi-antrag-ohne-unterschrift': ['Unterschrift'],
  'plausi-antrag-ohne-datum': ['Datum'],
  'plausi-mietzahlung-fehlt': ['Mietzahlung erkannt'],
  'plausi-rentenart-fehlt': ['Rentenart'],
};

/** Props für `ExtraktionsBaum` (Kern) — per Spread übergeben. */
export const EXTRAKTION_BAUM_PROPS = {
  analyseLabels: ANALYSE_LABEL,
  formatAnalyseWert: analyseWert,
  pflichtangaben: { gruppen: ANTRAG_PFLICHT, erkennungsGruppen: ANTRAG_ERKENNUNGS_GRUPPEN },
  regelFelder: REGEL_ZU_FELD,
};

/** Reihenfolge der Themengruppen im Regelkatalog. */
export const REGEL_GRUPPEN_REIHENFOLGE = ['grundangaben', 'wohnen', 'identitaet_versicherung', 'einkommen', 'familie_pflege', 'vermoegen', 'ausschluss', 'verfahren'];
