import { iban } from '../lib';
import type { Fall } from '../types';

/**
 * F25 — Hauptmieter vermietet ein möbliertes Zimmer (14 m²) für 350 € unter
 * (Fragen 28/29), Untermietvertrag mit Zustimmung des Vermieters liegt bei; die
 * Untermiete geht monatlich auf seinem Konto ein.
 * Prüft: Untermiete als zu berücksichtigende Einnahme (keine App-Regel) und dass
 * der Untermietvertrag (App-Typ mietvertrag) keinen falschen Miethöhen-Widerspruch
 * auslöst — der Hauptmietvertrag liegt deshalb davor.
 */
export const F25: Fall = {
  id: 'F25',
  titel: 'Hauptmieter mit Untervermietung eines Zimmers',
  gruppe: 'D',
  antragsdatum: '2026-08-27',
  antragsart: 'erstantrag',
  behoerde: 'Stadt Heidelberg\nAmt für Soziales und Senioren – Wohngeld\n69045 Heidelberg',
  telefon: '06221 4380927',
  personen: [{
    id: 'P1', vorname: 'Tobias', nachname: 'Reinhardt', geburtsdatum: '1985-12-03', geburtsort: 'Mannheim',
    staatsangehoerigkeit: 'deutsch', geschlecht: 'maennlich', familienstand: 'ledig', erwerb: 'Arbeitnehmer',
    einnahmen: [{ art: 'Gehalt/Lohn (Teilzeit)', brutto: 2050, turnus: 'monatlich' }],
    abzuege: { steuern: true, rvlv: true, kv: true },
    beschaeftigung: {
      arbeitgeber: 'Buchhandlung Neckarlauf GmbH', arbeitgeberAnschrift: 'Plöck 61, 69117 Heidelberg',
      personalnummer: '1146', eintritt: '2015-05-01', steuerklasse: 'I', wochenstunden: 30, kirche: true,
    },
    ausweis: { nummer: 'L8DN5VQ1X', ausgestellt: '2019-09-12', gueltigBis: '2029-09-11', behoerde: 'Stadt Heidelberg', groesseCm: 183, augenfarbe: 'grün' },
  }],
  wohnung: {
    strasse: 'Kirchheimer Feldweg', hausnummer: '42', plz: '69124', ort: 'Heidelberg', lage: '1. OG rechts',
    zimmer: 3, flaeche: 66, grundmiete: 690, nebenkosten: 150, heizkosten: 85, warmwasser: 20,
    gefoerdert: false, einzug: '2017-07-01', mietbeginn: '2017-07-01', mieteSeit: '2024-07-01',
  },
  vermieter: {
    name: 'Ingeborg Dannecker', strasse: 'Rohrbacher Hang 3', plzOrt: '69126 Heidelberg', telefon: '06221 318822',
    iban: iban('67260133', '0000918834'), bank: 'Heidelberger Volksbank Süd eG',
  },
  bank: { name: 'Sparkasse Heidelberg-Kurpfalz', iban: iban('67250044', '0009120563'), bic: 'SOLADES1HDK' },
  unterschrift: { antrag: true, antragDatum: true, mietvertrag: true },
  antrag: {
    untervermietung: { flaeche: 14, art: 'ueberlassen', entgelt: 350, heizung: 40 },
  },
  dokumente: [
    { art: 'antrag' },
    { art: 'personalausweis', person: 'P1' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-05' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-06' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-07' },
    { art: 'mietvertrag' },
    {
      art: 'untermietvertrag', person: 'P1',
      optionen: {
        untermieter: { vorname: 'Emre', nachname: 'Kaplan', geburtsdatum: '2001-04-19' },
        zimmerQm: 14, grundentgelt: 250, anteilNebenkosten: 60, anteilHeizung: 40,
        beginn: '2026-03-01', zustimmungVom: '2026-02-09',
      },
    },
    { art: 'vermieterbescheinigung' },
    {
      art: 'kontoauszug', person: 'P1', monat: '2026-07',
      optionen: { buchungen: [{ tag: 1, text: 'Emre Kaplan', zweck: 'Untermiete Zimmer Juli Kirchheimer Feldweg 42', betrag: 350 }] },
    },
  ],
  erwartung: {
    befunde: [],
    befundeOhneAppRegel: [
      'Untermieteinnahmen 350 €/Monat (davon 40 € Heizung) aus der Untervermietung eines 14-m²-Zimmers sind bei der Wohngeldberechnung zu berücksichtigen (Fragen 28/29) — keine App-Regel',
    ],
    hinweise: [
      'Hauptmietvertrag, Vermieterbescheinigung und Kontoauszug: Gesamtmiete 945 € (Bruttokaltmiete 840 €), 66 m².',
      'Untermietvertrag ab 01.03.2026: Zimmer 14 m², 250 € Grundentgelt + 60 € Betriebskosten + 40 € Heizung = 350 €; Zustimmung der Vermieterin vom 09.02.2026.',
      'Der Untermietvertrag hat den App-Typ mietvertrag (Miete 350 €). Die App vergleicht nur das ERSTE Miet-Dokument mit dem Antrag; läge der Untermietvertrag vorn, entstünde ein falscher plausi-miethoehe-abweichung-Befund.',
    ],
  },
};
