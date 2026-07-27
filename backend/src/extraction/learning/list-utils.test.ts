import { test, expect } from 'bun:test';
import { dedupeListItems } from './list-utils';
import type { ProjectItemField } from './types';

const ITEM_FIELDS: Record<string, ProjectItemField> = {
  bezeichnung: { type: 'text', label: 'Bezeichnung' },
  menge: { type: 'number', label: 'Menge' },
};

test('entfernt exakte Duplikate (Union-Merge-Artefakte)', () => {
  const items = [
    { bezeichnung: 'Schraube M4', menge: 10 },
    { bezeichnung: 'Schraube M4', menge: 10 },
    { bezeichnung: 'Mutter M4', menge: 10 },
  ];
  const result = dedupeListItems(items, ITEM_FIELDS);
  expect(result).toEqual([
    { bezeichnung: 'Schraube M4', menge: 10 },
    { bezeichnung: 'Mutter M4', menge: 10 },
  ]);
});

test('normalisiert Strings (trim + lowercase) fuer den Vergleich', () => {
  const items = [
    { bezeichnung: 'Schraube M4', menge: 10 },
    { bezeichnung: '  schraube m4 ', menge: 10 },
  ];
  expect(dedupeListItems(items, ITEM_FIELDS)).toHaveLength(1);
});

test('unterschiedliche Positionen bleiben erhalten', () => {
  const items = [
    { bezeichnung: 'Schraube M4', menge: 10 },
    { bezeichnung: 'Schraube M4', menge: 20 },
  ];
  expect(dedupeListItems(items, ITEM_FIELDS)).toHaveLength(2);
});

test('fehlende Felder und null werden vereinheitlicht', () => {
  const items = [
    { bezeichnung: 'X' }, // menge fehlt
    { bezeichnung: 'X', menge: null },
    { bezeichnung: 'X', menge: undefined },
  ];
  expect(dedupeListItems(items, ITEM_FIELDS)).toHaveLength(1);
});

test('leere Liste bleibt leer', () => {
  expect(dedupeListItems([], ITEM_FIELDS)).toEqual([]);
});

test('Nicht-Objekt-Eintraege bleiben unveraendert erhalten', () => {
  const items = ['freitext', 'freitext', 42, null];
  expect(dedupeListItems(items, ITEM_FIELDS)).toEqual(['freitext', 'freitext', 42, null]);
});

test('Vergleich nutzt nur definierte item_fields (Fremd-Keys ignoriert)', () => {
  const items = [
    { bezeichnung: 'A', menge: 1, _extra: 'x' },
    { bezeichnung: 'A', menge: 1, _extra: 'y' },
  ];
  // gleiche definierte Spalten → Duplikat, trotz unterschiedlicher Fremd-Keys
  expect(dedupeListItems(items, ITEM_FIELDS)).toHaveLength(1);
});
