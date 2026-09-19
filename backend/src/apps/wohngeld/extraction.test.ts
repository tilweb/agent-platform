import { test, expect, describe } from 'bun:test';
import { parseExtraktion } from './extraction';

describe('parseExtraktion — valides JSON', () => {
  test('Wohngeldantrag mit Analyse + Stammdaten', () => {
    const raw = JSON.stringify({
      typ: 'wohngeldantrag',
      titel: 'Antrag auf Wohngeld',
      analyse: { unterschrift_vorhanden: true, datum_vorhanden: true, miete: 620.5 },
      stammdaten: {
        antragsdatum: '2026-09-01',
        wohngeldart: 'mietzuschuss',
        antragsart: 'erstantrag',
        antragsteller: { vorname: 'Erika', nachname: 'Mustermann', geburtsdatum: '1960-05-12' },
        adresse: { strasse: 'Hauptstr.', hausnummer: '5', plz: '12345', ort: 'Musterstadt' },
        wohnung: { miete: 620.5, wohnflaeche_qm: 55 },
      },
    });
    const r = parseExtraktion(raw);
    expect(r.typ).toBe('wohngeldantrag');
    expect(r.titel).toBe('Antrag auf Wohngeld');
    expect(r.analyse.unterschrift_vorhanden).toBe(true);
    expect(r.analyse.miete).toBe(620.5);
    expect(r.stammdaten?.wohngeldart).toBe('mietzuschuss');
    expect(r.stammdaten?.antragsteller?.nachname).toBe('Mustermann');
    expect(r.stammdaten?.wohnung?.wohnflaeche_qm).toBe(55);
  });

  test('Kontoauszug mit erkannten Einkünften', () => {
    const r = parseExtraktion('{"typ":"kontoauszug","analyse":{"mietzahlung_erkannt":true,"erkannte_einkuenfte":["kapitalertraege"]}}');
    expect(r.typ).toBe('kontoauszug');
    expect(r.analyse.mietzahlung_erkannt).toBe(true);
    expect(r.analyse.erkannte_einkuenfte).toEqual(['kapitalertraege']);
  });

  test('deutsche Zahlenformate werden normalisiert', () => {
    const r = parseExtraktion('{"typ":"mietvertrag","analyse":{"miete":"1.234,56","wohnflaeche_qm":"72,5"}}');
    expect(r.analyse.miete).toBeCloseTo(1234.56, 2);
    expect(r.analyse.wohnflaeche_qm).toBeCloseTo(72.5, 2);
  });
});

describe('parseExtraktion — JSON mit Fließtext drumherum', () => {
  test('extrahiert das JSON-Objekt aus umgebendem Text', () => {
    const raw = 'Hier ist das Ergebnis:\n```json\n{"typ":"rentenbescheid","analyse":{"rentenart_vorhanden":true,"betrag":1450}}\n```\nDanke.';
    const r = parseExtraktion(raw);
    expect(r.typ).toBe('rentenbescheid');
    expect(r.analyse.rentenart_vorhanden).toBe(true);
    expect(r.analyse.betrag).toBe(1450);
  });
});

describe('parseExtraktion — Fallback', () => {
  test('kaputtes JSON → sonstiges + leere Analyse', () => {
    const r = parseExtraktion('{ typ: kontoauszug, das ist kein json ');
    expect(r.typ).toBe('sonstiges');
    expect(r.analyse).toEqual({});
    expect(r.stammdaten).toBeUndefined();
  });

  test('leerer String → Fallback', () => {
    const r = parseExtraktion('');
    expect(r.typ).toBe('sonstiges');
    expect(r.analyse).toEqual({});
  });

  test('kein JSON-Objekt im Text → Fallback', () => {
    const r = parseExtraktion('Ich konnte das Dokument nicht klassifizieren.');
    expect(r.typ).toBe('sonstiges');
  });
});

describe('parseExtraktion — unbekannter typ', () => {
  test('unbekannter typ → sonstiges, Analyse bleibt erhalten', () => {
    const r = parseExtraktion('{"typ":"steuerbescheid","analyse":{"betrag":99}}');
    expect(r.typ).toBe('sonstiges');
    expect(r.analyse.betrag).toBe(99);
  });

  test('fehlender typ → sonstiges', () => {
    const r = parseExtraktion('{"analyse":{}}');
    expect(r.typ).toBe('sonstiges');
  });

  test('ungültige Enum-Werte in Stammdaten werden verworfen', () => {
    const r = parseExtraktion('{"typ":"wohngeldantrag","stammdaten":{"wohngeldart":"quatsch","antragsart":"erstantrag"}}');
    expect(r.stammdaten?.wohngeldart).toBeUndefined();
    expect(r.stammdaten?.antragsart).toBe('erstantrag');
  });
});
