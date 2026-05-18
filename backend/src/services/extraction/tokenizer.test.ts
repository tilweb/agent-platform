import { test, expect, describe } from 'bun:test';
import {
  approximateTokenCount,
  fitsInBudget,
  effectiveInputBudget,
  DEFAULT_TOKEN_BUDGET,
} from './tokenizer';

describe('approximateTokenCount', () => {
  test('zero-length text returns 0', () => {
    expect(approximateTokenCount('')).toBe(0);
  });

  test('returns ceil(length / 3.5)', () => {
    expect(approximateTokenCount('hello')).toBe(Math.ceil(5 / 3.5));      // 2
    expect(approximateTokenCount('a'.repeat(35))).toBe(10);
    expect(approximateTokenCount('a'.repeat(36))).toBe(Math.ceil(36 / 3.5)); // 11
  });

  test('handles unicode (rough heuristic, but stable)', () => {
    const text = 'Müller-Schmidt schließt einen Vertrag über 12 Seiten';
    const tokens = approximateTokenCount(text);
    expect(tokens).toBeGreaterThan(10);
    expect(tokens).toBeLessThan(20);
  });
});

describe('effectiveInputBudget', () => {
  test('default ergibt 128000 - 2000 - 4000 = 122000', () => {
    expect(effectiveInputBudget()).toBe(122000);
  });

  test('respektiert override', () => {
    expect(effectiveInputBudget({ modelContext: 256000 })).toBe(250000);
  });

  test('never returns negative', () => {
    expect(effectiveInputBudget({ modelContext: 100, systemReserve: 200 })).toBe(0);
  });
});

describe('fitsInBudget', () => {
  test('short text fits in default budget', () => {
    expect(fitsInBudget('Hello world', {})).toBe(true);
  });

  test('text > budget returns false', () => {
    // 122000 effective × 3.5 = 427000 chars, mit safetyMargin 1.15 → 371000
    const huge = 'a'.repeat(500000);
    expect(fitsInBudget(huge)).toBe(false);
  });

  test('safetyMargin verhindert Edge-Case-Pass', () => {
    // Budget exakt am Limit ohne Margin wuerde passen — mit Margin nicht.
    const charsAtLimit = 122000 * 3.5; // exakte Token-Budget-Grenze
    const text = 'a'.repeat(charsAtLimit);
    expect(fitsInBudget(text)).toBe(false);   // Margin 1.15 schiebt darueber
  });
});
