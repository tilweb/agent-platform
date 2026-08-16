/**
 * /wertfehler-Assembly: strukturiert die W-Befunde (PM-W-a/b/c) entlang der
 * 6-Stationen-Kette, führt W2/W3 als stehende Panel-Fragen, trägt den Methoden-
 * Kern (letzten beweisbar richtigen Punkt finden).
 */
import { test, expect, describe } from 'bun:test';
import { wertfehlerAnalyse, W_MUSTER } from './wertfehler';
import type { PMFinding } from './types';

const f = (pm: string, prozessNr = '1', schrittId?: number): PMFinding => ({
  pm, aspekt: pm, prozessNr, schrittId, befund: '', beleg: '', provenienz: '[G Text]',
  schwere: 'mittel', empfehlung: '', dimensionen: ['D6b'], beobachtend: true,
});

describe('/wertfehler · Assembly', () => {
  const a = wertfehlerAnalyse([f('PM-W-c', '213'), f('PM-W-a', '210', 8), f('PM-01', '2'), f('PM-W-b', '213')]);

  test('nur W-Muster als statische Befunde', () => {
    expect(a.statischeBefunde.map((x) => x.pm).sort()).toEqual(['PM-W-a', 'PM-W-b', 'PM-W-c']);
    expect(a.statischeBefunde.some((x) => x.pm === 'PM-01')).toBe(false);
  });

  test('6 Stationen; PM-W-b/c an Ablage (3), PM-W-a an Übertragung (5)', () => {
    expect(a.stationen).toHaveLength(6);
    const ablage = a.stationen.find((s) => s.nr === 3)!;
    const uebertragung = a.stationen.find((s) => s.nr === 5)!;
    expect(ablage.befunde.map((x) => x.pm).sort()).toEqual(['PM-W-b', 'PM-W-c']);
    expect(uebertragung.befunde.map((x) => x.pm)).toEqual(['PM-W-a']);
  });

  test('W2/W3 als stehende Panel-Fragen; Methoden-Kern gesetzt', () => {
    expect(a.panelFragen.join(' ')).toContain('W2');
    expect(a.panelFragen.join(' ')).toContain('W3');
    expect(a.methodenHinweis).toContain('letzten beweisbar richtigen Punkt');
  });

  test('W_MUSTER enthält genau die drei statischen W-Checker', () => {
    expect([...W_MUSTER].sort()).toEqual(['PM-W-a', 'PM-W-b', 'PM-W-c']);
  });

  test('leere Eingabe → leere Befunde, Stationen dennoch da', () => {
    const leer = wertfehlerAnalyse([]);
    expect(leer.statischeBefunde).toHaveLength(0);
    expect(leer.stationen).toHaveLength(6);
    expect(leer.panelFragen.length).toBeGreaterThan(0);
  });
});
