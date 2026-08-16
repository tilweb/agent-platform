/**
 * Phase-4 Lagebild: aggregiert die Telemetrie-Zeilen zu Verfahren/Event-Zählern,
 * Verbrauch (Züge/USD/Budget-Ampel), letztem Gold-Lauf und Tresor-Funden.
 */
import { test, expect, describe } from 'bun:test';
import { lagebild, type TelemetrieZeile } from './lagebild';

const zeilen: TelemetrieZeile[] = [
  { verfahren: 'lvar', event: 'extract', data: null, createdAt: '2026-08-16T08:00:00Z' },
  { verfahren: 'gold', event: 'gold-run', data: { pass: false }, createdAt: '2026-08-16T08:01:00Z' },
  { verfahren: 'gold', event: 'gold-run', data: { pass: true }, createdAt: '2026-08-16T09:00:00Z' },
  { verfahren: 'tresor', event: 'redact', data: { funde: 2 }, createdAt: '2026-08-16T09:05:00Z' },
  { verfahren: 'verbrauch', event: 'benotung', data: { zuege: 3, tokens: 120000, usd: 40 }, createdAt: '2026-08-16T09:10:00Z' },
  { verfahren: 'verbrauch', event: 'narrativ', data: { zuege: 1, tokens: 30000, usd: 35 }, createdAt: '2026-08-16T09:20:00Z' },
];

describe('Lagebild', () => {
  const l = lagebild(zeilen, 150);

  test('zählt Ereignisse je Verfahren + Event', () => {
    expect(l.gesamt).toBe(6);
    expect(l.jeVerfahren.gold).toBe(2);
    expect(l.jeVerfahren.verbrauch).toBe(2);
    expect(l.jeEvent['gold-run']).toBe(2);
  });

  test('Verbrauch summiert Züge + USD; Budget-Ampel greift', () => {
    expect(l.verbrauch.zuege).toBe(4);
    expect(l.verbrauch.usd).toBe(75);            // 40 + 35
    expect(l.verbrauch.budgetStufe).toBe('hinweis'); // 75/150 = 50 %
  });

  test('jüngster Gold-Lauf gewinnt (PASS 09:00 nach FAIL 08:01)', () => {
    expect(l.letzterGold?.pass).toBe(true);
    expect(l.letzterGold?.datum).toBe('2026-08-16T09:00:00Z');
  });

  test('Tresor-Funde summiert', () => {
    expect(l.tresorFunde).toBe(2);
  });

  test('Lage-Zeile trägt die Kernzahlen', () => {
    expect(l.zeile).toContain('75 USD');
    expect(l.zeile).toContain('Gold PASS');
    expect(l.zeile).toContain('Tresor-Fund');
  });

  test('leere Telemetrie → leeres, kein Crash', () => {
    const leer = lagebild([]);
    expect(leer.gesamt).toBe(0);
    expect(leer.verbrauch.zuege).toBe(0);
    expect(leer.letzterGold).toBeUndefined();
  });
});
