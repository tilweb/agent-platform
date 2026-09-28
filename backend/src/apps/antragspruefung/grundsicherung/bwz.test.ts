import { test, expect } from 'bun:test';
import { berechneBwzVorschlag } from './bwz';

test('12 Monate ab Monatserster des Antragsmonats', () => {
  expect(berechneBwzVorschlag('2026-03-17')).toEqual({ start: '2026-03-01', ende: '2027-02-28' });
  expect(berechneBwzVorschlag('2026-01-01')).toEqual({ start: '2026-01-01', ende: '2026-12-31' });
  expect(berechneBwzVorschlag('2026-12-31')).toEqual({ start: '2026-12-01', ende: '2027-11-30' });
});

test('Schaltjahr: Ende im Februar mit 29 Tagen', () => {
  expect(berechneBwzVorschlag('2027-03-05')).toEqual({ start: '2027-03-01', ende: '2028-02-29' });
});

test('ISO-Zeitstempel wird auf den Tag reduziert', () => {
  expect(berechneBwzVorschlag('2026-07-15T23:30:00.000Z')).toEqual({ start: '2026-07-01', ende: '2027-06-30' });
});

test('ungültig oder leer → null', () => {
  expect(berechneBwzVorschlag(undefined)).toBeNull();
  expect(berechneBwzVorschlag('')).toBeNull();
  expect(berechneBwzVorschlag('15.03.2026')).toBeNull();
  expect(berechneBwzVorschlag('2026-13-01')).toBeNull();
});
