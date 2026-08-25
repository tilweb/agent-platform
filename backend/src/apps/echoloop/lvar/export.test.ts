/**
 * L-VAR-Export-Builder: bildet die Extraktions-Daten in Sebs Engine-Format ab
 * (varId→id, prozesse aus den Items) und reicht Namensmodul/CFG/Stand/Analyse durch.
 */
import { test, expect, describe } from 'bun:test';
import { buildLvarExport, LVAR_EXPORT_SCHEMA } from './export';
import type { Variable, ProzessItem } from '../types';
import type { LvarErgebnis } from './assemble';

const variablen = [
  { p: '210', varId: '501', name: 'C_ArchivPfad', typ: 'string', schnitt: 'Privat', init: 'C:\\x', pos: 1, fund: [{ s: '2', typ: 'Warten' }] } as unknown as Variable,
];
const items = [
  { nr: '210', nameExport: 'Rechnungslauf', prozessStand: '2026-08-05 14:22:10', druckStand: '2026-08-07 09:15:00', aufrufe: ['211', '212'], cvrefs: [], ausgaenge: { erfolg: 1, fehler: 0 } } as unknown as ProzessItem,
];
const analyse = { nk: { zielnamen: 24 } } as unknown as LvarErgebnis;

const exp = buildLvarExport({
  exportiertAm: '2026-08-25T10:00:00Z',
  kd: 'DEMO', familie: 'ERECH',
  variablen, items,
  namensmodul: { map: [{ alt: 'Archivordner', neu: 'C_ArchivPfad', rolle: 'C' }] },
  cfg: undefined,
  stand: { 'UB-Archivordner-st': 'erledigt', 'UB-Archivordner-fb': 'passt' },
  analyse,
});

describe('L-VAR-Export', () => {
  test('_meta trägt Schema, Quelle, Kunde/Familie', () => {
    expect(exp._meta.schema).toBe(LVAR_EXPORT_SCHEMA);
    expect(exp._meta.quelle).toBe('Workplace Echo-Loop');
    expect(exp._meta.kd).toBe('DEMO');
    expect(exp._meta.familie).toBe('ERECH');
  });

  test('daten.variablen im Engine-Format (varId→id, init/pos/fund)', () => {
    const v = exp.daten.variablen[0]!;
    expect(v.id).toBe('501');
    expect(v.p).toBe('210');
    expect(v.init).toBe('C:\\x');
    expect(v.pos).toBe(1);
    expect(v.fund).toEqual([{ s: '2', typ: 'Warten' }]);
  });

  test('daten.prozesse aus den Items (Stände, Call-Graph, Ausgänge)', () => {
    const p = exp.daten.prozesse['210']!;
    expect(p.name_export).toBe('Rechnungslauf');
    expect(p.prozess_stand).toBe('2026-08-05 14:22:10');
    expect(p.aufrufe).toEqual(['211', '212']);
    expect(p.ausgaenge).toEqual({ erfolg: 1, fehler: 0 });
  });

  test('Namensmodul + Kunden-Arbeitsstand + Analyse werden durchgereicht', () => {
    expect(exp.namensmodul?.map[0]?.neu).toBe('C_ArchivPfad');
    expect(exp.stand['UB-Archivordner-st']).toBe('erledigt');
    expect(exp.analyse.nk.zielnamen).toBe(24);
  });
});
