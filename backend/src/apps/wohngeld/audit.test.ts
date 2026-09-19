/**
 * GOV-1 — Tests für die reinen Audit-Helfer (diffFelder / diffToVorherNachher / hatAenderung).
 * Die DB-schreibende `audit()`-Funktion wird hier bewusst NICHT getestet (I/O).
 */
import { test, expect, describe } from 'bun:test';
import { diffFelder, diffToVorherNachher, hatAenderung } from './audit';

describe('diffFelder', () => {
  test('liefert nur geänderte Felder', () => {
    const vorher = { status: 'posteingang', prioritaet: 'normal', sachbearbeiter: 'a' };
    const nachher = { status: 'sachbearbeitung', prioritaet: 'normal', sachbearbeiter: 'a' };
    const diff = diffFelder(vorher, nachher, ['status', 'prioritaet', 'sachbearbeiter']);
    expect(diff).toEqual({ status: { alt: 'posteingang', neu: 'sachbearbeitung' } });
  });

  test('leerer Diff, wenn nichts geändert', () => {
    const obj = { status: 'a', prioritaet: 'hoch' };
    const diff = diffFelder(obj, { ...obj }, ['status', 'prioritaet']);
    expect(diff).toEqual({});
    expect(hatAenderung(diff)).toBe(false);
  });

  test('betrachtet nur die angegebenen Felder', () => {
    const vorher = { status: 'a', geheim: 1 };
    const nachher = { status: 'a', geheim: 2 };
    const diff = diffFelder(vorher, nachher, ['status']);
    expect(diff).toEqual({});
  });

  test('erkennt Änderungen in verschachtelten Objekten (wohnung)', () => {
    const vorher = { wohnung: { miete: 500, plz: '12345' } };
    const nachher = { wohnung: { miete: 550, plz: '12345' } };
    const diff = diffFelder(vorher, nachher, ['wohnung']);
    expect(hatAenderung(diff)).toBe(true);
    expect(diff.wohnung!.alt).toEqual({ miete: 500, plz: '12345' });
    expect(diff.wohnung!.neu).toEqual({ miete: 550, plz: '12345' });
  });

  test('erkennt Änderungen in Arrays (bwz)', () => {
    const vorher = { bwz: [{ id: 'x', start: '2026-01-01' }] };
    const nachher = { bwz: [{ id: 'x', start: '2026-02-01' }] };
    const diff = diffFelder(vorher, nachher, ['bwz']);
    expect(hatAenderung(diff)).toBe(true);
  });

  test('undefined ↔ fehlend gilt als gleich', () => {
    const vorher: Record<string, unknown> = { frist: undefined };
    const nachher: Record<string, unknown> = {};
    const diff = diffFelder(vorher, nachher, ['frist']);
    expect(diff).toEqual({});
  });

  test('null → Wert wird als Änderung erkannt', () => {
    const vorher: Record<string, unknown> = { frist: null };
    const nachher: Record<string, unknown> = { frist: '2026-03-01' };
    const diff = diffFelder(vorher, nachher, ['frist']);
    expect(diff).toEqual({ frist: { alt: null, neu: '2026-03-01' } });
  });

  test('behandelt null/undefined Objekte robust', () => {
    expect(diffFelder(null, { status: 'a' }, ['status'])).toEqual({ status: { alt: null, neu: 'a' } });
    expect(diffFelder({ status: 'a' }, undefined, ['status'])).toEqual({ status: { alt: 'a', neu: null } });
  });
});

describe('diffToVorherNachher', () => {
  test('zerlegt Diff in getrennte vorher/nachher-Objekte', () => {
    const diff = diffFelder(
      { status: 'a', prioritaet: 'normal' },
      { status: 'b', prioritaet: 'hoch' },
      ['status', 'prioritaet'],
    );
    const { vorher, nachher } = diffToVorherNachher(diff);
    expect(vorher).toEqual({ status: 'a', prioritaet: 'normal' });
    expect(nachher).toEqual({ status: 'b', prioritaet: 'hoch' });
  });
});
