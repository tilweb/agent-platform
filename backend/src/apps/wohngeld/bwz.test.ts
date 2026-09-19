import { test, expect, describe } from 'bun:test';
import { berechneBwzVorschlag, fmtDe } from './bwz';

describe('BWZ-Vorschlag (§ 22/§ 25) — 12 Monate ab Antragsmonat', () => {
  test('Mitte des Monats → erster Tag des Antragsmonats bis Monatsende +11 Monate', () => {
    expect(berechneBwzVorschlag('2026-08-12')).toEqual({ start: '2026-08-01', ende: '2027-07-31' });
  });
  test('Januar-Antrag', () => {
    expect(berechneBwzVorschlag('2026-01-05')).toEqual({ start: '2026-01-01', ende: '2026-12-31' });
  });
  test('Februar (Schaltjahr-Grenze im Endmonat unkritisch, da Januar-Ende)', () => {
    expect(berechneBwzVorschlag('2026-02-28')).toEqual({ start: '2026-02-01', ende: '2027-01-31' });
  });
  test('Dezember-Antrag rollt ins Folgejahr', () => {
    expect(berechneBwzVorschlag('2026-12-20')).toEqual({ start: '2026-12-01', ende: '2027-11-30' });
  });
  test('leeres/ungültiges Datum → null', () => {
    expect(berechneBwzVorschlag(undefined)).toBeNull();
    expect(berechneBwzVorschlag('kein-datum')).toBeNull();
  });
});

describe('fmtDe', () => {
  test('ISO → TT.MM.JJJJ', () => {
    expect(fmtDe('2026-08-01')).toBe('01.08.2026');
  });
  test('leer → leerer String', () => {
    expect(fmtDe(undefined)).toBe('');
  });
});
