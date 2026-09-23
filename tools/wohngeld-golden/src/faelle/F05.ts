import { iban } from '../lib';
import type { Fall } from '../types';

/**
 * F05 — Mutter (Angestellte) mit volljährigem Sohn in betrieblicher Ausbildung, Duisburg.
 * Referenzfall ohne Lücken. Prüft: zwei Einkommen, Ausbildungsvergütung (Variante ausbildung),
 * Personalausweis für den volljährigen Sohn, Frage 5 Zweitwohnsitz (Berufsschulort des Sohns).
 */
export const F05: Fall = {
  id: 'F05',
  titel: 'Mutter angestellt, volljähriger Sohn in Ausbildung',
  gruppe: 'A',
  antragsdatum: '2026-08-12',
  antragsart: 'erstantrag',
  behoerde: 'Stadt Duisburg\nAmt für Soziales und Wohnen – Wohngeld\n47049 Duisburg',
  telefon: '0203 7195520',
  email: 'r.pietsch@example.org',
  personen: [
    {
      id: 'P1', vorname: 'Ramona', nachname: 'Pietsch', geburtsname: 'Hülsmann', geburtsdatum: '1978-07-21', geburtsort: 'Oberhausen',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'weiblich', familienstand: 'geschieden', erwerb: 'Arbeitnehmer',
      einnahmen: [{ art: 'Gehalt/Lohn', brutto: 2360, turnus: 'monatlich' }],
      abzuege: { steuern: true, rvlv: true, kv: true },
      beschaeftigung: {
        arbeitgeber: 'Rheinhafen Speditionskontor GmbH', arbeitgeberAnschrift: 'Am Parallelhafen 14, 47059 Duisburg',
        personalnummer: '2091', eintritt: '2012-03-01', steuerklasse: 'II', wochenstunden: 38, kirche: true,
      },
      ausweis: { nummer: 'L3HV6T9KN', ausgestellt: '2020-09-08', gueltigBis: '2030-09-07', behoerde: 'Stadt Duisburg', groesseCm: 169, augenfarbe: 'blau' },
    },
    {
      id: 'P2', vorname: 'Kevin', nachname: 'Pietsch', geburtsdatum: '2006-11-03', geburtsort: 'Duisburg',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'maennlich', familienstand: 'ledig', erwerb: 'Azubi',
      verhaeltnis: 'Sohn', einnahmen: [{ art: 'Ausbildungsvergütung', brutto: 1085, turnus: 'monatlich' }],
      abzuege: { steuern: false, rvlv: true, kv: true },
      beschaeftigung: {
        arbeitgeber: 'Niederrhein Stahlservice GmbH', arbeitgeberAnschrift: 'Ruhrorter Straße 190, 47119 Duisburg',
        personalnummer: 'A-0613', eintritt: '2025-08-01', steuerklasse: 'I', wochenstunden: 38, kirche: false,
      },
      ausweis: { nummer: 'L3HK1P4ZD', ausgestellt: '2024-11-12', gueltigBis: '2034-11-11', behoerde: 'Stadt Duisburg', groesseCm: 183, augenfarbe: 'blau' },
    },
  ],
  wohnung: {
    strasse: 'Wanheimer Straße', hausnummer: '266', plz: '47053', ort: 'Duisburg', lage: '2. OG links',
    zimmer: 3, flaeche: 71, grundmiete: 490, nebenkosten: 175, heizkosten: 85, warmwasser: 25,
    gefoerdert: false, einzug: '2016-10-01', mietbeginn: '2016-10-01', mieteSeit: '2024-10-01',
  },
  vermieter: {
    name: 'Hochfeld Immobilienverwaltung Schrader KG', vertreter: 'Jens Schrader',
    strasse: 'Düsseldorfer Straße 41', plzOrt: '47051 Duisburg', telefon: '0203 3398120',
    iban: iban('35050011', '0200418835'), bank: 'Sparkasse Duisburg-Mitte',
  },
  bank: { name: 'Volksbank Rhein-Ruhr Mitte eG', iban: iban('35060311', '0001557640'), bic: 'GENODED1VRM' },
  unterschrift: { antrag: true, antragDatum: true, mietvertrag: true },
  antrag: {
    // Katalog: Zweitwohnsitz des SOHNS am Berufsschulort. Das Formular fragt Frage 5 nur für die
    // antragstellende Person ab — daher hier gesetzt, Erläuterung in den Hinweisen.
    zweitwohnsitz: true,
  },
  dokumente: [
    { art: 'antrag' },
    { art: 'personalausweis', person: 'P1' },
    { art: 'personalausweis', person: 'P2' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-05' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-06' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-07' },
    { art: 'gehaltsabrechnung', person: 'P2', monat: '2026-05', optionen: { variante: 'ausbildung' } },
    { art: 'gehaltsabrechnung', person: 'P2', monat: '2026-06', optionen: { variante: 'ausbildung' } },
    { art: 'gehaltsabrechnung', person: 'P2', monat: '2026-07', optionen: { variante: 'ausbildung' } },
    { art: 'mietvertrag' },
    { art: 'vermieterbescheinigung' },
    {
      art: 'kontoauszug', person: 'P1', monat: '2026-07',
      optionen: {
        // Ausbildungsvergütung geht (laut Abrechnung) auf das Haushaltskonto der Mutter; Netto wie Abrechnung Variante ausbildung
        buchungen: [{ tag: 30, text: 'Niederrhein Stahlservice GmbH', zweck: 'AUSBILDUNGSVERG. 07/2026 PERS.NR A-0613 KEVIN PIETSCH', betrag: 855.52 }],
      },
    },
  ],
  erwartung: {
    befunde: [],
    befundeOhneAppRegel: [],
    hinweise: [
      'Zwei Einkommen: Gehalt der Mutter 2.360 € und Ausbildungsvergütung des Sohns 1.085 € (Abrechnungen als „Abrechnung Ausbildungsvergütung").',
      'Sohn ist volljährig (19) und legt einen eigenen Personalausweis vor.',
      'Frage 5 (Zweitwohnsitz) = Ja: fachlich gemeint ist der Zweitwohnsitz des Sohns am Berufsschulort (Blockunterricht). Das Formular fragt Frage 5 nur für die antragstellende Person ab; der Haken steht deshalb dort.',
      'Kontoauszug (Konto der Mutter): Gehalt der Mutter und Ausbildungsvergütung des Sohns (netto 855,52 €) gehen dort ein, wie in beiden Abrechnungen angegeben.',
    ],
  },
};
