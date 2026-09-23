import { iban } from '../lib';
import type { Fall } from '../types';

/**
 * F16 — Geschiedener Vater zahlt Kindesunterhalt für die Tochter aus erster Ehe (lebt
 * bei der Mutter in Gotha); neue Lebensgefährtin im Haushalt, beide Arbeitnehmer.
 * Frage 16 = Ja und Anlage Unterhaltsverpflichtungen ausgefüllt — aber KEIN
 * Zahlungsnachweis/Titel; auch der Kontoauszug zeigt keine Unterhaltsüberweisung.
 * Geprüft wird: Unterhaltsabzug (§ 18 WoGG) ohne Beleg — keine App-Regel.
 */
export const F16: Fall = {
  id: 'F16',
  titel: 'Geschiedener Vater zahlt Unterhalt, Zahlungsnachweis fehlt',
  gruppe: 'B',
  antragsdatum: '2026-08-27',
  antragsart: 'erstantrag',
  behoerde: 'Landeshauptstadt Erfurt\nAmt für Soziales – Wohngeldstelle\n99111 Erfurt',
  telefon: '0361 6559210',
  personen: [
    {
      id: 'P1', vorname: 'Steffen', nachname: 'Kühn', geburtsdatum: '1982-08-30', geburtsort: 'Gotha',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'maennlich', familienstand: 'geschieden', erwerb: 'Arbeitnehmer',
      einnahmen: [{ art: 'Gehalt/Lohn', brutto: 2290, turnus: 'monatlich' }],
      abzuege: { steuern: true, rvlv: true, kv: true },
      beschaeftigung: {
        arbeitgeber: 'Thüringer Glas- und Fassadenbau Linderbach GmbH', arbeitgeberAnschrift: 'Am Wiesenhügel 12, 99094 Erfurt',
        personalnummer: '1473', eintritt: '2016-03-01', steuerklasse: 'I', wochenstunden: 40, kirche: false,
      },
      ausweis: { nummer: 'L8RC5K3VW', ausgestellt: '2021-09-06', gueltigBis: '2031-09-05', behoerde: 'Stadt Erfurt', groesseCm: 186, augenfarbe: 'grau' },
    },
    {
      id: 'P2', vorname: 'Anja', nachname: 'Wendt', geburtsdatum: '1987-01-12', geburtsort: 'Weimar',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'weiblich', familienstand: 'ledig', erwerb: 'Arbeitnehmer',
      verhaeltnis: 'Lebensgefährtin', einnahmen: [{ art: 'Gehalt/Lohn (Teilzeit)', brutto: 980, turnus: 'monatlich' }],
      abzuege: { steuern: true, rvlv: true, kv: true },
      beschaeftigung: {
        arbeitgeber: 'Bäckerei Hohmann & Tochter OHG', arbeitgeberAnschrift: 'Magdeburger Allee 150, 99086 Erfurt',
        personalnummer: '62', eintritt: '2023-01-15', steuerklasse: 'I', wochenstunden: 17, kirche: true,
      },
      ausweis: { nummer: 'L8RF1N6TX', ausgestellt: '2022-11-21', gueltigBis: '2032-11-20', behoerde: 'Stadt Erfurt', groesseCm: 169, augenfarbe: 'blau' },
    },
  ],
  wohnung: {
    strasse: 'Ringelbergstraße', hausnummer: '22', plz: '99085', ort: 'Erfurt', lage: '3. OG links',
    zimmer: 3, flaeche: 69, grundmiete: 520, nebenkosten: 150, heizkosten: 85, warmwasser: 20,
    gefoerdert: false, einzug: '2024-05-01', mietbeginn: '2024-05-01', mieteSeit: '2024-05-01',
  },
  vermieter: {
    name: 'Wohnungsbau Erfurt-Nord GmbH', vertreter: 'i. A. Katja Brömel, Mieterservice',
    strasse: 'Stauffenbergallee 71', plzOrt: '99085 Erfurt', telefon: '0361 74021-0',
    iban: iban('82050099', '0001302299'), bank: 'Sparkasse Mittelthüringen-Nord',
  },
  bank: { name: 'Erfurter Bank Domplatz eG', iban: iban('82064199', '0000938114'), bic: 'ERFBDE8EXXX' },
  unterschrift: { antrag: true, antragDatum: true, mietvertrag: true },
  antrag: {
    unterhaltGezahlt: [{
      zahler: 'P1',
      fuer: { nachname: 'Kühn', vorname: 'Lena', geburtsdatum: '2014-02-18', anschrift: 'Birkenweg 5, 99867 Gotha' },
      verwandt: 'Tochter', betrag: 579,
    }],
  },
  dokumente: [
    { art: 'antrag' },
    { art: 'unterhaltsanlage' },
    { art: 'personalausweis', person: 'P1' },
    { art: 'personalausweis', person: 'P2' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-05' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-06' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-07' },
    { art: 'gehaltsabrechnung', person: 'P2', monat: '2026-05' },
    { art: 'gehaltsabrechnung', person: 'P2', monat: '2026-06' },
    { art: 'gehaltsabrechnung', person: 'P2', monat: '2026-07' },
    { art: 'mietvertrag' },
    { art: 'vermieterbescheinigung' },
    { art: 'kontoauszug', person: 'P1', monat: '2026-07' },
  ],
  erwartung: {
    befunde: [],
    befundeOhneAppRegel: ['Nachweis der Unterhaltszahlung für Lena Kühn fehlt (Titel/Jugendamtsurkunde und Zahlungsbelege) — nur Frage 16 und Anlage Unterhalt ausgefüllt'],
    hinweise: [
      'Frage 16 und Anlage Unterhaltsverpflichtungen: 579,00 € monatlich an die Tochter Lena (geb. 18.02.2014, lebt bei der Mutter in Gotha).',
      'Der Kontoauszug Juli 2026 (Gehaltskonto Steffen Kühn) zeigt KEINE Unterhaltsüberweisung — die Zahlung ist nirgends belegt.',
      'Die Anlage Unterhalt ist Typ unterhaltsnachweis, belegt aber nur die Angabe, nicht die Zahlung. Mietvertrag und Konto laufen nur auf Steffen Kühn (Lebensgefährtin nicht Mitmieterin).',
    ],
  },
};
