/**
 * Fachliche Angaben (Grundsicherung) für den generischen Extraktions-Baum des Antrags-Kerns.
 * Aufrufer übergeben `EXTRAKTION_BAUM_PROPS` per Spread an `ExtraktionsBaum`.
 * Felder = DokumentAnalyse-Vertrag in backend/src/apps/grundsicherung/types.ts.
 */
import { VERMOEGENSART_LABEL } from './api';

// ── Fallback-Formatierung (Analyse → Label/Wert), Reihenfolge = Anzeige ─────
export const ANALYSE_LABEL = {
  // Antrag
  unterschrift_vorhanden: 'Unterschrift',
  datum_vorhanden: 'Datum',
  regelbedarfsstufe: 'Regelbedarfsstufe',
  bisheriger_lebensunterhalt: 'Bisheriger Lebensunterhalt',
  // Ausweis / Person
  vorname: 'Vorname',
  nachname: 'Nachname',
  geburtsdatum: 'Geburtsdatum',
  // Rente
  rentenart: 'Rentenart',
  zahlbetrag: 'Zahlbetrag',
  zahlbetrag_ab: 'Zahlbetrag ab',
  befristet_bis: 'Befristet bis',
  unbefristet: 'Unbefristet',
  arbeitsmarktabhaengig: 'Wegen Arbeitsmarktlage',
  bescheiddatum: 'Bescheiddatum',
  grundrentenzuschlag: 'Grundrentenzuschlag',
  stichtag: 'Stichtag',
  zahlbetrag_alt: 'Bisheriger Zahlbetrag',
  zahlbetrag_neu: 'Neuer Zahlbetrag',
  dauerhaft_voll_erwerbsgemindert: 'Dauerhaft voll erwerbsgemindert',
  traeger: 'Träger',
  betrag_monat: 'Betrag monatlich',
  // Konto
  iban: 'IBAN',
  zeitraum_von: 'Zeitraum von',
  zeitraum_bis: 'Zeitraum bis',
  endsaldo: 'Endsaldo',
  eingaenge: 'Zahlungseingänge',
  mietzahlung_erkannt: 'Mietzahlung erkannt',
  mietzahlung_betrag: 'Mietzahlung (Betrag)',
  grosse_abgaenge: 'Größere Abgänge',
  // Wohnen
  mieter: 'Mieter',
  beginn: 'Mietbeginn',
  grundmiete: 'Grundmiete',
  nebenkosten_kalt: 'Kalte Nebenkosten',
  heizkosten: 'Heizkosten',
  pauschalmiete: 'Pauschalmiete',
  heizkosten_enthalten: 'Heizkosten enthalten',
  gueltig_ab: 'Gültig ab',
  abrechnungszeitraum_bis: 'Abrechnungszeitraum bis',
  // Vermögen
  art: 'Art',
  stand: 'Stand',
  rueckkaufswert: 'Rückkaufswert',
  // Schwerbehinderung / ärztliche Bescheinigung
  gdb: 'GdB',
  merkzeichen: 'Merkzeichen',
  gueltig_bis: 'Gültig bis',
  zweck: 'Zweck',
  datum: 'Datum der Feststellung',
  // Wohngeldbescheid
  bwz_von: 'Bewilligt von',
  bwz_bis: 'Bewilligt bis',
};

const RENTENART_LABEL = {
  altersrente: 'Altersrente',
  volle_em: 'Rente wegen voller Erwerbsminderung',
  teilweise_em: 'Rente wegen teilweiser Erwerbsminderung',
  hinterbliebene: 'Hinterbliebenenrente',
  sonstige: 'Sonstige',
};
const EINGANG_ART_LABEL = {
  rente: 'Rente', betriebsrente: 'Betriebsrente', wohngeld: 'Wohngeld', unterhalt: 'Unterhalt',
  erwerb: 'Erwerb', kapitalertrag: 'Kapitalertrag', miete_einnahme: 'Mieteinnahme', zuwendung: 'Zuwendung',
  sozialleistung: 'Sozialleistung', erstattung: 'Erstattung', sonstige: 'Sonstige',
};
const ZWECK_LABEL = { ernaehrung: 'Kostenaufwändige Ernährung', em_befund: 'Befund Erwerbsminderung', sonstiges: 'Sonstiges' };

export const EURO_FELDER = new Set([
  'zahlbetrag', 'zahlbetrag_alt', 'zahlbetrag_neu', 'betrag_monat', 'endsaldo', 'mietzahlung_betrag',
  'grundmiete', 'nebenkosten_kalt', 'heizkosten', 'pauschalmiete', 'stand', 'rueckkaufswert',
]);
export const DATUM_FELDER = new Set([
  'geburtsdatum', 'zahlbetrag_ab', 'befristet_bis', 'bescheiddatum', 'stichtag', 'zeitraum_von', 'zeitraum_bis',
  'beginn', 'gueltig_ab', 'abrechnungszeitraum_bis', 'gueltig_bis', 'datum', 'bwz_von', 'bwz_bis',
]);
export const VORHANDEN_FELDER = new Set(['unterschrift_vorhanden', 'datum_vorhanden']);
export const JA_NEIN_FELDER = new Set([
  'unbefristet', 'arbeitsmarktabhaengig', 'grundrentenzuschlag', 'dauerhaft_voll_erwerbsgemindert',
  'mietzahlung_erkannt', 'heizkosten_enthalten',
]);

