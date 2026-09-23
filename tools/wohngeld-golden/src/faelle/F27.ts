import { iban } from '../lib';
import type { Fall } from '../types';

const EHEFRAU = { vorname: 'Christa', nachname: 'Pöllmann', geburtsname: 'Hierl', geburtsdatum: '1960-08-22', geburtsort: 'Straubing' };
const STERBEDATUM = '2026-04-06';

/**
 * F27 — Witwer, die Ehefrau ist vor fünf Monaten verstorben. Frage 8 (verstorbenes
 * Haushaltsmitglied) und Frage 18 (einmalige Einnahme: Sterbegeld der Sterbekasse)
 * sind mit „Ja" beantwortet; laufendes Einkommen ist die große Witwerrente.
 * Belegt durch Sterbeurkunde, Rentenanpassungsmitteilung (Rentenart „Große
 * Witwerrente") und Sterbegeld-Mitteilung. Vollständig und stimmig.
 * Prüft: keine Befunde — Erkennung Sterbeurkunde/Sterbegeld (Typ sonstiges),
 * Rentenart Witwerrente, Haushaltsänderung durch Tod.
 */
export const F27: Fall = {
  id: 'F27',
  titel: 'Witwer, Ehefrau vor 5 Monaten verstorben, Sterbegeld',
  gruppe: 'D',
  antragsdatum: '2026-09-08',
  antragsart: 'erstantrag',
  behoerde: 'Stadt Regensburg\nAmt für Soziales – Wohngeldstelle\n93047 Regensburg',
  telefon: '0941 6402271',
  personen: [{
    id: 'P1', vorname: 'Josef', nachname: 'Pöllmann', geburtsdatum: '1963-03-02', geburtsort: 'Kelheim',
    staatsangehoerigkeit: 'deutsch', geschlecht: 'maennlich', familienstand: 'verwitwet', erwerb: 'Rentner',
    einnahmen: [{ art: 'Witwerrente (große Witwerrente)', brutto: 1182.5, turnus: 'monatlich' }],
    abzuege: { steuern: false, rvlv: false, kv: true },
    rente: {
      art: 'Große Witwerrente', traeger: 'Deutsche Rentenversicherung Bayern Süd',
      traegerAnschrift: 'Am Alten Viehmarkt 2, 84028 Landshut', versicherungsnummer: '13 220860 H 024',
      brutto: 1182.5, rentenbeginn: '2026-04-07',
    },
    ausweis: { nummer: 'L1WQ6RT3K', ausgestellt: '2018-06-19', gueltigBis: '2028-06-18', behoerde: 'Stadt Regensburg', groesseCm: 178, augenfarbe: 'braun' },
  }],
  wohnung: {
    strasse: 'Brandlberger Anger', hausnummer: '6', plz: '93057', ort: 'Regensburg', lage: 'EG links',
    zimmer: 2, flaeche: 58, grundmiete: 520, nebenkosten: 115, heizkosten: 70, warmwasser: 15,
    gefoerdert: false, einzug: '2009-10-01', mietbeginn: '2009-10-01', mieteSeit: '2023-10-01',
  },
  vermieter: {
    name: 'Donaupark Immobilienverwaltung GmbH', vertreter: 'i. A. Martina Schwarzfischer',
    strasse: 'Nordgaustraße 31', plzOrt: '93059 Regensburg', telefon: '0941 29933-0',
    iban: iban('75060150', '0002271935'), bank: 'Regensburger Volksbank Nord eG',
  },
  bank: { name: 'Sparkasse Regensburg-Oberpfalz', iban: iban('75050011', '0008442917'), bic: 'BYLADEM1ROP' },
  unterschrift: { antrag: true, antragDatum: true, mietvertrag: true },
  antrag: {
    verstorben: { nachname: EHEFRAU.nachname, vorname: EHEFRAU.vorname, datum: STERBEDATUM, transfer: false, umgezogen: false },
    einmalig: [{ person: 'P1', art: 'Sterbegeld (Sterbekasse)', betrag: 3280, datum: '2026-04-30' }],
  },
  dokumente: [
    { art: 'antrag' },
    { art: 'personalausweis', person: 'P1' },
    {
      art: 'sterbeurkunde', person: 'P1',
      optionen: {
        verstorben: { ...EHEFRAU, sterbedatum: STERBEDATUM, sterbeort: 'Regensburg' },
        standesamt: 'Standesamt Regensburg', ausgestellt: '2026-04-10',
      },
    },
    { art: 'rentenbescheid', person: 'P1' },
    {
      art: 'sterbegeld_mitteilung', person: 'P1',
      optionen: { verstorbenName: `${EHEFRAU.vorname} ${EHEFRAU.nachname}`, sterbedatum: STERBEDATUM, betrag: 3280, auszahlung: '2026-04-30', datum: '2026-04-28' },
    },
    { art: 'mietvertrag' },
    { art: 'vermieterbescheinigung' },
    { art: 'kontoauszug', person: 'P1', monat: '2026-08' },
  ],
  erwartung: {
    befunde: [],
    befundeOhneAppRegel: [],
    hinweise: [
      'Ehefrau Christa Pöllmann am 06.04.2026 verstorben (Frage 8 „Ja", kein Transferbezug, kein Umzug); Haushalt seither 1 Person.',
      'Laufendes Einkommen: große Witwerrente 1.182,50 € brutto seit 07.04.2026 (Rentenanpassungsmitteilung nennt Rentenart „Große Witwerrente").',
      'Frage 18: Sterbegeld der Sterbekasse 3.280,00 €, ausgezahlt am 30.04.2026 — Sterbegeld-Mitteilung bestätigt Betrag und Datum.',
      'Sterbeurkunde und Sterbegeld-Mitteilung sind App-Typ sonstiges; es gibt keine Regel, die sie verlangt.',
    ],
  },
};
