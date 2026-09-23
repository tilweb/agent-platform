import { describe, expect, test } from 'bun:test';
import { isoDatum, ordneZu, splitMetrik, urteile, vergleicheFelder, werteBefundeAus, zahl } from './vergleich';

describe('Werte', () => {
  test('Zahlen deutsch/englisch', () => {
    expect(zahl('1.234,50 €')).toBe(1234.5);
    expect(zahl('388.5')).toBe(388.5);
    expect(zahl(12)).toBe(12);
    expect(zahl('abc')).toBeNull();
  });
  test('Datum', () => {
    expect(isoDatum('14.3.1952')).toBe('1952-03-14');
    expect(isoDatum('2026-08-18T00:00:00Z')).toBe('2026-08-18');
  });
  test('Urteile', () => {
    expect(urteile(388.5, '388,50')).toBe('richtig');
    expect(urteile(388.5, 400)).toBe('falsch');
    expect(urteile(388.5, null)).toBe('fehlt');
    expect(urteile(null, 12)).toBe('zuviel');
    expect(urteile(null, '')).toBe('richtig');
    expect(urteile('1952-03-14', '14.03.1952')).toBe('richtig');
    expect(urteile('Yıldız', 'YILDIZ')).toBe('richtig');
    expect(urteile('Weiß', 'Weiss')).toBe('richtig');
    expect(urteile(true, 'ja')).toBe('richtig');
    expect(urteile(false, true)).toBe('falsch');
  });
  test('Felder mit Punktpfaden', () => {
    const r = vergleicheFelder(
      { stammdaten: { 'antragsteller.nachname': 'Kessler', 'wohnung.miete': 388.5 }, analyse: { unterschrift_vorhanden: true } },
      { stammdaten: { antragsteller: { nachname: 'KESSLER' }, wohnung: {} }, analyse: { unterschrift_vorhanden: false } },
    );
    expect(r.map((x) => x.urteil)).toEqual(['richtig', 'fehlt', 'falsch']);
  });
});

describe('Split', () => {
  const erwartet = [
    { nr: 1, seiteVon: 1, seiteBis: 11, typ: 'wohngeldantrag' },
    { nr: 2, seiteVon: 12, seiteBis: 12, typ: 'personalausweis' },
    { nr: 3, seiteVon: 13, seiteBis: 13, typ: 'sonstiges', leerseite: true },
    { nr: 4, seiteVon: 14, seiteBis: 15, typ: 'mietbescheinigung' },
  ];
  test('perfekt, Leerseite am Nachbarn toleriert', () => {
    const m = splitMetrik(erwartet, [{ von: 1, bis: 11 }, { von: 12, bis: 13 }, { von: 14, bis: 15 }]);
    expect(m.fehlalarme).toBe(0);
    expect(m.verfehlt).toBe(0);
    expect(m.trefferquote).toBe(1);
    expect(m.dokumenteExakt).toBe(2); // Ausweis ist wegen angehängter Leerseite nicht exakt
  });
  test('Übertrennung und verfehlter Schnitt', () => {
    const m = splitMetrik(erwartet, [{ von: 1, bis: 5 }, { von: 6, bis: 15 }]);
    expect(m.fehlalarmSeiten).toEqual([6]);
    expect(m.verfehltSeiten).toEqual([12]);
  });
  test('Zuordnung über Überlappung', () => {
    expect(ordneZu(erwartet, [{ von: 1, bis: 12 }, { von: 13, bis: 15 }])).toEqual([0, 0, 1, 1]);
  });
});

test('Befunde', () => {
  const a = werteBefundeAus(
    ['bwz-vorschlag-pruefen', 'krankenversicherung-nachweis', 'krankenversicherung-nachweis', 'mietvertrag', 'plausi-kontoauszug-unerklaerte-einkuenfte:rente'],
    { befunde: ['plausi-miethoehe-abweichung'], standardbefunde: ['bwz-vorschlag-pruefen'], appVermutlichZusaetzlich: [{ regelId: 'krankenversicherung-nachweis' }] },
  );
  expect(a.treffer).toEqual(['bwz-vorschlag-pruefen']);
  expect(a.verfehlt).toEqual(['plausi-miethoehe-abweichung']);
  expect(a.bekannt).toEqual(['krankenversicherung-nachweis']);
  expect(a.fehlalarm).toEqual(['mietvertrag', 'plausi-kontoauszug-unerklaerte-einkuenfte']);
});
