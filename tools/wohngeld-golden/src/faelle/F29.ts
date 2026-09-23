import { eur, iban, rund2 } from '../lib';
import { nettoLohn } from '../nachweise/gehaltsabrechnung';
import type { DokSpec, Fall, Person } from '../types';

/**
 * F29 — Großfamilie mit 6 Personen: Vater in Kurzarbeit, Mutter bezieht Elterngeld
 * für das jüngste Kind, ältester Sohn in Ausbildung, zwei weitere Kinder. Die
 * Großmutter zahlt monatlich 200 € Mietzuschuss (Frage 26), ein weiteres Kind wird
 * erwartet (Frage 9), eine Modernisierungsmieterhöhung ist angekündigt (Frage 27).
 * Haushaltsmitglied Nr. 6 steht auf einem Zusatzblatt direkt hinter dem Antrag.
 * Prüft: keine Befunde — mehr als 4 Haushaltsmitglieder (Zusatzblatt), Kurzarbeit,
 * Elterngeld, Zuwendung Dritter; Sammel-PDF mit mehr als 40 Seiten (Split-Grenze).
 */

const SOLL = 3150;
/** Ist-Entgelt je Monat (Kurzarbeit ab April 2026; Januar–März volles Entgelt). */
const IST: Record<string, number> = {
  '2026-01': SOLL, '2026-02': SOLL, '2026-03': SOLL,
  '2026-04': 1890, '2026-05': 1575, '2026-06': 1575, '2026-07': 1260, '2026-08': 1575,
};

const vater: Person = {
  id: 'P1', vorname: 'Ronny', nachname: 'Kretzschmar', geburtsdatum: '1985-06-04', geburtsort: 'Freital',
  staatsangehoerigkeit: 'deutsch', geschlecht: 'maennlich', familienstand: 'verheiratet', erwerb: 'Arbeitnehmer',
  einnahmen: [], // unten gesetzt (Ist-Entgelt + Kurzarbeitergeld)
  abzuege: { steuern: true, rvlv: true, kv: true },
  beschaeftigung: {
    arbeitgeber: 'Elbe Präzisionsteile GmbH', arbeitgeberAnschrift: 'Coschützer Werkstraße 9, 01189 Dresden',
    personalnummer: '30482', eintritt: '2008-09-01', steuerklasse: 'III', wochenstunden: 40, kirche: false,
  },
  ausweis: { nummer: 'L7GX3PB5N', ausgestellt: '2020-05-14', gueltigBis: '2030-05-13', behoerde: 'Landeshauptstadt Dresden', groesseCm: 180, augenfarbe: 'blau' },
};

/** Überweisung laut Abrechnung: Netto aus Ist-Entgelt + Kurzarbeitergeld (67 %, Kinder im Haushalt). */
function kug(ist: number): number {
  return ist >= SOLL ? 0 : rund2((nettoLohn(SOLL, vater, true).netto - nettoLohn(ist, vater, true).netto) * 0.67);
}
const ueberweisung = (ist: number) => rund2(nettoLohn(ist, vater, true).netto + kug(ist));

vater.einnahmen = [
  { art: 'Gehalt/Lohn (Kurzarbeit, Ist-Entgelt)', brutto: 1575, turnus: 'monatlich' },
  { art: 'Kurzarbeitergeld', brutto: kug(1575), turnus: 'monatlich' },
];

const ELTERNGELD = 780;
const KINDERGELD = 4 * 259;
const KITA = { beitrag: 186, essen: 72 };
const OMA = { vorname: 'Heidrun', nachname: 'Lehmann', anschrift: 'Meißner Straße 212, 01445 Radebeul' };

function kontoauszug(monat: string): DokSpec {
  const mm = `${monat.slice(5)}/${monat.slice(0, 4)}`;
  return {
    art: 'kontoauszug', person: 'P1', monat,
    optionen: {
      ohneGehalt: ['P1'],
      buchungen: [
        { tag: 1, text: `${OMA.vorname} ${OMA.nachname}`, zweck: `Zuschuss Miete Familie Kretzschmar ${mm}`, betrag: 200 },
        { tag: 5, text: 'Landeshauptstadt Dresden Kindertageseinrichtungen', zweck: `Elternbeitrag + Verpflegung Ben Kretzschmar ${mm}`, betrag: -(KITA.beitrag + KITA.essen) },
        { tag: 7, text: 'Bundesagentur für Arbeit - Familienkasse', zweck: `Kindergeld ${mm}`, betrag: KINDERGELD },
        { tag: 13, text: 'Landeshauptstadt Dresden Elterngeldstelle', zweck: `Elterngeld Lina Kretzschmar ${mm}`, betrag: ELTERNGELD },
        { tag: 28, text: 'Elbe Präzisionsteile GmbH', zweck: `LOHN/GEHALT ${mm} PERS.NR 30482 inkl. KUG`, betrag: ueberweisung(IST[monat]!) },
      ],
    },
  };
}

