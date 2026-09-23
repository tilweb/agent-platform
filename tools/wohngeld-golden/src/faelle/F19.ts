import { iban } from '../lib';
import type { Fall } from '../types';

/**
 * F19 — Alleinstehender Arbeitnehmer, zum 01.07.2026 aus Bramsche (Landkreis Osnabrück)
 * nach Osnabrück umgezogen; Antrag handschriftlich. Im Antrag 62 m² Wohnfläche,
 * Mietvertrag und Vermieterbescheinigung nennen 72 m². Frage 4 = Ja: für die alte
 * Wohnung läuft noch Wohngeld des Landkreises (Zahlung für 08/2026 im Juli-Auszug).
 * Geprüft wird: Wohnflächen-Widerspruch; Hinweis auf Doppelbezug (ohne App-Regel).
 */
export const F19: Fall = {
  id: 'F19',
  titel: 'Alleinstehender Arbeitnehmer, Wohnfläche im Antrag zu klein, altes Wohngeld läuft aus (Handschrift)',
  gruppe: 'C',
  antragsdatum: '2026-08-06',
  antragsart: 'erstantrag',
  behoerde: 'Stadt Osnabrück\nFachbereich Soziales – Wohngeld\n49074 Osnabrück',
  telefon: '0541 5098833',
  personen: [{
    id: 'P1', vorname: 'Tobias', nachname: 'Rehkamp', geburtsdatum: '1991-05-23', geburtsort: 'Bramsche',
    staatsangehoerigkeit: 'deutsch', geschlecht: 'maennlich', familienstand: 'ledig', erwerb: 'Arbeitnehmer',
    einnahmen: [{ art: 'Gehalt/Lohn', brutto: 2120, turnus: 'monatlich' }],
    abzuege: { steuern: true, rvlv: true, kv: true },
    beschaeftigung: {
      arbeitgeber: 'Hasetal Lager- und Umschlag GmbH', arbeitgeberAnschrift: 'Fürstenauer Weg 64, 49090 Osnabrück',
      personalnummer: '7716', eintritt: '2019-08-01', steuerklasse: 'I', wochenstunden: 40, kirche: true,
    },
    ausweis: { nummer: 'L5NW2P8KC', ausgestellt: '2022-02-08', gueltigBis: '2032-02-07', behoerde: 'Stadt Bramsche', groesseCm: 180, augenfarbe: 'grün' },
  }],
  wohnung: {
    strasse: 'Hasestraße', hausnummer: '104', plz: '49074', ort: 'Osnabrück', lage: 'DG links',
    zimmer: 3, flaeche: 72, grundmiete: 520, nebenkosten: 140, heizkosten: 85, warmwasser: 20,
    gefoerdert: false, einzug: '2026-07-01', mietbeginn: '2026-07-01', mieteSeit: '2026-07-01',
  },
  antragAbweichung: { flaeche: 62 },
  vermieter: {
    name: 'Gerd Wellmann', strasse: 'Lotter Straße 17', plzOrt: '49078 Osnabrück', telefon: '0541 432290',
    iban: iban('26550199', '0010442871'), bank: 'Sparkasse Osnabrück-Hase',
  },
  bank: { name: 'Volksbank Osnabrücker Nordland eG', iban: iban('26562499', '0003308215'), bic: 'GENODEF1OSN' },
  unterschrift: { antrag: true, antragDatum: true, mietvertrag: true },
  antrag: {
    handschrift: true,
    andereWohnungWohngeld: true,
  },
  dokumente: [
    { art: 'antrag' },
    { art: 'personalausweis', person: 'P1' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-05' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-06' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-07' },
    { art: 'mietvertrag' },
    { art: 'vermieterbescheinigung' },
    {
      art: 'kontoauszug', person: 'P1', monat: '2026-07',
      optionen: { buchungen: [{ tag: 30, text: 'Landkreis Osnabrück', zweck: 'Wohngeld 08/2026 Az. 50.3-WG-18842 Bramsche', betrag: 164 }] },
    },
  ],
  erwartung: {
    befunde: ['plausi-wohnflaeche-abweichung'],
    befundeOhneAppRegel: [],
    hinweise: [
      'Wohnfläche: Antrag 62 m², Mietvertrag und Vermieterbescheinigung 72 m². Miete stimmt überall überein (Gesamtmiete 765,00 €, Bruttokaltmiete 660,00 €).',
      'Frage 4 = Ja: Wohngeld für die bisherige Wohnung in Bramsche (Landkreis Osnabrück, bewilligt bis 31.08.2026). Der Kontoauszug Juli 2026 zeigt am 30.07. noch 164,00 € Wohngeld für 08/2026, obwohl der Umzug zum 01.07.2026 erfolgte ⇒ Einstellung/Erstattung beim Landkreis und Doppelbezug ab 08/2026 klären (keine App-Regel).',
      'Personalausweis noch mit der Ausstellungsbehörde Stadt Bramsche.',
    ],
  },
};
