import { iban } from '../lib';
import type { Fall } from '../types';

/**
 * F21 — Alleinstehende, laut Antrag nur Teilzeit beschäftigt. Die Kontoauszüge
 * Juli/August zeigen zusätzlich einen regelmäßigen Minijob-Eingang (Gaststätte,
 * 480 €/Monat), der im Antrag fehlt, und keine Mietüberweisung: die Miete wird
 * bar abgehoben und bar bezahlt.
 * Prüft: `plausi-mietzahlung-fehlt` (je Kontoauszug) und die nicht erklärte
 * Einnahme (keine App-Regel, da Lohn ohnehin deklariert ist).
 */
export const F21: Fall = {
  id: 'F21',
  titel: 'Alleinstehende Teilzeitkraft, nicht angegebener Minijob, Miete bar',
  gruppe: 'C',
  antragsdatum: '2026-09-04',
  antragsart: 'erstantrag',
  behoerde: 'Stadt Köln\nAmt für Wohnungswesen – Wohngeldstelle\n50605 Köln',
  telefon: '0221 5563917',
  email: 'n.brueckmann@example.org',
  personen: [{
    id: 'P1', vorname: 'Nadine', nachname: 'Brückmann', geburtsdatum: '1991-05-23', geburtsort: 'Leverkusen',
    staatsangehoerigkeit: 'deutsch', geschlecht: 'weiblich', familienstand: 'ledig', erwerb: 'Arbeitnehmer',
    einnahmen: [{ art: 'Gehalt/Lohn (Teilzeit)', brutto: 1380, turnus: 'monatlich' }],
    abzuege: { steuern: true, rvlv: true, kv: true },
    beschaeftigung: {
      arbeitgeber: 'Rheinufer Apotheken OHG', arbeitgeberAnschrift: 'Deutzer Freiheit 71, 50679 Köln',
      personalnummer: '0317', eintritt: '2020-02-01', steuerklasse: 'I', wochenstunden: 22, kirche: false,
    },
    ausweis: { nummer: 'L9KT3WX7M', ausgestellt: '2022-01-18', gueltigBis: '2032-01-17', behoerde: 'Stadt Köln', groesseCm: 170, augenfarbe: 'blau' },
  }],
  wohnung: {
    strasse: 'Merheimer Gartenweg', hausnummer: '27', plz: '51065', ort: 'Köln', lage: '2. OG Mitte',
    zimmer: 1, flaeche: 41, grundmiete: 455, nebenkosten: 95, heizkosten: 55, warmwasser: 15,
    gefoerdert: false, einzug: '2021-04-01', mietbeginn: '2021-04-01', mieteSeit: '2021-04-01',
  },
  vermieter: {
    name: 'Helmut Kranzbühler', strasse: 'Buchheimer Ring 14', plzOrt: '51067 Köln', telefon: '0221 694412',
    iban: iban('37060512', '0003318842'), bank: 'Kölner Bürgerbank eG',
  },
  bank: { name: 'Sparkasse Köln-Rechtsrheinisch', iban: iban('37050211', '0019044736'), bic: 'COKSDE33XXX' },
  unterschrift: { antrag: true, antragDatum: true, mietvertrag: true },
  dokumente: [
    { art: 'antrag' },
    { art: 'personalausweis', person: 'P1' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-06' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-07' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-08' },
    { art: 'mietvertrag' },
    { art: 'vermieterbescheinigung' },
    {
      art: 'kontoauszug', person: 'P1', monat: '2026-07',
      optionen: { mieteBar: true, zusatzEingang: { text: 'Gaststätte Zum Mülheimer Hafen GmbH', betrag: 480, tag: 15 } },
    },
    {
      art: 'kontoauszug', person: 'P1', monat: '2026-08',
      optionen: { mieteBar: true, zusatzEingang: { text: 'Gaststätte Zum Mülheimer Hafen GmbH', betrag: 480, tag: 14 } },
    },
  ],
  erwartung: {
    befunde: ['plausi-mietzahlung-fehlt'],
    befundeOhneAppRegel: [
      'Nicht angegebene Einnahme: regelmäßiger Eingang „Gaststätte Zum Mülheimer Hafen GmbH" (480 €/Monat, Minijob) auf den Kontoauszügen Juli und August — im Antrag ist nur die Teilzeitbeschäftigung angegeben; Nacherklärung und Minijob-Nachweise anfordern',
    ],
    hinweise: [
      'Antrag: nur Teilzeitgehalt 1.380 € brutto; Gehaltsabrechnungen Juni–August bestätigen das.',
      'Kontoauszüge Juli und August: je ein Eingang von 480 € „Verdienst" vom Gastronomiebetrieb (Minijob neben der Hauptbeschäftigung).',
      'Keine Mietüberweisung an den Vermieter; stattdessen Barabhebung 650 € am 2. des Monats (Gesamtmiete 620 €) — die App meldet plausi-mietzahlung-fehlt je Kontoauszug (2×).',
      'Eine App-Regel für unerklärte Lohneingänge greift nicht: die Einkunftsart Lohn/Gehalt ist bereits angegeben.',
    ],
  },
};
