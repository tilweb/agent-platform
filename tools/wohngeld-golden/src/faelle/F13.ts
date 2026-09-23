import { iban } from '../lib';
import type { Fall } from '../types';

/**
 * F13 — Unverheiratetes Paar, beide Arbeitnehmer; Antrag handschriftlich ausgefüllt.
 * Im Antrag bewusst leer: Geburtsdatum der Lebensgefährtin, Wohnfläche und
 * Gesamtmiete (Frage 22/23). Nachweise vollständig, sie zeigen die tatsächlichen Werte.
 * Geprüft wird: Erkennen fehlender Pflichtangaben (Miethöhe ⇒ essenzielle-angaben)
 * und Handschrift-Extraktion.
 */
export const F13: Fall = {
  id: 'F13',
  titel: 'Paar, beide Arbeitnehmer, Pflichtangaben im Antrag leer (Handschrift)',
  gruppe: 'B',
  antragsdatum: '2026-08-21',
  antragsart: 'erstantrag',
  behoerde: 'Stadt Chemnitz\nSozialamt – Wohngeldstelle\n09106 Chemnitz',
  telefon: '0371 3398145',
  personen: [
    {
      id: 'P1', vorname: 'Ronny', nachname: 'Lehmann', geburtsdatum: '1979-12-05', geburtsort: 'Karl-Marx-Stadt',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'maennlich', familienstand: 'ledig', erwerb: 'Arbeitnehmer',
      einnahmen: [{ art: 'Gehalt/Lohn', brutto: 2050, turnus: 'monatlich' }],
      abzuege: { steuern: true, rvlv: true, kv: true },
      beschaeftigung: {
        arbeitgeber: 'Erzgebirgs-Logistik Kappel GmbH', arbeitgeberAnschrift: 'Neefestraße 201, 09119 Chemnitz',
        personalnummer: '5520', eintritt: '2015-05-04', steuerklasse: 'I', wochenstunden: 40, kirche: false,
      },
      ausweis: { nummer: 'L6PR2X9TM', ausgestellt: '2019-08-14', gueltigBis: '2029-08-13', behoerde: 'Stadt Chemnitz', groesseCm: 183, augenfarbe: 'blau' },
    },
    {
      id: 'P2', vorname: 'Mandy', nachname: 'Richter', geburtsdatum: '1983-07-30', geburtsort: 'Zwickau',
      staatsangehoerigkeit: 'deutsch', geschlecht: 'weiblich', familienstand: 'ledig', erwerb: 'Arbeitnehmer',
      verhaeltnis: 'Lebensgefährtin', einnahmen: [{ art: 'Gehalt/Lohn (Teilzeit)', brutto: 1180, turnus: 'monatlich' }],
      abzuege: { steuern: true, rvlv: true, kv: true },
      beschaeftigung: {
        arbeitgeber: 'Pflegedienst Sonnenberg gGmbH', arbeitgeberAnschrift: 'Fürstenstraße 77, 09130 Chemnitz',
        personalnummer: '208', eintritt: '2020-10-01', steuerklasse: 'I', wochenstunden: 24, kirche: false,
      },
      ausweis: { nummer: 'L6PT7C4VK', ausgestellt: '2024-01-09', gueltigBis: '2034-01-08', behoerde: 'Stadt Chemnitz', groesseCm: 161, augenfarbe: 'grün' },
    },
  ],
  wohnung: {
    strasse: 'Zeisigwaldstraße', hausnummer: '46', plz: '09130', ort: 'Chemnitz', lage: '1. OG Mitte',
    zimmer: 3, flaeche: 68, grundmiete: 390, nebenkosten: 140, heizkosten: 80, warmwasser: 20,
    gefoerdert: false, einzug: '2022-04-01', mietbeginn: '2022-04-01', mieteSeit: '2022-04-01',
  },
  vermieter: {
    name: 'Chemnitzer Wohnungsgenossenschaft Sonnenberg eG', vertreter: 'i. A. Heike Pfüller, Vermietung',
    strasse: 'Hainstraße 120', plzOrt: '09130 Chemnitz', telefon: '0371 40506-0',
    iban: iban('87050099', '0003501127'), bank: 'Sparkasse Chemnitz-Nord',
  },
  bank: { name: 'Volksbank Mittleres Erzgebirge eG', iban: iban('87096199', '0001182740'), bic: 'GENODEF1MEZ' },
  unterschrift: { antrag: true, antragDatum: true, mietvertrag: true },
  antrag: {
    handschrift: true,
    leer: ['P2.geburtsdatum', 'flaeche', 'gesamtmiete'],
  },
  dokumente: [
    { art: 'antrag' },
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
    befunde: ['essenzielle-angaben'],
    befundeOhneAppRegel: [
      'Geburtsdatum des 2. Haushaltsmitglieds (Mandy Richter) fehlt im Antrag (Frage 6)',
      'Wohnfläche fehlt im Antrag (Frage 22)',
    ],
    hinweise: [
      'Antragsseite 10: Wohnfläche und Gesamtmiete leer ⇒ Miethöhe fehlt (essenzielle-angaben). Mietvertrag/Vermieterbescheinigung/Kontoauszug zeigen 68 m² und 630,00 € Gesamtmiete (Bruttokaltmiete 530,00 €).',
      'Da Miete und Fläche im Antrag fehlen, sind plausi-miethoehe-abweichung und plausi-wohnflaeche-abweichung NICHT zu erwarten.',
      'Geburtsdatum der Lebensgefährtin fehlt nur im Antrag; der Personalausweis enthält es (30.07.1983). Mietvertrag und Kontoauszug laufen nur auf Ronny Lehmann.',
    ],
  },
};
