import { describe, expect, test } from 'bun:test';
import {
  batchCreateFunction,
  batchExportFunction,
  batchGetFunction,
  decodeDocument,
  extractFunction,
  extractionPublicFunctions,
  projectsListFunction,
  safeName,
} from './public-functions';
import { getVirtualApps } from '../public-api/virtual-apps';
import { scopeMatches, validate } from '../public-api/validator';

const b64 = (s: string) => Buffer.from(s).toString('base64');

describe('decodeDocument', () => {
  test('dekodiert base64', () => {
    expect(decodeDocument({ filename: 'a.txt', content_base64: b64('hallo') }, 0).toString()).toBe('hallo');
  });

  test('leerer Inhalt wird abgelehnt', () => {
    expect(() => decodeDocument({ filename: 'a.txt', content_base64: '' }, 0)).toThrow(/leerer Inhalt/);
  });

  test('zu grosses Dokument wird abgelehnt', () => {
    const big = Buffer.alloc(11 * 1024 * 1024, 0x41).toString('base64');
    expect(() => decodeDocument({ filename: 'gross.pdf', content_base64: big }, 2)).toThrow(/Dokument 3 \(gross.pdf\).*10 MB/s);
  });
});

describe('safeName', () => {
  test('entfernt Pfade und Sonderzeichen', () => {
    expect(safeName('../../etc/passwd')).toBe('passwd');
    expect(safeName('C:\\tmp\\Rechnung Nr. 5.pdf')).toBe('Rechnung_Nr._5.pdf');
    expect(safeName('')).toBe('dokument');
    expect(safeName('x'.repeat(200))).toHaveLength(120);
  });
});

describe('Function-Vertraege', () => {
  test('alle fuenf Functions sind registriert und eindeutig', () => {
    const ids = extractionPublicFunctions.map((f) => f.id);
    expect(ids).toEqual(['projects.list', 'extract', 'batch.create', 'batch.get', 'batch.export']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('Input-Schemas akzeptieren gueltige und lehnen ungueltige Anfragen ab', () => {
    expect(validate({}, projectsListFunction.input)).toEqual([]);
    expect(validate({ project_id: 'p', text: 'x' }, extractFunction.input)).toEqual([]);
    expect(validate({}, extractFunction.input)).not.toEqual([]);
    expect(
      validate({ project_id: 'p', documents: [{ filename: 'a.pdf', content_base64: 'eA==' }] }, batchCreateFunction.input),
    ).toEqual([]);
    // Dokument ohne Inhalt -> Schema-Fehler, bevor irgendetwas dekodiert wird
    expect(validate({ project_id: 'p', documents: [{ filename: 'a.pdf' }] }, batchCreateFunction.input)).not.toEqual([]);
    expect(validate({ project_id: 'p', run_id: 'r' }, batchGetFunction.input)).toEqual([]);
    expect(validate({ run_id: 'r' }, batchGetFunction.input)).not.toEqual([]);
    // Export: Format ist optional, aber wenn gesetzt nur flat|grouped
    expect(validate({ project_id: 'p', run_id: 'r' }, batchExportFunction.input)).toEqual([]);
    expect(validate({ project_id: 'p', run_id: 'r', format: 'flat' }, batchExportFunction.input)).toEqual([]);
    expect(validate({ project_id: 'p', run_id: 'r', format: 'csv' }, batchExportFunction.input)).not.toEqual([]);
  });

  test('jede Function hat Beschreibung, Output-Schema und Rate-Limit', () => {
    for (const fn of extractionPublicFunctions) {
      expect(fn.description.length).toBeGreaterThan(30);
      expect(fn.output?.type).toBe('object');
      expect(fn.defaultRateLimit?.requests).toBeGreaterThan(0);
    }
  });
});

describe('virtuelle App', () => {
  test('stellt die Extraktion ohne Registry-Eintrag bereit', () => {
    const apps = getVirtualApps();
    expect(apps).toHaveLength(1);
    expect(apps[0]!.id).toBe('extraktion');
    expect(apps[0]!.enabled).toBe(true);
    // Keine Routen -> kein toter Sidebar-Link
    expect(apps[0]!.routes).toEqual([]);
    expect(apps[0]!.publicFunctions).toHaveLength(5);
  });

  test('Scopes greifen wie bei Registry-Apps', () => {
    expect(scopeMatches('app:extraktion:batch.create', ['app:extraktion:*'])).toBe(true);
    expect(scopeMatches('app:extraktion:batch.create', ['app:extraktion:extract'])).toBe(false);
    expect(scopeMatches('app:extraktion:extract', ['app:*:*'])).toBe(true);
  });

  test('EXTRACTION_PUBLIC_API=0 schaltet die API ab', () => {
    const prev = process.env.EXTRACTION_PUBLIC_API;
    process.env.EXTRACTION_PUBLIC_API = '0';
    try {
      expect(getVirtualApps()).toEqual([]);
    } finally {
      if (prev === undefined) delete process.env.EXTRACTION_PUBLIC_API;
      else process.env.EXTRACTION_PUBLIC_API = prev;
    }
  });
});
