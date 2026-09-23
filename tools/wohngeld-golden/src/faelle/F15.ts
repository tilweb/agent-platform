import { iban } from '../lib';
import type { Fall } from '../types';

/**
 * F15 — Familie Yıldız (Eltern türkische Staatsangehörige, Sohn in Deutschland geboren,
 * deutsch nach § 4 Abs. 3 StAG). Er Arbeitnehmer, sie ohne Einkommen. Frage 6:
 * Verpflichtungserklärung § 68 AufenthG = Nein. Beigelegt ist nur der Aufenthaltstitel
 * des Antragstellers; für die Ehefrau fehlen Identitätsnachweis und Aufenthaltstitel.
 * Geprüft wird: Identität je erwachsener Person, Aufenthaltstitel (ohne App-Regel),
 * türkische Sonderzeichen (getippt ersetzt, in Nachweisen erhalten).
 */
export const F15: Fall = {
  id: 'F15',
  titel: 'Familie mit türkischer Staatsangehörigkeit, Nachweise der Ehefrau fehlen',
  gruppe: 'B',
  antragsdatum: '2026-08-19',
  antragsart: 'erstantrag',
  behoerde: 'Stadt Mannheim\nFachbereich Arbeit und Soziales – Wohngeld\n68159 Mannheim',
  telefon: '0621 1782264',
  personen: [
    {
      id: 'P1', vorname: 'Murat', nachname: 'Yıldız', geburtsdatum: '1986-03-09', geburtsort: 'Gaziantep',
      staatsangehoerigkeit: 'türkisch', geschlecht: 'maennlich', familienstand: 'verheiratet', erwerb: 'Arbeitnehmer',
      einnahmen: [{ art: 'Gehalt/Lohn', brutto: 2480, turnus: 'monatlich' }],
      abzuege: { steuern: true, rvlv: true, kv: true },
      beschaeftigung: {
        arbeitgeber: 'Rheinau Metallbearbeitung GmbH', arbeitgeberAnschrift: 'Relaisstraße 88, 68219 Mannheim',
        personalnummer: '30612', eintritt: '2012-09-01', steuerklasse: 'III', wochenstunden: 38, kirche: false,
      },
    },
    {
      id: 'P2', vorname: 'Elif', nachname: 'Yıldız', geburtsname: 'Kaya', geburtsdatum: '1990-11-27', geburtsort: 'Kayseri',
      staatsangehoerigkeit: 'türkisch', geschlecht: 'weiblich', familienstand: 'verheiratet', erwerb: 'Nichterwerbsperson',
      verhaeltnis: 'Ehefrau', einnahmen: [], abzuege: { steuern: false, rvlv: false, kv: false },
    },
    {
      id: 'P3', vorname: 'Deniz', nachname: 'Yıldız', geburtsdatum: '2019-05-14', geburtsort: 'Mannheim',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'maennlich', familienstand: 'ledig', erwerb: 'Nichterwerbsperson',
      verhaeltnis: 'Sohn', einnahmen: [], abzuege: { steuern: false, rvlv: false, kv: false },
    },
  ],
  wohnung: {
    strasse: 'Karlsterner Straße', hausnummer: '15', plz: '68219', ort: 'Mannheim', lage: '2. OG rechts',
    zimmer: 3, flaeche: 71, grundmiete: 590, nebenkosten: 165, heizkosten: 90, warmwasser: 25,
    gefoerdert: false, einzug: '2018-04-01', mietbeginn: '2018-04-01', mieteSeit: '2025-04-01',
  },
  vermieter: {
    name: 'Kurpfalz Immobilienverwaltung Neckarau GmbH', vertreter: 'Sabine Reuther',
    strasse: 'Friedrichstraße 41', plzOrt: '68199 Mannheim', telefon: '0621 8490310',
    iban: iban('67050599', '0038812044'), bank: 'Sparkasse Rhein Neckar Süd',
  },
  bank: { name: 'Volksbank Kurpfalz-Rheinau eG', iban: iban('67090199', '0012207735'), bic: 'GENODE61MAR' },
  unterschrift: { antrag: true, antragDatum: true, mietvertrag: true },
  antrag: { drittstaatVerpflichtung: false },
  dokumente: [
    { art: 'antrag' },
    { art: 'aufenthaltstitel', person: 'P1', optionen: { titelArt: 'Niederlassungserlaubnis', ausgestellt: '2022-03-15', behoerde: 'Stadt Mannheim – Ausländerbehörde' } },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-05' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-06' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-07' },
    { art: 'kindergeldbescheid', person: 'P1' },
    { art: 'mietvertrag' },
    { art: 'vermieterbescheinigung' },
    {
      art: 'kontoauszug', person: 'P1', monat: '2026-07',
      optionen: { buchungen: [{ tag: 9, text: 'Bundesagentur für Arbeit - Familienkasse', zweck: 'KINDERGELD 07/2026 FUER DENIZ', betrag: 259 }] },
    },
  ],
  erwartung: {
    befunde: ['identitaet-jede-person'],
    befundeOhneAppRegel: ['Aufenthaltstitel der Ehefrau Elif Yıldız fehlt (Drittstaatsangehörige, Wohngeldberechtigung nach § 3 Abs. 5 WoGG nicht belegt)'],
    hinweise: [
      'identitaet-jede-person ist fachlich nur für die Ehefrau (P2) erwartet; für den Sohn (P3, 7 Jahre) meldet die App den Befund vermutlich zusätzlich.',
      'Identität des Antragstellers ist über den elektronischen Aufenthaltstitel (Niederlassungserlaubnis) belegt — Klassifikation personalausweis.',
      'Frage 6: Verpflichtungserklärung nach § 68 AufenthG = Nein. Im getippten Antrag steht „Yildiz" (ohne ı), in den Nachweisen „Yıldız".',
      'Kindergeld 259,00 € für Deniz auf dem Kontoauszug Juli 2026, passend zum Kindergeldbescheid.',
    ],
  },
};
