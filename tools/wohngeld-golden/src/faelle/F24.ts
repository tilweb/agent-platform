import { iban } from '../lib';
import type { Fall } from '../types';

/**
 * F24 — Studentin mit BAföG in einer Wohngemeinschaft (eigener Zimmer-Mietvertrag,
 * Küche/Bad gemeinsam). Frage 7: zwei Mitbewohner, die nicht zum Haushalt gehören.
 * Sie lebt allein in ihrem Haushalt und erhält BAföG „dem Grunde nach" ⇒
 * Ausschluss nach § 20 Abs. 2 WoGG.
 * Prüft: Ausschluss wegen Ausbildungsförderung (keine automatische App-Regel),
 * Mitbewohner-Angabe, BAföG als Einkommensnachweis.
 */
export const F24: Fall = {
  id: 'F24',
  titel: 'Studentin mit BAföG in einer WG (Ausschluss § 20 Abs. 2 WoGG)',
  gruppe: 'D',
  antragsdatum: '2026-09-14',
  antragsart: 'erstantrag',
  behoerde: 'Stadt Münster\nSozialamt – Wohngeldstelle\n48127 Münster',
  telefon: '0251 5092214',
  email: 'zofia.kowalczyk@example.com',
  personen: [{
    id: 'P1', vorname: 'Zofia', nachname: 'Kowalczyk', geburtsdatum: '2004-01-19', geburtsort: 'Dortmund',
    staatsangehoerigkeit: 'deutsch', geschlecht: 'weiblich', familienstand: 'ledig', erwerb: 'Azubi',
    einnahmen: [{ art: 'BAföG (Ausbildungsförderung)', brutto: 812, turnus: 'monatlich' }],
    abzuege: { steuern: false, rvlv: false, kv: true },
    ausweis: { nummer: 'L6MH2ZR8T', ausgestellt: '2022-03-02', gueltigBis: '2032-03-01', behoerde: 'Stadt Dortmund', groesseCm: 172, augenfarbe: 'grün' },
  }],
  wohnung: {
    strasse: 'Kanonierweg', hausnummer: '18', plz: '48151', ort: 'Münster', lage: '3. OG links, WG-Zimmer 2 (Küche und Bad gemeinschaftlich)',
    zimmer: 1, flaeche: 24, grundmiete: 330, nebenkosten: 60, heizkosten: 45, warmwasser: 10,
    gefoerdert: false, einzug: '2024-10-01', mietbeginn: '2024-10-01', mieteSeit: '2024-10-01',
  },
  vermieter: {
    name: 'Dr. Reinhild Overbeck', strasse: 'Hammer Straße 147', plzOrt: '48153 Münster', telefon: '0251 791033',
    iban: iban('40060155', '0001847729'), bank: 'Münsterländer Volksbank eG',
  },
  bank: { name: 'Sparkasse Münster-Süd', iban: iban('40050177', '0034720815'), bic: 'WELADED1MSS' },
  unterschrift: { antrag: true, antragDatum: true, mietvertrag: true },
  antrag: {
    mitbewohner: [
      { nachname: 'Brüggemann', vorname: 'Jannik' },
      { nachname: 'Aydın', vorname: 'Selin' },
    ],
  },
  dokumente: [
    { art: 'antrag' },
    { art: 'personalausweis', person: 'P1' },
    { art: 'bafoeg_bescheid', person: 'P1', optionen: { hochschule: 'Hochschule für Sozialwesen Münsterland', studiengang: 'Soziale Arbeit (B.A.)', fachsemester: 5 } },
    { art: 'mietvertrag' },
    { art: 'vermieterbescheinigung' },
    {
      art: 'kontoauszug', person: 'P1', monat: '2026-08',
      optionen: { buchungen: [{ tag: 28, text: 'Bundeskasse Studierendenwerk Münster', zweck: 'BAföG 09/2026 Förderungsnr. lt. Bescheid', betrag: 812 }] },
    },
  ],
  erwartung: {
    befunde: [],
    befundeOhneAppRegel: [
      'Ausschluss nach § 20 Abs. 2 WoGG: Die Antragstellerin lebt allein in ihrem Haushalt (Mitbewohner gehören nicht zum Haushalt) und erhält BAföG — Wohngeld ist ausgeschlossen, Ablehnung vorbereiten',
    ],
    hinweise: [
      'WG mit zwei weiteren Personen (Frage 7 „Ja"): eigener Zimmer-Mietvertrag über 24 m² (Zimmer + Anteil Gemeinschaftsfläche), Gesamtmiete 445 €.',
      'BAföG-Bescheid: 812 €/Monat, Bewilligungszeitraum 01.10.2025–30.09.2026 (Einkommensnachweis, App-Typ verdienstbescheinigung).',
      'Die App kennt den Ausschlussgrund „Ausbildungsförderung" nur, wenn die Sachbearbeitung ihn an der Person erfasst (dann ausschluss-person-transferbezug); aus BAföG-Bescheid oder Antrag leitet sie ihn nicht selbst ab.',
    ],
  },
};
