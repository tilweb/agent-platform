import { iban } from '../lib';
import type { Fall } from '../types';

/**
 * F14 — Alleinstehende Rentnerin; im Antrag (Frage 15) Schwerbehinderung GdB 70 und
 * Pflegegrad 3 (häusliche Pflege) angegeben, Pflegegeld geht auf dem Konto ein.
 * Schwerbehindertenausweis und Pflegekassenbescheid liegen aber NICHT bei.
 * Geprüft wird: fehlende Nachweise für die Freibeträge nach § 17 WoGG.
 */
export const F14: Fall = {
  id: 'F14',
  titel: 'Rentnerin mit Schwerbehinderung und Pflegegrad 3, Nachweise fehlen',
  gruppe: 'B',
  antragsdatum: '2026-08-12',
  antragsart: 'erstantrag',
  behoerde: 'Stadt Augsburg\nAmt für Soziale Leistungen – Wohngeld\n86150 Augsburg',
  telefon: '0821 4471903',
  personen: [{
    id: 'P1', vorname: 'Hildegard', nachname: 'Moosbauer', geburtsname: 'Rieger',
    geburtsdatum: '1950-06-19', geburtsort: 'Günzburg', staatsangehoerigkeit: 'deutsch',
    geschlecht: 'weiblich', familienstand: 'verwitwet', erwerb: 'Rentner',
    einnahmen: [{ art: 'Altersrente (Regelaltersrente)', brutto: 1078.4, turnus: 'monatlich' }],
    abzuege: { steuern: false, rvlv: false, kv: true },
    rente: {
      art: 'Regelaltersrente', traeger: 'Deutsche Rentenversicherung Schwaben',
      traegerAnschrift: 'Dieselstraße 9, 86154 Augsburg', versicherungsnummer: '12 190650 R 012',
      brutto: 1078.4, rentenbeginn: '2015-07-01',
    },
    ausweis: { nummer: 'L3KV8T1PW', ausgestellt: '2020-03-02', gueltigBis: '2030-03-01', behoerde: 'Stadt Augsburg', groesseCm: 158, augenfarbe: 'braun' },
  }],
  wohnung: {
    strasse: 'Bärenkellerstraße', hausnummer: '31', plz: '86156', ort: 'Augsburg', lage: 'EG links (barrierearm)',
    zimmer: 2, flaeche: 46, grundmiete: 410, nebenkosten: 105, heizkosten: 65, warmwasser: 15,
    gefoerdert: false, einzug: '2019-11-01', mietbeginn: '2019-11-01', mieteSeit: '2024-11-01',
  },
  vermieter: {
    name: 'Lechwohnen Augsburg-West GmbH', vertreter: 'i. A. Stefan Wiedemann, Bestandsverwaltung',
    strasse: 'Ulmer Straße 204', plzOrt: '86156 Augsburg', telefon: '0821 45209-0',
    iban: iban('72050199', '0002406618'), bank: 'Stadtsparkasse Augsburg-West',
  },
  bank: { name: 'Raiffeisenbank Augsburger Land-West eG', iban: iban('72069199', '0000583912'), bic: 'GENODEF1ZUS' },
  unterschrift: { antrag: true, antragDatum: true, mietvertrag: true },
  antrag: {
    schwerbehinderung: [{ person: 'P1', gdb: 70, pflegegrad: 3, haeuslich: true }],
  },
  dokumente: [
    { art: 'antrag' },
    { art: 'personalausweis', person: 'P1' },
    { art: 'rentenbescheid', person: 'P1' },
    { art: 'mietvertrag' },
    { art: 'vermieterbescheinigung' },
    {
      art: 'kontoauszug', person: 'P1', monat: '2026-07',
      optionen: { buchungen: [{ tag: 1, text: 'AOK Bayern Pflegekasse', zweck: 'Pflegegeld 07/2026 PG 3 Vers-Nr M190650812', betrag: 599 }] },
    },
  ],
  erwartung: {
    befunde: ['schwerbehinderung-nachweis', 'pflegegrad-nachweis'],
    befundeOhneAppRegel: [],
    hinweise: [
      'Frage 15 = Ja: GdB 70, Pflegegrad 3, häuslich pflegebedürftig — ohne Schwerbehindertenausweis und ohne Bescheid der Pflegekasse.',
      'Kontoauszug Juli 2026 zeigt Pflegegeld 599,00 € (Pflegegrad 3) — Indiz, ersetzt den Pflegebescheid nicht; Pflegegeld ist kein Einkommen im Sinne des WoGG und steht deshalb nicht unter den Einnahmen.',
    ],
  },
};
