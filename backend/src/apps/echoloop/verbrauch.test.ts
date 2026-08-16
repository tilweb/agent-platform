/**
 * /verbrauch: Kostenformel (4 Felder × Preistabelle), Aggregation, Kontext-
 * Wiederholungs-Anteil, Budget-Ampel (50/80/100 %) und Kontext-Wächter (400/600/800k).
 */
import { test, expect, describe } from 'bun:test';
import { kosten, kontext, summe, budgetStufe, kontextWaechter, PREISE, type ZugVerbrauch } from './verbrauch';

const z = (model: string, i: number, cr: number, cw: number, out: number): ZugVerbrauch =>
  ({ model, in: i, cr, cw, out });

describe('/verbrauch · Kostenformel', () => {
  test('Haiku: 1 Mio in + 1 Mio out = 1 + 5 = 6 USD', () => {
    expect(kosten(z('claude-haiku-4-5-20251001', 1e6, 0, 0, 1e6))).toBeCloseTo(6.0, 6);
  });
  test('Sonnet: 1 Mio in + 1 Mio out = 3 + 15 = 18 USD', () => {
    expect(kosten(z('claude-sonnet-5', 1e6, 0, 0, 1e6))).toBeCloseTo(18.0, 6);
  });
  test('cache_read wiegt ~10 % des Eingabepreises (Opus: 1 Mio cr = 1,50 USD)', () => {
    expect(kosten(z('claude-opus-5', 0, 1e6, 0, 0))).toBeCloseTo(1.5, 6);
  });
  test('unbekanntes Modell → _default (Opus-Preise)', () => {
    expect(kosten(z('qwen3-5-a3b-35b-256k', 1e6, 0, 0, 0))).toBeCloseTo(PREISE._default!.in, 6);
  });
  test('kontext = in + cr + cw', () => {
    expect(kontext(z('x', 100, 200, 300, 999))).toBe(600);
  });
});

describe('/verbrauch · Aggregation', () => {
  const s = summe([
    z('claude-haiku-4-5-20251001', 100_000, 900_000, 0, 10_000),
    z('claude-sonnet-5', 50_000, 50_000, 0, 5_000),
  ]);
  test('summiert Felder + Züge + je Modell', () => {
    expect(s.zuege).toBe(2);
    expect(s.in).toBe(150_000);
    expect(s.cr).toBe(950_000);
    expect(Object.keys(s.jeModell).sort()).toEqual(['claude-haiku-4-5-20251001', 'claude-sonnet-5']);
  });
  test('Kontext-Wiederholungs-Anteil = cr / (in+cr+cw)', () => {
    // 950k / (150k+950k+0) = 950/1100 ≈ 86,4 %
    expect(s.wiederholAnteil).toBeCloseTo(86.4, 1);
  });
  test('Züge über 600k Kontext werden gezählt', () => {
    // Zug 1 Kontext = 1.000.000 > 600k → 1
    expect(s.ueber600k).toBe(1);
  });
});

describe('/verbrauch · Budget-Ampel + Kontext-Wächter', () => {
  test('Budget-Stufen 50/80/100 % (Default 150 USD)', () => {
    expect(budgetStufe(10)).toBe('ok');
    expect(budgetStufe(75)).toBe('hinweis');   // 50 %
    expect(budgetStufe(120)).toBe('warnung');  // 80 %
    expect(budgetStufe(150)).toBe('stopp');    // 100 %
  });
  test('Kontext-Wächter-Schwellen 400/600/800k je Zug', () => {
    expect(kontextWaechter(300_000)).toBe('ok');
    expect(kontextWaechter(400_000)).toBe('warn');
    expect(kontextWaechter(600_000)).toBe('halt');
    expect(kontextWaechter(800_000)).toBe('schnitt');
  });
});
