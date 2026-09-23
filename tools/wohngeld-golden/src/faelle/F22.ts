import { iban } from '../lib';
import type { Fall } from '../types';

/**
 * F22 — Alleinstehender Rentner (✍ handschriftlich). Frage 20 (Vermögen) ist mit
 * „Nein" beantwortet, beigelegt ist aber ein Depotauszug über rund 140.000 € —
 * weit über der Freigrenze von 60.000 € für einen Ein-Personen-Haushalt.
 * Prüft: `plausi-vermoegen-ueber-freigrenze` und den Widerspruch Frage 20 ↔ Depotauszug.
 */
export const F22: Fall = {
  id: 'F22',
  titel: 'Alleinstehender Rentner, Vermögen verschwiegen (Depot 140.000 €)',
  gruppe: 'C',
  antragsdatum: '2026-09-10',
  antragsart: 'erstantrag',
  behoerde: 'Landeshauptstadt Stuttgart\nAmt für Soziales – Wohngeldstelle\n70161 Stuttgart',
  telefon: '0711 8826410',
  personen: [{
    id: 'P1', vorname: 'Günther', nachname: 'Schäfle', geburtsdatum: '1951-10-07', geburtsort: 'Esslingen am Neckar',
    staatsangehoerigkeit: 'deutsch', geschlecht: 'maennlich', familienstand: 'geschieden', erwerb: 'Rentner',
    einnahmen: [{ art: 'Altersrente (Regelaltersrente)', brutto: 1290, turnus: 'monatlich' }],
    abzuege: { steuern: false, rvlv: false, kv: true },
    rente: {
      art: 'Regelaltersrente', traeger: 'Deutsche Rentenversicherung Baden-Württemberg',
      traegerAnschrift: 'Adalbert-Stifter-Straße 105, 70437 Stuttgart', versicherungsnummer: '53 071051 S 012',
      brutto: 1290, rentenbeginn: '2017-02-01',
    },
    ausweis: { nummer: 'L4PX8N2RC', ausgestellt: '2020-11-03', gueltigBis: '2030-11-02', behoerde: 'Landeshauptstadt Stuttgart', groesseCm: 176, augenfarbe: 'grau' },
  }],
  wohnung: {
    strasse: 'Hallschlager Weg', hausnummer: '9', plz: '70376', ort: 'Stuttgart', lage: '1. OG links',
    zimmer: 2, flaeche: 52, grundmiete: 520, nebenkosten: 120, heizkosten: 70, warmwasser: 20,
    gefoerdert: false, einzug: '2012-08-01', mietbeginn: '2012-08-01', mieteSeit: '2024-01-01',
  },
  vermieter: {
    name: 'Neckarblick Wohnbau GmbH', vertreter: 'i. A. Sabine Rieker, Kundenbetreuung',
    strasse: 'Pragstraße 58', plzOrt: '70376 Stuttgart', telefon: '0711 5530-0',
    iban: iban('60050111', '0002904418'), bank: 'Württembergische Genossenschaftsbank',
  },
  bank: { name: 'Neckarsparkasse Stuttgart', iban: iban('60050222', '0070381156'), bic: 'NESPDESSXXX' },
  unterschrift: { antrag: true, antragDatum: true, mietvertrag: true },
  antrag: { handschrift: true },
  dokumente: [
    { art: 'antrag' },
    { art: 'personalausweis', person: 'P1' },
    { art: 'rentenbescheid', person: 'P1' },
    { art: 'mietvertrag' },
    { art: 'vermieterbescheinigung' },
    { art: 'kontoauszug', person: 'P1', monat: '2026-08' },
    {
      art: 'depotauszug', person: 'P1',
      optionen: {
        stichtag: '2026-08-31',
        positionen: [
          { bezeichnung: 'Tagesgeldkonto', wert: 23418.77 },
          { bezeichnung: 'Vanguard FTSE All-World UCITS ETF (thesaurierend)', wert: 58920.4 },
          { bezeichnung: 'UniGlobal Vorsorge', wert: 34275.12 },
          { bezeichnung: 'Festgeld 24 Monate', wert: 20000 },
          { bezeichnung: 'Allianz SE Namens-Aktien', wert: 3602.55 },
        ],
      },
    },
  ],
  erwartung: {
    befunde: ['plausi-vermoegen-ueber-freigrenze'],
    befundeOhneAppRegel: [
      'Widerspruch: Frage 20 (Vermögen über Freigrenze) mit „Nein" beantwortet, der beigelegte Depotauszug weist zum 31.08.2026 ein Vermögen von 140.216,84 € aus — Angabe berichtigen lassen, Zweckerklärung anfordern, Wohngeld nach § 21 Nr. 3 WoGG voraussichtlich ausgeschlossen',
    ],
    hinweise: [
      'Freigrenze für 1 Haushaltsmitglied: 60.000 €; Depot/Tagesgeld/Festgeld zusammen 140.216,84 €.',
      'Die App liest das Personenvermögen nicht aus Dokumenten, sondern nur aus der erfassten Personenangabe (p.vermoegen / vermoegenPositionen). Weil Frage 20 „Nein" ist, meldet sie plausi-vermoegen-ueber-freigrenze voraussichtlich erst, nachdem die Sachbearbeitung den Depotwert erfasst hat.',
      '`vermoegensnachweise` wird fachlich NICHT erwartet: der Vermögensnachweis (Depotauszug, Typ vermoegensnachweis) liegt bereits vor. Auch nach Erfassung des Vermögens meldet die App diese Regel deshalb nicht.',
      'Keine Kapitalerträge auf dem Girokonto (thesaurierender ETF, Zinsen auf dem Tagesgeldkonto) — kein Befund zu unerklärten Einkünften erwartet.',
    ],
  },
};
