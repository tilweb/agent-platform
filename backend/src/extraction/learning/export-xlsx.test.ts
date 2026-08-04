import { describe, expect, test } from 'bun:test';
import { buildBatchExportSections, cellString, countExportRows, sanitizeSheetName } from './export-xlsx';
import type { BatchFileSummary } from './batch-runs';
import type { ExtractionProject } from './types';

const project: ExtractionProject = {
  id: 'lieferscheine',
  name: 'Lieferscheine',
  description: '',
  created: '2026-08-05T00:00:00.000Z',
  updated: '2026-08-05T00:00:00.000Z',
  fields: {
    lieferscheinnummer: { type: 'text', required: true, label: 'Lieferscheinnummer' },
    lieferdatum: { type: 'date', required: true, label: 'Lieferdatum' },
    positionen: {
      type: 'list',
      required: false,
      label: 'Positionen',
      item_fields: {
        artikelnummer: { type: 'text', label: 'Artikelnummer' },
        menge: { type: 'number', label: 'Menge' },
      },
    },
  },
  guidelines: '',
  learning: { total_examples: 0, accuracy_estimate: 0, guideline_version: 0 },
};

const file = (over: Partial<BatchFileSummary> = {}): BatchFileSummary => ({
  id: 'bf1',
  filename: 'beleg.pdf',
  status: 'completed',
  data: {
    lieferscheinnummer: 'LS-1',
    lieferdatum: '2026-07-01',
    positionen: [
      { artikelnummer: 'A-1', menge: 5 },
      { artikelnummer: 'A-2', menge: 3 },
    ],
  },
  fieldConfidences: null,
  strategy: 'vision-per-page',
  error: null,
  audit: null,
  reviewStatus: 'auto_ok',
  validations: null,
  ...over,
});

describe('flaches Format', () => {
  test('eine Zeile je Position mit wiederholten Kopfdaten', () => {
    const [sheet] = buildBatchExportSections(project, [file()], 'flat');
    expect(sheet!.content.headers).toEqual([
      'Datei', 'Status', 'Pruefung', 'Befunde', 'Lieferscheinnummer', 'Lieferdatum', 'Artikelnummer', 'Menge',
    ]);
    expect(sheet!.content.rows).toEqual([
      ['beleg.pdf', 'completed', 'ok', '', 'LS-1', '2026-07-01', 'A-1', '5'],
      ['beleg.pdf', 'completed', 'ok', '', 'LS-1', '2026-07-01', 'A-2', '3'],
    ]);
  });

  test('Belege ohne Positionen verschwinden nicht', () => {
    const ohne = file({ data: { lieferscheinnummer: 'LS-2', lieferdatum: null, positionen: [] } });
    const [sheet] = buildBatchExportSections(project, [ohne], 'flat');
    expect(sheet!.content.rows).toHaveLength(1);
    expect(sheet!.content.rows[0]!.slice(-2)).toEqual(['', '']);
  });

  test('fehlgeschlagene Datei kommt mit Fehlertext in die Befunde-Spalte', () => {
    const kaputt = file({ status: 'failed', data: null, error: 'Timeout', reviewStatus: null });
    const [sheet] = buildBatchExportSections(project, [kaputt], 'flat');
    expect(sheet!.content.rows[0]!.slice(0, 4)).toEqual(['beleg.pdf', 'failed', '', 'Timeout']);
  });

  test('Befunde stehen im Klartext, info-Protokolle nicht', () => {
    const mitBefund = file({
      reviewStatus: 'needs_review',
      validations: [
        { rule_id: 'r1', type: 'sum', severity: 'error', message: 'Summe passt nicht', fields: [] },
        { rule_id: 'c1', type: 'catalog', severity: 'info', message: 'angeglichen', fields: [] },
      ],
    });
    const [sheet] = buildBatchExportSections(project, [mitBefund], 'flat');
    expect(sheet!.content.rows[0]![2]).toBe('zu pruefen');
    expect(sheet!.content.rows[0]![3]).toBe('Summe passt nicht');
  });
});

describe('gruppiertes Format (unveraendert)', () => {
  test('Hauptblatt plus Zusatzblatt je Liste', () => {
    const sections = buildBatchExportSections(project, [file()], 'grouped');
    expect(sections).toHaveLength(2);
    expect(sections[0]!.content.headers).toEqual(['Datei', 'Status', 'Lieferscheinnummer', 'Lieferdatum', 'Positionen']);
    expect(sections[0]!.content.rows[0]!.at(-1)).toBe('2 Positionen');
    expect(sections[1]!.sheet).toBe('Positionen');
    expect(sections[1]!.content.rows).toHaveLength(2);
    expect(countExportRows(sections)).toBe(3);
  });
});

describe('Helfer', () => {
  test('cellString', () => {
    expect(cellString(null)).toBe('');
    expect(cellString(true)).toBe('Ja');
    expect(cellString(false)).toBe('Nein');
    expect(cellString(5)).toBe('5');
    expect(cellString({ a: 1 })).toBe('{"a":1}');
  });

  test('sanitizeSheetName', () => {
    expect(sanitizeSheetName('Positionen')).toBe('Positionen');
    expect(sanitizeSheetName('A/B:C*D')).toBe('A-B-C-D');
    expect(sanitizeSheetName('x'.repeat(40))).toHaveLength(31);
    expect(sanitizeSheetName('')).toBe('Liste');
  });
});
