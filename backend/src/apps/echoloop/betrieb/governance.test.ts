/**
 * Phase-4 Governance PROD↔PROJ: nur PROD schaltet scharf (Standard-Promotion +
 * Standard-Änderung); PROJ darf melden/beobachten/verwerfen, aber nichts promoten.
 */
import { test, expect, describe } from 'bun:test';
import { darfStandardAendern, darfPromoten, pruefeGovernance, GovernanceFehler } from './governance';

describe('Governance · PROD/PROJ', () => {
  test('nur PROD darf Standards ändern', () => {
    expect(darfStandardAendern('PROD')).toBe(true);
    expect(darfStandardAendern('PROJ')).toBe(false);
  });

  test('nur PROD darf zum Standard promoten', () => {
    expect(darfPromoten('PROD', 'standard')).toBe(true);
    expect(darfPromoten('PROJ', 'standard')).toBe(false);
  });

  test('PROJ darf melden/beobachten/verwerfen', () => {
    for (const ziel of ['beobachtend', 'im_review', 'verworfen', 'kandidat'] as const) {
      expect(darfPromoten('PROJ', ziel)).toBe(true);
    }
  });

  test('pruefeGovernance wirft, wenn PROJ scharf schalten will', () => {
    expect(() => pruefeGovernance('PROJ', 'standard')).toThrow(GovernanceFehler);
    expect(() => pruefeGovernance('PROD', 'standard')).not.toThrow();
    expect(() => pruefeGovernance('PROJ', 'im_review')).not.toThrow();
  });
});
