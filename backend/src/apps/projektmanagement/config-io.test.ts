import { test, expect } from 'bun:test';
import {
  exportToExcel,
  exportToCsv,
  parseExcel,
  parseCsv,
  buildTemplateCsv,
  diffConfig,
  applyImport,
  lockedWarnings,
  type Config,
} from './config-io';

const SAMPLE: Config = {
  project_type: [
    { value: 'internal', label: 'Internes Projekt' },
    { value: 'external', label: 'Externes Projekt, GmbH' }, // Komma → CSV-Quoting
  ],
  priority: [
    { value: 'low', label: 'Niedrig' },
    { value: 'high', label: 'Hoch "dringend"' }, // Quote → CSV-Quoting
  ],
  idee_status: [
    { value: 'draft', label: 'Entwurf' },
    { value: 'approved', label: 'Genehmigt' },
  ],
  abschluss_checkliste: [
    { id: 'doku_archiviert', label: 'Doku archiviert' },
  ],
};

test('CSV round-trip: export → parse ergibt gleiche Listen', () => {
  const csv = exportToCsv(SAMPLE);
  const { lists, warnings } = parseCsv(csv);
  expect(warnings).toEqual([]);
  expect(lists.project_type).toEqual(SAMPLE.project_type);
  expect(lists.priority).toEqual(SAMPLE.priority);
  expect(lists.abschluss_checkliste).toEqual(SAMPLE.abschluss_checkliste);
});

test('CSV: Umlaute + BOM + Quoting korrekt', () => {
  const csv = exportToCsv(SAMPLE);
  expect(csv.startsWith('﻿')).toBe(true); // BOM
  expect(csv).toContain('"Externes Projekt, GmbH"');
  expect(csv).toContain('"Hoch ""dringend"""');
});

test('Excel round-trip: export → parse ergibt gleiche Listen', async () => {
  const buf = await exportToExcel(SAMPLE);
  const { lists, warnings } = await parseExcel(buf);
  expect(warnings).toEqual([]);
  expect(lists.project_type).toEqual(SAMPLE.project_type);
  expect(lists.abschluss_checkliste).toEqual(SAMPLE.abschluss_checkliste);
});

test('parseCsv: unbekannte Liste → Warnung, keine Liste', () => {
  const csv = 'liste,schluessel,anzeige\nfoo_bar,x,X\nproject_type,internal,Intern\n';
  const { lists, warnings } = parseCsv(csv);
  expect(lists.foo_bar).toBeUndefined();
  expect(lists.project_type).toEqual([{ value: 'internal', label: 'Intern' }]);
  expect(warnings.some((w) => w.includes('foo_bar'))).toBe(true);
});

test('parseCsv: leere Anzeigenamen + Duplikate übersprungen mit Warnung', () => {
  const csv = 'liste,schluessel,anzeige\npriority,low,Niedrig\npriority,low,Nochmal\npriority,mid,\n';
  const { lists, warnings } = parseCsv(csv);
  expect(lists.priority).toEqual([{ value: 'low', label: 'Niedrig' }]);
  expect(warnings.some((w) => w.includes('doppelter'))).toBe(true);
  expect(warnings.some((w) => w.includes('ohne Anzeigename'))).toBe(true);
});

test('diffConfig: added/changed/removed pro Liste', () => {
  const current: Config = { priority: [{ value: 'low', label: 'Niedrig' }, { value: 'high', label: 'Hoch' }] };
  const incoming: Config = { priority: [{ value: 'low', label: 'Gering' }, { value: 'crit', label: 'Kritisch' }] };
  const diff = diffConfig(current, incoming);
  expect(diff.priority!.added).toEqual(['crit']);
  expect(diff.priority!.removed).toEqual(['high']);
  expect(diff.priority!.changed).toEqual([{ key: 'low', from: 'Niedrig', to: 'Gering' }]);
});

test('applyImport: editierbare Liste wird ersetzt, nicht ausgewählte bleibt', () => {
  const current: Config = {
    priority: [{ value: 'low', label: 'Niedrig' }],
    role: [{ value: 'pl', label: 'PL' }],
  };
  const incoming: Config = {
    priority: [{ value: 'a', label: 'A' }],
    role: [{ value: 'x', label: 'X' }],
  };
  const result = applyImport(current, incoming, ['priority']);
  expect(result.priority).toEqual([{ value: 'a', label: 'A' }]);
  expect(result.role).toEqual([{ value: 'pl', label: 'PL' }]); // unverändert
});

test('applyImport: gesperrte Liste — nur Labels existierender Schlüssel', () => {
  const current: Config = {
    idee_status: [
      { value: 'draft', label: 'Entwurf' },
      { value: 'approved', label: 'Genehmigt' },
    ],
  };
  const incoming: Config = {
    idee_status: [
      { value: 'draft', label: 'Neu-Label' },   // Label-Änderung → übernommen
      { value: 'fremd', label: 'Ignorieren' },  // fremder Key → ignoriert
      // 'approved' fehlt → bleibt trotzdem erhalten
    ],
  };
  const result = applyImport(current, incoming, ['idee_status']);
  expect(result.idee_status).toEqual([
    { value: 'draft', label: 'Neu-Label' },
    { value: 'approved', label: 'Genehmigt' },
  ]);
});

test('lockedWarnings: warnt bei Schlüssel-Abweichung in gesperrter Liste', () => {
  const current: Config = { idee_status: [{ value: 'draft', label: 'Entwurf' }] };
  const incoming: Config = { idee_status: [{ value: 'draft', label: 'E' }, { value: 'neu', label: 'N' }] };
  const w = lockedWarnings(current, incoming);
  expect(w.length).toBe(1);
  expect(w[0]).toContain('fixiert');
});

test('buildTemplateCsv: editierbare Listen leer, gesperrte vorbefüllt', () => {
  const csv = buildTemplateCsv(SAMPLE);
  const { lists } = parseCsv(csv);
  expect(lists.project_type).toBeUndefined(); // editierbar → leer
  expect(lists.idee_status).toEqual(SAMPLE.idee_status); // gesperrt → vorbefüllt
});
