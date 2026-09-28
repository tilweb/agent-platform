import { test, expect } from 'bun:test';
import { aggregiereAufgaben } from './aufgaben';
import type { Akte, Vorgang } from './types';

const akte = { id: 'a1', name: 'Muster, Erika', antragstellerName: 'Erika Muster' } as Akte;
const v = (id: string, o: Partial<Vorgang>): Vorgang => ({
  id, akteId: 'a1', vorgangsnummer: `GS-${id}`, antragsart: 'erstantrag', status: 'sachbearbeitung', prioritaet: 'normal',
  version: 1, created_at: '', updated_at: '', ...o,
});

test('Fristen vor Todos, überfällige zuerst, erledigte Todos und abgeschlossene Vorgänge ohne Frist-Aufgabe', () => {
  const aufgaben = aggregiereAufgaben([
    v('1', { wiedervorlage: '2026-10-10', todos: [{ id: 't1', text: 'Rückruf', erledigt: false }, { id: 't2', text: 'x', erledigt: true }] }),
    v('2', { frist: '2026-09-01' }),
    v('3', { wiedervorlage: '2026-09-01', status: 'abgeschlossen' }),
  ], [akte], '2026-09-27');
  expect(aufgaben.map((a) => (a.art === 'frist' ? `frist:${a.vorgangId}:${a.ueberfaellig}` : `todo:${a.todoId}`))).toEqual([
    'frist:2:true', 'frist:1:false', 'todo:t1',
  ]);
  expect(aufgaben[0]!.antragsteller).toBe('Erika Muster');
  expect(aufgaben[0]!.vorgangsnummer).toBe('GS-2');
});
