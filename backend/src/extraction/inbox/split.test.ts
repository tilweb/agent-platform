import { test, expect } from 'bun:test';
import { rangesFromBoundaries, parseBoundaryVerdict } from './split';

// ============== rangesFromBoundaries ==============

test('keine Grenzen → ein Bereich ueber alles', () => {
  expect(rangesFromBoundaries(5, [false, false, false, false])).toEqual([{ from: 1, to: 5 }]);
});

test('alle Grenzen → lauter Einzelseiten', () => {
  expect(rangesFromBoundaries(3, [true, true])).toEqual([
    { from: 1, to: 1 },
    { from: 2, to: 2 },
    { from: 3, to: 3 },
  ]);
});

test('gemischte Grenzen', () => {
  // Schnitt nach Seite 2 und nach Seite 4 → [1-2], [3-4], [5-6]
  expect(rangesFromBoundaries(6, [false, true, false, true, false])).toEqual([
    { from: 1, to: 2 },
    { from: 3, to: 4 },
    { from: 5, to: 6 },
  ]);
});

test('eine Seite → ein Bereich', () => {
  expect(rangesFromBoundaries(1, [])).toEqual([{ from: 1, to: 1 }]);
});

test('pageCount 0 → leer', () => {
  expect(rangesFromBoundaries(0, [])).toEqual([]);
});

test('Laengen-Mismatch: fehlende Urteile = kein Schnitt, ueberzaehlige ignoriert', () => {
  expect(rangesFromBoundaries(4, [true])).toEqual([{ from: 1, to: 1 }, { from: 2, to: 4 }]);
  expect(rangesFromBoundaries(2, [true, true, true])).toEqual([{ from: 1, to: 1 }, { from: 2, to: 2 }]);
});

// ============== parseBoundaryVerdict ==============

test('klares true trennt (auch mit Punkt/Case/Whitespace)', () => {
  expect(parseBoundaryVerdict('true')).toBe(true);
  expect(parseBoundaryVerdict(' True. ')).toBe(true);
  expect(parseBoundaryVerdict('TRUE\n')).toBe(true);
});

test('false und alles Unklare trennen NICHT (konservativ)', () => {
  expect(parseBoundaryVerdict('false')).toBe(false);
  expect(parseBoundaryVerdict('true, weil ...')).toBe(false);
  expect(parseBoundaryVerdict('Das ist true')).toBe(false);
  expect(parseBoundaryVerdict('')).toBe(false);
  expect(parseBoundaryVerdict(null)).toBe(false);
  expect(parseBoundaryVerdict(undefined)).toBe(false);
});
