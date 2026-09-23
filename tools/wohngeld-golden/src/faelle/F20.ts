import { iban } from '../lib';
import type { Fall } from '../types';

/**
 * F20 — Alleinerziehender Vater mit zwei Kindern (16 und 13), Kindesunterhalt der
 * Mutter und Kindergeld gehen auf seinem Konto ein. Unterlagen vollständig, aber
 * der Mietvertrag ist von keiner Partei unterschrieben.
 * Geprüft wird: plausi-mietvertrag-unsigniert.
 */
export const F20: Fall = {
  id: 'F20',
  titel: 'Alleinerziehender Vater, 2 Kinder, Mietvertrag ohne Unterschriften',
  gruppe: 'C',
  antragsdatum: '2026-09-10',
  antragsart: 'erstantrag',
  behoerde: 'Landeshauptstadt Potsdam\nFachbereich Soziales – Wohngeldstelle\n14461 Potsdam',
  telefon: '0331 2894471',
  email: 'c.wolter@example.com',
  personen: [
    {
      id: 'P1', vorname: 'Christian', nachname: 'Wolter', geburtsdatum: '1984-10-15', geburtsort: 'Brandenburg an der Havel',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'maennlich', familienstand: 'geschieden', erwerb: 'Arbeitnehmer',
      einnahmen: [{ art: 'Gehalt/Lohn', brutto: 2560, turnus: 'monatlich' }],
      abzuege: { steuern: true, rvlv: true, kv: true },
      beschaeftigung: {
        arbeitgeber: 'Havelland Haustechnik Drewitz GmbH', arbeitgeberAnschrift: 'Konrad-Wolf-Allee 90, 14480 Potsdam',
        personalnummer: '2391', eintritt: '2013-06-01', steuerklasse: 'II', wochenstunden: 40, kirche: false,
      },
      ausweis: { nummer: 'L2VT9R5MX', ausgestellt: '2021-12-13', gueltigBis: '2031-12-12', behoerde: 'Landeshauptstadt Potsdam', groesseCm: 188, augenfarbe: 'braun' },
    },
    {
      id: 'P2', vorname: 'Jonas', nachname: 'Wolter', geburtsdatum: '2010-03-02', geburtsort: 'Potsdam',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'maennlich', familienstand: 'ledig', erwerb: 'Nichterwerbsperson',
      verhaeltnis: 'Sohn', einnahmen: [{ art: 'Kindesunterhalt', brutto: 465, turnus: 'monatlich' }],
      abzuege: { steuern: false, rvlv: false, kv: false },
      ausweis: { nummer: 'L2VW3K8TN', ausgestellt: '2026-03-17', gueltigBis: '2036-03-16', behoerde: 'Landeshauptstadt Potsdam', groesseCm: 176, augenfarbe: 'braun' },
    },
    {
      id: 'P3', vorname: 'Mia', nachname: 'Wolter', geburtsdatum: '2013-07-21', geburtsort: 'Potsdam',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'weiblich', familienstand: 'ledig', erwerb: 'Nichterwerbsperson',
      verhaeltnis: 'Tochter', einnahmen: [{ art: 'Kindesunterhalt', brutto: 465, turnus: 'monatlich' }],
      abzuege: { steuern: false, rvlv: false, kv: false },
      ausweis: { nummer: 'L2VX6C1PR', ausgestellt: '2025-06-30', gueltigBis: '2031-06-29', behoerde: 'Landeshauptstadt Potsdam', groesseCm: 157, augenfarbe: 'blau' },
    },
  ],
  wohnung: {
    strasse: 'Drewitzer Anger', hausnummer: '27', plz: '14480', ort: 'Potsdam', lage: '1. OG rechts',
    zimmer: 3, flaeche: 78, grundmiete: 720, nebenkosten: 190, heizkosten: 105, warmwasser: 25,
    gefoerdert: false, einzug: '2023-10-01', mietbeginn: '2023-10-01', mieteSeit: '2023-10-01',
  },
  vermieter: {
    name: 'Havelblick Wohnen Potsdam-Süd GmbH', vertreter: 'Dirk Lemcke',
    strasse: 'Friedrich-Engels-Straße 57', plzOrt: '14473 Potsdam', telefon: '0331 7408820',
    iban: iban('16050099', '0035528100'), bank: 'Mittelbrandenburgische Sparkasse Süd',
  },
  bank: { name: 'Potsdamer Volksbank Teltow-Drewitz eG', iban: iban('16062099', '0001943307'), bic: 'GENODEF1PTD' },
  unterschrift: { antrag: true, antragDatum: true, mietvertrag: false },
  dokumente: [
    { art: 'antrag' },
    { art: 'personalausweis', person: 'P1' },
    { art: 'personalausweis', person: 'P2' },
    { art: 'personalausweis', person: 'P3' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-06' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-07' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-08' },
    { art: 'kindergeldbescheid', person: 'P1' },
    { art: 'mietvertrag' },
    { art: 'vermieterbescheinigung' },
    {
      art: 'kontoauszug', person: 'P1', monat: '2026-08',
      optionen: {
        buchungen: [
          { tag: 3, text: 'Katrin Seidel', zweck: 'Kindesunterhalt 08/2026 Jonas und Mia', betrag: 930 },
          { tag: 12, text: 'Bundesagentur für Arbeit - Familienkasse', zweck: 'KINDERGELD 08/2026 FUER 2 KINDER', betrag: 518 },
        ],
      },
    },
  ],
  erwartung: {
    befunde: ['plausi-mietvertrag-unsigniert'],
    befundeOhneAppRegel: [],
    hinweise: [
      'Mietvertrag (4 Seiten) ohne Unterschrift von Mieter und Vermieter; Vermieterbescheinigung ist unterschrieben und bestätigt die Werte (Gesamtmiete 1.040,00 €, 78 m²).',
      'Kindesunterhalt der Mutter (je 465,00 €, zusammen 930,00 €) steht im Antrag bei den Kindern und geht auf dem Konto des Vaters ein; Kindergeld 2 × 259,00 €.',
      'Beide Kinder haben einen eigenen Personalausweis (Jonas 16, Mia 13) — identitaet-jede-person ist daher auch in der App nicht zu erwarten.',
    ],
  },
};
