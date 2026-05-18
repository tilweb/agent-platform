/**
 * Tests fuer den LLM-Timeout-Wrapper.
 *
 * Race-Pattern, kein echtes Abort — wir koennen nur garantieren, dass der
 * Aufrufer nicht laenger als `timeoutMs` blockiert. Der LLM-Request laeuft
 * im Hintergrund weiter und wird ggf. ge-garbaged.
 *
 * Run: `cd backend && bun test src/apps/projektmanagement/llm-utils.test.ts`
 */

import { test, expect, describe } from 'bun:test';
import { withLlmTimeout, LlmTimeoutError } from './llm-utils';

describe('withLlmTimeout', () => {
  test('schnelle Promise → Wert wird durchgereicht', async () => {
    const result = await withLlmTimeout(Promise.resolve('ok'), 'test', 100);
    expect(result).toBe('ok');
  });

  test('langsame Promise → LlmTimeoutError', async () => {
    const slow = new Promise((resolve) => setTimeout(() => resolve('zu spät'), 200));
    try {
      await withLlmTimeout(slow, 'slow_call', 50);
      throw new Error('Sollte abgelaufen sein');
    } catch (err) {
      expect(err).toBeInstanceOf(LlmTimeoutError);
      expect((err as LlmTimeoutError).label).toBe('slow_call');
      expect((err as LlmTimeoutError).timeoutMs).toBe(50);
    }
  });

  test('rejected Promise → Original-Error wird durchgereicht', async () => {
    const failing = Promise.reject(new Error('LLM exploded'));
    try {
      await withLlmTimeout(failing, 'bang', 1000);
      throw new Error('Sollte rejected sein');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toBe('LLM exploded');
      expect(err).not.toBeInstanceOf(LlmTimeoutError);
    }
  });

  test('Default-Timeout = 30 Sekunden', async () => {
    // Indirekt verifizierbar: ein Aufruf der schnell zurückkommt, soll auch
    // ohne explizites Timeout funktionieren.
    const result = await withLlmTimeout(Promise.resolve(42), 'default');
    expect(result).toBe(42);
  });
});

describe('LlmTimeoutError', () => {
  test('Properties werden gesetzt', () => {
    const err = new LlmTimeoutError('my_call', 5000);
    expect(err.label).toBe('my_call');
    expect(err.timeoutMs).toBe(5000);
    expect(err.name).toBe('LlmTimeoutError');
    expect(err.message).toContain('5000ms');
    expect(err.message).toContain('my_call');
  });

  test('ist eine echte Error-Subklasse', () => {
    const err = new LlmTimeoutError('x', 1);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(LlmTimeoutError);
  });
});
