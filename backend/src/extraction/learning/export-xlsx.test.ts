import { describe, expect, test } from 'bun:test';
import { buildBatchExportSections, cellString, countExportRows, sanitizeSheetName, sectionToCsv, parseExportFormat } from './export-xlsx';
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

describe('Segment-Profile (Welle 10.4)', () => {
  const segProject = {
    id: 'p', name: 'P', description: '', created: '', updated: '',
    fields: {}, guidelines: '', learning: { total_examples: 0, guideline_version: 0 },
    segments: {
      formular: {
        label: 'Anmeldeformular',
        description: 'x'.repeat(30),
        fields: { datum: { type: 'date', required: false, label: 'Datum' } },
        required: true,
      },
      einwilligung: { label: 'Einwilligung', description: 'y'.repeat(30), mode: 'classify-only', repeatable: true },
    },
  } as never;
  const segFiles = [
    {
      id: 'f1', filename: 'a.pdf', status: 'completed', reviewStatus: 'auto_ok',
      data: {
        formular: { datum: '2026-05-25' },
        einwilligung: [{ _beleg: 'Einwilligung, Seite 3' }, { _beleg: 'Einwilligung, Seite 4' }],
      },
      fieldConfidences: null, strategy: null, error: null, audit: null, validations: [],
      segments: [
        { type: 'formular', instance: 1, pageFrom: 1, pageTo: 2, confidence: 0.9 },
        { type: 'einwilligung', instance: 1, pageFrom: 3, pageTo: 3, confidence: 0.95, summary: 'Einwilligung, Seite 3' },
        { type: 'einwilligung', instance: 2, pageFrom: 4, pageTo: 4, confidence: 0.8, summary: 'Einwilligung, Seite 4' },
        { type: 'unbekannt', instance: 1, pageFrom: 5, pageTo: 5, confidence: 0 },
      ],
    },
  ] as never;

  test('flach: eine Zeile je Segment-Instanz inkl. classify-only und unbekannt', () => {
    const sections = buildBatchExportSections(segProject, segFiles, 'flat');
    expect(sections).toHaveLength(1);
    const { headers, rows } = sections[0]!.content;
    expect(headers).toContain('Segment');
    expect(headers).toContain('Datum');
    expect(rows).toHaveLength(4);
    const formularRow = rows.find((r) => r[headers.indexOf('Segment')] === 'Anmeldeformular')!;
    expect(formularRow[headers.indexOf('Datum')]).toBe('2026-05-25');
    expect(formularRow[headers.indexOf('Seiten')]).toBe('1-2');
    const zweiteEinwilligung = rows.find((r) => r[headers.indexOf('Instanz')] === '2')!;
    expect(zweiteEinwilligung[headers.indexOf('Beleg')]).toBe('Einwilligung, Seite 4');
    expect(rows.some((r) => r[headers.indexOf('Segment')] === 'Nicht zugeordnet')).toBe(true);
  });

  test('gruppiert: Hauptblatt-Zusammenfassung + Segmente-Blatt', () => {
    const sections = buildBatchExportSections(segProject, segFiles, 'grouped');
    expect(sections).toHaveLength(2);
    expect(sections[0]!.content.rows[0]![2]).toContain('Anmeldeformular (S.1-2)');
    expect(sections[1]!.sheet).toBe('Segmente');
    expect(sections[1]!.content.rows).toHaveLength(4);
  });
});

describe('breites Format (flat-wide)', () => {
  const zwei = file({ id: 'bf2', filename: 'zwei.pdf', data: {
    lieferscheinnummer: 'LS-2', lieferdatum: '2026-07-02',
    positionen: [{ artikelnummer: 'B-1', menge: 1 }],
  } });

  test('eine Zeile je Dokument, Liste als nummerierte Spalten (Batch-Max)', () => {
    const [sheet] = buildBatchExportSections(project, [file(), zwei], 'flat-wide');
    const { headers, rows } = sheet!.content;
    // Batch-Max Positionen = 2 → Instanz-1- und Instanz-2-Spalten.
    expect(headers).toEqual([
      'Datei', 'Status', 'Pruefung', 'Befunde', 'Lieferscheinnummer', 'Lieferdatum',
      'Positionen (Anzahl)',
      'Positionen 1 – Artikelnummer', 'Positionen 1 – Menge',
      'Positionen 2 – Artikelnummer', 'Positionen 2 – Menge',
    ]);
    // Genau EINE Zeile je Dokument (nicht je Position).
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(['beleg.pdf', 'completed', 'ok', '', 'LS-1', '2026-07-01', '2', 'A-1', '5', 'A-2', '3']);
    // Dokument mit nur 1 Position → Instanz-2-Zellen leer.
    expect(rows[1]).toEqual(['zwei.pdf', 'completed', 'ok', '', 'LS-2', '2026-07-02', '1', 'B-1', '1', '', '']);
  });

  test('positionsloses Dokument bekommt trotzdem eine Zeile', () => {
    const leer = file({ id: 'bf3', filename: 'leer.pdf', data: { lieferscheinnummer: 'LS-0', lieferdatum: '', positionen: [] } });
    const [sheet] = buildBatchExportSections(project, [leer], 'flat-wide');
    expect(sheet!.content.rows).toHaveLength(1);
    expect(sheet!.content.rows[0]![6]).toBe('0'); // Anzahl
  });
});

describe('CSV-Serialisierung', () => {
  test('sectionToCsv: BOM, ;-Trenner, Quoting von Sonderzeichen', () => {
    const [sheet] = buildBatchExportSections(project, [file({ data: {
      lieferscheinnummer: 'LS;1', lieferdatum: 'a"b', positionen: [{ artikelnummer: 'X', menge: 2 }],
    } })], 'flat-wide');
    const csv = sectionToCsv(sheet!);
    expect(csv.charCodeAt(0)).toBe(0xFEFF);            // BOM
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toContain('Datei;Status');        // ;-getrennt
    expect(lines[1]).toContain('"LS;1"');              // Trenner → gequotet
    expect(lines[1]).toContain('"a""b"');              // Quote verdoppelt
  });

  test('parseExportFormat normalisiert', () => {
    expect(parseExportFormat('flat-wide')).toBe('flat-wide');
    expect(parseExportFormat('flat')).toBe('flat');
    expect(parseExportFormat('quatsch')).toBe('grouped');
    expect(parseExportFormat(undefined)).toBe('grouped');
  });
});
