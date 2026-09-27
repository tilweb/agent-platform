import { test, expect, describe } from 'bun:test';
import { istUeberfaellig, tageBisFrist, plusTage, addJahre } from './datum';

describe('istUeberfaellig', () => {
  test('Frist vor heute → überfällig', () => {
    expect(istUeberfaellig('2026-09-10', '2026-09-19')).toBe(true);
  });
  test('Frist == heute → nicht überfällig', () => {
    expect(istUeberfaellig('2026-09-19', '2026-09-19')).toBe(false);
  });
  test('Frist nach heute → nicht überfällig', () => {
    expect(istUeberfaellig('2026-09-25', '2026-09-19')).toBe(false);
  });
  test('ISO mit Zeitanteil wird auf Tag reduziert', () => {
    expect(istUeberfaellig('2026-09-18T23:59:59.000Z', '2026-09-19')).toBe(true);
    expect(istUeberfaellig('2026-09-19T00:00:00.000Z', '2026-09-19')).toBe(false);
  });
  test('fehlende/ungültige Frist → false', () => {
    expect(istUeberfaellig(undefined, '2026-09-19')).toBe(false);
    expect(istUeberfaellig('kein-datum', '2026-09-19')).toBe(false);
  });
});

describe('tageBisFrist', () => {
  test('Frist in der Zukunft → positiv', () => {
    expect(tageBisFrist('2026-09-25', '2026-09-19')).toBe(6);
  });
  test('Frist heute → 0', () => {
    expect(tageBisFrist('2026-09-19', '2026-09-19')).toBe(0);
  });
  test('überfällig → negativ', () => {
    expect(tageBisFrist('2026-09-10', '2026-09-19')).toBe(-9);
  });
  test('über Monatsgrenze', () => {
    expect(tageBisFrist('2026-10-01', '2026-09-19')).toBe(12);
  });
  test('fehlende/ungültige Frist → NaN', () => {
    expect(tageBisFrist(undefined, '2026-09-19')).toBeNaN();
    expect(tageBisFrist('kein-datum', '2026-09-19')).toBeNaN();
  });
});

describe('plusTage', () => {
  test('addiert Tage über Monatsgrenzen', () => {
    expect(plusTage('2026-09-28', 3)).toBe('2026-10-01');
    expect(plusTage('2026-09-19T12:00:00.000Z', 0)).toBe('2026-09-19');
  });
  test('ungültiges/leeres Datum → undefined', () => {
    expect(plusTage(undefined, 3)).toBeUndefined();
    expect(plusTage('kein-datum', 3)).toBeUndefined();
  });
});

describe('addJahre', () => {
  test('addiert Jahre auf ein Datum', () => {
    expect(addJahre('2026-09-19', 10)).toBe('2036-09-19');
    expect(addJahre('2026-09-19', 2)).toBe('2028-09-19');
  });
  test('29.02. wird in Nicht-Schaltjahren auf 28.02. gekappt', () => {
    // 2024 ist Schaltjahr, 2034 nicht.
    expect(addJahre('2024-02-29', 10)).toBe('2034-02-28');
    // Zieljahr Schaltjahr → bleibt 29.02.
    expect(addJahre('2024-02-29', 4)).toBe('2028-02-29');
  });
});
