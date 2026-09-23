import { iban } from '../lib';
import type { Fall } from '../types';

/**
 * F10 — Alleinstehende Angestellte in Würzburg. Gezielte Lücke: Mietvertrag UND
 * Vermieterbescheinigung fehlen; die Miete ist nur über Antrag und Kontoauszug belegt.
 * Prüft: Nachforderung `mietvertrag` und `vermieterbescheinigung`.
 */
export const F10: Fall = {
  id: 'F10',
  titel: 'Alleinstehende Angestellte, Mietvertrag und Vermieterbescheinigung fehlen',
  gruppe: 'B',
  antragsdatum: '2026-09-10',
  antragsart: 'erstantrag',
  behoerde: 'Stadt Würzburg\nFachbereich Soziales – Wohngeldstelle\n97067 Würzburg',
  telefon: '0931 37194480',
  email: 'm.gruenewald94@example.net',
  personen: [{
    id: 'P1', vorname: 'Melanie', nachname: 'Grünewald', geburtsdatum: '1994-02-08', geburtsort: 'Kitzingen',
    staatsangehoerigkeit: 'deutsch', geschlecht: 'weiblich', familienstand: 'ledig', erwerb: 'Arbeitnehmer',
    einnahmen: [{ art: 'Gehalt/Lohn (Teilzeit)', brutto: 1890, turnus: 'monatlich' }],
    abzuege: { steuern: true, rvlv: true, kv: true },
    beschaeftigung: {
      arbeitgeber: 'Mainfranken Buch & Papier GmbH', arbeitgeberAnschrift: 'Juliuspromenade 44, 97070 Würzburg',
      personalnummer: '0712', eintritt: '2020-10-01', steuerklasse: 'I', wochenstunden: 30, kirche: true,
    },
    ausweis: { nummer: 'L2WZ6Q9TB', ausgestellt: '2023-01-17', gueltigBis: '2033-01-16', behoerde: 'Stadt Würzburg', groesseCm: 167, augenfarbe: 'grün' },
  }],
  wohnung: {
    strasse: 'Frankfurter Straße', hausnummer: '58', plz: '97082', ort: 'Würzburg', lage: '1. OG rechts',
    zimmer: 1.5, flaeche: 41, grundmiete: 435, nebenkosten: 105, heizkosten: 58, warmwasser: 14,
    gefoerdert: false, einzug: '2022-05-01', mietbeginn: '2022-05-01', mieteSeit: '2025-05-01',
  },
  vermieter: {
    name: 'Zellerau Hausverwaltung Dietz GmbH', vertreter: 'Andrea Dietz',
    strasse: 'Weißenburgstraße 12', plzOrt: '97082 Würzburg', telefon: '0931 417730',
    iban: iban('79050011', '0042288160'), bank: 'Sparkasse Mainfranken-West',
  },
  bank: { name: 'VR-Bank Würzburg Mitte eG', iban: iban('79090011', '0002647315'), bic: 'GENODEF1WVM' },
  unterschrift: { antrag: true, antragDatum: true, mietvertrag: true },
  dokumente: [
    { art: 'antrag' },
    { art: 'personalausweis', person: 'P1' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-06' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-07' },
    { art: 'gehaltsabrechnung', person: 'P1', monat: '2026-08' },
    { art: 'kontoauszug', person: 'P1', monat: '2026-08' },
  ],
  erwartung: {
    befunde: ['mietvertrag', 'vermieterbescheinigung'],
    befundeOhneAppRegel: [],
    hinweise: [
      'Lücke: Weder Mietvertrag noch Vermieterbescheinigung liegen bei. Die Miete (612 €, Bruttokaltmiete 540 €) steht nur im Antrag und als Dauerauftrag auf dem Kontoauszug.',
      'Ohne Mietdokument kann die App Miethöhe/Wohnfläche nicht gegenprüfen — es darf kein Miet-Widerspruch gemeldet werden.',
    ],
  },
};
