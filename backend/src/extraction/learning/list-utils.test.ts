import { test, expect } from 'bun:test';
import { dedupeListItems } from './list-utils';
import type { ProjectItemField } from './types';

const ITEM_FIELDS: Record<string, ProjectItemField> = {
  bezeichnung: { type: 'text', label: 'Bezeichnung' },
  menge: { type: 'number', label: 'Menge' },
};

test('bewahrt echte identische Positionen und ihre Indizes', () => {
  const items = [{ bezeichnung: 'A', menge: 1 }, { bezeichnung: 'A', menge: 1 }, { bezeichnung: 'B', menge: 2 }];
  expect(dedupeListItems(items, ITEM_FIELDS)).toEqual(items);
  expect(dedupeListItems(items, ITEM_FIELDS)[2]).toBe(items[2]);
});
test('normalisiert oder entfernt keine Quellzeilen', () => {
  const items = [{ bezeichnung: 'A' }, { bezeichnung: 'a', menge: null }, null, 'text'];
  expect(dedupeListItems(items, ITEM_FIELDS)).toEqual(items);
});
test('leere Liste bleibt leer', () => expect(dedupeListItems([], ITEM_FIELDS)).toEqual([]));
