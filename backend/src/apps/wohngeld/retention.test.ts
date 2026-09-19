/**
 * GOV-5 — Tests für die reinen Retention-Helfer (berechneAufbewahrungBis /
 * istLoeschfaellig / addJahre / istAbschlussStatus). Kein I/O, kein DB.
 */
import { test, expect, describe } from 'bun:test';
import {
  berechneAufbewahrungBis, istLoeschfaellig, addJahre, istAbschlussStatus,
} from './retention';

describe('istAbschlussStatus', () => {
  test('abgeschlossen + entscheidung sind Abschluss-Status', () => {
    expect(istAbschlussStatus('abgeschlossen')).toBe(true);
    expect(istAbschlussStatus('entscheidung')).toBe(true);
  });
  test('laufende Status sind kein Abschluss', () => {
    expect(istAbschlussStatus('posteingang')).toBe(false);
    expect(istAbschlussStatus('sachbearbeitung')).toBe(false);
    expect(istAbschlussStatus(undefined)).toBe(false);
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

describe('berechneAufbewahrungBis', () => {
  test('Abschluss → Stichtag + Standardfrist (10 J.)', () => {
    expect(berechneAufbewahrungBis('abgeschlossen', 'erstantrag', '2026-09-19T12:00:00.000Z', 10)).toBe('2036-09-19');
    expect(berechneAufbewahrungBis('entscheidung', 'erstantrag', '2026-09-19', 10)).toBe('2036-09-19');
  });
  test('kürzere Frist wird durchgereicht (abgelehnt → 2 J.)', () => {
    expect(berechneAufbewahrungBis('entscheidung', 'erstantrag', '2026-09-19', 2)).toBe('2028-09-19');
  });
  test('ohne jahre → ENV-Default (10 J.)', () => {
    // ohne gesetzte ENV greift der Default 10
    expect(berechneAufbewahrungBis('abgeschlossen', 'erstantrag', '2026-09-19')).toBe('2036-09-19');
  });
  test('laufender Status → keine Frist', () => {
    expect(berechneAufbewahrungBis('sachbearbeitung', 'erstantrag', '2026-09-19', 10)).toBeUndefined();
    expect(berechneAufbewahrungBis('posteingang', 'erstantrag', '2026-09-19', 10)).toBeUndefined();
  });
  test('fehlender/ungültiger Stichtag → keine Frist', () => {
    expect(berechneAufbewahrungBis('abgeschlossen', 'erstantrag', undefined, 10)).toBeUndefined();
    expect(berechneAufbewahrungBis('abgeschlossen', 'erstantrag', 'kein-datum', 10)).toBeUndefined();
  });
});

describe('istLoeschfaellig', () => {
  test('Frist vor heute + kein Legal Hold → löschfällig', () => {
    expect(istLoeschfaellig({ aufbewahrungBis: '2026-09-10' }, '2026-09-19')).toBe(true);
  });
  test('Frist == heute → noch nicht löschfällig (strikt <)', () => {
    expect(istLoeschfaellig({ aufbewahrungBis: '2026-09-19' }, '2026-09-19')).toBe(false);
  });
  test('Frist in der Zukunft → nicht löschfällig', () => {
    expect(istLoeschfaellig({ aufbewahrungBis: '2036-09-19' }, '2026-09-19')).toBe(false);
  });
  test('Legal Hold verhindert Löschfälligkeit', () => {
    expect(istLoeschfaellig({ aufbewahrungBis: '2020-01-01', legalHold: true }, '2026-09-19')).toBe(false);
  });
  test('ohne gesetzte Frist → nicht löschfällig', () => {
    expect(istLoeschfaellig({}, '2026-09-19')).toBe(false);
    expect(istLoeschfaellig(null, '2026-09-19')).toBe(false);
  });
});
