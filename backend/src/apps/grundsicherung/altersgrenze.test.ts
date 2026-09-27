import { describe, expect, test } from 'bun:test';
import {
  altersgrenzeErreichtAm, altersgrenzeFuerJahrgang, altersgrenzeImMonatErreicht, altersgrenzeMonat, fmtAltersgrenze,
} from './altersgrenze';

describe('altersgrenzeFuerJahrgang — Tabelle § 41 Abs. 2 SGB XII', () => {
  const tabelle: Array<[number, number, number]> = [
    [1930, 65, 0], [1946, 65, 0],
    [1947, 65, 1], [1948, 65, 2], [1949, 65, 3], [1950, 65, 4], [1951, 65, 5], [1952, 65, 6],
    [1953, 65, 7], [1954, 65, 8], [1955, 65, 9], [1956, 65, 10], [1957, 65, 11],
    [1958, 66, 0],
    [1959, 66, 2], [1960, 66, 4], [1961, 66, 6], [1962, 66, 8], [1963, 66, 10],
    [1964, 67, 0], [1970, 67, 0], [1990, 67, 0],
  ];
  for (const [jahrgang, jahre, monate] of tabelle) {
    test(`Jahrgang ${jahrgang} → ${jahre} J. ${monate} M.`, () => {
      expect(altersgrenzeFuerJahrgang(jahrgang)).toEqual({ jahre, monate });
    });
  }
});

describe('altersgrenzeErreichtAm — tagesgenau (§ 187 Abs. 2, § 188 Abs. 2/3 BGB)', () => {
  test('vor 1947: 65. Geburtstag minus 1 Tag', () => {
    expect(altersgrenzeErreichtAm('1946-12-31')).toBe('2011-12-30');
    expect(altersgrenzeErreichtAm('1940-06-15')).toBe('2005-06-14');
  });
  test('Grenzjahrgang 1947 (+1 Monat)', () => {
    expect(altersgrenzeErreichtAm('1947-01-01')).toBe('2012-01-31');
    expect(altersgrenzeErreichtAm('1947-12-15')).toBe('2013-01-14'); // Monatsüberlauf ins Folgejahr
  });
  test('Jahrgang 1957 (+11) und 1958 (+12 = 66 Jahre)', () => {
    expect(altersgrenzeErreichtAm('1957-02-10')).toBe('2023-01-09');
    expect(altersgrenzeErreichtAm('1958-05-20')).toBe('2024-05-19');
  });
  test('Grenzjahrgang 1959 (+14 = 66 J. 2 M.)', () => {
    expect(altersgrenzeErreichtAm('1959-11-10')).toBe('2026-01-09');
  });
  test('Katalogbeispiel geb. 03.1960 → 07.2026', () => {
    expect(altersgrenzeMonat('1960-03-15')).toBe('2026-07');
    expect(altersgrenzeErreichtAm('1960-03-15')).toBe('2026-07-14');
  });
  test('Geburt am Monatsersten: Altersgrenze schon im Vormonat erreicht', () => {
    expect(altersgrenzeErreichtAm('1960-08-01')).toBe('2026-11-30');
    expect(altersgrenzeMonat('1960-08-01')).toBe('2026-11');
    expect(altersgrenzeErreichtAm('1964-01-01')).toBe('2030-12-31');
  });
  test('Jahrgang 1963 (+22 = 66 J. 10 M.) und 1964 (67 J.)', () => {
    expect(altersgrenzeErreichtAm('1963-06-15')).toBe('2030-04-14');
    expect(altersgrenzeErreichtAm('1964-06-15')).toBe('2031-06-14');
  });
  test('fehlender Monatstag → letzter Tag des Monats (§ 188 Abs. 3 BGB)', () => {
    // 31.05.1960 + 66 J. 4 M. → 31.09.2026 existiert nicht → 30.09.2026
    expect(altersgrenzeErreichtAm('1960-05-31')).toBe('2026-09-30');
    // 29.02.1960 + 66 J. 4 M. → 29.06.2026 existiert → Vortag
    expect(altersgrenzeErreichtAm('1960-02-29')).toBe('2026-06-28');
    // 29.02.1964 + 67 J. → 29.02.2031 existiert nicht → 28.02.2031
    expect(altersgrenzeErreichtAm('1964-02-29')).toBe('2031-02-28');
    // 30.10.1961 + 66 J. 6 M. → 30.04.2028 existiert → 29.04.2028
    expect(altersgrenzeErreichtAm('1961-10-30')).toBe('2028-04-29');
    // 31.08.1962 + 66 J. 8 M. → 31.04.2029 fehlt → 30.04.2029
    expect(altersgrenzeErreichtAm('1962-08-31')).toBe('2029-04-30');
  });
  test('ungültig/leer → null', () => {
    expect(altersgrenzeErreichtAm(undefined)).toBeNull();
    expect(altersgrenzeErreichtAm('')).toBeNull();
    expect(altersgrenzeErreichtAm('15.03.1960')).toBeNull();
    expect(altersgrenzeErreichtAm('1960-13-01')).toBeNull();
  });
  test('ISO-Zeitstempel wird auf den Tag gekürzt', () => {
    expect(altersgrenzeErreichtAm('1960-03-15T00:00:00.000Z')).toBe('2026-07-14');
  });
});

describe('altersgrenzeImMonatErreicht (§ 44 Abs. 2 SGB XII)', () => {
  test('im Antragsmonat erreicht → true, auch wenn Tag nach Antragsdatum', () => {
    expect(altersgrenzeImMonatErreicht('1960-03-15', '2026-07-01')).toBe(true);
  });
  test('Folgemonat → false', () => {
    expect(altersgrenzeImMonatErreicht('1960-03-15', '2026-06-30')).toBe(false);
  });
  test('fehlende Daten → null', () => {
    expect(altersgrenzeImMonatErreicht(undefined, '2026-06-30')).toBeNull();
    expect(altersgrenzeImMonatErreicht('1960-03-15', undefined)).toBeNull();
  });
});

test('fmtAltersgrenze', () => {
  expect(fmtAltersgrenze({ jahre: 66, monate: 4 })).toBe('66 Jahre 4 Monate');
  expect(fmtAltersgrenze({ jahre: 65, monate: 1 })).toBe('65 Jahre 1 Monat');
  expect(fmtAltersgrenze({ jahre: 67, monate: 0 })).toBe('67 Jahre');
});
