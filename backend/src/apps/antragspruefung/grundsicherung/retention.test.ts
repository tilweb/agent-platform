import { test, expect, afterEach } from 'bun:test';
import { aufbewahrungsPatch, aufbewahrungJahreDefault, aufbewahrungJahreAbgelehnt } from './retention';

afterEach(() => {
  delete process.env.GRUNDSICHERUNG_AUFBEWAHRUNG_JAHRE;
  delete process.env.GRUNDSICHERUNG_AUFBEWAHRUNG_ABGELEHNT_JAHRE;
});

test('Defaults 10/2 Jahre, per Env überschreibbar', () => {
  expect(aufbewahrungJahreDefault()).toBe(10);
  expect(aufbewahrungJahreAbgelehnt()).toBe(2);
  process.env.GRUNDSICHERUNG_AUFBEWAHRUNG_JAHRE = '6';
  expect(aufbewahrungJahreDefault()).toBe(6);
});

test('Abschluss setzt Frist, Ablehnung/Rücknahme kürzer, nie überschreiben', () => {
  const heute = '2026-09-27T10:00:00.000Z';
  expect(aufbewahrungsPatch({ status: 'sachbearbeitung' }, { status: 'abgeschlossen' }, heute)).toEqual({ aufbewahrungBis: '2036-09-27' });
  expect(aufbewahrungsPatch({ status: 'sachbearbeitung' }, { status: 'entscheidung', abschluss: { ergebnis: 'abgelehnt' } }, heute)).toEqual({ aufbewahrungBis: '2028-09-27' });
  expect(aufbewahrungsPatch({ status: 'entscheidung', abschluss: { ergebnis: 'zurueckgenommen' } }, { status: 'abgeschlossen' }, heute)).toEqual({ aufbewahrungBis: '2028-09-27' });
  expect(aufbewahrungsPatch({ status: 'entscheidung', aufbewahrungBis: '2030-01-01' }, { status: 'abgeschlossen' }, heute)).toEqual({});
  expect(aufbewahrungsPatch({ status: 'posteingang' }, { status: 'sachbearbeitung' }, heute)).toEqual({});
});
