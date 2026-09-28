import { test, expect, describe } from 'bun:test';
import {
  sha256Hex, sha256HexString, envelopeHash,
  uebergangErlaubt, istTerminal, darfAuswerten, darfZuordnen,
} from './zustand';

describe('Dedupe-Hash', () => {
  test('sha256Hex ist deterministisch und gleich für gleiche Bytes', () => {
    const a = new TextEncoder().encode('hallo welt');
    const b = new TextEncoder().encode('hallo welt');
    expect(sha256Hex(a)).toBe(sha256Hex(b));
    expect(sha256Hex(a)).toMatch(/^[0-9a-f]{64}$/);
  });

  test('unterschiedliche Bytes → unterschiedlicher Hash', () => {
    expect(sha256Hex(new TextEncoder().encode('a'))).not.toBe(sha256Hex(new TextEncoder().encode('b')));
  });

  test('envelopeHash ist reihenfolge-unabhängig (Doppel-Scan derselben Sendung)', () => {
    expect(envelopeHash(['h1', 'h2', 'h3'])).toBe(envelopeHash(['h3', 'h1', 'h2']));
  });

  test('envelopeHash unterscheidet abweichende Umschläge', () => {
    expect(envelopeHash(['h1', 'h2'])).not.toBe(envelopeHash(['h1', 'h2', 'h3']));
  });

  test('sha256HexString für idempotencyKey ist stabil', () => {
    expect(sha256HexString('scan-2026-0001')).toBe(sha256HexString('scan-2026-0001'));
  });
});

describe('Zustandsautomat', () => {
  test('erlaubte Übergänge', () => {
    expect(uebergangErlaubt('eingegangen', 'in_analyse')).toBe(true);
    expect(uebergangErlaubt('in_analyse', 'analysiert')).toBe(true);
    expect(uebergangErlaubt('in_analyse', 'fehler')).toBe(true);
    expect(uebergangErlaubt('analysiert', 'zugeordnet')).toBe(true);
    expect(uebergangErlaubt('analysiert', 'in_analyse')).toBe(true); // Neu auswerten
    expect(uebergangErlaubt('eingegangen', 'verworfen')).toBe(true);
    expect(uebergangErlaubt('fehler', 'in_analyse')).toBe(true);
  });

  test('unerlaubte Übergänge', () => {
    expect(uebergangErlaubt('eingegangen', 'zugeordnet')).toBe(false);
    expect(uebergangErlaubt('zugeordnet', 'in_analyse')).toBe(false);
    expect(uebergangErlaubt('verworfen', 'analysiert')).toBe(false);
    expect(uebergangErlaubt('analysiert', 'fehler')).toBe(false);
  });

  test('Terminal-Status', () => {
    expect(istTerminal('zugeordnet')).toBe(true);
    expect(istTerminal('verworfen')).toBe(true);
    expect(istTerminal('eingegangen')).toBe(false);
    expect(istTerminal('analysiert')).toBe(false);
  });

  test('darfAuswerten / darfZuordnen', () => {
    expect(darfAuswerten('eingegangen')).toBe(true);
    expect(darfAuswerten('analysiert')).toBe(true);
    expect(darfAuswerten('fehler')).toBe(true);
    expect(darfAuswerten('zugeordnet')).toBe(false);
    expect(darfZuordnen('analysiert')).toBe(true);
    expect(darfZuordnen('eingegangen')).toBe(false);
  });
});
