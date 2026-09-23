import { iban } from '../lib';
import type { Fall } from '../types';

/**
 * F08 — Familie mit zwei Kindern in Magdeburg (Konstellation wie F02, andere Personen):
 * er Vollzeit, sie Minijob. Gezielte Lücken: Minijob-Nachweise der Ehefrau und der
 * Kindergeldbescheid fehlen. Kontoauszug zeigt Minijob-Lohn und Kindergeld (stimmige Geschichte).
 * Prüft: Nachforderung `verdienstbescheinigung` (Ehefrau) und `kindergeld-nachweis`.
 */
export const F08: Fall = {
  id: 'F08',
  titel: 'Familie mit zwei Kindern, Minijob- und Kindergeldnachweis fehlen',
  gruppe: 'B',
  antragsdatum: '2026-09-01',
  antragsart: 'erstantrag',
  behoerde: 'Landeshauptstadt Magdeburg\nSozial- und Wohnungsamt – Wohngeld\n39090 Magdeburg',
  telefon: '0391 5063318',
  personen: [
    {
      id: 'P1', vorname: 'Andrej', nachname: 'Weber', geburtsdatum: '1986-03-19', geburtsort: 'Karaganda',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'maennlich', familienstand: 'verheiratet', erwerb: 'Arbeitnehmer',
      einnahmen: [{ art: 'Gehalt/Lohn', brutto: 2640, turnus: 'monatlich' }],
      abzuege: { steuern: true, rvlv: true, kv: true },
      beschaeftigung: {
        arbeitgeber: 'Elbe-Börde Metallbau GmbH', arbeitgeberAnschrift: 'Sülzeweg 12, 39128 Magdeburg',
        personalnummer: '1146', eintritt: '2015-06-01', steuerklasse: 'III', wochenstunden: 40, kirche: false,
      },
      ausweis: { nummer: 'L8MB4W1RT', ausgestellt: '2020-05-06', gueltigBis: '2030-05-05', behoerde: 'Landeshauptstadt Magdeburg', groesseCm: 180, augenfarbe: 'grau' },
    },
    {
      id: 'P2', vorname: 'Olga', nachname: 'Weber', geburtsname: 'Schmidt', geburtsdatum: '1988-11-27', geburtsort: 'Pawlodar',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'weiblich', familienstand: 'verheiratet', erwerb: 'Arbeitnehmer',
      verhaeltnis: 'Ehefrau', einnahmen: [{ art: 'Minijob (geringfügige Beschäftigung)', brutto: 480, turnus: 'monatlich' }],
      abzuege: { steuern: false, rvlv: false, kv: false },
      beschaeftigung: {
        arbeitgeber: 'Glanzwerk Gebäudereinigung Kühne e. K.', arbeitgeberAnschrift: 'Lübecker Straße 40, 39124 Magdeburg',
        personalnummer: '3307', eintritt: '2023-09-01', steuerklasse: 'V', wochenstunden: 8, kirche: false,
      },
      ausweis: { nummer: 'L8MC7X5NP', ausgestellt: '2021-08-30', gueltigBis: '2031-08-29', behoerde: 'Landeshauptstadt Magdeburg', groesseCm: 163, augenfarbe: 'blau' },
    },
    {
      id: 'P3', vorname: 'Sofia', nachname: 'Weber', geburtsdatum: '2016-09-02', geburtsort: 'Magdeburg',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'weiblich', familienstand: 'ledig', erwerb: 'Nichterwerbsperson',
      verhaeltnis: 'Tochter', einnahmen: [], abzuege: { steuern: false, rvlv: false, kv: false },
    },
    {
      id: 'P4', vorname: 'Maxim', nachname: 'Weber', geburtsdatum: '2021-01-15', geburtsort: 'Magdeburg',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'maennlich', familienstand: 'ledig', erwerb: 'Nichterwerbsperson',
      verhaeltnis: 'Sohn', einnahmen: [], abzuege: { steuern: false, rvlv: false, kv: false },
    },
  ],
  wohnung: {
    strasse: 'Halberstädter Straße', hausnummer: '115', plz: '39112', ort: 'Magdeburg', lage: '3. OG rechts',
    zimmer: 4, flaeche: 78, grundmiete: 470, nebenkosten: 170, heizkosten: 95, warmwasser: 25,
    gefoerdert: false, einzug: '2019-07-01', mietbeginn: '2019-07-01', mieteSeit: '2025-07-01',
  },
  vermieter: {
    name: 'Sudenburger Wohnungsgenossenschaft eG', vertreter: 'i. A. Maik Lehmann, Vermietung',
    strasse: 'Ambrosiusplatz 3', plzOrt: '39112 Magdeburg', telefon: '0391 6259400',
    iban: iban('81050511', '0031477260'), bank: 'Stadtsparkasse Magdeburg-Süd',
  },
  bank: { name: 'Volksbank Börde-Elbe eG', iban: iban('81090811', '0003390415'), bic: 'GENODEF1VBE' },
  unterschrift: { antrag: true, antragDatum: true, mietvertrag: true },
  dokumente: [
    { art: 'antrag' },
    { art: 'personalausweis', person: 'P1' },
    { art: 'personalausweis', person: 'P2' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-06' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-07' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-08' },
    { art: 'mietvertrag' },
    { art: 'vermieterbescheinigung' },
    {
      art: 'kontoauszug', person: 'P1', monat: '2026-08',
      optionen: {
        // Minijob wird netto = brutto überwiesen (Generator würde sonst SV-Abzüge rechnen)
        ohneGehalt: ['P2'],
        buchungen: [
          { tag: 28, text: 'Glanzwerk Gebäudereinigung Kühne e. K.', zweck: 'LOHN 08/2026 PERS.NR 3307', betrag: 480 },
          { tag: 13, text: 'Familienkasse Sachsen-Anhalt-Thüringen', zweck: 'KINDERGELD 318FK227906 08/2026', betrag: 518 },
        ],
      },
    },
  ],
  erwartung: {
    befunde: ['verdienstbescheinigung', 'kindergeld-nachweis'],
    befundeOhneAppRegel: [],
    hinweise: [
      'Lücke 1: Die Ehefrau gibt einen Minijob (480 €) an, legt aber keine Abrechnungen vor — `verdienstbescheinigung` für P2. Der Lohneingang ist nur auf dem Kontoauszug sichtbar.',
      'Lücke 2: Kindergeld 2 × 259 € geht auf dem Kontoauszug ein, ein Kindergeldbescheid fehlt — `kindergeld-nachweis`.',
    ],
  },
};
