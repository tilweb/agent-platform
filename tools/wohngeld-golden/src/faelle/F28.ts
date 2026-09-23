import { iban } from '../lib';
import type { Fall } from '../types';

const MUTTER = { vorname: 'Sandra', nachname: 'Heuser', anschrift: 'Am Weidenbach 7, 53127 Bonn' };

/**
 * F28 — Getrennte Eltern, Sohn (16) im Wechselmodell: 40 % Betreuung beim Vater
 * (Antragsteller), 60 % bei der Mutter. Der Sohn ist Haushaltsmitglied (Frage 6);
 * der Vater zahlt Unterhalt an das Kind im Haushalt der Mutter — Anlage
 * Unterhaltsverpflichtungen Spalte b (Kind getrennt lebender Eltern, annähernd
 * gleiche Betreuung). ✍ handschriftlich ausgefüllt.
 * Prüft: keine Befunde — Wechselmodell mit Betreuungsvereinbarung, Kindergeld beim
 * Antragsteller, Unterhaltsanlage (Typ unterhaltsnachweis).
 */
export const F28: Fall = {
  id: 'F28',
  titel: 'Getrennter Vater, Sohn im Wechselmodell (40 %)',
  gruppe: 'D',
  antragsdatum: '2026-09-01',
  antragsart: 'erstantrag',
  behoerde: 'Bundesstadt Bonn\nAmt für Soziales und Wohnen – Wohngeld\n53103 Bonn',
  telefon: '0228 9471163',
  personen: [
    {
      id: 'P1', vorname: 'Marek', nachname: 'Nowicki', geburtsdatum: '1983-09-12', geburtsort: 'Gliwice',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'maennlich', familienstand: 'geschieden', erwerb: 'Arbeitnehmer',
      einnahmen: [{ art: 'Gehalt/Lohn', brutto: 2640, turnus: 'monatlich' }],
      abzuege: { steuern: true, rvlv: true, kv: true },
      beschaeftigung: {
        arbeitgeber: 'Siebengebirge Elektrotechnik GmbH', arbeitgeberAnschrift: 'Königswinterer Straße 318, 53227 Bonn',
        personalnummer: '5521', eintritt: '2012-01-02', steuerklasse: 'II', wochenstunden: 38, kirche: true,
      },
      ausweis: { nummer: 'L5HR9KX2D', ausgestellt: '2024-02-20', gueltigBis: '2034-02-19', behoerde: 'Bundesstadt Bonn', groesseCm: 185, augenfarbe: 'blau' },
    },
    {
      id: 'P2', vorname: 'Julian', nachname: 'Nowicki', geburtsdatum: '2010-03-21', geburtsort: 'Bonn',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'maennlich', familienstand: 'ledig', erwerb: 'Nichterwerbsperson',
      verhaeltnis: 'Sohn', einnahmen: [], abzuege: { steuern: false, rvlv: false, kv: false },
      ausweis: { nummer: 'L5HT1MV6C', ausgestellt: '2026-04-08', gueltigBis: '2032-04-07', behoerde: 'Bundesstadt Bonn', groesseCm: 174, augenfarbe: 'blau' },
    },
  ],
  wohnung: {
    strasse: 'Holzlarer Mühlenpfad', hausnummer: '15', plz: '53229', ort: 'Bonn', lage: '2. OG rechts',
    zimmer: 3, flaeche: 69, grundmiete: 640, nebenkosten: 150, heizkosten: 80, warmwasser: 20,
    gefoerdert: false, einzug: '2022-10-01', mietbeginn: '2022-10-01', mieteSeit: '2022-10-01',
  },
  vermieter: {
    name: 'Rheinaue Hausverwaltung KG', vertreter: 'Christoph Esser',
    strasse: 'Friedrich-Breuer-Allee 22', plzOrt: '53225 Bonn', telefon: '0228 461170',
    iban: iban('38060177', '0004419826'), bank: 'Volksbank Bonn-Beuel eG',
  },
  bank: { name: 'Sparkasse Bonn-Beuel', iban: iban('38050044', '0027731409'), bic: 'COLSDE33BBL' },
  unterschrift: { antrag: true, antragDatum: true, mietvertrag: true },
  antrag: {
    handschrift: true,
    unterhaltGezahlt: [{
      zahler: 'P1',
      fuer: { nachname: 'Nowicki', vorname: 'Julian', geburtsdatum: '2010-03-21', anschrift: `bei der Mutter, ${MUTTER.anschrift}` },
      verwandt: 'Sohn', betrag: 210,
    }],
  },
  dokumente: [
    { art: 'antrag' },
    {
      art: 'unterhaltsanlage',
      optionen: { zahler: 'P1', zeilen: [{ fuer: `Nowicki, Julian, geb. 21.03.2010, ${MUTTER.anschrift}`, ziffer: '2', betrag: 210, spalte: 'b' }] },
    },
    { art: 'personalausweis', person: 'P1' },
    { art: 'personalausweis', person: 'P2' },
    {
      art: 'betreuungsvereinbarung', person: 'P1',
      optionen: {
        kind: { vorname: 'Julian', nachname: 'Nowicki', geburtsdatum: '2010-03-21' },
        andererElternteil: MUTTER, anteilProzent: 40, ab: '2025-11-01', kindergeldBei: 'person',
      },
    },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-06' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-07' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-08' },
    { art: 'kindergeldbescheid', person: 'P1', optionen: { kinder: ['P2'], ab: '2026-01-01' } },
    { art: 'mietvertrag' },
    { art: 'vermieterbescheinigung' },
    {
      art: 'kontoauszug', person: 'P1', monat: '2026-08',
      optionen: {
        buchungen: [
          { tag: 12, text: 'Bundesagentur für Arbeit - Familienkasse', zweck: 'Kindergeld 08/2026 KG-Nr. lt. Bescheid', betrag: 259 },
          { tag: 3, text: MUTTER.vorname + ' ' + MUTTER.nachname, zweck: 'Kindesunterhalt Julian 08/2026 (Wechselmodell)', betrag: -210 },
        ],
      },
    },
  ],
  erwartung: {
    befunde: [],
    befundeOhneAppRegel: [],
    hinweise: [
      'Sohn Julian (16) lebt im Wechselmodell 40/60 (Betreuungsvereinbarung ab 01.11.2025) und zählt zum Haushalt des Vaters (Frage 6); Kindergeld 259 € bezieht nach Vereinbarung der Vater.',
      'Unterhalt 210 €/Monat an das Kind im Haushalt der Mutter: Frage 16 „Ja" und Anlage Unterhaltsverpflichtungen Spalte b (Absetzbetrag bis 3.000 €/Jahr); Kontoauszug August zeigt die Zahlung.',
      'Beide Haushaltsmitglieder haben einen Personalausweis (Sohn ab 16 ausweispflichtig).',
      'Betreuungsvereinbarung ist App-Typ sonstiges; Anlage Unterhalt ist Typ unterhaltsnachweis.',
    ],
  },
};
