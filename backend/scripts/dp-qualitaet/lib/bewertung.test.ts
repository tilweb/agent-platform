import { describe, expect, test } from 'bun:test';
import { aggregiere, bewerteFall, bewerteFelder, bewerteSegmente, feldSchluessel } from './bewertung';
import { beurteile, kritischRichtigJeFall, rauschbandAus } from './bericht';
import type { ExtractionProject } from '../../../src/extraction/learning/types';

const flach = {
  id: 'rechnung', fields: {
    nummer: { type: 'text', required: true, label: 'Nr.' },
    betrag: { type: 'number', required: true, label: 'Betrag' },
    datum: { type: 'date', required: false, label: 'Datum' },
    positionen: { type: 'list', required: false, label: 'Pos.', item_fields: { menge: { type: 'number', label: 'Menge' }, text: { type: 'text', label: 'Text' } } },
  },
} as unknown as ExtractionProject;

const segmentiert = {
  id: 'eingang', fields: {},
  segments: {
    antrag: { label: 'Antrag', description: 'x', fields: { name: { type: 'text', required: false, label: 'Name' } } },
    lohn: { label: 'Lohn', description: 'x', repeatable: true, fields: { netto: { type: 'number', required: false, label: 'Netto' } } },
  },
} as unknown as ExtractionProject;

describe('bewerteFelder', () => {
  test('flach: typ-normalisiert, Listen als Multimenge, nur erwartete Schluessel, kritisch und sicher', () => {
    const r = bewerteFelder(flach,
      { nummer: 'R-1', betrag: 1234.5, datum: '2026-10-01', positionen: [{ menge: 2, text: 'A' }, { menge: 1, text: 'B' }] },
      { nummer: 'r-1 ', betrag: '1.234,50', datum: '01.10.2026', positionen: [{ menge: 1, text: 'B' }, { menge: 2, text: 'A' }], extra: 'x' },
      { betrag: 0.95, datum: 0.4 }, { kritische: ['betrag'], sicherAb: 0.8 });
    expect(r.felder.map((f) => [f.pfad, f.ok])).toEqual([['nummer', true], ['betrag', true], ['datum', true], ['positionen', true]]);
    expect(r.felder.find((f) => f.pfad === 'betrag')).toMatchObject({ kritisch: true, sicher: true });
    expect(r.felder.find((f) => f.pfad === 'datum')!.sicher).toBe(false);
  });

  test('Segmente: je Instanz und Feld, fehlende Instanz falsch, zusaetzliche gezaehlt', () => {
    const r = bewerteFelder(segmentiert,
      { antrag: { name: 'Kılıç' }, lohn: [{ netto: 1640 }, { netto: 1700 }] },
      { antrag: { name: 'kılıç' }, lohn: [{ netto: 1640 }, { netto: 1650 }, { netto: 99 }] },
      { 'lohn[1].netto': 0.9, 'lohn[2].netto': 0.9 }, { kritische: ['lohn[].netto'], sicherAb: 0.8 });
    expect(r.felder.map((f) => [f.pfad, f.ok])).toEqual([['antrag.name', true], ['lohn[1].netto', true], ['lohn[2].netto', false]]);
    expect(r.zusaetzlicheInstanzen).toBe(1);
    expect(r.felder.filter((f) => f.kritisch)).toHaveLength(2);
    expect(r.felder.find((f) => f.pfad === 'lohn[2].netto')).toMatchObject({ sicher: true, ok: false });
    expect(feldSchluessel('lohn[12].netto')).toBe('lohn[].netto');
  });
});

test('bewerteSegmente: Schnitte, Fehlschnitte, exakt, Typ; Leerseiten ignoriert', () => {
  const s = bewerteSegmente(
    [{ typ: 'antrag', von: 1, bis: 3 }, { typ: 'lohn', von: 5, bis: 5 }, { typ: 'lohn', von: 6, bis: 6 }],
    [
      { type: 'antrag', instance: 1, pageFrom: 1, pageTo: 3, confidence: 1 },
      { type: 'leerseite', instance: 1, pageFrom: 4, pageTo: 4, confidence: 1 },
      { type: 'lohn', instance: 1, pageFrom: 5, pageTo: 6, confidence: 1 },
      { type: 'antrag', instance: 2, pageFrom: 7, pageTo: 7, confidence: 1 },
    ]);
  expect(s).toEqual({ erwartet: 3, exakt: 1, typRichtig: 1, schnitteErwartet: 2, schnitteGefunden: 1, fehlschnitte: 1 });
});

test('aggregiere + beurteile: Rueckgang, gekipptes kritisches Feld, Ausfall, Kosten', () => {
  const fall = (id: string, betrag: unknown) => bewerteFall(flach, { id, split: 'test', erwartet: { daten: { nummer: 'R', betrag: 10 } } },
    { success: true, data: { nummer: 'R', betrag }, seiten: 2, sekunden: 10, verbrauch: { aufrufe: 2, promptTokens: 1000, completionTokens: 200, ohneAngabe: 0, modelle: {} } },
    { kritische: ['betrag'], sicherAb: 0.8 });
  const basisFaelle = [fall('a', 10), fall('b', 10)];
  const basis = { metriken: aggregiere(basisFaelle), rauschband: { felder: 0.5 }, kritischRichtig: kritischRichtigJeFall(basisFaelle) };
  expect(basis.metriken.quoten.felder).toBe(100);
  expect(basis.metriken.betrieb).toMatchObject({ sekundenJeSeite: 5, tokensJeSeite: 600, aufrufeJeSeite: 1 });

  const jetzt = [fall('a', 10), fall('b', 11)];
  const u = beurteile('rechnung', aggregiere(jetzt), jetzt, basis);
  expect(u.harte.some((h) => h.includes('felder 100 % → 75 %'))).toBe(true);
  expect(u.harte.some((h) => h.includes('rechnung/b: kritisches Feld betrag gekippt'))).toBe(true);

  const ausfall = [fall('a', 10), bewerteFall(flach, { id: 'b', split: 'test', erwartet: {} }, { success: false, error: 'Timeout', data: {}, seiten: 1, sekunden: 1 }, { kritische: [], sicherAb: 0.8 })];
  expect(beurteile('rechnung', aggregiere(ausfall), ausfall, basis).harte[0]).toContain('Ausfall');

  const teil = bewerteFall(flach, { id: 'c', split: 'test', erwartet: { daten: { nummer: 'R' } } },
    { success: true, data: {}, seiten: 4, sekunden: 1, verarbeitungsfehler: ['Seite 3: nicht lesbar (503)'] }, { kritische: [], sicherAb: 0.8 });
  expect(teil.fehler).toContain('Teilausfall (1×)');
  expect(aggregiere([teil]).ausfaelle).toBe(1);
  expect(beurteile('neu', aggregiere(basisFaelle), basisFaelle, undefined).warnungen[0]).toContain('keine Baseline');
});

test('rauschbandAus: halbe Spannweite je Quote', () => {
  const m = (felder: number) => ({ quoten: { felder, schnitte_gefunden: 98 } }) as never;
  expect(rauschbandAus([m(95), m(96), m(97)])).toEqual({ felder: 1, schnitte_gefunden: 0 });
});
