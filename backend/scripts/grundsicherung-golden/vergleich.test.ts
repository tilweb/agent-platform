import { describe, expect, test } from 'bun:test';
import { gleich, holePfad, ordneZu, splitMetrik } from './vergleich';

describe('Grundsicherung-Golden — Vergleich', () => {
  const erg = { stammdaten: { personen: [{ rolle: 'antragsteller', einkommen: [{ art: 'altersrente', betrag_monat: 780 }] }] } };

  test('Pfad mit Listen-Auswahl', () => {
    expect(holePfad(erg, 'stammdaten.personen[rolle=antragsteller].einkommen[art=altersrente].betrag_monat')).toBe(780);
    expect(holePfad(erg, 'stammdaten.personen[rolle=partner]')).toBeUndefined();
  });

  test('Vergleich: Zahl mit Toleranz, null = fehlt, Namenslisten ohne Reihenfolge', () => {
    expect(gleich(780, '780,00')).toBe(true);
    expect(gleich(780, 780.5)).toBe(false);
    expect(gleich(null, undefined)).toBe(true);
    expect(gleich(null, [])).toBe(true);
    expect(gleich(null, 650)).toBe(false);
    expect(gleich(['Klaus Berger', 'Sabine Berger'], ['sabine berger', 'Klaus Berger'])).toBe(true);
    expect(gleich([], [])).toBe(true);
    expect(gleich('Müller', 'MUELLER')).toBe(true);
  });

  test('Zuordnung: exakter Bereich vor Überlappung; Split-Metrik', () => {
    const soll = [{ von: 1, bis: 8, typ: 'a' }, { von: 9, bis: 9, typ: 'b' }, { von: 10, bis: 12, typ: 'c' }];
    const ist = [{ von: 1, bis: 9, typ: 'a' }, { von: 10, bis: 12, typ: 'c' }];
    expect(ordneZu(soll, ist)).toEqual([0, -1, 1]);
    expect(splitMetrik(soll, ist)).toEqual({ erwarteteSchnitte: 2, treffer: 1, fehlschnitte: 0, verfehlt: [9], zusaetzlich: [] });
  });
});
