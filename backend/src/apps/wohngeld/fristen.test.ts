import { test, expect, describe } from 'bun:test';
import { istUeberfaellig, tageBisFrist } from './fristen';

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
