import { iban } from '../lib';
import type { Fall } from '../types';

/**
 * F04 — Rentnerehepaar in Nürnberg, Weiterleistungsantrag mit Wohngeldnummer.
 * Mietvertrag und Ausweise liegen aus dem Erstantrag in der Akte und werden nicht erneut
 * eingereicht. Prüft: Antragstyp Weiterleistung, Wohngeldnummer, zwei Renten im Haushalt,
 * und dass die App ohne Mietvertrag/Ausweise keine fachlich unnötigen Nachforderungen stellt.
 */
export const F04: Fall = {
  id: 'F04',
  titel: 'Rentnerehepaar, Weiterleistungsantrag',
  gruppe: 'A',
  antragsdatum: '2026-09-08',
  antragsart: 'weiterleistungsantrag',
  wohngeldnummer: 'WG 50.2-2025/0418 77',
  behoerde: 'Stadt Nürnberg\nSozialamt – Wohngeldstelle\n90403 Nürnberg',
  telefon: '0911 4486213',
  personen: [
    {
      id: 'P1', vorname: 'Zbigniew', nachname: 'Kowalczyk', geburtsdatum: '1956-02-17', geburtsort: 'Opole',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'maennlich', familienstand: 'verheiratet', erwerb: 'Rentner',
      einnahmen: [{ art: 'Altersrente (Regelaltersrente)', brutto: 1318.4, turnus: 'monatlich' }],
      abzuege: { steuern: false, rvlv: false, kv: true },
      rente: {
        art: 'Regelaltersrente', traeger: 'Deutsche Rentenversicherung Nordbayern',
        traegerAnschrift: 'Wittelsbacherring 11, 95444 Bayreuth', versicherungsnummer: '09 170256 K 012',
        brutto: 1318.4, rentenbeginn: '2021-07-01',
      },
    },
    {
      id: 'P2', vorname: 'Halina', nachname: 'Kowalczyk', geburtsname: 'Nowicka', geburtsdatum: '1958-08-30', geburtsort: 'Gliwice',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'weiblich', familienstand: 'verheiratet', erwerb: 'Rentner',
      verhaeltnis: 'Ehefrau', einnahmen: [{ art: 'Altersrente (Regelaltersrente)', brutto: 742.9, turnus: 'monatlich' }],
      abzuege: { steuern: false, rvlv: false, kv: true },
      rente: {
        art: 'Regelaltersrente', traeger: 'Deutsche Rentenversicherung Nordbayern',
        traegerAnschrift: 'Wittelsbacherring 11, 95444 Bayreuth', versicherungsnummer: '09 300858 N 505',
        brutto: 742.9, rentenbeginn: '2024-09-01',
      },
    },
  ],
  wohnung: {
    strasse: 'Gibitzenhofstraße', hausnummer: '203', plz: '90443', ort: 'Nürnberg', lage: '3. OG Mitte',
    zimmer: 3, flaeche: 63, grundmiete: 565, nebenkosten: 150, heizkosten: 78, warmwasser: 22,
    gefoerdert: false, einzug: '2009-05-01', mietbeginn: '2009-05-01', mieteSeit: '2025-01-01',
  },
  vermieter: {
    name: 'Frankenheim Wohnungsgesellschaft mbH', vertreter: 'i. A. Stefan Kraus, Bestandsbetreuung',
    strasse: 'Allersberger Straße 120', plzOrt: '90461 Nürnberg', telefon: '0911 945520',
    iban: iban('76050199', '0001286630'), bank: 'Sparkasse Nürnberg-Süd',
  },
  bank: { name: 'Frankenbank Nürnberg eG', iban: iban('76060611', '0002294718'), bic: 'GENODEF1FBN' },
  unterschrift: { antrag: true, antragDatum: true, mietvertrag: true },
  dokumente: [
    { art: 'antrag' },
    { art: 'rentenbescheid', person: 'P1' },
    { art: 'rentenbescheid', person: 'P2' },
    { art: 'vermieterbescheinigung' },
    { art: 'kontoauszug', person: 'P1', monat: '2026-08' },
  ],
  erwartung: {
    befunde: [],
    befundeOhneAppRegel: [],
    hinweise: [
      'Weiterleistungsantrag mit Wohngeldnummer: Mietvertrag und Personalausweise liegen aus dem Erstantrag in der Akte — fachlich keine Nachforderung.',
      'Die App-Regel „mietvertrag" feuert trotzdem (sie kennt keinen Weiterleistungsantrag); ebenso „identitaet-jede-person" für beide Eheleute. Beides sind erwartete App-Übermeldungen, keine fachlichen Befunde.',
      'Zwei Renteneingänge (DRV Nordbayern) auf dem gemeinsamen Konto; Miete 815 € (Bruttokaltmiete 715 €).',
    ],
  },
};
