/**
 * L-VAR ↔ RGA-Verzahnung gegen den Übungsfall: der NK-/Kopplungs-Zustand erzeugt
 * die erwarteten RGA-Dimensionshinweise (Dublette → D5/D9, Kopplungs-Riss → D6b),
 * ohne Levels zu setzen.
 */
import { test, expect, describe } from 'bun:test';
import { nkNachRga, hinweiseJeDimension } from './verzahnung';
import { pruefeNK, type NkNamensmodul, type VarFundort } from './nk';
import { analysiereKopplung } from './kopplung';
import { extractProcessFromPdf } from '../extract/emma';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const FIX = join(import.meta.dir, '..', 'extract', '__fixtures__', 'uebungsfall');
const modul = JSON.parse(readFileSync(join(FIX, 'nk-namensmodul.json'), 'utf8')) as NkNamensmodul;
const fundorte: VarFundort[] = [];
for (const f of readdirSync(join(FIX, 'prozesse')).filter((f) => f.endsWith('.pdf'))) {
  const nr = f.match(/Prozess_(\d+)/)?.[1] ?? '';
  const p = await extractProcessFromPdf(new Uint8Array(readFileSync(join(FIX, 'prozesse', f))), nr);
  for (const v of p.variablen) fundorte.push({ name: v.name, p: v.p });
}

const nk = pruefeNK(modul, fundorte);
const kopplung = analysiereKopplung(modul, fundorte);
const hinweise = nkNachRga(nk, kopplung);
const jeDim = hinweiseJeDimension(hinweise);

describe('Verzahnung · NK/Kopplung → RGA', () => {
  test('G4-Dublette (H_BetragZahl) erzeugt Hinweise an D5 und D9', () => {
    expect(jeDim.D5?.join(' ')).toContain('H_BetragZahl');
    expect(jeDim.D9?.join(' ')).toContain('H_BetragZahl');
  });

  test('Kopplungs-Riss (C_ArchivPfad) erzeugt Hinweis an D6b', () => {
    expect(jeDim.D6b?.join(' ')).toContain('C_ArchivPfad');
    expect(hinweise.find((h) => h.dim === 'D6b')?.quelle).toBe('kopplung');
  });

  test('keine harten Kanon-Verstöße im Übungsfall → kein D6-Kanon-Hinweis', () => {
    expect(nk.sperrend).toBe(false);
    expect(jeDim.D6 ?? []).not.toContain('harter Kanon-Verstoß');
  });

  test('Hinweise setzen keine Levels (nur Belege)', () => {
    for (const h of hinweise) expect(h).not.toHaveProperty('ist');
  });
});

describe('Verzahnung · harte Fälle', () => {
  test('Fachwert-Präfix (harter G1) → D6 + D8-Hinweis', () => {
    const badNk = pruefeNK({ map: [{ alt: 'X', neu: 'U_Falsch', rolle: 'U' }] });
    const h = nkNachRga(badNk);
    const dims = h.map((x) => x.dim);
    expect(dims).toContain('D6');
    expect(dims).toContain('D8');
  });
});
