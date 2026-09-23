import { iban } from '../lib';
import type { Fall } from '../types';

/**
 * F11 — Ehepaar nach abgelehntem Bürgergeld-Antrag. Er bezieht Arbeitslosengeld I,
 * sie arbeitet in Teilzeit. Das Jobcenter hat den Bürgergeld-Antrag abgelehnt
 * (Einkommen knapp über dem Bedarf) und zur Wohngeld-Antragstellung aufgefordert
 * (Frage 10 mit Ablehnungsdatum, Frage 11 = Ja).
 * Geprüft wird: Es liegt KEIN Kontoauszug bei ⇒ Nachweis der Mietzahlung fehlt.
 */
export const F11: Fall = {
  id: 'F11',
  titel: 'Ehepaar nach abgelehntem Bürgergeld, Jobcenter fordert Wohngeld-Antrag',
  gruppe: 'B',
  antragsdatum: '2026-08-14',
  antragsart: 'erstantrag',
  behoerde: 'Stadt Dortmund\nSozialamt – Wohngeldstelle\n44122 Dortmund',
  telefon: '0231 7744190',
  personen: [
    {
      id: 'P1', vorname: 'Kevin', nachname: 'Brandes', geburtsdatum: '1985-04-22', geburtsort: 'Dortmund',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'maennlich', familienstand: 'verheiratet', erwerb: 'Arbeitslos',
      einnahmen: [{ art: 'Arbeitslosengeld I', brutto: 1149.9, turnus: 'monatlich' }],
      abzuege: { steuern: false, rvlv: false, kv: false },
      ausweis: { nummer: 'L9TC3R7XK', ausgestellt: '2020-11-03', gueltigBis: '2030-11-02', behoerde: 'Stadt Dortmund', groesseCm: 178, augenfarbe: 'grau' },
    },
    {
      id: 'P2', vorname: 'Jasmin', nachname: 'Brandes', geburtsname: 'Ahrens', geburtsdatum: '1988-09-03', geburtsort: 'Lünen',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'weiblich', familienstand: 'verheiratet', erwerb: 'Arbeitnehmer',
      verhaeltnis: 'Ehefrau', einnahmen: [{ art: 'Gehalt/Lohn (Teilzeit)', brutto: 1256, turnus: 'monatlich' }],
      abzuege: { steuern: true, rvlv: true, kv: true },
      beschaeftigung: {
        arbeitgeber: 'Rosen-Apotheke Hörde e.K.', arbeitgeberAnschrift: 'Clarenberger Weg 14, 44263 Dortmund',
        personalnummer: '0117', eintritt: '2018-02-01', steuerklasse: 'IV', wochenstunden: 20, kirche: false,
      },
      ausweis: { nummer: 'L9TD8M2WN', ausgestellt: '2022-04-19', gueltigBis: '2032-04-18', behoerde: 'Stadt Dortmund', groesseCm: 165, augenfarbe: 'braun' },
    },
  ],
  wohnung: {
    strasse: 'Kolberger Weg', hausnummer: '9', plz: '44141', ort: 'Dortmund', lage: '2. OG links',
    zimmer: 3, flaeche: 64, grundmiete: 470, nebenkosten: 150, heizkosten: 85, warmwasser: 20,
    gefoerdert: false, einzug: '2017-09-01', mietbeginn: '2017-09-01', mieteSeit: '2024-03-01',
  },
  vermieter: {
    name: 'Westfalen Wohnbau Dortmund-Ost GmbH', vertreter: 'i. A. Carsten Möllmann, Kundenbetreuung',
    strasse: 'Hansemannweg 30', plzOrt: '44135 Dortmund', telefon: '0231 5582-0',
    iban: iban('44050211', '0003318420'), bank: 'Stadtsparkasse Dortmund-Ost',
  },
  bank: { name: 'Dortmunder Volksbank Süd eG', iban: iban('44160211', '0004410973'), bic: 'GENODEM1DOS' },
  unterschrift: { antrag: true, antragDatum: true, mietvertrag: true },
  antrag: {
    transfer: [{ person: 'P1', leistung: 'Bürgergeld (SGB II)', beantragt: '2026-06-08', abgelehnt: '2026-07-06' }],
    aufforderungTransferbehoerde: true,
  },
  dokumente: [
    { art: 'antrag' },
    { art: 'personalausweis', person: 'P1' },
    { art: 'personalausweis', person: 'P2' },
    { art: 'alg1_bescheid', person: 'P1', optionen: { von: '2026-05-01', leistungssatz: 38.33, datum: '2026-05-12' } },
    { art: 'gehaltsabrechnung', person: 'P2', monat: '2026-05' },
    { art: 'gehaltsabrechnung', person: 'P2', monat: '2026-06' },
    { art: 'gehaltsabrechnung', person: 'P2', monat: '2026-07' },
    { art: 'jobcenter_ablehnung', person: 'P1', optionen: { antragVom: '2026-06-08', datum: '2026-07-06' } },
    { art: 'jobcenter_aufforderung', person: 'P1', optionen: { datum: '2026-07-09', frist: '2026-08-31' } },
    { art: 'mietvertrag' },
    { art: 'vermieterbescheinigung' },
  ],
  erwartung: {
    befunde: ['mietzahlungsnachweis'],
    befundeOhneAppRegel: [],
    hinweise: [
      'Kein Kontoauszug in der Sendung ⇒ Nachweis der aktuellen Mietzahlung fehlt (mietzahlungsnachweis).',
      'plausi-mietzahlung-fehlt (Katalog) setzt einen Kontoauszug OHNE Mietbuchung voraus und kann ohne Kontoauszug nicht feuern — fachlich ist es derselbe Mangel, daher nicht zusätzlich erwartet.',
      'Frage 10: Bürgergeld beantragt 08.06.2026, abgelehnt 06.07.2026 (innerhalb von 2 Monaten vor Antrag) ⇒ kein Ausschluss nach § 7 WoGG; Frage 11 = Ja (Aufforderung Jobcenter nach § 12a SGB II vom 09.07.2026).',
      'Arbeitslosengeld-Bescheid (Leistungssatz 38,33 €/Tag = 1.149,90 €/Monat) ist Einkommensnachweis von Kevin Brandes (Typ verdienstbescheinigung); Jobcenter-Aufforderung ist Typ sonstiges.',
    ],
  },
};
