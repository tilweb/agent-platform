/**
 * Antrag-Kern — Aufbewahrung mit App-Konfiguration (statt Umgebung).
 */
import { test, expect } from 'bun:test';
import { createAufbewahrung, istLoeschfaellig } from './aufbewahrung';

test('Konfiguration bestimmt Abschluss-Status und Fristen', () => {
  let jahre = 5;
  const a = createAufbewahrung({ jahre: () => jahre, jahreAbgelehnt: 1, abschlussStatus: ['erledigt'] });
  expect(a.istAbschlussStatus('erledigt')).toBe(true);
  expect(a.istAbschlussStatus('offen')).toBe(false);
  expect(a.aufbewahrungJahreDefault()).toBe(5);
  expect(a.aufbewahrungJahreAbgelehnt()).toBe(1);
  expect(a.berechneAufbewahrungBis('erledigt', '2026-09-19')).toBe('2031-09-19');
  jahre = 7; // Getter wird bei jedem Aufruf gelesen
  expect(a.berechneAufbewahrungBis('erledigt', '2026-09-19')).toBe('2033-09-19');
  expect(a.berechneAufbewahrungBis('erledigt', '2026-09-19', a.aufbewahrungJahreAbgelehnt())).toBe('2027-09-19');
  expect(a.berechneAufbewahrungBis('offen', '2026-09-19')).toBeUndefined();
  expect(a.berechneAufbewahrungBis('erledigt', undefined)).toBeUndefined();
});

test('istLoeschfaellig: strukturell, strikt vor heute, Legal Hold sperrt', () => {
  expect(istLoeschfaellig({ aufbewahrungBis: '2026-09-10' }, '2026-09-19')).toBe(true);
  expect(istLoeschfaellig({ aufbewahrungBis: '2026-09-19' }, '2026-09-19')).toBe(false);
  expect(istLoeschfaellig({ aufbewahrungBis: '2020-01-01', legalHold: true }, '2026-09-19')).toBe(false);
  expect(istLoeschfaellig({}, '2026-09-19')).toBe(false);
  expect(istLoeschfaellig(null, '2026-09-19')).toBe(false);
});
