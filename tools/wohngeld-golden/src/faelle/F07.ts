import { iban } from '../lib';
import type { Fall } from '../types';

/**
 * F07 — Alleinstehender Rentner in Kiel, schwerbehindert (GdB 80, Merkzeichen G) und
 * Pflegegrad 2 bei häuslicher Pflege. Referenzfall ohne Lücken.
 * Prüft: Frage 15 Schwerbehinderung + Pflegegrad, Schwerbehindertenausweis, Pflegekassenbescheid,
 * Krankenversichertenkarte als KV-Nachweis; Pflegegeld-Eingang auf dem Kontoauszug (keine Einnahme).
 */
export const F07: Fall = {
  id: 'F07',
  titel: 'Rentner mit GdB 80 und Pflegegrad 2 (häuslich)',
  gruppe: 'A',
  antragsdatum: '2026-08-24',
  antragsart: 'erstantrag',
  behoerde: 'Landeshauptstadt Kiel\nAmt für Wohnen und Grundsicherung – Wohngeld\n24099 Kiel',
  telefon: '0431 5579310',
  personen: [{
    id: 'P1', vorname: 'Hans-Jürgen', nachname: 'Thießen', geburtsdatum: '1949-06-12', geburtsort: 'Eckernförde',
    staatsangehoerigkeit: 'deutsch', geschlecht: 'maennlich', familienstand: 'verwitwet', erwerb: 'Rentner',
    einnahmen: [{ art: 'Altersrente (Regelaltersrente)', brutto: 1265.3, turnus: 'monatlich' }],
    abzuege: { steuern: false, rvlv: false, kv: true },
    rente: {
      art: 'Regelaltersrente', traeger: 'Deutsche Rentenversicherung Nord',
      traegerAnschrift: 'Ziegelstraße 150, 23556 Lübeck', versicherungsnummer: '12 120649 T 004',
      brutto: 1265.3, rentenbeginn: '2014-07-01',
    },
    ausweis: { nummer: 'L1KD5V8XP', ausgestellt: '2022-01-24', gueltigBis: '2032-01-23', behoerde: 'Landeshauptstadt Kiel', groesseCm: 176, augenfarbe: 'grau' },
  }],
  wohnung: {
    strasse: 'Elisabethstraße', hausnummer: '61', plz: '24143', ort: 'Kiel', lage: 'EG links',
    zimmer: 2, flaeche: 46, grundmiete: 372, nebenkosten: 108, heizkosten: 61, warmwasser: 14,
    gefoerdert: false, einzug: '2022-11-01', mietbeginn: '2022-11-01', mieteSeit: '2024-11-01',
  },
  vermieter: {
    name: 'Förde Wohnen eG', vertreter: 'i. A. Birte Carstensen, Mieterbetreuung',
    strasse: 'Werftstraße 201', plzOrt: '24143 Kiel', telefon: '0431 7295530',
    iban: iban('21050177', '0090318824'), bank: 'Förde Sparkasse Ost',
  },
  bank: { name: 'Kieler Volksbank Ostufer eG', iban: iban('21090011', '0005318640'), bic: 'GENODEF1KVO' },
  unterschrift: { antrag: true, antragDatum: true, mietvertrag: true },
  antrag: {
    schwerbehinderung: [{ person: 'P1', gdb: 80, pflegegrad: 2, haeuslich: true }],
  },
  dokumente: [
    { art: 'antrag' },
    { art: 'personalausweis', person: 'P1' },
    { art: 'rentenbescheid', person: 'P1' },
    { art: 'schwerbehindertenausweis', person: 'P1', optionen: { gdb: 80, merkzeichen: ['G'], ausgestellt: '2024-03-18', gueltigBis: 'unbefristet', behoerde: 'Landesamt für soziale Dienste Schleswig-Holstein' } },
    { art: 'pflegebescheid', person: 'P1', optionen: { pflegegrad: 2, versorgung: 'haeuslich', pflegegeld: 347, ab: '2026-02-01', datum: '2026-03-10', stelle: 'Pflegekasse bei der AOK NordWest' } },
    { art: 'kv_karte', person: 'P1', optionen: { kasse: 'AOK NordWest' } },
    { art: 'mietvertrag' },
    { art: 'vermieterbescheinigung' },
    {
      art: 'kontoauszug', person: 'P1', monat: '2026-07',
      optionen: {
        buchungen: [
          { tag: 1, text: 'AOK NordWest Pflegekasse', zweck: 'PFLEGEGELD 07/2026 PG 2 THIESSEN', betrag: 347 },
          { tag: 20, text: 'Sanitätshaus Holtenau GmbH', zweck: 'Eigenanteil Rollator Rg. 26-4471', betrag: -25 },
        ],
      },
    },
  ],
  erwartung: {
    befunde: [],
    befundeOhneAppRegel: [],
    hinweise: [
      'Frage 15: GdB 80 und Pflegegrad 2, häusliche Pflege — belegt durch Schwerbehindertenausweis (unbefristet) und Pflegekassenbescheid.',
      'KV-Karte (AOK NordWest) liegt als KV-Nachweis vor; die App sollte hier also keinen KV-Befund melden.',
      'Pflegegeld 347 € geht auf dem Kontoauszug ein, ist aber keine Einnahme im Sinne des WoGG und steht deshalb nicht im Antrag.',
    ],
  },
};
