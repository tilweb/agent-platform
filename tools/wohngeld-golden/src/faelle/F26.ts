import { iban } from '../lib';
import type { Fall } from '../types';

const HEIM_IBAN = iban('23050101', '0000772204');
const BETREUER = { vorname: 'Frank', nachname: 'Mertens' };
const TRAEGER = { name: 'Diakonische Altenhilfe Travegrund gGmbH', strasse: 'Kirchenweg 4', plzOrt: '23568 Lübeck' };

/**
 * F26 — Heimbewohnerin, 88, Pflegegrad 4 (✍ handschriftlich vom Betreuer ausgefüllt).
 * Frage 21 „Heimbewohner/in", Frage 30 Auszahlung an das Heim, Unterschrift durch
 * den rechtlichen Betreuer. Statt Mietvertrag/Vermieterbescheinigung liegt der
 * Wohn- und Betreuungsvertrag (WBVG) bei; der Eigenanteil wird per Dauerauftrag ans
 * Heim gezahlt (Rente + Umbuchung vom Sparkonto).
 * Prüft: ob die App den Heimvertrag als Wohnraumnachweis akzeptiert (fachlich
 * kein Mietvertrag/keine Vermieterbescheinigung nötig), Betreuer-Unterschrift,
 * Pflegegrad-Nachweis.
 */
