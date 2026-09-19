/**
 * GOV-1 — Tests für die reinen Audit-Helfer (diffFelder / diffToVorherNachher / hatAenderung).
 * Die DB-schreibende `audit()`-Funktion wird hier bewusst NICHT getestet (I/O).
 */
import { test, expect, describe } from 'bun:test';
import { diffFelder, diffToVorherNachher, hatAenderung, auditEintraegeToCsv } from './audit';
import type { AuditEintrag } from './types';

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

describe('auditEintraegeToCsv (GOV-4)', () => {
  function mk(over: Partial<AuditEintrag> = {}): AuditEintrag {
    return {
      id: 'a1', timestamp: '2026-01-04T10:30:00.000Z', aktion: 'vorgang.geoeffnet', objektTyp: 'vorgang',
      objektId: 'v1', vorgangId: 'v1', ergebnis: 'ok', akteurName: 'A', akteurRolle: 'editor', ip: '1.2.3.4', ...over,
    };
  }

  test('Kopfzeile enthält alle Felder, Werte semikolon-getrennt', () => {
    const csv = auditEintraegeToCsv([mk()]);
    const lines = csv.replace(/^﻿/, '').split('\r\n');
    expect(lines[0]).toBe('timestamp;akteur_name;akteur_rolle;aktion;objekt_typ;objekt_id;vorgang_id;ergebnis;detail;ip');
    expect(lines[1]).toContain('"vorgang.geoeffnet"');
    expect(lines[1]).toContain('"1.2.3.4"');
  });

  test('BOM vorangestellt + eine Zeile je Eintrag', () => {
    const csv = auditEintraegeToCsv([mk(), mk({ id: 'a2' })]);
    expect(csv.startsWith('﻿')).toBe(true);
    const rows = csv.replace(/^﻿/, '').trimEnd().split('\r\n');
    expect(rows).toHaveLength(3); // Header + 2 Zeilen
  });

  test('Anführungszeichen im Detail werden verdoppelt (Injection-sicher)', () => {
    const csv = auditEintraegeToCsv([mk({ detail: 'sagt "hallo"' })]);
    expect(csv).toContain('"sagt ""hallo"""');
  });

  test('Diff wird in die Detail-Spalte aufgenommen', () => {
    const csv = auditEintraegeToCsv([mk({ aktion: 'vorgang.geaendert', vorher: { status: 'a' }, nachher: { status: 'b' } })]);
    expect(csv).toContain('vorher=');
    expect(csv).toContain('nachher=');
  });
});
