import { describe, expect, test } from 'bun:test';
import { buildWohngeldEingangProject } from '../../extraction/templates/wohngeld-eingang';
import { ABSCHNITT_ZU_TYP, abschnitteAusErgebnis, bruttokalt, mappeAbschnitt } from './dp-erkennung';

describe('Profil-Vorlage', () => {
  const p = buildWohngeldEingangProject();
  test('jeder Abschnittstyp hat eine Abbildung und eine Beschreibung', () => {
    for (const [id, def] of Object.entries(p.segments!)) {
      expect(ABSCHNITT_ZU_TYP[id]).toBeTruthy();
      expect(def.description.length).toBeGreaterThan(40);
    }
  });
  test('Antrag nicht wiederholbar, Nachweise wiederholbar', () => {
    expect(p.segments!.wohngeldantrag!.repeatable).toBeFalsy();
    expect(p.segments!.gehaltsabrechnung!.repeatable).toBe(true);
    expect(p.segments!.personalausweis!.repeatable).toBe(true);
  });
});

test('Bruttokaltmiete aus Bestandteilen', () => {
  expect(bruttokalt({ gesamtmiete: 468.5, heizkosten: 62, warmwasser: 18 })).toBe(388.5);
  expect(bruttokalt({ gesamtmiete: '877,00', heizkosten: '78,00', warmwasser: 22 })).toBe(777);
  expect(bruttokalt({})).toBeUndefined();
});

describe('Abbildung je Abschnitt', () => {
  test('Antrag → Stammdaten, Bruttokaltmiete, Konfidenzpfade', () => {
    const e = mappeAbschnitt('wohngeldantrag', {
      antragsteller_nachname: 'Kessler', antragsteller_vorname: 'Waltraud', antragsteller_geburtsdatum: '1952-03-14',
      plz: '34127', ort: 'Kassel', gesamtmiete: 468.5, heizkosten: 62, warmwasser: 18, wohnflaeche_qm: 48,
      unterschrift_vorhanden: true, datum_vorhanden: true, antragsdatum: '2026-08-18',
    }, { gesamtmiete: 0.9, antragsteller_nachname: 0.8 });
    expect(e.typ).toBe('wohngeldantrag');
    expect(e.stammdaten!.wohnung!.miete).toBe(388.5);
    expect(e.stammdaten!.antragsart).toBe('erstantrag');
    expect(e.confidenceByPfad).toEqual({ 'wohnung.miete': 0.9, nachname: 0.8 });
    expect(e.analyse.unterschrift_vorhanden).toBe(true);
  });
  test('Wohngeldnummer ⇒ Weiterleistungsantrag', () => {
    expect(mappeAbschnitt('wohngeldantrag', { wohngeldnummer: 'WG-123' }).stammdaten!.antragsart).toBe('weiterleistungsantrag');
  });
  test('Mietvertrag ohne Gesamtmiete: Grundmiete + Nebenkosten', () => {
    expect(mappeAbschnitt('mietvertrag', { grundmiete: 545, nebenkosten: 165 }).analyse.miete).toBe(710);
  });
  test('Nachweise: Typ-Abbildung, Betrag, Identität', () => {
    const e = mappeAbschnitt('lohnersatzbescheid', { nachname: 'Brandes', vorname: 'Jan', betrag: 1149.9 });
    expect(e.typ).toBe('verdienstbescheinigung');
    expect(e.analyse.betrag).toBe(1149.9);
    expect(e.identitaet).toEqual({ nachname: 'Brandes', vorname: 'Jan', geburtsdatum: undefined });
    expect(mappeAbschnitt('aufenthaltstitel', {}).typ).toBe('personalausweis');
    expect(mappeAbschnitt('kontoauszug', { mietzahlung_erkannt: false, kapitalertraege_erkannt: true }).analyse)
      .toEqual({ mietzahlung_erkannt: false, erkannte_einkuenfte: ['kapitalertraege'] });
  });
});

test('Segmentergebnis → Abschnitte (wiederholbar, Leerseite, unbekannt)', () => {
  const profil = buildWohngeldEingangProject();
  const a = abschnitteAusErgebnis({
    segments: [
      { type: 'gehaltsabrechnung', instance: 2, pageFrom: 3, pageTo: 3, confidence: 0.9 },
      { type: 'wohngeldantrag', instance: 1, pageFrom: 1, pageTo: 1, confidence: 0.95 },
      { type: 'gehaltsabrechnung', instance: 1, pageFrom: 2, pageTo: 2, confidence: 0.8 },
      { type: 'leerseite', instance: 1, pageFrom: 4, pageTo: 4, confidence: 1 },
      { type: 'unbekannt', instance: 1, pageFrom: 5, pageTo: 5, confidence: 0 },
    ],
    data: {
      wohngeldantrag: { antragsteller_nachname: 'A' },
      gehaltsabrechnung: [{ nachname: 'A', brutto: 1000 }, { nachname: 'A', brutto: 1100 }],
    },
    fieldConfidences: { 'gehaltsabrechnung[2].brutto': 0.7 },
    segmentContexts: { 'gehaltsabrechnung[2]': 'Juli' },
  }, profil);
  expect(a.map((x) => [x.seiteVon, x.typ])).toEqual([[1, 'wohngeldantrag'], [2, 'gehaltsabrechnung'], [3, 'gehaltsabrechnung'], [5, 'sonstiges']]);
  expect(a[2]!.analyse.betrag).toBe(1100);
  expect(a[2]!.text).toBe('Juli');
  expect(a[3]!.titel).toBe('Nicht erkanntes Dokument');
});
