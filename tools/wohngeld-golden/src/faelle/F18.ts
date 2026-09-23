import { iban } from '../lib';
import type { Fall } from '../types';

/**
 * F18 — Ehepaar, kürzliche Mieterhöhung. Der Antrag nennt noch die ALTE Miete
 * (passt zum Mietvertrag von 2019), Vermieterbescheinigung, Mieterhöhungsschreiben
 * und Kontoauszug zeigen die NEUE Miete ⇒ Miethöhen-Abweichung.
 */
export const F18: Fall = {
  id: 'F18',
  titel: 'Ehepaar, Mieterhöhung nicht im Antrag berücksichtigt',
  gruppe: 'C',
  antragsdatum: '2026-08-25',
  antragsart: 'erstantrag',
  behoerde: 'Stadtverwaltung Mainz\nAmt für Soziale Leistungen – Wohngeld\n55028 Mainz',
  telefon: '06131 5569021',
  email: 'd.hoffmann88@example.net',
  personen: [
    {
      id: 'P1', vorname: 'Dennis', nachname: 'Hoffmann', geburtsdatum: '1988-11-02', geburtsort: 'Wiesbaden',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'maennlich', familienstand: 'verheiratet', erwerb: 'Arbeitnehmer',
      einnahmen: [{ art: 'Gehalt/Lohn', brutto: 2890, turnus: 'monatlich' }],
      abzuege: { steuern: true, rvlv: true, kv: true },
      beschaeftigung: {
        arbeitgeber: 'Rheinlog Lagerlogistik GmbH', arbeitgeberAnschrift: 'Hechtsheimer Straße 40, 55131 Mainz',
        personalnummer: '40718', eintritt: '2019-03-01', steuerklasse: 'III', wochenstunden: 40, kirche: false,
      },
      ausweis: { nummer: 'T4KW9M1RZ', ausgestellt: '2022-09-14', gueltigBis: '2032-09-13', behoerde: 'Stadt Mainz', groesseCm: 181, augenfarbe: 'blau' },
    },
    {
      id: 'P2', vorname: 'Laura', nachname: 'Hoffmann', geburtsname: 'Krämer', geburtsdatum: '1990-06-17', geburtsort: 'Bingen am Rhein',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'weiblich', familienstand: 'verheiratet', erwerb: 'Nichterwerbsperson',
      verhaeltnis: 'Ehefrau', einnahmen: [], abzuege: { steuern: false, rvlv: false, kv: false },
      ausweis: { nummer: 'T4KP2X7NC', ausgestellt: '2020-02-03', gueltigBis: '2030-02-02', behoerde: 'Stadt Mainz', groesseCm: 168, augenfarbe: 'braun' },
    },
  ],
  wohnung: {
    strasse: 'Wormser Straße', hausnummer: '63', plz: '55130', ort: 'Mainz', lage: '3. OG links',
    zimmer: 3, flaeche: 67, grundmiete: 612, nebenkosten: 165, heizkosten: 78, warmwasser: 22,
    gefoerdert: false, einzug: '2019-06-01', mietbeginn: '2019-06-01', mieteSeit: '2026-07-01',
  },
  mieterhoehung: { alteGrundmiete: 545, ab: '2026-07-01', schreibenVom: '2026-04-20' },
  antragAbweichung: { gesamtmiete: 810 },
  vermieter: {
    name: 'Hausverwaltung Brückner & Söhne GmbH', vertreter: 'Markus Brückner',
    strasse: 'Kaiserstraße 18', plzOrt: '55116 Mainz', telefon: '06131 223340',
    iban: iban('55050120', '0000481120'), bank: 'Mainzer Volksbank Rheinhessen eG',
  },
  bank: { name: 'Sparkasse Rheinhessen-Süd', iban: iban('55350010', '0020471188'), bic: 'MALADE51RHS' },
  unterschrift: { antrag: true, antragDatum: true, mietvertrag: true },
  dokumente: [
    { art: 'antrag' },
    { art: 'personalausweis', person: 'P1' },
    { art: 'personalausweis', person: 'P2' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-05' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-06' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-07' },
    { art: 'mietvertrag' },
    { art: 'mieterhoehung' },
    { art: 'vermieterbescheinigung' },
    { art: 'kontoauszug', person: 'P1', monat: '2026-07' },
  ],
  erwartung: {
    befunde: ['plausi-miethoehe-abweichung'],
    befundeOhneAppRegel: [],
    hinweise: [
      'Antrag: Gesamtmiete 810,00 € (Bruttokaltmiete 710,00 €) — Stand vor der Mieterhöhung, deckungsgleich mit dem Mietvertrag.',
      'Vermieterbescheinigung, Mieterhöhung ab 01.07.2026 und Kontoauszug Juli 2026: Gesamtmiete 877,00 € (Bruttokaltmiete 777,00 €).',
    ],
  },
};