function fmtEuro(v) {
  if (v == null || Number.isNaN(Number(v))) return null;
  return Number(v).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}
function fmtDatum(v) {
  if (!v) return null;
  const m = String(v).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : String(v);
}

export function analyseWert(feld, v) {
  if (v == null || v === '') return null;
  if (EURO_FELDER.has(feld)) return fmtEuro(v);
  if (DATUM_FELDER.has(feld)) return fmtDatum(v);
  if (VORHANDEN_FELDER.has(feld)) return v === true ? 'vorhanden' : v === false ? 'fehlt' : null;
  if (JA_NEIN_FELDER.has(feld)) return v === true ? 'ja' : v === false ? 'nein' : null;
  if (feld === 'rentenart') return RENTENART_LABEL[v] || String(v);
  if (feld === 'zweck') return ZWECK_LABEL[v] || String(v);
  if (feld === 'art') return VERMOEGENSART_LABEL[v] || String(v);
  if (feld === 'gdb') return String(v);
  if (feld === 'mieter' || feld === 'merkzeichen') return Array.isArray(v) && v.length ? v.join(', ') : null;
  if (feld === 'eingaenge') {
    if (!Array.isArray(v) || !v.length) return null;
    return v.map((e) => {
      const anzahl = e.anzahl && e.anzahl > 1 ? `${e.anzahl} × ` : '';
      const betrag = e.betrag != null ? fmtEuro(e.betrag) : '';
      const art = e.art ? ` (${EINGANG_ART_LABEL[e.art] || e.art})` : '';
      return `${anzahl}${e.verwendungszweck || 'Eingang'}${betrag ? ` à ${betrag}` : ''}${art}`;
    }).join('; ');
  }
  if (feld === 'grosse_abgaenge') {
    if (!Array.isArray(v) || !v.length) return null;
    return v.map((a) => [fmtEuro(a.betrag), a.datum ? fmtDatum(a.datum) : null, a.verwendungszweck].filter(Boolean).join(' · ')).join('; ');
  }
  if (typeof v === 'object') return null;
  return String(v);
}

/** Pflichtangaben des Antrags je Gruppe (Label wie im Extraktions-Baum). */
export const ANTRAG_PFLICHT = {
  Antragsteller: ['Vorname', 'Nachname', 'Geburtsdatum'],
  Antrag: ['Antragsdatum'],
};
/** Ein Dokument gilt als Antrag, wenn es Werte in einer dieser Gruppen hat. */
export const ANTRAG_ERKENNUNGS_GRUPPEN = ['Antragsteller'];

/** Offene Prüfhinweise → betroffenes Feld (Label im Baum). */
export const REGEL_ZU_FELD = {
  'antrag-vollstaendig-unterschrieben': ['Unterschrift'],
  'plausi-antrag-ohne-datum': ['Datum'],
  'plausi-geburtsdatum-abweichung': ['Geburtsdatum'],
  'plausi-em-rente-befristet': ['Befristet bis', 'Unbefristet'],
  'plausi-em-rente-teilweise-oder-arbeitsmarkt': ['Rentenart', 'Wegen Arbeitsmarktlage'],
  'plausi-rente-abweichung': ['Zahlbetrag', 'Neuer Zahlbetrag'],
  'plausi-rentenanpassung-fehlt': ['Zahlbetrag ab', 'Bescheiddatum'],
  'plausi-miete-abweichung': ['Grundmiete', 'Mietzahlung (Betrag)'],
  'plausi-miete-nicht-gezahlt': ['Mietzahlung erkannt'],
  'plausi-heizung-in-miete-unklar': ['Pauschalmiete', 'Heizkosten enthalten'],
  'plausi-kontoauszug-unerklaerte-eingaenge': ['Zahlungseingänge'],
  'plausi-kontostand-abweichung': ['Endsaldo'],
  'plausi-grosse-abgaenge': ['Größere Abgänge'],
  'plausi-ausweis-abgelaufen': ['Gültig bis'],
  'plausi-regelbedarfsstufe-inkonsistent': ['Regelbedarfsstufe'],
};

/** Props für `ExtraktionsBaum` (Kern) — per Spread übergeben. */
export const EXTRAKTION_BAUM_PROPS = {
  analyseLabels: ANALYSE_LABEL,
  formatAnalyseWert: analyseWert,
  pflichtangaben: { gruppen: ANTRAG_PFLICHT, erkennungsGruppen: ANTRAG_ERKENNUNGS_GRUPPEN },
  regelFelder: REGEL_ZU_FELD,
};

/** Reihenfolge der Themengruppen im Regelkatalog (backend checker/regeln.ts). */
export const REGEL_GRUPPEN_REIHENFOLGE = ['antrag', 'anspruch', 'wohnen', 'einkommen', 'vermoegen', 'mehrbedarf_versicherung', 'vorrang', 'verfahren'];
