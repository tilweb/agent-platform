import { test, expect } from 'bun:test';
import {
  normalizeForCompare,
  compareField,
  scoreEvalRows,
  evalSetHash,
  decideAcceptance,
  type EvalRow,
  type EvalOutcome,
} from './eval';
import type { ExtractionProject, ProjectField } from './types';

const textField: ProjectField = { type: 'text', required: false, label: 'Text' };
const numberField: ProjectField = { type: 'number', required: false, label: 'Zahl' };
const dateField: ProjectField = { type: 'date', required: false, label: 'Datum' };
const boolField: ProjectField = { type: 'boolean', required: false, label: 'JaNein' };
const listField: ProjectField = {
  type: 'list',
  required: false,
  label: 'Positionen',
  item_fields: {
    bezeichnung: { type: 'text', label: 'Bezeichnung' },
    menge: { type: 'number', label: 'Menge' },
  },
};

function makeProject(fields: Record<string, ProjectField>): ExtractionProject {
  return {
    id: 'p', name: 'P', description: '', created: '', updated: '',
    fields, guidelines: '',
    learning: { total_examples: 0, accuracy_estimate: 0, guideline_version: 0 },
  };
}

// ============== normalizeForCompare ==============

test('Zahlen: DE-Format und Float-Toleranz normalisieren gleich', () => {
  expect(normalizeForCompare('number', '1.234,56')).toBe(normalizeForCompare('number', 1234.56));
  expect(normalizeForCompare('number', '0,12')).toBe(normalizeForCompare('number', 0.12));
});

test('Datum: DE-Format → ISO', () => {
  expect(normalizeForCompare('date', '31.12.2024')).toBe('2024-12-31');
  expect(normalizeForCompare('date', '2024-12-31')).toBe('2024-12-31');
});

test('Text: trim, Whitespace-Collapse, lowercase', () => {
  expect(normalizeForCompare('text', '  Schraube   M4 ')).toBe('schraube m4');
});

test('Null-Familie → null', () => {
  expect(normalizeForCompare('text', null)).toBeNull();
  expect(normalizeForCompare('text', undefined)).toBeNull();
  expect(normalizeForCompare('text', '   ')).toBeNull();
});

test('Boolean: ja/nein/true/false', () => {
  expect(normalizeForCompare('boolean', 'ja')).toBe('true');
  expect(normalizeForCompare('boolean', 'Nein')).toBe('false');
  expect(normalizeForCompare('boolean', true)).toBe('true');
});

// ============== compareField ==============

test('compareField: Zahl mit Epsilon + DE-Format', () => {
  expect(compareField(numberField, 30.9, '30,90')).toBe(true);
  expect(compareField(numberField, 30.9, 30.901)).toBe(true);
  expect(compareField(numberField, 30.9, 31)).toBe(false);
});

test('compareField: beide leer = Treffer, einseitig leer = Fehler', () => {
  expect(compareField(textField, null, '')).toBe(true);
  expect(compareField(textField, 'x', null)).toBe(false);
  expect(compareField(dateField, undefined, null)).toBe(true);
});

test('compareField: Bool-Varianten', () => {
  expect(compareField(boolField, true, 'ja')).toBe(true);
  expect(compareField(boolField, false, 'Ja')).toBe(false);
});

test('Listen: Reihenfolge egal (Multiset)', () => {
  const a = [{ bezeichnung: 'A', menge: 1 }, { bezeichnung: 'B', menge: 2 }];
  const b = [{ bezeichnung: 'B', menge: 2 }, { bezeichnung: 'A', menge: 1 }];
  expect(compareField(listField, a, b)).toBe(true);
});

test('Listen: Duplikate zaehlen (Multiset, kein Set)', () => {
  const a = [{ bezeichnung: 'A', menge: 1 }, { bezeichnung: 'A', menge: 1 }];
  const b = [{ bezeichnung: 'A', menge: 1 }];
  expect(compareField(listField, a, b)).toBe(false);
});

test('Listen: normalisierte Zellen (Case/DE-Zahl) matchen', () => {
  const a = [{ bezeichnung: 'Schraube M4', menge: 0.12 }];
  const b = [{ bezeichnung: ' schraube m4 ', menge: '0,12' }];
  expect(compareField(listField, a, b)).toBe(true);
});

test('Listen: leer vs leer = Treffer, leer vs gefuellt = Fehler', () => {
  expect(compareField(listField, [], [])).toBe(true);
  expect(compareField(listField, [], [{ bezeichnung: 'A' }])).toBe(false);
  expect(compareField(listField, null, [])).toBe(true); // beide "keine Positionen"
});

// ============== scoreEvalRows ==============

test('Accuracy-Mathe: by_field und overall', () => {
  const project = makeProject({ a: textField, b: numberField });
  const rows: EvalRow[] = [
    { expected: { a: 'x', b: 1 }, actual: { a: 'x', b: 1 } },   // 2/2
    { expected: { a: 'x', b: 1 }, actual: { a: 'y', b: 1 } },   // 1/2
  ];
  const s = scoreEvalRows(project, rows);
  expect(s.by_field.a).toBe(50);
  expect(s.by_field.b).toBe(100);
  expect(s.overall).toBe(75);
  expect(s.examples).toBe(2);
  expect(s.failed).toBe(false);
});

test('Fehlgeschlagene Zeilen: failures gezaehlt, >50% → failed', () => {
  const project = makeProject({ a: textField });
  const rows: EvalRow[] = [
    { expected: { a: 'x' }, actual: { a: 'x' } },
    { error: 'boom' },
    { error: 'boom' },
  ];
  const s = scoreEvalRows(project, rows);
  expect(s.failures).toBe(2);
  expect(s.failed).toBe(true);
  expect(s.examples).toBe(1);
});

test('Leeres Eval-Set → failed', () => {
  expect(scoreEvalRows(makeProject({ a: textField }), []).failed).toBe(true);
});

// ============== evalSetHash ==============

test('Hash stabil und ordnungs-unabhaengig, aendert sich mit Modell/Cap', () => {
  const h1 = evalSetHash(['b', 'a'], 'm', 20);
  const h2 = evalSetHash(['a', 'b'], 'm', 20);
  expect(h1).toBe(h2);
  expect(evalSetHash(['a', 'b'], 'anders', 20)).not.toBe(h1);
  expect(evalSetHash(['a', 'b'], 'm', 10)).not.toBe(h1);
  expect(evalSetHash(['a', 'c'], 'm', 20)).not.toBe(h1);
});

// ============== decideAcceptance ==============

function outcome(overall: number, failed = false): EvalOutcome {
  return { overall, by_field: {}, examples: 5, failures: 0, failed };
}

test('Akzeptanz: besser/gleich → accept, schlechter → reject', () => {
  expect(decideAcceptance(80, outcome(85)).accept).toBe(true);
  expect(decideAcceptance(80, outcome(80)).accept).toBe(true);
  expect(decideAcceptance(80, outcome(79.9)).accept).toBe(false);
});

test('Akzeptanz: kein Champion → accept (initial)', () => {
  const d = decideAcceptance(null, outcome(50));
  expect(d.accept).toBe(true);
  expect(d.reason).toBe('no-champion');
});

test('Akzeptanz: failed → nie uebernehmen', () => {
  const d = decideAcceptance(10, outcome(99, true));
  expect(d.accept).toBe(false);
  expect(d.reason).toBe('error');
});
