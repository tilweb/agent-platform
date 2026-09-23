import { iban } from '../lib';
import type { Fall } from '../types';

/**
 * F02 — Ehepaar mit zwei Kindern (7 und 3 Jahre) in Leipzig. Er arbeitet Vollzeit,
 * sie hat einen Minijob, der Jüngere geht in die Kita. Referenzfall ohne Lücken.
 * Prüft: 4 Haushaltsmitglieder, Minijob-Abrechnungen (Variante minijob), Kindergeld-
 * und Kita-Gebührenbescheid, Frage 14 Kinderbetreuung, Frage 24 Heizkosten mit Betrag.
 */
export const F02: Fall = {
  id: 'F02',
  titel: 'Ehepaar mit zwei Kindern, Vollzeit und Minijob, Kita-Kosten',
  gruppe: 'A',
  antragsdatum: '2026-08-20',
  antragsart: 'erstantrag',
  behoerde: 'Stadt Leipzig\nSozialamt – Abteilung Wohngeld\n04092 Leipzig',
  telefon: '0341 8820417',
  email: 'ducanh.nguyen@example.net',
  personen: [
    {
      id: 'P1', vorname: 'Duc Anh', nachname: 'Nguyen', geburtsdatum: '1987-05-09', geburtsort: 'Leipzig',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'maennlich', familienstand: 'verheiratet', erwerb: 'Arbeitnehmer',
      einnahmen: [{ art: 'Gehalt/Lohn', brutto: 2780, turnus: 'monatlich' }],
      abzuege: { steuern: true, rvlv: true, kv: true },
      beschaeftigung: {
        arbeitgeber: 'Elstertal Logistik GmbH', arbeitgeberAnschrift: 'Radefelder Allee 31, 04158 Leipzig',
        personalnummer: '30217', eintritt: '2014-09-01', steuerklasse: 'III', wochenstunden: 40, kirche: false,
      },
      ausweis: { nummer: 'L4PT7N2VX', ausgestellt: '2021-11-03', gueltigBis: '2031-11-02', behoerde: 'Stadt Leipzig', groesseCm: 172, augenfarbe: 'braun' },
    },
    {
      id: 'P2', vorname: 'Thi Mai', nachname: 'Nguyen', geburtsname: 'Tran', geburtsdatum: '1990-12-14', geburtsort: 'Chemnitz',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'weiblich', familienstand: 'verheiratet', erwerb: 'Arbeitnehmer',
      verhaeltnis: 'Ehefrau', einnahmen: [{ art: 'Minijob (geringfügige Beschäftigung)', brutto: 520, turnus: 'monatlich' }],
      abzuege: { steuern: false, rvlv: false, kv: false },
      beschaeftigung: {
        arbeitgeber: 'Bäckerei Sonnenkorn Inh. R. Voigt', arbeitgeberAnschrift: 'Georg-Schwarz-Straße 88, 04179 Leipzig',
        personalnummer: '118', eintritt: '2024-02-01', steuerklasse: 'V', wochenstunden: 9, kirche: false,
      },
      ausweis: { nummer: 'L4PR3K8WM', ausgestellt: '2023-06-20', gueltigBis: '2033-06-19', behoerde: 'Stadt Leipzig', groesseCm: 158, augenfarbe: 'braun' },
    },
    {
      id: 'P3', vorname: 'Linh', nachname: 'Nguyen', geburtsdatum: '2019-03-27', geburtsort: 'Leipzig',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'weiblich', familienstand: 'ledig', erwerb: 'Nichterwerbsperson',
      verhaeltnis: 'Tochter', einnahmen: [], abzuege: { steuern: false, rvlv: false, kv: false },
    },
    {
      id: 'P4', vorname: 'Bao', nachname: 'Nguyen', geburtsdatum: '2023-02-11', geburtsort: 'Leipzig',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'maennlich', familienstand: 'ledig', erwerb: 'Nichterwerbsperson',
      verhaeltnis: 'Sohn', einnahmen: [], abzuege: { steuern: false, rvlv: false, kv: false },
    },
  ],
  wohnung: {
    strasse: 'Merseburger Straße', hausnummer: '147', plz: '04177', ort: 'Leipzig', lage: '2. OG rechts',
    zimmer: 4, flaeche: 86, grundmiete: 615, nebenkosten: 185, heizkosten: 110, warmwasser: 30,
    gefoerdert: false, einzug: '2020-04-01', mietbeginn: '2020-04-01', mieteSeit: '2024-04-01',
  },
  vermieter: {
    name: 'Lindenauer Wohnbau GmbH & Co. KG', vertreter: 'i. A. Carola Heinze, Vermietung',
    strasse: 'Lützner Straße 52', plzOrt: '04177 Leipzig', telefon: '0341 4926610',
    iban: iban('86055521', '0031190458'), bank: 'Sparkasse Westsachsen',
  },
  bank: { name: 'Leipziger Volksbank Mitte eG', iban: iban('86090411', '0004471902'), bic: 'GENODEF1LVM' },
  unterschrift: { antrag: true, antragDatum: true, mietvertrag: true },
  antrag: {
    kinderbetreuung: [{ person: 'P4', betrag: 185 }],
  },
  dokumente: [
    { art: 'antrag' },
    { art: 'personalausweis', person: 'P1' },
    { art: 'personalausweis', person: 'P2' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-05' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-06' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-07' },
    { art: 'gehaltsabrechnung', person: 'P2', monat: '2026-05', optionen: { variante: 'minijob' } },
    { art: 'gehaltsabrechnung', person: 'P2', monat: '2026-06', optionen: { variante: 'minijob' } },
    { art: 'gehaltsabrechnung', person: 'P2', monat: '2026-07', optionen: { variante: 'minijob' } },
    { art: 'kindergeldbescheid', person: 'P1', optionen: { aktenzeichen: '245FK318405' } },
    {
      art: 'kita_gebuehrenbescheid', person: 'P1',
      optionen: { kinder: ['P4'], beitrag: 185, essensgeld: 72, einrichtung: 'Kindertagesstätte Pusteblume Lindenau', ab: '2026-03-01' },
    },
    { art: 'mietvertrag' },
    { art: 'vermieterbescheinigung' },
    {
      art: 'kontoauszug', person: 'P1', monat: '2026-07',
      optionen: {
        // Minijob wird netto = brutto überwiesen (Generator würde sonst SV-Abzüge rechnen)
        ohneGehalt: ['P2'],
        buchungen: [
          { tag: 30, text: 'Bäckerei Sonnenkorn Inh. R. Voigt', zweck: 'LOHN 07/2026 AUSHILFE PERS.NR 118', betrag: 520 },
          { tag: 12, text: 'Familienkasse Sachsen', zweck: 'KINDERGELD 245FK318405 07/2026', betrag: 518 },
          { tag: 6, text: 'Stadt Leipzig Amt für Jugend und Familie', zweck: 'Elternbeitrag + Verpflegung 07/2026 Bao Nguyen', betrag: -257 },
        ],
      },
    },
  ],
  erwartung: {
    befunde: [],
    befundeOhneAppRegel: [],
    hinweise: [
      'Haushalt mit 4 Personen: Einkommen Lohn 2.780 € (Vollzeit) + Minijob 520 € (netto = brutto); Kindergeld 2 × 259 € auf dem Kontoauszug.',
      'Frage 14: Kinderbetreuung 185 € monatlich für Bao — deckungsgleich mit dem Kita-Gebührenbescheid (Verpflegungsentgelt 72 € separat).',
      'Kita-Gebührenbescheid ist kein App-Nachweistyp (sonstiges); er stützt Frage 14.',
      'Katalog nennt „Kontoauszug teilweise geschwärzt" — vom Generator nicht umsetzbar, daher ungeschwärzt.',
    ],
  },
};
