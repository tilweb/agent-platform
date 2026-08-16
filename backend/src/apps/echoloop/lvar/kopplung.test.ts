/**
 * Namenskopplung + Umbenennen-Cockpit gegen den Übungsfall:
 * 1 Kopplungs-Riss (C_ArchivPfad: 213 umbenannt, 211 noch „Archivordner"),
 * 1 Dublette (H_BetragZahl) + 1 Konsolidierung (RechnungenAnzahl) aus G4,
 * Vorabhaken gesetzt (C_ArchivPfad) vs. gesperrt (C_DruckerName, D-085).
 */
import { test, expect, describe } from 'bun:test';
import { analysiereKopplung } from './kopplung';
import type { NkNamensmodul, VarFundort } from './nk';
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

// Reiter 3 (CFG) sperrt C_DruckerName (D-085-Kreuz).
const erg = analysiereKopplung(modul, fundorte, { gesperrt: ['C_DruckerName'] });
const karten = new Map(erg.karten.map((k) => [k.alt, k]));

describe('Kopplung · Übungsfall', () => {
  test('genau 1 Kopplungs-Riss: C_ArchivPfad (213 neu, 211 alt)', () => {
    expect(erg.risse).toHaveLength(1);
    const r = erg.risse[0]!;
    expect(r.neu).toBe('C_ArchivPfad');
    expect(r.altName).toBe('Archivordner');
    expect(r.renamedIn).toContain('213');
    expect(r.oldIn).toContain('211');
  });

  test('G4: 1 Dublette (H_BetragZahl) + 1 Konsolidierung (RechnungenAnzahl)', () => {
    expect(erg.dubletten).toEqual(['H_BetragZahl']);
    expect(erg.konsolidierungen).toEqual(['RechnungenAnzahl']);
  });

  test('24 Umbenennen-Karten mit append-only IDs', () => {
    expect(erg.karten).toHaveLength(24);
    expect(karten.get('Archivordner')!.id).toBe('UB-Archivordner');
  });

  test('Vorabhaken: C_ArchivPfad gesetzt (schon umbenannt), C_DruckerName gesperrt (D-085)', () => {
    expect(karten.get('C_ArchivPfad')!.vorabHaken).toBe(true);
    expect(karten.get('C_ArchivPfad')!.status).toBe('erledigt');
    expect(karten.get('C_DruckerName')!.vorabHaken).toBe(false);
    expect(karten.get('C_DruckerName')!.gesperrt).toBe(true);
    expect(karten.get('C_DruckerName')!.status).toBe('frage');
  });

  test('offene Umbenennung (Alt≠Neu) → Status offen, kein Vorabhaken', () => {
    expect(karten.get('Archivordner')!.status).toBe('offen');
    expect(karten.get('Archivordner')!.vorabHaken).toBe(false);
  });
});
