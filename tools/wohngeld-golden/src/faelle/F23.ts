import { iban } from '../lib';
import type { Fall } from '../types';

/**
 * F23 — Mischhaushalt: Mutter (Arbeitnehmerin) beantragt Wohngeld, die erwachsene
 * Tochter (26, eigene Bedarfsgemeinschaft) bezieht Bürgergeld. Frage 10 ist mit
 * „Ja" für die Tochter beantwortet, der Bürgergeld-Bescheid liegt bei.
 * Prüft: `ausschluss-person-transferbezug` für die Tochter (§ 7 WoGG) — sie bleibt
 * bei der Wohngeldberechnung außer Betracht, die Mutter ist wohngeldberechtigt.
 */
export const F23: Fall = {
  id: 'F23',
  titel: 'Mischhaushalt: Mutter Arbeitnehmerin, Tochter bezieht Bürgergeld',
  gruppe: 'C',
  antragsdatum: '2026-09-03',
  antragsart: 'erstantrag',
  behoerde: 'Stadt Essen\nAmt für Soziales und Wohnen – Wohngeld\n45121 Essen',
  telefon: '0201 3317205',
  personen: [
    {
      id: 'P1', vorname: 'Aylin', nachname: 'Yıldırım', geburtsname: 'Kaya', geburtsdatum: '1975-02-14', geburtsort: 'Gelsenkirchen',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'weiblich', familienstand: 'geschieden', erwerb: 'Arbeitnehmer',
      einnahmen: [{ art: 'Gehalt/Lohn', brutto: 2180, turnus: 'monatlich' }],
      abzuege: { steuern: true, rvlv: true, kv: true },
      beschaeftigung: {
        arbeitgeber: 'Ruhrmarkt Lebensmittel GmbH & Co. KG', arbeitgeberAnschrift: 'Altenessener Straße 402, 45329 Essen',
        personalnummer: '77104', eintritt: '2013-09-01', steuerklasse: 'II', wochenstunden: 37.5, kirche: false,
      },
      ausweis: { nummer: 'L3CZ7PQ4W', ausgestellt: '2021-07-26', gueltigBis: '2031-07-25', behoerde: 'Stadt Essen', groesseCm: 162, augenfarbe: 'braun' },
    },
    {
      id: 'P2', vorname: 'Derya', nachname: 'Yıldırım', geburtsdatum: '2000-06-30', geburtsort: 'Essen',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'weiblich', familienstand: 'ledig', erwerb: 'Arbeitslos',
      verhaeltnis: 'Tochter', einnahmen: [], abzuege: { steuern: false, rvlv: false, kv: false },
      ausweis: { nummer: 'L3CW2KT9N', ausgestellt: '2023-05-09', gueltigBis: '2033-05-08', behoerde: 'Stadt Essen', groesseCm: 167, augenfarbe: 'braun' },
    },
  ],
  wohnung: {
    strasse: 'Karnaper Bogen', hausnummer: '33', plz: '45329', ort: 'Essen', lage: '2. OG rechts',
    zimmer: 3, flaeche: 71, grundmiete: 470, nebenkosten: 150, heizkosten: 85, warmwasser: 20,
    gefoerdert: false, einzug: '2014-03-01', mietbeginn: '2014-03-01', mieteSeit: '2025-03-01',
  },
  vermieter: {
    name: 'Emschertal Wohnungsgesellschaft mbH', vertreter: 'i. A. Jörg Wiemers, Vermietung',
    strasse: 'Hafenstraße 212', plzOrt: '45356 Essen', telefon: '0201 8640-0',
    iban: iban('36060188', '0005520417'), bank: 'Bank im Revier eG',
  },
  bank: { name: 'Sparkasse Essen-Nord', iban: iban('36050133', '0023357190'), bic: 'SPENDE3EXXX' },
  unterschrift: { antrag: true, antragDatum: true, mietvertrag: true },
  antrag: {
    transfer: [{ person: 'P2', leistung: 'Bürgergeld (SGB II)', beantragt: '2026-04-02', bewilligt: '2026-04-22' }],
  },
  dokumente: [
    { art: 'antrag' },
    { art: 'personalausweis', person: 'P1' },
    { art: 'personalausweis', person: 'P2' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-06' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-07' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-08' },
    { art: 'buergergeld_bescheid', person: 'P2', optionen: { von: '2026-05-01', bis: '2027-04-30', datum: '2026-04-22' } },
    { art: 'mietvertrag' },
    { art: 'vermieterbescheinigung' },
    {
      art: 'kontoauszug', person: 'P1', monat: '2026-08',
      // Tochter überweist ihren KdU-Kopfteil (310,00 + 52,50) aus dem Bürgergeld an die Mutter.
      optionen: { buchungen: [{ tag: 3, text: 'Derya Yıldırım', zweck: 'Mietanteil August (KdU Jobcenter)', betrag: 362.5 }] },
    },
  ],
  erwartung: {
    befunde: ['ausschluss-person-transferbezug'],
    befundeOhneAppRegel: [],
    hinweise: [
      'Tochter Derya (26) bildet eine eigene Bedarfsgemeinschaft (über 25) und bezieht Bürgergeld inkl. Kosten der Unterkunft (Kopfteil 1/2) ⇒ nach § 7 Abs. 1 WoGG vom Wohngeld ausgeschlossen, Mutter bleibt wohngeldberechtigt (Mischhaushalt).',
      'Bürgergeld-Bescheid: Regelbedarf 563 € + Unterkunft 310,00 € + Heizung 52,50 € = 925,50 €/Monat ab 01.05.2026.',
      'Kontoauszug August: Tochter überweist ihren Mietanteil 362,50 € an die Mutter; die Mutter zahlt die volle Miete 725 € an den Vermieter.',
      'Die App meldet ausschluss-person-transferbezug nur, wenn der Transferbezug an der Person erfasst ist (Ausschluss/Transferleistung mit KdU) — die Angabe steht in Frage 10.',
    ],
  },
};
