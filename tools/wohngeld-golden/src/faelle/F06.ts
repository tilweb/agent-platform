import { iban } from '../lib';
import type { Fall } from '../types';

/**
 * F06 — Selbständiger Fliesenleger (Kleingewerbe, privat krankenversichert) und Ehefrau als
 * Teilzeit-Angestellte mit langem Arbeitsweg, Freiburg im Breisgau. Referenzfall ohne Lücken.
 * Prüft: Einkommen Selbständiger über Steuerbescheid 2025 + EÜR, privater KV-Beitragsnachweis,
 * Frage 13 Werbungskosten über Pauschbetrag (Ehefrau), Frage 25 Stellplatz separat an Dritte (40 €).
 */
export const F06: Fall = {
  id: 'F06',
  titel: 'Selbständiger Handwerker und Ehefrau angestellt, hohe Fahrtkosten',
  gruppe: 'A',
  antragsdatum: '2026-09-03',
  antragsart: 'erstantrag',
  behoerde: 'Stadt Freiburg im Breisgau\nAmt für Soziales – Wohngeldstelle\n79095 Freiburg im Breisgau',
  telefon: '0761 38826640',
  email: 'ferraro.fliesen@example.com',
  personen: [
    {
      id: 'P1', vorname: 'Marco', nachname: 'Ferraro', geburtsdatum: '1982-04-02', geburtsort: 'Lörrach',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'maennlich', familienstand: 'verheiratet', erwerb: 'Selbständiger',
      einnahmen: [{ art: 'Gewinn aus Gewerbebetrieb (Selbständigkeit)', brutto: 22800, turnus: 'jährlich' }],
      abzuege: { steuern: true, rvlv: false, kv: true },
      ausweis: { nummer: 'L6FZ8R3MQ', ausgestellt: '2019-07-15', gueltigBis: '2029-07-14', behoerde: 'Stadt Freiburg im Breisgau', groesseCm: 177, augenfarbe: 'braun' },
    },
    {
      id: 'P2', vorname: 'Julia', nachname: 'Ferraro', geburtsname: 'Maier', geburtsdatum: '1985-01-26', geburtsort: 'Offenburg',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'weiblich', familienstand: 'verheiratet', erwerb: 'Arbeitnehmer',
      verhaeltnis: 'Ehefrau', einnahmen: [{ art: 'Gehalt/Lohn (Teilzeit)', brutto: 1420, turnus: 'monatlich' }],
      abzuege: { steuern: true, rvlv: true, kv: true },
      beschaeftigung: {
        arbeitgeber: 'Kaiserstuhl Dental-Labor GmbH', arbeitgeberAnschrift: 'Industriestraße 7, 79346 Endingen am Kaiserstuhl',
        personalnummer: '0877', eintritt: '2018-05-01', steuerklasse: 'IV', wochenstunden: 24, kirche: false,
      },
      ausweis: { nummer: 'L6FW2D7KC', ausgestellt: '2024-02-28', gueltigBis: '2034-02-27', behoerde: 'Stadt Freiburg im Breisgau', groesseCm: 171, augenfarbe: 'grün' },
    },
  ],
  wohnung: {
    strasse: 'Lehener Straße', hausnummer: '94', plz: '79106', ort: 'Freiburg im Breisgau', lage: 'DG rechts',
    zimmer: 3, flaeche: 66, grundmiete: 720, nebenkosten: 165, heizkosten: 82, warmwasser: 23,
    gefoerdert: false, einzug: '2017-03-01', mietbeginn: '2017-03-01', mieteSeit: '2025-03-01',
  },
  vermieter: {
    name: 'Dr. Ursula Gerspach', strasse: 'Schwimmbadstraße 22', plzOrt: '79100 Freiburg im Breisgau', telefon: '0761 704319',
    iban: iban('68050199', '0002061874'), bank: 'Sparkasse Freiburg-Breisgau',
  },
  bank: { name: 'Volksbank Breisgau-Mitte eG', iban: iban('68090011', '0000731946'), bic: 'GENODE61BMV' },
  unterschrift: { antrag: true, antragDatum: true, mietvertrag: true },
  antrag: {
    werbungskosten: [{ person: 'P2', betrag: 235 }],
    kostenDritte: 40,
  },
  dokumente: [
    { art: 'antrag' },
    { art: 'personalausweis', person: 'P1' },
    { art: 'personalausweis', person: 'P2' },
    { art: 'steuerbescheid', person: 'P1', optionen: { jahr: 2025, finanzamt: 'Finanzamt Freiburg-Stadt' } },
    { art: 'euer', person: 'P1', optionen: { jahr: 2025, firma: 'Ferraro Fliesen & Naturstein' } },
    { art: 'kv_beitragsnachweis', person: 'P1', optionen: { art: 'privat', versicherer: 'Hanseatische Krankenversicherung a. G.', kvBeitrag: 412.6, pvBeitrag: 52.3 } },
    { art: 'gehaltsabrechnung', person: 'P2', monat: '2026-06' },
    { art: 'gehaltsabrechnung', person: 'P2', monat: '2026-07' },
    { art: 'gehaltsabrechnung', person: 'P2', monat: '2026-08' },
    { art: 'mietvertrag' },
    { art: 'vermieterbescheinigung' },
    {
      art: 'kontoauszug', person: 'P1', monat: '2026-08',
      optionen: {
        buchungen: [
          { tag: 4, text: 'Ferraro Fliesen & Naturstein', zweck: 'Privatentnahme 08/2026 Übertrag Geschäftskonto', betrag: 1900 },
          { tag: 1, text: 'Hanseatische Krankenversicherung a. G.', zweck: 'Beitrag KV/PV 08/2026 Marco Ferraro', betrag: -464.9 },
          { tag: 3, text: 'Parkraum Lehen GbR', zweck: 'Stellplatzmiete Tiefgarage Nr. 17 08/2026', betrag: -40 },
        ],
      },
    },
  ],
  erwartung: {
    befunde: [],
    befundeOhneAppRegel: [],
    hinweise: [
      'Einkommen des Selbständigen: Gewinn 2025 lt. EÜR und Einkommensteuerbescheid 22.800 € (1.900 €/Monat), Privatentnahme 1.900 € auf dem Kontoauszug.',
      'Privat krankenversichert: Beitragsbescheinigung KV 412,60 € + PV 52,30 € = 464,90 €/Monat, Lastschrift auf dem Kontoauszug. Fachlich ist hier ein eigener KV-Nachweis erforderlich — und er liegt vor.',
      'Frage 13: Werbungskosten der Ehefrau 235 €/Monat (Pendelweg nach Endingen) über dem Arbeitnehmer-Pauschbetrag.',
      'Frage 25: Tiefgaragen-Stellplatz 40 €/Monat separat an einen Dritten (nicht Teil der Miete, nicht in der Vermieterbescheinigung).',
    ],
  },
};
