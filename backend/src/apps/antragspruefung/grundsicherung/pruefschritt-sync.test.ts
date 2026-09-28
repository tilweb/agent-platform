import { describe, test, expect } from 'bun:test';
import { planePruefschrittSync, pruefschrittSchluessel } from './pruefschritt-sync';
import type { PruefBefund, Pruefschritt } from './types';

const befund = (regelId: string, personId?: string): PruefBefund => ({
  regelId, personId, kategorie: 'vollstaendigkeit', typ: 'anforderung', titel: regelId, belegtext: '',
});
type B = Pick<Pruefschritt, 'id' | 'regelId' | 'personId' | 'status' | 'automatisch'>;
const schritt = (id: string, regelId: string, o: Partial<B> = {}): B => ({ id, regelId, status: 'offen', automatisch: true, ...o });

describe('planePruefschrittSync', () => {
  test('leerer Bestand: alle Befunde anlegen', () => {
    const plan = planePruefschrittSync([], [befund('mietvertrag'), befund('rentenbescheid', 'p1')]);
    expect(plan.anlegen.map((b) => b.regelId)).toEqual(['mietvertrag', 'rentenbescheid']);
    expect(plan.entfernen).toEqual([]);
  });

  test('idempotent: vorhandener automatischer Schritt wird nicht doppelt angelegt', () => {
    const plan = planePruefschrittSync([schritt('s1', 'mietvertrag')], [befund('mietvertrag')]);
    expect(plan).toEqual({ anlegen: [], entfernen: [], angleichen: [] });
  });

  test('Schlüssel ist regelId + personId', () => {
    const plan = planePruefschrittSync([schritt('s1', 'identitaet-jede-person', { personId: 'p1' })], [
      befund('identitaet-jede-person', 'p1'), befund('identitaet-jede-person', 'p2'),
    ]);
    expect(plan.anlegen.map((b) => b.personId)).toEqual(['p2']);
    expect(pruefschrittSchluessel('x', undefined)).toBe(pruefschrittSchluessel('x', null));
  });

  test('verschwundener Befund: nur automatische, OFFENE Schritte werden entfernt', () => {
    const plan = planePruefschrittSync([
      schritt('auto-offen', 'a'),
      schritt('auto-erledigt', 'b', { status: 'erledigt' }),
      schritt('auto-verworfen', 'c', { status: 'verworfen' }),
      schritt('manuell', 'd', { automatisch: false }),
    ], []);
    expect(plan.entfernen).toEqual(['auto-offen']);
  });

  test('manueller Schritt mit gleicher regelId verhindert keinen automatischen', () => {
    const plan = planePruefschrittSync([schritt('m', 'kontoauszuege', { automatisch: false })], [befund('kontoauszuege')]);
    expect(plan.anlegen).toHaveLength(1);
  });

  test('erledigter automatischer Schritt bleibt, Befund wird nicht erneut angelegt', () => {
    const plan = planePruefschrittSync([schritt('e', 'kontoauszuege', { status: 'erledigt' })], [befund('kontoauszuege')]);
    expect(plan).toEqual({ anlegen: [], entfernen: [], angleichen: [] });
  });

  test('doppelte Befunde im selben Lauf werden nur einmal angelegt', () => {
    const plan = planePruefschrittSync([], [befund('a'), befund('a')]);
    expect(plan.anlegen).toHaveLength(1);
  });
});

test('offene automatische Schritte werden an geänderten Typ/Titel der Regel angeglichen, erledigte nicht', () => {
  const befund = { regelId: 'plausi-mietvertrag-unsigniert', kategorie: 'plausibilitaet', typ: 'info', titel: 'Unterschrift im Mietvertrag bitte sichten', belegtext: 'x' } as never;
  const plan = planePruefschrittSync([
    { id: 'a', regelId: 'plausi-mietvertrag-unsigniert', status: 'offen', automatisch: true, typ: 'anforderung', titel: 'Mietvertrag ohne Unterschrift' },
    { id: 'b', regelId: 'plausi-mietvertrag-unsigniert', personId: 'p1', status: 'erledigt', automatisch: true, typ: 'anforderung', titel: 'alt' },
  ] as never, [befund, { ...(befund as object), personId: 'p1' } as never]);
  expect(plan.angleichen.map((x) => x.id)).toEqual(['a']);
  expect(plan.anlegen).toEqual([]);
  const gleich = planePruefschrittSync([{ id: 'a', regelId: 'plausi-mietvertrag-unsigniert', status: 'offen', automatisch: true, typ: 'info', titel: 'Unterschrift im Mietvertrag bitte sichten' }] as never, [befund]);
  expect(gleich.angleichen).toEqual([]);
});
