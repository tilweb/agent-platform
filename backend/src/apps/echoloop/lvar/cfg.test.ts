/**
 * CFG-Generator gegen die Übungsfall-Golden-Referenz (cfg-demo.json, modelliert
 * aus _DATENSATZ.md §3 Reiter 3): alle 7 Diff-Klassen + Excel-Waisen, jede genau
 * einmal, inkl. D-085-Kreuz-Widerspruch (C_DruckerName fehlend ↔ DruckerName verwaist).
 */
import { test, expect, describe } from 'bun:test';
import { generiereCfg, cfgAlsCsv, type CfgTarget, type CfgExcel } from './cfg';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FIX = join(import.meta.dir, '..', 'extract', '__fixtures__', 'uebungsfall');
const demo = JSON.parse(readFileSync(join(FIX, 'cfg-demo.json'), 'utf8')) as {
  targets: CfgTarget[]; excel: CfgExcel[];
  _golden: { klassen: Record<string, string>; verwaist: Record<string, string>; abweichendKandidaten: Record<string, string[]>; vorabhakenGesperrt: string[] };
};

const erg = generiereCfg(demo.targets, demo.excel);
const byKey = new Map(erg.schluessel.map((s) => [s.key, s] as const));

describe('CFG-Generator · Übungsfall-Golden', () => {
  test('Modus ABGLEICH (eine Excel hinterlegt)', () => {
    expect(erg.modus).toBe('ABGLEICH');
  });

  test('jede der 7 Diff-Klassen trifft den erwarteten Schlüssel', () => {
    for (const [key, klasse] of Object.entries(demo._golden.klassen)) {
      expect(`${key}=${byKey.get(key)?.klasse}`).toBe(`${key}=${klasse}`);
    }
  });

  test('alle 7 Klassen kommen vor (Vollständigkeit)', () => {
    expect(erg.verteilung.gleich).toBe(1);
    expect(erg.verteilung.abweichend).toBe(1);
    expect(erg.verteilung.unklar).toBe(1);
    expect(erg.verteilung.nur_excel).toBe(1);
    expect(erg.verteilung.nur_panel).toBe(1);
    expect(erg.verteilung.fehlend).toBe(1);
    expect(erg.verteilung.nicht_verglichen).toBe(3);
  });

  test('abweichend zeigt drei Kandidaten (Excel 2000 · Panel 1000 · 210 trägt 500), keiner belegt vor', () => {
    const kand = byKey.get('C_PruefSchwelleZahl')?.kandidaten ?? [];
    expect([...kand].sort()).toEqual(['1000', '2000', '500']); // Menge, keiner bevorzugt (Reihenfolge irrelevant)
    expect(kand[0]).toBe('2000'); // Excel-Wert steht vorn
  });

  test('D-085: C_DruckerName fehlend + Vorabhaken gesperrt', () => {
    const d = byKey.get('C_DruckerName');
    expect(d?.klasse).toBe('fehlend');
    expect(d?.vorabhakenGesperrt).toBe(true);
    expect(d?.hinweis).toContain('unfertige Umbenennung');
  });

  test('Excel-Waisen: DruckerName = Verdacht (halbe Umbenennung), Faxgeraet = Altlast', () => {
    const w = new Map(erg.verwaist.map((x) => [x.key, x]));
    expect(w.get('DruckerName')?.art).toBe('verdacht');
    expect(w.get('Faxgeraet')?.art).toBe('altlast');
    expect(erg.verwaist).toHaveLength(2);
  });

  test('CSV-Export enthält Kopf + alle Schlüssel + Waisen', () => {
    const csv = cfgAlsCsv(erg);
    expect(csv.split('\n')[0]).toContain('Schluessel;CONFIG-Prozess;Klasse');
    expect(csv).toContain('C_EingangPfad;211;gleich');
    expect(csv).toContain('verwaist:altlast');
  });
});

describe('CFG-Generator · Modus-Erkennung', () => {
  test('keine Excel hinterlegt → ERSTANLAGE', () => {
    const erg2 = generiereCfg(
      [{ key: 'C_Pfad', configProzess: '211', panelWerte: { '211': 'x' } }],
      [{ configProzess: '211', vorhanden: false, werte: {} }],
    );
    expect(erg2.modus).toBe('ERSTANLAGE');
    expect(erg2.schluessel[0]!.klasse).toBe('nicht_verglichen');
  });
});
