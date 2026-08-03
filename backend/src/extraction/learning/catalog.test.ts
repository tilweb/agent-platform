import { describe, expect, test } from 'bun:test';
import {
  applyCatalogs,
  levenshtein,
  matchCatalogValue,
  normalizeForMatch,
  renderCatalogHint,
} from './catalog';
import { hasBlockingIssue } from './rules';
import { validateProjectFields } from './validators';
import type { CatalogValue, ExtractionProject } from './types';

const LIEFERANTEN: CatalogValue[] = [
  { value: 'Acme AG', synonyms: ['acme', 'ACME Aktiengesellschaft'] },
  { value: 'Muster Bau GmbH' },
  { value: 'Nordlicht Handel KG' },
];

const EINHEITEN: CatalogValue[] = [
  { value: 'Stk', synonyms: ['Stück', 'Stueck', 'St.'] },
  { value: 'kg' },
  { value: 'm' },
];

describe('normalizeForMatch', () => {
  test('faltet Umlaute, Case, Interpunktion und Whitespace', () => {
    expect(normalizeForMatch('Stück.')).toBe('stueck');
    expect(normalizeForMatch('  ACME   AG  ')).toBe('acme ag');
    expect(normalizeForMatch('Groß-Gerau')).toBe('gross gerau');
    expect(normalizeForMatch(null)).toBe('');
    expect(normalizeForMatch(42)).toBe('42');
  });
});

describe('levenshtein', () => {
  test('bekannte Distanzen', () => {
    expect(levenshtein('abc', 'abc')).toBe(0);
    expect(levenshtein('acme ag', 'acmee ag')).toBe(1);
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('', 'abc')).toBe(3);
  });

  test('Frueh-Abbruch liefert eine Zahl groesser als max', () => {
    expect(levenshtein('kitten', 'sitting', 1)).toBeGreaterThan(1);
  });
});

describe('matchCatalogValue', () => {
  test('exakt und Schreibweise', () => {
    expect(matchCatalogValue('Acme AG', LIEFERANTEN)).toEqual({ kind: 'exact', value: 'Acme AG' });
    expect(matchCatalogValue('acme ag', LIEFERANTEN)).toEqual({ kind: 'exact', value: 'Acme AG' });
    expect(matchCatalogValue('  ACME   AG ', LIEFERANTEN)).toEqual({ kind: 'exact', value: 'Acme AG' });
  });

  test('Synonyme inkl. Umlaut-Varianten', () => {
    expect(matchCatalogValue('acme', LIEFERANTEN).value).toBe('Acme AG');
    expect(matchCatalogValue('Stück', EINHEITEN)).toEqual({ kind: 'synonym', value: 'Stk' });
    expect(matchCatalogValue('stueck', EINHEITEN).value).toBe('Stk');
    expect(matchCatalogValue('St.', EINHEITEN).value).toBe('Stk');
  });

  test('Praefix/Enthalten ab Mindestlaenge', () => {
    expect(matchCatalogValue('Muster Bau', LIEFERANTEN)).toEqual({ kind: 'contains', value: 'Muster Bau GmbH' });
    expect(matchCatalogValue('Nordlicht Handel KG Zweigstelle', LIEFERANTEN).value).toBe('Nordlicht Handel KG');
    // zu kurz fuer Praefix-Logik -> kein Treffer ueber diesen Weg
    expect(matchCatalogValue('Mus', LIEFERANTEN).kind).toBe('none');
  });

  test('Tippfehler innerhalb des Budgets', () => {
    expect(matchCatalogValue('Acmee AG', LIEFERANTEN)).toEqual({ kind: 'fuzzy', value: 'Acme AG' });
    expect(matchCatalogValue('Nordlicht Handel KG', LIEFERANTEN).value).toBe('Nordlicht Handel KG');
  });

  test('mehrdeutig wird nicht gemappt', () => {
    const kandidaten: CatalogValue[] = [{ value: 'Kostenstelle A1' }, { value: 'Kostenstelle A2' }];
    const m = matchCatalogValue('Kostenstelle A3', kandidaten);
    expect(m.kind).toBe('ambiguous');
    expect(m.value).toBeUndefined();
    expect(m.candidates).toEqual(['Kostenstelle A1', 'Kostenstelle A2']);
  });

  test('unbekannter Wert liefert die naechsten Kandidaten', () => {
    const m = matchCatalogValue('Fremdfirma Schmidt e.K.', LIEFERANTEN);
    expect(m.kind).toBe('none');
    expect(m.value).toBeUndefined();
    expect(m.candidates).toHaveLength(3);
  });

  test('leerer Wert oder leerer Katalog', () => {
    expect(matchCatalogValue('', LIEFERANTEN).kind).toBe('none');
    expect(matchCatalogValue(null, LIEFERANTEN).kind).toBe('none');
    expect(matchCatalogValue('Acme AG', []).kind).toBe('none');
  });
});

