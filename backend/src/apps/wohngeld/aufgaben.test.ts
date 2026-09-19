import { test, expect, describe } from 'bun:test';
import { aggregiereAufgaben } from './aufgaben';
import type { Vorgang, Akte } from './types';

function mkVorgang(over: Partial<Vorgang> = {}): Vorgang {
  return {
    id: 'v1', akteId: 'a1', antragsId: 'WG-1', wohngeldart: 'mietzuschuss', antragsart: 'erstantrag',
    status: 'sachbearbeitung', prioritaet: 'normal', version: 1, created_at: '', updated_at: '', ...over,
  };
}
function mkAkte(over: Partial<Akte> = {}): Akte {
  return { id: 'a1', name: 'Mustermann', version: 1, created_at: '', updated_at: '', ...over };
}

describe('aggregiereAufgaben', () => {
  test('offene Todos werden aufgenommen, erledigte nicht', () => {
    const v = mkVorgang({ todos: [
      { id: 't1', text: 'Nachweis anfordern', erledigt: false },
      { id: 't2', text: 'Erledigt', erledigt: true },
    ] });
    const out = aggregiereAufgaben([v], [mkAkte()], '2026-09-19');
    const todos = out.filter((a) => a.art === 'todo');
    expect(todos).toHaveLength(1);
    expect(todos[0]).toMatchObject({ text: 'Nachweis anfordern', antragsteller: 'Mustermann', status: 'sachbearbeitung' });
  });

  test('antragstellerName bevorzugt gegenüber Aktenname', () => {
    const v = mkVorgang({ todos: [{ id: 't1', text: 'X', erledigt: false }] });
    const out = aggregiereAufgaben([v], [mkAkte({ antragstellerName: 'Erika Musterfrau' })], '2026-09-19');
    expect(out[0]!.antragsteller).toBe('Erika Musterfrau');
  });

  test('Wiedervorlagen mit Überfälligkeits-Flag; überfällige zuerst', () => {
    const v1 = mkVorgang({ id: 'v1', antragsId: 'WG-1', wiedervorlage: '2026-09-25' });
    const v2 = mkVorgang({ id: 'v2', antragsId: 'WG-2', wiedervorlage: '2026-09-10' });
    const out = aggregiereAufgaben([v1, v2], [mkAkte()], '2026-09-19');
    const fristen = out.filter((a) => a.art === 'frist');
    expect(fristen).toHaveLength(2);
    expect(fristen[0]).toMatchObject({ antragsId: 'WG-2', ueberfaellig: true });
    expect(fristen[1]).toMatchObject({ antragsId: 'WG-1', ueberfaellig: false });
  });

  test('Fristen stehen vor Todos', () => {
    const v = mkVorgang({ wiedervorlage: '2026-09-20', todos: [{ id: 't1', text: 'X', erledigt: false }] });
    const out = aggregiereAufgaben([v], [mkAkte()], '2026-09-19');
    expect(out[0]!.art).toBe('frist');
    expect(out[out.length - 1]!.art).toBe('todo');
  });

  test('keine Aufgaben → leere Liste', () => {
    expect(aggregiereAufgaben([mkVorgang()], [mkAkte()], '2026-09-19')).toEqual([]);
  });
});
