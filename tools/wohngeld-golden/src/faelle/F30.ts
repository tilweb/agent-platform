import { iban } from '../lib';
import type { Fall } from '../types';

/**
 * F30 — „Chaos-Einsendung": Unterlagen in falscher Reihenfolge, Nachweise vor dem
 * Antrag, Hinweisblatt mitgeschickt, Antragsseite 10 fehlt (Miete/Wohnfläche),
 * Seite 4 doppelt, Kontoauszug quer, fremdes Dokument (Stromrechnung), Leerseite.
 */
export const F30: Fall = {
  id: 'F30',
  titel: 'Chaos-Einsendung: Paar, beide Arbeitnehmer',
  gruppe: 'D',
  antragsdatum: '2026-09-02',
  antragsart: 'erstantrag',
  behoerde: 'Stadt Bielefeld\nAmt für Soziale Leistungen – Wohngeldstelle\n33597 Bielefeld',
  telefon: '0521 9876120',
  personen: [
    {
      id: 'P1', vorname: 'Sandra', nachname: 'Wegener', geburtsname: 'Lüdtke', geburtsdatum: '1983-01-29', geburtsort: 'Herford',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'weiblich', familienstand: 'verheiratet', erwerb: 'Arbeitnehmer',
      einnahmen: [{ art: 'Gehalt/Lohn (Teilzeit)', brutto: 1640, turnus: 'monatlich' }],
      abzuege: { steuern: true, rvlv: true, kv: true },
      beschaeftigung: {
        arbeitgeber: 'Seniorenzentrum Am Obersee gGmbH', arbeitgeberAnschrift: 'Talbrückenstraße 12, 33611 Bielefeld',
        personalnummer: '2207', eintritt: '2016-08-15', steuerklasse: 'IV', wochenstunden: 25, kirche: true,
      },
      ausweis: { nummer: 'L2RN8C4TV', ausgestellt: '2019-10-22', gueltigBis: '2029-10-21', behoerde: 'Stadt Bielefeld', groesseCm: 166, augenfarbe: 'grün' },
    },
    {
      id: 'P2', vorname: 'Thomas', nachname: 'Wegener', geburtsdatum: '1980-07-08', geburtsort: 'Bielefeld',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'maennlich', familienstand: 'verheiratet', erwerb: 'Arbeitnehmer',
      verhaeltnis: 'Ehemann', einnahmen: [{ art: 'Gehalt/Lohn', brutto: 2710, turnus: 'monatlich' }],
      abzuege: { steuern: true, rvlv: true, kv: true },
      beschaeftigung: {
        arbeitgeber: 'moBiel Verkehrsbetriebe Ost GmbH', arbeitgeberAnschrift: 'Otto-Brenner-Straße 242, 33604 Bielefeld',
        personalnummer: '118834', eintritt: '2011-04-01', steuerklasse: 'IV', wochenstunden: 39, kirche: false,
      },
      ausweis: { nummer: 'L2RM1D9QW', ausgestellt: '2023-03-06', gueltigBis: '2033-03-05', behoerde: 'Stadt Bielefeld', groesseCm: 184, augenfarbe: 'braun' },
    },
  ],
  wohnung: {
    strasse: 'Heeper Straße', hausnummer: '118a', plz: '33607', ort: 'Bielefeld', lage: 'EG rechts',
    zimmer: 3, flaeche: 74, grundmiete: 520, nebenkosten: 150, heizkosten: 85, warmwasser: 25,
    gefoerdert: false, einzug: '2021-10-01', mietbeginn: '2021-10-01', mieteSeit: '2021-10-01',
  },
  vermieter: {
    name: 'Klaus-Dieter Ostmann', strasse: 'Sieker Landstraße 9', plzOrt: '33605 Bielefeld', telefon: '0521 290011',
    iban: iban('48050161', '0072261904'), bank: 'Sparkasse Bielefeld-Ost',
  },
  bank: { name: 'Volksbank Teutoburger Wald eG', iban: iban('47260121', '0008830417'), bic: 'DGPBDE3MXXX' },
  unterschrift: { antrag: true, antragDatum: true, mietvertrag: true },
  dokumente: [
    { art: 'gehaltsabrechnung', person: 'P2', monat: '2026-06' },
    { art: 'gehaltsabrechnung', person: 'P2', monat: '2026-07' },
    { art: 'hinweisblatt' },
    { art: 'antrag', seitenFehlen: [10], seitenDoppelt: [4] },
    { art: 'personalausweis', person: 'P1' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-05' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-06' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-07' },
    { art: 'kontoauszug', person: 'P1', monat: '2026-07', quer: true },
    { art: 'stromrechnung' },
    { art: 'mietvertrag' },
    { art: 'leerseite' },
    { art: 'personalausweis', person: 'P2' },
    { art: 'vermieterbescheinigung' },
    { art: 'gehaltsabrechnung', person: 'P2', monat: '2026-05' },
  ],
  erwartung: {
    befunde: ['essenzielle-angaben'],
    befundeOhneAppRegel: ['Antrag unvollständig: Seite 10 fehlt (Fragen 21–27, Miete und Wohnfläche)'],
    antragFelder: { 'wohnung.miete': null, 'wohnung.wohnflaeche_qm': null },
    hinweise: [
      'Split: 15 Dokumente in gestörter Reihenfolge; Gehaltsabrechnungen derselben Person sind getrennte Dokumente je Monat.',
      'Antrag hat 11 Seiten im Original: Seite 10 fehlt, Seite 4 liegt doppelt vor (Sendung: 11 Seiten).',
      'Stromrechnung und Hinweisblatt gehören nicht zum Antrag (Typ sonstiges); Leerseite ist eine leere Rückseite.',
    ],
  },
};
