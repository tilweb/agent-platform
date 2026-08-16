/**
 * /prozess-start Einbau-Tabelle gegen den Übungsfall: 8 Spalten je Prozess,
 * Kopfblock-§A8-Format, C_ProzessTyp, Frische-Kontrakt nur bei SP (Verstoß wo
 * T_-Frische-Variablen fehlen), Umbenenn-Risiko als [Panel]-❓.
 */
import { test, expect, describe } from 'bun:test';
import { einbauTabelle } from './prozessstart';
import type { NkNamensmodul, VarFundort } from './nk';
import { extractProcessFromPdf } from '../extract/emma';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const FIX = join(import.meta.dir, '..', 'extract', '__fixtures__', 'uebungsfall');
const namensmodul = JSON.parse(readFileSync(join(FIX, 'nk-namensmodul.json'), 'utf8')) as NkNamensmodul;

const fundorte: VarFundort[] = [];
const callGraph: { von: string; nach: string }[] = [];
for (const f of readdirSync(join(FIX, 'prozesse')).filter((f) => f.endsWith('.pdf')).sort()) {
  const nr = f.match(/Prozess_(\d+)/)?.[1] ?? '';
  const p = await extractProcessFromPdf(new Uint8Array(readFileSync(join(FIX, 'prozesse', f))), nr);
  for (const v of p.variablen) fundorte.push({ name: v.name, p: v.p });
  for (const ziel of p.aufrufe) callGraph.push({ von: nr, nach: ziel });
}

const tabelle = einbauTabelle({ namensmodul, fundorte, callGraph });
const byNr = new Map(tabelle.map((z) => [z.nr, z]));

describe('/prozess-start · Einbau-Tabelle Übungsfall', () => {
  test('je Prozess eine Zeile mit allen 8 Spalten', () => {
    expect(tabelle).toHaveLength(5);
    const z = byNr.get('213')!;
    expect(z.istName).toBe('Rechnung prüfen');
    expect(z.namensVorschlag).toBe('MW_ERECH_Rechnung-Pruefen_SUB');
    expect(z.typ).toBe('TP');
    expect(z.cProzessTyp).toBe('TP');
  });

  test('Kopfblock im §A8-Format (Name · v · Zweck · Owner · Takt · Typ · NK)', () => {
    const k = byNr.get('210')!.kopfblock;
    expect(k).toContain('MW_ERECH_Rechnungslauf_MASTER · v1.0');
    expect(k).toContain('Typ: MP');
    expect(k).toContain('NK: v2 ab Bau');
    expect(k).toContain('Owner: ❓');
  });

  test('Frische-Kontrakt nur bei SP; SP ohne T_-Frische-Variablen = Verstoß', () => {
    expect(byNr.get('210')!.frische).toBeUndefined();  // MP
    expect(byNr.get('213')!.frische).toBeUndefined();  // TP
    const sp = byNr.get('211')!;                        // SP (CONFIG)
    expect(sp.frische?.benoetigt).toBe(true);
    expect(sp.frische?.verstoss).toBe(true);           // keine T_LetzterLauf/T_StandDatum
    expect(sp.frische?.schwelleVorschlag).toContain('Fachbereich');
  });

  test('Typ-Begründung passt zum Typ', () => {
    expect(byNr.get('210')!.typBegruendung).toContain('Master');
    expect(byNr.get('213')!.typBegruendung).toContain('Fachlogik');
  });

  test('Umbenenn-Risiko ist immer eine [Panel]-Frage (nie statisch verneint)', () => {
    for (const z of tabelle) expect(z.umbenennFrage).toContain('[Panel]');
    // 213 wird von 210 gerufen → Aufrufer im Text.
    expect(byNr.get('213')!.umbenennAufrufer).toContain('210');
  });
});
