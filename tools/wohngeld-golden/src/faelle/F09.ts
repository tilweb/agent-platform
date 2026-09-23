import { iban } from '../lib';
import type { Fall } from '../types';

/**
 * F09 — Alleinstehender Rentner in Saarbrücken, Antrag handschriftlich. Gezielte Lücken:
 * Rentenbescheid fehlt, im Antrag steht nur „Rente" ohne Rentenart. Die Rente ist allein
 * über den Renteneingang auf dem Kontoauszug erkennbar.
 * Prüft: Nachforderung `rentenbescheid`; die unklare Rentenart ist fachlich ein Befund ohne passende App-Regel.
 */
export const F09: Fall = {
  id: 'F09',
  titel: 'Alleinstehender Rentner, Rentenbescheid fehlt (handschriftlich)',
  gruppe: 'B',
  antragsdatum: '2026-08-17',
  antragsart: 'erstantrag',
  behoerde: 'Landeshauptstadt Saarbrücken\nAmt für soziale Angelegenheiten – Wohngeld\n66104 Saarbrücken',
  telefon: '0681 9053372',
  personen: [{
    id: 'P1', vorname: 'Gerhard', nachname: 'Altmeyer', geburtsdatum: '1957-12-03', geburtsort: 'Völklingen',
    staatsangehoerigkeit: 'deutsch', geschlecht: 'maennlich', familienstand: 'geschieden', erwerb: 'Rentner',
    // Rentenart bewusst nicht angegeben
    einnahmen: [{ art: 'Rente', brutto: 1147.6, turnus: 'monatlich' }],
    abzuege: { steuern: false, rvlv: false, kv: true },
    rente: {
      art: 'Altersrente für langjährig Versicherte', traeger: 'Deutsche Rentenversicherung Saarland',
      traegerAnschrift: 'Martin-Luther-Straße 2–4, 66111 Saarbrücken', versicherungsnummer: '17 031257 A 019',
      brutto: 1147.6, rentenbeginn: '2021-01-01',
    },
    ausweis: { nummer: 'L5SA9H2WK', ausgestellt: '2018-10-11', gueltigBis: '2028-10-10', behoerde: 'Landeshauptstadt Saarbrücken', groesseCm: 174, augenfarbe: 'blau' },
  }],
  wohnung: {
    strasse: 'Mainzer Straße', hausnummer: '157', plz: '66121', ort: 'Saarbrücken', lage: '2. OG links',
    zimmer: 2, flaeche: 51, grundmiete: 395, nebenkosten: 118, heizkosten: 68, warmwasser: 16,
    gefoerdert: false, einzug: '2018-04-01', mietbeginn: '2018-04-01', mieteSeit: '2024-04-01',
  },
  vermieter: {
    name: 'Renate Scherer-Lauer', strasse: 'Am Staden 31', plzOrt: '66121 Saarbrücken', telefon: '0681 632208',
    iban: iban('59050199', '0010927733'), bank: 'Sparkasse Saarbrücken-Ost',
  },
  bank: { name: 'Saar-Volksbank Mitte eG', iban: iban('59090611', '0001804276'), bic: 'GENODE51SVM' },
  unterschrift: { antrag: true, antragDatum: true, mietvertrag: true },
  antrag: {
    handschrift: true,
  },
  dokumente: [
    { art: 'antrag' },
    { art: 'personalausweis', person: 'P1' },
    { art: 'mietvertrag' },
    { art: 'vermieterbescheinigung' },
    { art: 'kontoauszug', person: 'P1', monat: '2026-07' },
  ],
  erwartung: {
    befunde: ['rentenbescheid'],
    befundeOhneAppRegel: ['Rentenart im Antrag nicht angegeben (nur „Rente") — die App-Regel `plausi-rentenart-fehlt` wertet nur einen vorliegenden Rentenbescheid aus'],
    hinweise: [
      'Lücke 1: Rentenbescheid fehlt; die Rente (Zahlbetrag der DRV Saarland) ist nur auf dem Kontoauszug sichtbar — `rentenbescheid`.',
      'Lücke 2: Im Antrag steht als Einnahmeart nur „Rente" (1.147,60 €) ohne Rentenart — fachlich `plausi-rentenart-fehlt`. Achtung: Die App-Regel wertet heute nur einen vorliegenden Rentenbescheid aus und wird ohne Bescheid vermutlich nicht feuern (App-Lücke).',
      'Antrag handschriftlich ausgefüllt.',
    ],
  },
};
