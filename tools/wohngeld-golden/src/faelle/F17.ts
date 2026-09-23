import { iban } from '../lib';
import type { Fall } from '../types';

/**
 * F17 — Alleinstehender Angestellter (62), Aufhebungsvertrag zum 31.12.2026 mit
 * Abfindung; ab 01.01.2027 Altersrente für langjährig Versicherte (beantragt).
 * Frage 18 (einmalige Einnahme) und Frage 19 (Einnahmeänderung) sind mit „Ja"
 * beantwortet — Abfindungsvereinbarung und Rentenantrag/-auskunft fehlen.
 * Geprüft wird: angekündigte Einkommensereignisse ohne Beleg — keine App-Regel.
 */
export const F17: Fall = {
  id: 'F17',
  titel: 'Angestellter mit Abfindung und Rentenbeginn 2027, Nachweise fehlen',
  gruppe: 'B',
  antragsdatum: '2026-09-03',
  antragsart: 'erstantrag',
  behoerde: 'Hanse- und Universitätsstadt Rostock\nAmt für Jugend, Soziales und Asyl – Wohngeld\n18050 Rostock',
  telefon: '0381 2037746',
  personen: [{
    id: 'P1', vorname: 'Jens', nachname: 'Pagel', geburtsdatum: '1963-11-04', geburtsort: 'Stralsund',
    staatsangehoerigkeit: 'deutsch', geschlecht: 'maennlich', familienstand: 'geschieden', erwerb: 'Arbeitnehmer',
    einnahmen: [{ art: 'Gehalt/Lohn (Teilzeit)', brutto: 1980, turnus: 'monatlich' }],
    abzuege: { steuern: true, rvlv: true, kv: true },
    beschaeftigung: {
      arbeitgeber: 'Warnow Hafenservice GmbH', arbeitgeberAnschrift: 'Am Kühlhaus 3, 18147 Rostock',
      personalnummer: '00874', eintritt: '1998-04-01', steuerklasse: 'I', wochenstunden: 30, kirche: false,
    },
    ausweis: { nummer: 'L1MX6W8RT', ausgestellt: '2018-10-30', gueltigBis: '2028-10-29', behoerde: 'Hanse- und Universitätsstadt Rostock', groesseCm: 176, augenfarbe: 'blau' },
  }],
  wohnung: {
    strasse: 'Kopenhagener Straße', hausnummer: '18', plz: '18107', ort: 'Rostock', lage: '4. OG rechts',
    zimmer: 2, flaeche: 52, grundmiete: 430, nebenkosten: 125, heizkosten: 70, warmwasser: 18,
    gefoerdert: false, einzug: '2011-02-01', mietbeginn: '2011-02-01', mieteSeit: '2025-02-01',
  },
  vermieter: {
    name: 'Wohnungsgenossenschaft Lütten Klein eG', vertreter: 'i. A. Maren Stüdemann, Mitgliederservice',
    strasse: 'Warnowallee 29', plzOrt: '18107 Rostock', telefon: '0381 77110-0',
    iban: iban('13050099', '0000671550'), bank: 'Ostseesparkasse Rostock-Nordwest',
  },
  bank: { name: 'Rostocker Volks- und Raiffeisenbank Warnow eG', iban: iban('13061099', '0002241839'), bic: 'GENODEF1HR2' },
  unterschrift: { antrag: true, antragDatum: true, mietvertrag: true },
  antrag: {
    einmalig: [{ person: 'P1', art: 'Abfindung', betrag: 14500, datum: '2026-12-31' }],
    einnahmeAenderung: {
      richtung: 'verringern',
      eintraege: [
        { person: 'P1', art: 'Gehalt/Lohn', zeitpunkt: '2027-01-01', grund: 'Ende Arbeitsvertrag', betrag: 0 },
        { person: 'P1', art: 'Altersrente', zeitpunkt: '2027-01-01', grund: 'Rentenbeginn', betrag: 1310 },
      ],
    },
  },
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
    befunde: [],
    befundeOhneAppRegel: [
      'Einmalige Einnahme (Abfindung 14.500,00 €, Frage 18) ohne Nachweis — Aufhebungs-/Abfindungsvereinbarung fehlt',
      'Einnahmeänderung ab 01.01.2027 (Frage 19: Wegfall Gehalt, Altersrente 1.310,00 €) ohne Nachweis — Rentenantrag bzw. Rentenauskunft fehlt',
    ],
    hinweise: [
      'Frage 18: Abfindung 14.500,00 € brutto, Zahlung mit der Dezemberabrechnung (31.12.2026).',
      'Frage 19 „verringern": Gehalt entfällt ab 01.01.2027, Altersrente für langjährig Versicherte voraussichtlich 1.310,00 € brutto.',
      'Gehaltsabrechnungen Juni–August 2026 und Kontoauszug August 2026 zeigen das laufende Teilzeitgehalt; keine App-Regel prüft die Fragen 18/19 — die App sollte hier (außer Standardbefunden) nichts melden.',
    ],
  },
};