function abrechnung(monat: string): DokSpec {
  const ist = IST[monat]!;
  return ist >= SOLL
    ? { art: 'gehaltsabrechnung', person: 'P1', monat, optionen: { variante: 'normal', brutto: SOLL } }
    : { art: 'gehaltsabrechnung', person: 'P1', monat, optionen: { variante: 'kurzarbeit', brutto: SOLL, istBrutto: ist } };
}

export const F29: Fall = {
  id: 'F29',
  titel: 'Großfamilie mit 6 Personen: Kurzarbeit, Elterngeld, Zuschuss Großeltern',
  gruppe: 'D',
  antragsdatum: '2026-09-09',
  antragsart: 'erstantrag',
  behoerde: 'Landeshauptstadt Dresden\nSozialamt – Sachgebiet Wohngeld\n01001 Dresden',
  telefon: '0351 4127736',
  email: 'familie.kretzschmar@example.de',
  personen: [
    vater,
    {
      id: 'P2', vorname: 'Jana', nachname: 'Kretzschmar', geburtsname: 'Lehmann', geburtsdatum: '1990-03-15', geburtsort: 'Radebeul',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'weiblich', familienstand: 'verheiratet', erwerb: 'Nichterwerbsperson',
      verhaeltnis: 'Ehefrau', einnahmen: [{ art: 'Elterngeld (Basiselterngeld)', brutto: ELTERNGELD, turnus: 'monatlich' }],
      abzuege: { steuern: false, rvlv: false, kv: false },
      ausweis: { nummer: 'L7GW8CN2R', ausgestellt: '2019-08-27', gueltigBis: '2029-08-26', behoerde: 'Landeshauptstadt Dresden', groesseCm: 165, augenfarbe: 'grün' },
    },
    {
      id: 'P3', vorname: 'Paul', nachname: 'Kretzschmar', geburtsdatum: '2009-01-27', geburtsort: 'Dresden',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'maennlich', familienstand: 'ledig', erwerb: 'Azubi',
      verhaeltnis: 'Sohn', einnahmen: [{ art: 'Ausbildungsvergütung', brutto: 1020, turnus: 'monatlich' }],
      abzuege: { steuern: false, rvlv: true, kv: true },
      beschaeftigung: {
        arbeitgeber: 'Autohaus Elbtal GmbH', arbeitgeberAnschrift: 'Washingtonstraße 61, 01139 Dresden',
        personalnummer: 'A-219', eintritt: '2025-09-01', steuerklasse: 'I', wochenstunden: 40, kirche: false,
      },
      ausweis: { nummer: 'L7GV5TD9X', ausgestellt: '2025-02-11', gueltigBis: '2031-02-10', behoerde: 'Landeshauptstadt Dresden', groesseCm: 179, augenfarbe: 'blau' },
    },
    {
      id: 'P4', vorname: 'Emma', nachname: 'Kretzschmar', geburtsdatum: '2015-02-09', geburtsort: 'Dresden',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'weiblich', familienstand: 'ledig', erwerb: 'Nichterwerbsperson',
      verhaeltnis: 'Tochter', einnahmen: [], abzuege: { steuern: false, rvlv: false, kv: false },
    },
    {
      id: 'P5', vorname: 'Ben', nachname: 'Kretzschmar', geburtsdatum: '2021-04-30', geburtsort: 'Dresden',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'maennlich', familienstand: 'ledig', erwerb: 'Nichterwerbsperson',
      verhaeltnis: 'Sohn', einnahmen: [], abzuege: { steuern: false, rvlv: false, kv: false },
    },
    {
      id: 'P6', vorname: 'Lina', nachname: 'Kretzschmar', geburtsdatum: '2025-11-14', geburtsort: 'Dresden',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'weiblich', familienstand: 'ledig', erwerb: 'Nichterwerbsperson',
      verhaeltnis: 'Tochter', einnahmen: [], abzuege: { steuern: false, rvlv: false, kv: false },
    },
  ],
  wohnung: {
    strasse: 'Gorbitzer Hangweg', hausnummer: '23', plz: '01169', ort: 'Dresden', lage: '4. OG links',
    zimmer: 4, flaeche: 98, grundmiete: 760, nebenkosten: 215, heizkosten: 130, warmwasser: 35,
    gefoerdert: false, einzug: '2016-05-01', mietbeginn: '2016-05-01', mieteSeit: '2024-05-01',
  },
  vermieter: {
    name: 'Wohnungsgenossenschaft Elbhang Dresden eG', vertreter: 'i. A. Steffen Richter, Mitgliederservice',
    strasse: 'Kesselsdorfer Straße 140', plzOrt: '01169 Dresden', telefon: '0351 41602-0',
    iban: iban('85060144', '0006620391'), bank: 'Dresdner Volksbank West eG',
  },
  bank: { name: 'Ostsächsische Sparkasse Dresden-West', iban: iban('85050322', '0031177045'), bic: 'OSDDDE81DWS' },
  unterschrift: { antrag: true, antragDatum: true, mietvertrag: true },
  antrag: {
    haushaltAenderung: { datum: '2027-01-18', grund: 'Geburt eines weiteren Kindes erwartet (errechneter Entbindungstermin)' },
    kinderbetreuung: [{ person: 'P5', betrag: KITA.beitrag }],
    zuschussDritter: { nachname: OMA.nachname, vorname: OMA.vorname, betrag: 200, zeitraum: 'seit 01.01.2026 monatlich, unbefristet' },
    mieteAenderung: {
      richtung: 'erhoehen', wann: '2026-11-01',
      grund: 'Modernisierungsmieterhöhung (Fenstertausch), angekündigt mit Schreiben vom 11.08.2026', zukuenftig: 1198,
    },
  },
  dokumente: [
    { art: 'antrag' },
    { art: 'zusatzblatt_haushalt' },
    { art: 'personalausweis', person: 'P1' },
    { art: 'personalausweis', person: 'P2' },
    { art: 'personalausweis', person: 'P3' },
    ...Object.keys(IST).map(abrechnung),
    { art: 'gehaltsabrechnung', person: 'P3', monat: '2026-06', optionen: { variante: 'ausbildung' } },
    { art: 'gehaltsabrechnung', person: 'P3', monat: '2026-07', optionen: { variante: 'ausbildung' } },
    { art: 'gehaltsabrechnung', person: 'P3', monat: '2026-08', optionen: { variante: 'ausbildung' } },
    { art: 'elterngeldbescheid', person: 'P2', optionen: { kind: 'P6', betrag: ELTERNGELD, bezugsmonate: 12, datum: '2026-01-09' } },
    { art: 'kindergeldbescheid', person: 'P2', optionen: { kinder: ['P3', 'P4', 'P5', 'P6'] } },
    { art: 'kita_gebuehrenbescheid', person: 'P2', optionen: { kinder: ['P5'], beitrag: KITA.beitrag, essensgeld: KITA.essen, einrichtung: 'Kita Gorbitzer Spatzennest' } },
    {
      art: 'zuwendungserklaerung', person: 'P2',
      optionen: { von: OMA, verhaeltnis: 'Großmutter (Mutter von Jana Kretzschmar)', betrag: 200, seit: '2026-01-01', zahlungsweise: 'dauerauftrag', datum: '2026-09-02' },
    },
    { art: 'mietvertrag' },
    { art: 'vermieterbescheinigung' },
    kontoauszug('2026-06'),
    kontoauszug('2026-07'),
    kontoauszug('2026-08'),
  ],
  erwartung: {
    befunde: [],
    befundeOhneAppRegel: [],
    hinweise: [
      'Split: Die Sammel-PDF hat mehr als 40 Seiten — die automatische Trennung der App greift bei dieser Seitenzahl nicht; erwartet wird ein Hinweis „über 40 Seiten" bzw. manuelle Trennung.',
      '6 Haushaltsmitglieder: im Antrag P1–P5 (Seite 2/3 und Einnahmen), das 6. Mitglied (Lina, *14.11.2025) steht auf dem Zusatzblatt direkt hinter dem Antrag (App-Typ wohngeldantrag, gehört zum Antrag).',
      `Kurzarbeit ab April 2026: Soll-Entgelt ${eur(SOLL)} €, Ist-Entgelt 1.260–1.890 €; im Antrag Ist-Entgelt 1.575 € + Kurzarbeitergeld ${eur(kug(1575))} €. Abrechnungen Januar–August (Januar–März volles Entgelt).`,
      `Elterngeld ${eur(ELTERNGELD)} €/Monat für Lina (12 Lebensmonate), Kindergeld 4 × 259 € = ${eur(KINDERGELD)} € (Paul in Ausbildung), Kita-Beitrag Ben ${eur(KITA.beitrag)} € + ${eur(KITA.essen)} € Essen (Frage 14).`,
      'Frage 26: Großmutter Heidrun Lehmann zahlt seit 01.2026 monatlich 200 € Mietzuschuss per Dauerauftrag (Erklärung + Kontoauszüge).',
      'Frage 9: Geburt eines weiteren Kindes erwartet (18.01.2027); Frage 27: Mieterhöhung ab 01.11.2026 auf 1.198 € Gesamtmiete angekündigt (Vermieterbescheinigung zeigt die aktuelle Miete 1.140 €).',
    ],
  },
};