describe('renderCatalogHint', () => {
  test('listet die Werte und die Ausweichregel', () => {
    const hint = renderCatalogHint(LIEFERANTEN);
    expect(hint).toContain('Acme AG · Muster Bau GmbH · Nordlicht Handel KG');
    expect(hint).toContain('gefundenen Wert');
  });

  test('kappt lange Kataloge', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ value: `Wert ${i + 1}` }));
    const hint = renderCatalogHint(many);
    expect(hint).toContain('Wert 40');
    expect(hint).not.toContain('Wert 41');
    expect(hint).toContain('(20 weitere)');
  });

  test('ohne Werte kein Hinweis', () => {
    expect(renderCatalogHint(undefined)).toBe('');
    expect(renderCatalogHint([])).toBe('');
  });
});

function project(overrides: Partial<ExtractionProject> = {}): ExtractionProject {
  return {
    id: 'p',
    name: 'Rechnungen',
    description: '',
    created: '2026-08-03T00:00:00.000Z',
    updated: '2026-08-03T00:00:00.000Z',
    fields: {
      lieferant: {
        type: 'text',
        required: true,
        label: 'Lieferant',
        catalog: { source: 'list', values: LIEFERANTEN },
      },
      positionen: {
        type: 'list',
        required: false,
        label: 'Positionen',
        item_fields: {
          bezeichnung: { type: 'text', label: 'Bezeichnung' },
          einheit: { type: 'text', label: 'Einheit', catalog: { source: 'list', values: EINHEITEN } },
        },
      },
    },
    guidelines: '',
    learning: { total_examples: 0, accuracy_estimate: 0, guideline_version: 0 },
    ...overrides,
  };
}

const noResolve = async () => ({ error: 'keine Tabelle erwartet' });

describe('validateProjectFields mit Katalogen', () => {
  function withCatalog(catalog: unknown) {
    const p = project();
    (p.fields.lieferant as any).catalog = catalog;
    return p.fields;
  }

  test('gueltige Kataloge passieren — auch normalisiert gleiche Synonyme desselben Werts', () => {
    expect(validateProjectFields(project().fields)).toBeNull();
    // "Stück" und "Stueck" normalisieren gleich, gehoeren aber beide zu "Stk"
    expect(validateProjectFields(withCatalog({ source: 'list', values: EINHEITEN }))).toBeNull();
    expect(validateProjectFields(withCatalog({ source: 'table', table_id: 't', column_id: 'c' }))).toBeNull();
  });

  test('leere Liste, fehlende Quelle und unvollstaendige Tabelle werden abgelehnt', () => {
    expect(validateProjectFields(withCatalog({ source: 'list', values: [] }))).toContain('keinen Wert');
    expect(validateProjectFields(withCatalog({ source: 'quatsch' }))).toContain('Quelle');
    expect(validateProjectFields(withCatalog({ source: 'table', table_id: 't' }))).toContain('Tabelle und Spalte');
  });

  test('echte Dubletten und fremde Synonyme werden abgelehnt', () => {
    expect(
      validateProjectFields(withCatalog({ source: 'list', values: [{ value: 'Acme AG' }, { value: 'acme ag' }] })),
    ).toContain('doppelt');
    expect(
      validateProjectFields(
        withCatalog({ source: 'list', values: [{ value: 'Acme AG' }, { value: 'Beta AG', synonyms: ['acme ag'] }] }),
      ),
    ).toContain('gehoert aber schon zu');
  });

  test('Werteliste am Listen-Feld selbst wird abgelehnt', () => {
    const fields = project().fields;
    (fields.positionen as any).catalog = { source: 'list', values: [{ value: 'X' }] };
    expect(validateProjectFields(fields)).toContain('gehoert an eine Spalte');
  });
});

