import { describe, expect, test } from 'bun:test';
import {
  evaluateLookupRule,
  evaluateRules,
  evaluateSumRule,
  hasBlockingIssue,
  normalizeLookupValue,
} from './rules';
import { validateProjectRules } from './validators';
import type { ExtractionProject, LookupRule, SumRule } from './types';

function project(overrides: Partial<ExtractionProject> = {}): ExtractionProject {
  return {
    id: 'rechnungen',
    name: 'Rechnungen',
    description: '',
    created: '2026-08-01T00:00:00.000Z',
    updated: '2026-08-01T00:00:00.000Z',
    fields: {
      gesamtbetrag: { type: 'number', required: true, label: 'Gesamtbetrag' },
      lieferant: { type: 'text', required: false, label: 'Lieferant' },
      positionen: {
        type: 'list',
        required: false,
        label: 'Positionen',
        item_fields: {
          bezeichnung: { type: 'text', label: 'Bezeichnung' },
          betrag: { type: 'number', label: 'Betrag' },
        },
      },
    },
    guidelines: '',
    learning: { total_examples: 0, accuracy_estimate: 0, guideline_version: 0 },
    ...overrides,
  };
}

const SUM_RULE: SumRule = {
  id: 'r1',
  type: 'sum',
  list_field: 'positionen',
  item_field: 'betrag',
  target_field: 'gesamtbetrag',
};

const LOOKUP_RULE: LookupRule = {
  id: 'r2',
  type: 'lookup',
  field: 'lieferant',
  table_id: 'lieferanten',
  column_id: 'name',
};

describe('evaluateSumRule', () => {
  test('exakte Summe erzeugt keinen Befund', () => {
    const data = {
      gesamtbetrag: 30,
      positionen: [{ betrag: 10 }, { betrag: 20 }],
    };
    expect(evaluateSumRule(SUM_RULE, data, project())).toBeNull();
  });

  test('Abweichung innerhalb der Toleranz erzeugt keinen Befund', () => {
    const data = { gesamtbetrag: 30.005, positionen: [{ betrag: 10 }, { betrag: 20 }] };
    expect(evaluateSumRule(SUM_RULE, data, project())).toBeNull();
  });

  test('Fliesskomma-Rauschen erzeugt keinen Befund', () => {
    const data = { gesamtbetrag: 0.3, positionen: [{ betrag: 0.1 }, { betrag: 0.2 }] };
    expect(evaluateSumRule(SUM_RULE, data, project())).toBeNull();
  });

  test('Abweichung ausserhalb der Toleranz erzeugt error-Befund mit Labels', () => {
    const data = { gesamtbetrag: 100, positionen: [{ betrag: 10 }, { betrag: 20 }] };
    const issue = evaluateSumRule(SUM_RULE, data, project());
    expect(issue).not.toBeNull();
    expect(issue!.severity).toBe('error');
    expect(issue!.fields).toEqual(['positionen', 'gesamtbetrag']);
    expect(issue!.message).toContain('Betrag');
    expect(issue!.message).toContain('Gesamtbetrag');
    expect(issue!.message).toContain('30,00');
    expect(issue!.message).toContain('100,00');
  });

  test('deutsche Zahlformate werden normalisiert', () => {
    const data = {
      gesamtbetrag: '1.234,56',
      positionen: [{ betrag: '1.000,00' }, { betrag: '234,56' }],
    };
    expect(evaluateSumRule(SUM_RULE, data, project())).toBeNull();
  });

  test('eigene Toleranz wird respektiert', () => {
    const data = { gesamtbetrag: 31, positionen: [{ betrag: 10 }, { betrag: 20 }] };
    expect(evaluateSumRule({ ...SUM_RULE, tolerance: 1 }, data, project())).toBeNull();
    expect(evaluateSumRule({ ...SUM_RULE, tolerance: 0.5 }, data, project())).not.toBeNull();
  });

  test('leere Liste oder leeres Zielfeld erzeugt keinen Befund', () => {
    expect(evaluateSumRule(SUM_RULE, { gesamtbetrag: 30, positionen: [] }, project())).toBeNull();
    expect(evaluateSumRule(SUM_RULE, { gesamtbetrag: null, positionen: [{ betrag: 10 }] }, project())).toBeNull();
    expect(evaluateSumRule(SUM_RULE, { positionen: [{ betrag: 10 }] }, project())).toBeNull();
  });

  test('nicht-numerische Positionen werden uebersprungen, nicht als 0 gewertet', () => {
    const data = { gesamtbetrag: 10, positionen: [{ betrag: 10 }, { betrag: 'k.A.' }] };
    expect(evaluateSumRule(SUM_RULE, data, project())).toBeNull();
  });

  test('nur unlesbare Positionen erzeugen keinen Befund', () => {
    const data = { gesamtbetrag: 10, positionen: [{ betrag: 'n/a' }] };
    expect(evaluateSumRule(SUM_RULE, data, project())).toBeNull();
  });
});

