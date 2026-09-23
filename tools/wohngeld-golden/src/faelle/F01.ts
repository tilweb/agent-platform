import { iban } from '../lib';
import type { Fall } from '../types';

/** F01 — Alleinstehende Rentnerin, Sozialwohnung. Referenzfall ohne Lücken. */
export const F01: Fall = {
  id: 'F01',
  titel: 'Alleinstehende Rentnerin, Altersrente, Sozialwohnung',
  gruppe: 'A',
  antragsdatum: '2026-08-18',
  antragsart: 'erstantrag',
  behoerde: 'Stadt Kassel\nWohngeldstelle\n34112 Kassel',
  telefon: '0561 4719388',
  personen: [{
    id: 'P1', vorname: 'Waltraud', nachname: 'Kessler', geburtsname: 'Brandt',
    geburtsdatum: '1952-03-14', geburtsort: 'Hann. Münden', staatsangehoerigkeit: 'deutsch',
    geschlecht: 'weiblich', familienstand: 'verwitwet', erwerb: 'Rentner',
    einnahmen: [{ art: 'Altersrente (Regelaltersrente)', brutto: 1184.2, turnus: 'monatlich' }],
    abzuege: { steuern: false, rvlv: false, kv: true },
    rente: {
      art: 'Regelaltersrente', traeger: 'Deutsche Rentenversicherung Hessen',
      traegerAnschrift: 'Städelstraße 28, 60596 Frankfurt am Main', versicherungsnummer: '14 140352 K 507',
      brutto: 1184.2, rentenbeginn: '2017-10-01',
    },
    ausweis: { nummer: 'L7XR4T2KP', ausgestellt: '2021-05-11', gueltigBis: '2031-05-10', behoerde: 'Stadt Kassel', groesseCm: 163, augenfarbe: 'grau' },
  }],
  wohnung: {
    strasse: 'Am Lindenhof', hausnummer: '12', plz: '34127', ort: 'Kassel', lage: '1. OG rechts',
    zimmer: 2, flaeche: 48, grundmiete: 298.5, nebenkosten: 90, heizkosten: 62, warmwasser: 18,
    gefoerdert: true, einzug: '2023-02-01', mietbeginn: '2023-02-01', mieteSeit: '2023-02-01',
  },
  vermieter: {
    name: 'Gemeinnützige Wohnungsbau Kassel-Nord eG', vertreter: 'i. A. Petra Vollmer, Mieterservice',
    strasse: 'Holländische Straße 141', plzOrt: '34127 Kassel', telefon: '0561 98170-0',
    iban: iban('52090611', '0004182233'), bank: 'Kasseler Genossenschaftsbank eG',
  },
  bank: { name: 'Kasseler Sparkasse Nord', iban: iban('52050399', '0012749031'), bic: 'KSNODE51XXX' },
  unterschrift: { antrag: true, antragDatum: true, mietvertrag: true },
  dokumente: [
    { art: 'antrag' },
    { art: 'personalausweis', person: 'P1' },
    { art: 'rentenbescheid', person: 'P1' },
    { art: 'mietvertrag' },
    { art: 'vermieterbescheinigung' },
    { art: 'kontoauszug', person: 'P1', monat: '2026-07' },
  ],
  erwartung: { befunde: [], befundeOhneAppRegel: [] },
};
