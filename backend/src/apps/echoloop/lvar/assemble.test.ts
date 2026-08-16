/**
 * L-VAR-Assembly gegen den Übungsfall: die vier Verfahren + Verzahnung liefern
 * in einem Aufruf das erwartete Explorer-Ergebnis (NK 24→21, CFG 7 Klassen,
 * Steckbriefe MP/UNENTSCHIEDEN, 1 Kopplungs-Riss, D-085-Sperre durchgereicht).
 */
import { test, expect, describe } from 'bun:test';
import { assembleLvar, type LvarInput } from './assemble';
import type { NkNamensmodul, VarFundort } from './nk';
import type { CfgTarget, CfgExcel } from './cfg';
import { extractProcessFromPdf } from '../extract/emma';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const FIX = join(import.meta.dir, '..', 'extract', '__fixtures__', 'uebungsfall');
const namensmodul = JSON.parse(readFileSync(join(FIX, 'nk-namensmodul.json'), 'utf8')) as NkNamensmodul;
const cfgDemo = JSON.parse(readFileSync(join(FIX, 'cfg-demo.json'), 'utf8')) as { targets: CfgTarget[]; excel: CfgExcel[] };

const fundorte: VarFundort[] = [];
const callGraph: { von: string; nach: string }[] = [];
for (const f of readdirSync(join(FIX, 'prozesse')).filter((f) => f.endsWith('.pdf')).sort()) {
  const nr = f.match(/Prozess_(\d+)/)?.[1] ?? '';
  const p = await extractProcessFromPdf(new Uint8Array(readFileSync(join(FIX, 'prozesse', f))), nr);
  for (const v of p.variablen) fundorte.push({ name: v.name, p: v.p });
  for (const ziel of p.aufrufe) callGraph.push({ von: nr, nach: ziel });
}

const input: LvarInput = { namensmodul, fundorte, callGraph, cfg: { targets: cfgDemo.targets, excel: cfgDemo.excel } };
const erg = assembleLvar(input);

describe('L-VAR-Assembly · Übungsfall', () => {
  test('Reiter 1: NK 24→21, G4 offen', () => {
    expect(erg.nk.zielnamen).toBe(24);
    expect(erg.nk.entschieden).toBe(21);
    expect(erg.nk.offen).toEqual(['G4']);
  });

  test('Reiter 1: 1 Kopplungs-Riss, D-085-Vorabhaken gesperrt', () => {
    expect(erg.kopplung.risse).toHaveLength(1);
    const drucker = erg.kopplung.karten.find((k) => k.neu === 'C_DruckerName' && k.alt === 'C_DruckerName');
    expect(drucker?.gesperrt).toBe(true);   // Sperre kam aus Reiter 3 (CFG)
  });

  test('Reiter 2: Typen aus dem Namensmodul (gesetzt) — 210 MP · 213 TP · 211/214 SP', () => {
    const t = new Map(erg.steckbriefe.map((s) => [s.nr, s]));
    expect(t.get('210')!.typ).toBe('MP');
    expect(t.get('213')!.typ).toBe('TP');
    expect(t.get('211')!.typ).toBe('SP');
    expect(t.get('213')!.typQuelle).toBe('gesetzt');
  });

  test('Reiter 3: alle 7 CFG-Diff-Klassen vorhanden', () => {
    expect(erg.cfg).not.toBeNull();
    expect(erg.cfg!.verteilung.gleich).toBe(1);
    expect(erg.cfg!.verteilung.fehlend).toBe(1);
    expect(erg.cfg!.verteilung.nicht_verglichen).toBe(3);
  });

  test('Verzahnung: Dublette → D5/D9, Kopplungs-Riss → D6b', () => {
    const dims = erg.rgaHinweise.map((h) => h.dim);
    expect(dims).toContain('D5');
    expect(dims).toContain('D6b');
  });

  test('ohne CFG-Eingabe: cfg null, restliche Reiter arbeiten', () => {
    const ohne = assembleLvar({ namensmodul, fundorte, callGraph });
    expect(ohne.cfg).toBeNull();
    expect(ohne.nk.zielnamen).toBe(24);
  });
});