describe('applyCatalogs', () => {
  test('gleicht Skalar und Listen-Spalten an und protokolliert', async () => {
    const data: Record<string, unknown> = {
      lieferant: 'acme ag',
      positionen: [{ bezeichnung: 'Kies', einheit: 'Stück' }, { bezeichnung: 'Zement', einheit: 'kg' }],
    };
    const issues = await applyCatalogs(project(), data, noResolve);

    expect(data.lieferant).toBe('Acme AG');
    expect((data.positionen as any[])[0].einheit).toBe('Stk');
    expect((data.positionen as any[])[1].einheit).toBe('kg'); // exakt -> unveraendert
    expect(issues).toHaveLength(2);
    expect(issues.every((i) => i.severity === 'info')).toBe(true);
    expect(hasBlockingIssue(issues)).toBe(false);
    expect(issues[0]!.message).toContain('angeglichen');
  });

  test('unbekannter Wert erzeugt einen blockierenden Befund', async () => {
    const data: Record<string, unknown> = { lieferant: 'Fremdfirma Schmidt' };
    const issues = await applyCatalogs(project(), data, noResolve);
    expect(data.lieferant).toBe('Fremdfirma Schmidt'); // nicht veraendert
    expect(issues).toHaveLength(1);
    expect(issues[0]!.severity).toBe('error');
    expect(hasBlockingIssue(issues)).toBe(true);
    expect(issues[0]!.message).toContain('Naechste Katalogwerte');
  });

  test('severity warn blockiert nicht', async () => {
    const p = project();
    p.fields.lieferant!.catalog!.severity = 'warn';
    const issues = await applyCatalogs(p, { lieferant: 'Fremdfirma' }, noResolve);
    expect(issues[0]!.severity).toBe('warn');
    expect(hasBlockingIssue(issues)).toBe(false);
  });

  test('auto_map:false laesst den Rohwert stehen', async () => {
    const p = project();
    p.fields.lieferant!.catalog!.auto_map = false;
    const data: Record<string, unknown> = { lieferant: 'acme' };
    const issues = await applyCatalogs(p, data, noResolve);
    expect(data.lieferant).toBe('acme');
    expect(issues[0]!.severity).toBe('error');
    expect(issues[0]!.message).toContain('weicht vom Katalogwert');
  });

  test('leere Werte und Felder ohne Katalog werden uebergangen', async () => {
    const data: Record<string, unknown> = { lieferant: '', positionen: [{ bezeichnung: 'Kies', einheit: null }] };
    expect(await applyCatalogs(project(), data, noResolve)).toEqual([]);
  });

  test('Tabellen-Quelle wird aufgeloest und nur einmal geladen', async () => {
    let calls = 0;
    const p = project();
    p.fields.lieferant!.catalog = { source: 'table', table_id: 'lieferanten', column_id: 'name' };
    const data: Record<string, unknown> = { lieferant: 'acme ag' };
    const issues = await applyCatalogs(p, data, async () => {
      calls += 1;
      return { values: LIEFERANTEN };
    });
    expect(calls).toBe(1);
    expect(data.lieferant).toBe('Acme AG');
    expect(issues[0]!.severity).toBe('info');
  });

  test('nicht ladbare Tabelle meldet warn statt zu blockieren', async () => {
    const p = project();
    p.fields.lieferant!.catalog = { source: 'table', table_id: 'weg', column_id: 'name' };
    const issues = await applyCatalogs(p, { lieferant: 'Irgendwer' }, async () => ({ error: 'Tabelle "weg" nicht gefunden' }));
    expect(issues[0]!.severity).toBe('warn');
    expect(issues[0]!.message).toContain('nicht pruefbar');
    expect(hasBlockingIssue(issues)).toBe(false);
  });

  test('ohne Kataloge passiert nichts', async () => {
    const p = project();
    delete p.fields.lieferant!.catalog;
    delete p.fields.positionen!.item_fields!.einheit!.catalog;
    expect(await applyCatalogs(p, { lieferant: 'X', positionen: [{ einheit: 'y' }] }, noResolve)).toEqual([]);
  });
});
