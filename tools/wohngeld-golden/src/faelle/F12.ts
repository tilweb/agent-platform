import { iban } from '../lib';
import type { Fall } from '../types';

/**
 * F12 — Alleinstehende Arbeitnehmerin; der Antrag ist vollständig ausgefüllt, aber
 * weder unterschrieben noch datiert. Alle Nachweise liegen vor und sind stimmig.
 * Geprüft wird: fehlende Unterschrift und fehlendes Datum auf Antragsseite 11.
 */
export const F12: Fall = {
  id: 'F12',
  titel: 'Alleinstehende Arbeitnehmerin, Antrag ohne Unterschrift und Datum',
  gruppe: 'B',
  antragsdatum: '2026-09-08',
  antragsart: 'erstantrag',
  behoerde: 'Landeshauptstadt Hannover\nFachbereich Soziales – Wohngeld\n30159 Hannover',
  telefon: '0511 60938271',
  email: 'nele.hartmann@example.org',
  personen: [{
    id: 'P1', vorname: 'Nele', nachname: 'Hartmann', geburtsdatum: '1994-02-11', geburtsort: 'Celle',
    staatsangehoerigkeit: 'deutsch', geschlecht: 'weiblich', familienstand: 'ledig', erwerb: 'Arbeitnehmer',
    einnahmen: [{ art: 'Gehalt/Lohn (Teilzeit)', brutto: 1980, turnus: 'monatlich' }],
    abzuege: { steuern: true, rvlv: true, kv: true },
    beschaeftigung: {
      arbeitgeber: 'Praxisgemeinschaft Dr. Tönjes & Kollegen', arbeitgeberAnschrift: 'Fössestraße 112, 30451 Hannover',
      personalnummer: '031', eintritt: '2021-07-01', steuerklasse: 'I', wochenstunden: 32, kirche: true,
    },
    ausweis: { nummer: 'L4WK7N2CR', ausgestellt: '2023-06-27', gueltigBis: '2033-06-26', behoerde: 'Landeshauptstadt Hannover', groesseCm: 170, augenfarbe: 'blau' },
  }],
  wohnung: {
    strasse: 'Am Lindenkamp', hausnummer: '7', plz: '30449', ort: 'Hannover', lage: '3. OG rechts',
    zimmer: 2, flaeche: 46, grundmiete: 395, nebenkosten: 110, heizkosten: 60, warmwasser: 15,
    gefoerdert: false, einzug: '2021-08-01', mietbeginn: '2021-08-01', mieteSeit: '2021-08-01',
  },
  vermieter: {
    name: 'Ingrid Schaper', strasse: 'Wunstorfer Straße 58', plzOrt: '30453 Hannover', telefon: '0511 443127',
    iban: iban('25050199', '0019032281'), bank: 'Sparkasse Hannover-West',
  },
  bank: { name: 'Hannoversche Volksbank Linden eG', iban: iban('25190199', '0007712534'), bic: 'VOHADE2HLIN' },
  unterschrift: { antrag: false, antragDatum: false, mietvertrag: true },
  dokumente: [
    { art: 'antrag' },
    { art: 'personalausweis', person: 'P1' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-06' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-07' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-08' },
    { art: 'mietvertrag' },
    { art: 'vermieterbescheinigung' },
    { art: 'kontoauszug', person: 'P1', monat: '2026-08' },
  ],
  erwartung: {
    befunde: ['antrag-vollstaendig-unterschrieben', 'plausi-antrag-ohne-unterschrift', 'plausi-antrag-ohne-datum'],
    befundeOhneAppRegel: [],
    hinweise: [
      'Antragsseite 11: Datumsfeld leer, Unterschriftsfeld leer — sonst vollständig und stimmig.',
      'antrag-vollstaendig-unterschrieben ist fachlich erwartet (kein wirksam unterschriebener Antrag); die App-Regel feuert heute aber nur, wenn gar kein Antrag vorliegt — hier wird die App diesen Befund voraussichtlich NICHT melden (Regellücke), sondern nur die beiden plausi-Befunde.',
      'Ohne Datum fehlt der Standardbefund bwz-vorschlag-pruefen; übernimmt die App das Antragsdatum nur aus dem Formular, kann zusätzlich essenzielle-angaben (Antragsdatum) erscheinen — fachlich gilt der Posteingang als Antragsdatum.',
    ],
  },
};