describe('evaluateLookupRule', () => {
  const allowed = new Set(['acme gmbh', 'mustermann ag']);

  test('bekannter Wert erzeugt keinen Befund', () => {
    expect(evaluateLookupRule(LOOKUP_RULE, { lieferant: 'ACME GmbH' }, allowed, project())).toBeNull();
  });

  test('Whitespace und Gross-/Kleinschreibung sind egal', () => {
    expect(
      evaluateLookupRule(LOOKUP_RULE, { lieferant: '  mustermann   AG ' }, allowed, project()),
    ).toBeNull();
  });

  test('unbekannter Wert erzeugt error-Befund', () => {
    const issue = evaluateLookupRule(LOOKUP_RULE, { lieferant: 'Fremdfirma' }, allowed, project());
    expect(issue!.severity).toBe('error');
    expect(issue!.fields).toEqual(['lieferant']);
    expect(issue!.message).toContain('Fremdfirma');
  });

  test('severity warn wird uebernommen', () => {
    const issue = evaluateLookupRule(
      { ...LOOKUP_RULE, severity: 'warn' },
      { lieferant: 'Fremdfirma' },
      allowed,
      project(),
    );
    expect(issue!.severity).toBe('warn');
  });

  test('leerer Wert erzeugt keinen Befund', () => {
    expect(evaluateLookupRule(LOOKUP_RULE, { lieferant: '' }, allowed, project())).toBeNull();
    expect(evaluateLookupRule(LOOKUP_RULE, { lieferant: null }, allowed, project())).toBeNull();
  });

  test('nicht ladbare Quelle erzeugt warn statt error', () => {
    const issue = evaluateLookupRule(LOOKUP_RULE, { lieferant: 'Fremdfirma' }, null, project(), 'Tabelle weg');
    expect(issue!.severity).toBe('warn');
    expect(issue!.message).toContain('Tabelle weg');
  });
});

describe('evaluateRules', () => {
  test('laedt jede Wertequelle nur einmal', async () => {
    const calls: string[] = [];
    const p = project({
      rules: [
        LOOKUP_RULE,
        { ...LOOKUP_RULE, id: 'r3', field: 'lieferant' },
      ],
    });
    const issues = await evaluateRules(p, { lieferant: 'ACME GmbH' }, async (tableId, columnId) => {
      calls.push(`${tableId}/${columnId}`);
      return { values: new Set(['acme gmbh']) };
    });
    expect(calls).toEqual(['lieferanten/name']);
    expect(issues).toEqual([]);
  });

  test('ohne Regeln passiert nichts (kein Lade-Aufruf)', async () => {
    let called = false;
    const issues = await evaluateRules(project(), { lieferant: 'X' }, async () => {
      called = true;
      return { values: new Set<string>() };
    });
    expect(issues).toEqual([]);
    expect(called).toBe(false);
  });

  test('Fehler der Wertequelle kippt die Auswertung nicht', async () => {
    const p = project({ rules: [SUM_RULE, LOOKUP_RULE] });
    const data = { gesamtbetrag: 100, positionen: [{ betrag: 10 }], lieferant: 'Egal' };
    const issues = await evaluateRules(p, data, async () => ({ error: 'DB weg' }));
    expect(issues).toHaveLength(2);
    expect(issues[0]!.type).toBe('sum');
    expect(issues[1]!.severity).toBe('warn');
    expect(hasBlockingIssue(issues)).toBe(true);
  });
});

describe('hasBlockingIssue / normalizeLookupValue', () => {
  test('nur error blockiert', () => {
    expect(hasBlockingIssue(undefined)).toBe(false);
    expect(hasBlockingIssue([])).toBe(false);
    expect(hasBlockingIssue([{ rule_id: 'a', type: 'sum', severity: 'warn', message: '', fields: [] }])).toBe(false);
    expect(hasBlockingIssue([{ rule_id: 'a', type: 'sum', severity: 'error', message: '', fields: [] }])).toBe(true);
  });

  test('normalisiert Whitespace und Case', () => {
    expect(normalizeLookupValue('  Acme   GmbH ')).toBe('acme gmbh');
    expect(normalizeLookupValue(null)).toBe('');
    expect(normalizeLookupValue(42)).toBe('42');
  });
});

describe('validateProjectRules', () => {
  const fields = project().fields;

  test('gueltige Regeln passieren', () => {
    expect(validateProjectRules(fields, [SUM_RULE, LOOKUP_RULE])).toBeNull();
    expect(validateProjectRules(fields, undefined)).toBeNull();
    expect(validateProjectRules(fields, [])).toBeNull();
  });

  test('unbekanntes Listen-Feld / Spalte / Zielfeld wird abgelehnt', () => {
    expect(validateProjectRules(fields, [{ ...SUM_RULE, list_field: 'weg' }])).toContain('existiert nicht');
    expect(validateProjectRules(fields, [{ ...SUM_RULE, item_field: 'weg' }])).toContain('Spalte');
    expect(validateProjectRules(fields, [{ ...SUM_RULE, target_field: 'weg' }])).toContain('Zielfeld');
  });

  test('Summen-Regel braucht Listen-Feld und numerische Spalten', () => {
    expect(validateProjectRules(fields, [{ ...SUM_RULE, list_field: 'lieferant' }])).toContain('kein Listen-Feld');
    expect(validateProjectRules(fields, [{ ...SUM_RULE, item_field: 'bezeichnung' }])).toContain('Typ Zahl');
    expect(validateProjectRules(fields, [{ ...SUM_RULE, target_field: 'lieferant' }])).toContain('Typ Zahl');
  });

  test('Lookup braucht Tabelle und Spalte, kein Listen-Feld', () => {
    expect(validateProjectRules(fields, [{ ...LOOKUP_RULE, table_id: '' }])).toContain('Tabelle');
    expect(validateProjectRules(fields, [{ ...LOOKUP_RULE, field: 'positionen' }])).toContain('Listen-Feld');
  });

  test('doppelte Ids werden abgelehnt', () => {
    expect(validateProjectRules(fields, [SUM_RULE, { ...SUM_RULE }])).toContain('doppelt');
  });

  test('negative Toleranz wird abgelehnt', () => {
    expect(validateProjectRules(fields, [{ ...SUM_RULE, tolerance: -1 }])).toContain('Toleranz');
  });
});
