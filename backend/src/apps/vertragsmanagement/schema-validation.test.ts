import { test, expect, describe } from 'bun:test';
import { validateContractSchema } from './schema-validation';
import type { ContractSchema } from '../types';

const mietvertrag: ContractSchema = {
  id: 'mietvertrag',
  name: 'Mietvertrag',
  icon: 'building',
  fields: {
    vertragspartner: {
      vermieter: { type: 'text', required: true },
      mieter: { type: 'text', required: true },
    },
    laufzeit: {
      beginn: { type: 'date', required: true },
      ende: { type: 'date' },
    },
    finanzen: {
      kaltmiete_monatlich: { type: 'number', required: true },
    },
  },
  mapping: {
    party_a: 'vertragspartner.vermieter',
    party_b: 'vertragspartner.mieter',
    start_date: 'laufzeit.beginn',
    end_date: 'laufzeit.ende',
    value: 'finanzen.kaltmiete_monatlich * 12',
  },
};

describe('validateContractSchema', () => {
  test('System-Schema (mietvertrag) ist valide', () => {
    const issues = validateContractSchema(mietvertrag);
    expect(issues).toEqual([]);
  });

  test('mapping-Pfad zeigt auf nicht-existentes Feld', () => {
    const broken: ContractSchema = {
      ...mietvertrag,
      mapping: { ...mietvertrag.mapping, party_a: 'vertragspartner.auftraggeber' },
    };
    const issues = validateContractSchema(broken);
    expect(issues.length).toBe(1);
    expect(issues[0]!.field).toBe('party_a');
    expect(issues[0]!.path).toBe('vertragspartner.auftraggeber');
  });

  test('mapping fehlt komplett', () => {
    const broken = { ...mietvertrag, mapping: undefined } as unknown as ContractSchema;
    const issues = validateContractSchema(broken);
    expect(issues.length).toBeGreaterThan(0);
  });

  test('mapping.value mit *-Multiplier wird korrekt validiert', () => {
    const issues = validateContractSchema({
      ...mietvertrag,
      mapping: { ...mietvertrag.mapping, value: 'finanzen.kaltmiete_monatlich * 24' },
    });
    expect(issues).toEqual([]);
  });

  test('einzelnes mapping-Feld leer (z.B. value)', () => {
    const broken: ContractSchema = {
      ...mietvertrag,
      mapping: { ...mietvertrag.mapping, value: '' },
    };
    const issues = validateContractSchema(broken);
    expect(issues.length).toBe(1);
    expect(issues[0]!.field).toBe('value');
  });

  test('Schema mit extraction-Block ist valide (P2)', () => {
    const withExtraction: ContractSchema = {
      ...mietvertrag,
      extraction: { strategy: 'long-text-chunked', section_aware: true },
    };
    const issues = validateContractSchema(withExtraction);
    expect(issues).toEqual([]);
  });
});
