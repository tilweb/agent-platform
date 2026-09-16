import { describe, expect, test } from 'bun:test';
import { buildLiftMap } from './level-lift';
import { cacheKey } from './service';
import type { CatalogEntry } from './types';

describe('cacheKey (Ergebnis-Cache)', () => {
  test('normalisiert Whitespace und Gross-/Kleinschreibung', () => {
    expect(cacheKey('Abbrucharbeiten')).toBe(cacheKey('  abbrucharbeiten  '));
    expect(cacheKey('Abbruch  und\n Entkernung')).toBe(cacheKey('abbruch und entkernung'));
    expect(cacheKey('Abbrucharbeiten')).not.toBe(cacheKey('Abbrucharbeiten GmbH'));
  });
});

function entry(code: string, kurztext: string): CatalogEntry {
  return { code, kurztext, langtext: kurztext, validFrom: '2025-01-01', validTo: null };
}

describe('buildLiftMap (synthetisch)', () => {
  test('hebt Klasse auf einzige textgleiche Unterklasse an', () => {
    const map = buildLiftMap([entry('4311', 'Abbrucharbeiten'), entry('43110', 'Abbrucharbeiten')]);
    expect(map.get('4311')).toBe('43110');
    expect(map.has('43110')).toBe(false);
  });

  test('kein Lift bei Einzelkind mit abweichendem Text', () => {
    const map = buildLiftMap([entry('10510', 'Herstellung von Milcherzeugnissen'), entry('105101', 'Käserei')]);
    expect(map.size).toBe(0);
  });

  test('kein Lift bei mehreren Kindern', () => {
    const map = buildLiftMap([
      entry('43110', 'Abbrucharbeiten'),
      entry('431101', 'Abbrucharbeiten'),
      entry('431102', 'Abbrucharbeiten'),
    ]);
    expect(map.has('43110')).toBe(false);
  });

  test('folgt Ketten nur solange textgleich', () => {
    const map = buildLiftMap([
      entry('1051', 'Milchverarbeitung'),
      entry('10510', 'Milchverarbeitung'),
      entry('105101', 'Käserei'),
    ]);
    expect(map.get('1051')).toBe('10510');
    expect(map.has('10510')).toBe(false);
  });

  test('liftet ueber zwei textgleiche Ebenen', () => {
    const map = buildLiftMap([entry('1234', 'X'), entry('12340', 'X'), entry('123400', 'X')]);
    expect(map.get('1234')).toBe('123400');
    expect(map.get('12340')).toBe('123400');
  });
});

describe('buildLiftMap (echter Katalog)', () => {
  test('IHK-Fall: 4311 → 43110, keine Fehl-Lifts', async () => {
    const catalog = (await Bun.file(new URL('./assets/catalog.json', import.meta.url)).json()) as CatalogEntry[];
    const map = buildLiftMap(catalog);

    expect(map.get('4311')).toBe('43110');
    // 43110 hat zwei Kinder (431101 Entkernung, 431102 Demontage) → kein Lift
    expect(map.has('43110')).toBe(false);
    // Einzelkind mit anderem Text (105101 Käserei) darf nicht liften
    expect(map.has('10510')).toBe(false);

    // Jeder Lift muss textgleich sein — Invariante ueber den ganzen Katalog
    const byCode = new Map(catalog.map(e => [e.code, e]));
    for (const [from, to] of map) {
      expect(byCode.get(from)!.kurztext).toBe(byCode.get(to)!.kurztext);
    }
  });
});
