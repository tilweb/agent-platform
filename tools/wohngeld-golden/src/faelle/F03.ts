import { iban } from '../lib';
import type { Fall } from '../types';

/**
 * F03 — Alleinerziehende Mutter in Bremen, Teilzeit, eine Tochter (8), Unterhaltsvorschuss.
 * Antrag handschriftlich ausgefüllt. Referenzfall ohne Lücken.
 * Prüft: Handschrift-Extraktion (mit türkischen Sonderzeichen), UVS als Einnahme des Kindes,
 * Frage 17 Unterhaltsanspruch nicht durchsetzbar (Höhe nicht bekannt), Kindergeld- und UVS-Bescheid.
 */
export const F03: Fall = {
  id: 'F03',
  titel: 'Alleinerziehende Mutter, Teilzeit, Unterhaltsvorschuss (handschriftlich)',
  gruppe: 'A',
  antragsdatum: '2026-08-27',
  antragsart: 'erstantrag',
  behoerde: 'Amt für Soziale Dienste Bremen\nWohngeldstelle\n28195 Bremen',
  telefon: '0421 69184420',
  personen: [
    {
      id: 'P1', vorname: 'Şeyma', nachname: 'Kılıç', geburtsdatum: '1991-10-06', geburtsort: 'Bremerhaven',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'weiblich', familienstand: 'ledig', erwerb: 'Arbeitnehmer',
      einnahmen: [{ art: 'Gehalt/Lohn (Teilzeit)', brutto: 1640, turnus: 'monatlich' }],
      abzuege: { steuern: true, rvlv: true, kv: true },
      beschaeftigung: {
        arbeitgeber: 'Weserufer Praxisverbund MVZ GmbH', arbeitgeberAnschrift: 'Hastedter Heerstraße 212, 28207 Bremen',
        personalnummer: '5534', eintritt: '2019-01-15', steuerklasse: 'II', wochenstunden: 26, kirche: false,
      },
      ausweis: { nummer: 'L9WX2C6RT', ausgestellt: '2022-04-19', gueltigBis: '2032-04-18', behoerde: 'Stadtamt Bremen', groesseCm: 164, augenfarbe: 'braun' },
    },
    {
      id: 'P2', vorname: 'Elif', nachname: 'Kılıç', geburtsdatum: '2018-04-22', geburtsort: 'Bremen',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'weiblich', familienstand: 'ledig', erwerb: 'Nichterwerbsperson',
      verhaeltnis: 'Tochter', einnahmen: [{ art: 'Unterhaltsvorschuss', brutto: 299, turnus: 'monatlich' }],
      abzuege: { steuern: false, rvlv: false, kv: false },
    },
  ],
  wohnung: {
    strasse: 'Vor dem Steintor', hausnummer: '78', plz: '28203', ort: 'Bremen', lage: '1. OG links',
    zimmer: 2, flaeche: 57, grundmiete: 465, nebenkosten: 135, heizkosten: 70, warmwasser: 20,
    gefoerdert: false, einzug: '2021-08-01', mietbeginn: '2021-08-01', mieteSeit: '2024-08-01',
  },
  vermieter: {
    name: 'Hermann Brüggemann', strasse: 'Parkallee 19', plzOrt: '28209 Bremen', telefon: '0421 342871',
    iban: iban('29050199', '0010348226'), bank: 'Sparkasse Bremen-Weser',
  },
  bank: { name: 'Hanseatische Volksbank Bremen eG', iban: iban('29190411', '0000617255'), bic: 'GENODEF1HVB' },
  unterschrift: { antrag: true, antragDatum: true, mietvertrag: true },
  antrag: {
    handschrift: true,
    unterhaltAnspruch: [{ person: 'P2' }],
  },
  dokumente: [
    { art: 'antrag' },
    { art: 'personalausweis', person: 'P1' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-05' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-06' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-07' },
    { art: 'kindergeldbescheid', person: 'P1', optionen: { aktenzeichen: '217FK604413' } },
    { art: 'uvs_bescheid', person: 'P1', optionen: { kind: 'P2', betrag: 299, ab: '2026-01-01', unterhaltspflichtiger: 'Dennis Rohloff' } },
    { art: 'mietvertrag' },
    { art: 'vermieterbescheinigung' },
    {
      art: 'kontoauszug', person: 'P1', monat: '2026-07',
      optionen: {
        buchungen: [
          { tag: 1, text: 'Stadtgemeinde Bremen Unterhaltsvorschusskasse', zweck: 'UVG-LEISTUNG 07/2026 ELIF KILIC', betrag: 299 },
          { tag: 8, text: 'Familienkasse Niedersachsen-Bremen', zweck: 'KINDERGELD 217FK604413 07/2026', betrag: 259 },
        ],
      },
    },
  ],
  erwartung: {
    befunde: [],
    befundeOhneAppRegel: [],
    hinweise: [
      'Antrag handschriftlich ausgefüllt; Namen mit türkischen Sonderzeichen (Şeyma Kılıç).',
      'Unterhaltsvorschuss 299 € (2. Altersstufe) als Einnahme der Tochter; Kindesvater zahlt nicht — Frage 17 = Ja, Höhe nicht bekannt.',
      'Kontoauszug Juli 2026: Gehalt, UVS 299 € und Kindergeld 259 € gehen ein, Miete 690 € geht ab.',
    ],
  },
};