export const F26: Fall = {
  id: 'F26',
  titel: 'Heimbewohnerin mit Pflegegrad 4, Betreuer unterschreibt',
  gruppe: 'D',
  antragsdatum: '2026-09-15',
  antragsart: 'erstantrag',
  behoerde: 'Hansestadt Lübeck\nBereich Soziale Sicherung – Wohngeldstelle\n23539 Lübeck',
  telefon: '0451 7093318',
  personen: [{
    id: 'P1', vorname: 'Hildegard', nachname: 'Petersen', geburtsname: 'Claußen', geburtsdatum: '1938-02-11', geburtsort: 'Bad Segeberg',
    staatsangehoerigkeit: 'deutsch', geschlecht: 'weiblich', familienstand: 'verwitwet', erwerb: 'Rentner',
    einnahmen: [{ art: 'Altersrente (Regelaltersrente)', brutto: 1480, turnus: 'monatlich' }],
    abzuege: { steuern: false, rvlv: false, kv: true },
    rente: {
      art: 'Regelaltersrente', traeger: 'Deutsche Rentenversicherung Nord',
      traegerAnschrift: 'Ziegelstraße 150, 23556 Lübeck', versicherungsnummer: '12 110238 P 508',
      brutto: 1480, rentenbeginn: '2003-03-01',
    },
  }],
  // Heimplatz: Anschrift der Einrichtung; „Miete" = monatlicher Eigenanteil laut Heimvertrag
  // (Unterkunft 657,07 + Verpflegung 331,58 + Investition 407,63 + Pflege 2.144,61 − Pflegekasse 1.855,00).
  wohnung: {
    strasse: 'Travegrund', hausnummer: '14', plz: '23568', ort: 'Lübeck', lage: 'Haus Travegrund, Wohnbereich 2, Zimmer 2.14',
    zimmer: 1, flaeche: 18.5, grundmiete: 1685.89, nebenkosten: 0, heizkosten: 0, warmwasser: 0,
    gefoerdert: false, einzug: '2026-05-01', mietbeginn: '2026-05-01', mieteSeit: '2026-05-01',
  },
  vermieter: {
    name: TRAEGER.name, vertreter: 'Einrichtungsleitung Haus Travegrund',
    strasse: TRAEGER.strasse, plzOrt: TRAEGER.plzOrt, telefon: '0451 399120',
    iban: HEIM_IBAN, bank: 'Evangelische Bank Nord eG',
  },
  bank: { name: 'Sparkasse zu Lübeck-Travemünde', iban: iban('23050303', '0001588206'), bic: 'NOLADE21LTM' },
  unterschrift: { antrag: true, antragDatum: true, mietvertrag: true },
  antrag: {
    handschrift: true,
    status: 'heim',
    schwerbehinderung: [{ person: 'P1', pflegegrad: 4, haeuslich: false }],
    zahlungAn: { nachname: TRAEGER.name, vorname: '', anschrift: `${TRAEGER.strasse}, ${TRAEGER.plzOrt}`, bank: 'Evangelische Bank Nord eG', iban: HEIM_IBAN },
    bevollmaechtigter: BETREUER,
  },
  dokumente: [
    { art: 'antrag' },
    {
      art: 'betreuerausweis', person: 'P1',
      optionen: {
        betreuer: { ...BETREUER, anschrift: 'Am Mühlenteich 5, 23552 Lübeck', beruflich: true },
        amtsgericht: 'Amtsgericht Lübeck',
        aufgabenkreise: ['Vermögenssorge', 'Vertretung gegenüber Behörden, Versicherungen und Sozialleistungsträgern', 'Wohnungs- und Heimangelegenheiten', 'Gesundheitssorge'],
        bestelltAm: '2025-11-04',
      },
    },
    {
      art: 'heimvertrag', person: 'P1',
      optionen: {
        traeger: TRAEGER, einrichtung: 'Haus Travegrund', betreuer: BETREUER,
        zimmer: 'Einzelzimmer Nr. 2.14, Wohnbereich 2', zimmerQm: 18.5, pflegegrad: 4,
        tagUnterkunft: 21.6, tagVerpflegung: 10.9, tagInvestition: 13.4, tagPflege: 70.5,
        pflegekasse: 1855, beginn: '2026-05-01',
      },
    },
    { art: 'rentenbescheid', person: 'P1' },
    { art: 'pflegebescheid', person: 'P1', optionen: { pflegegrad: 4, versorgung: 'stationaer', datum: '2026-04-16', ab: '2026-05-01' } },
    {
      art: 'kontoauszug', person: 'P1', monat: '2026-08',
      optionen: { buchungen: [{ tag: 1, text: 'Umbuchung Sparkonto', zweck: 'Übertrag Sparkonto 1588214 Heimkosten-Eigenanteil', betrag: 800 }] },
    },
  ],
  erwartung: {
    befunde: ['identitaet-jede-person'],
    befundeOhneAppRegel: [],
    hinweise: [
      'Heimbewohnerin (Frage 21): Wohnraumnachweis ist der Wohn- und Betreuungsvertrag; Mietvertrag und Vermieterbescheinigung sind fachlich NICHT zu fordern. Wohngeldrelevante Miete = Unterkunft + Investitionskosten = 1.064,70 €/Monat.',
      'Die App wird vermutlich `vermieterbescheinigung` melden (kein Dokument vom Typ mietbescheinigung) — erwartete Übermeldung. `mietvertrag` greift nicht, weil der Heimvertrag als Typ mietvertrag erwartet wird; wird er anders klassifiziert, meldet die App auch `mietvertrag`.',
      'Im Antrag ist bei Heimbewohnern keine Miete eingetragen (Seite 10 entfällt) — die App meldet deshalb voraussichtlich auch `essenzielle-angaben` (Miethöhe fehlt), fachlich ist die Miete aus dem Heimvertrag zu übernehmen.',
      'Unterschrift auf Seite 11 durch den rechtlichen Betreuer Frank Mertens (Betreuerausweis AG Lübeck, Aufgabenkreis Behörden/Vermögen), Auszahlung des Wohngelds an den Heimträger (Frage 30).',
      'Kein Personalausweis der Antragstellerin beigefügt ⇒ identitaet-jede-person (Abweichung vom Katalog, der „keine Befunde" nennt; nach Leitfaden ist ein fehlender Ausweis bei Erwachsenen ein fachlicher Befund).',
      'Pflegegrad 4 vollstationär: Pflegekassenbescheid liegt vor (pflegegrad-nachweis erfüllt).',
      'Kontoauszug August: Rente 1.297,22 € netto, Umbuchung 800 € vom Sparkonto, Dauerauftrag Eigenanteil 1.685,89 € an den Heimträger.',
    ],
  },
};
