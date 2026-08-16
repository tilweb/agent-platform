/**
 * Prozess-Steckbriefe gegen den Übungsfall: MP maschinell aus dem Call-Graph
 * (aus der echten Extraktion), TP/SP fachlich = unentschieden, CFG → SP,
 * Soll-Kaskade (entschieden > twin > Struktur-Vorschlag D-095), Alt-Stand-Badge.
 */
import { test, expect, describe } from 'bun:test';
import { baueSteckbriefe, type SteckbriefInput } from './steckbriefe';
import { extractProcessFromPdf } from '../extract/emma';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const FIX = join(import.meta.dir, '..', 'extract', '__fixtures__', 'uebungsfall');

// Call-Graph + Stände aus der echten Koordinaten-Extraktion aufbauen.
const callGraph: { von: string; nach: string }[] = [];
const stand: Record<string, string> = {};
for (const f of readdirSync(join(FIX, 'prozesse')).filter((f) => f.endsWith('.pdf')).sort()) {
  const nr = f.match(/Prozess_(\d+)/)?.[1] ?? '';
  const p = await extractProcessFromPdf(new Uint8Array(readFileSync(join(FIX, 'prozesse', f))), nr);
  stand[nr] = p.prozess_stand ?? '';
  for (const ziel of p.aufrufe) callGraph.push({ von: nr, nach: ziel });
}

describe('Steckbriefe · reine Struktur-Ableitung (ohne gesetzten Typ)', () => {
  const input: SteckbriefInput = {
    namensraum: 'MW', familie: 'ERECH',
    prozesse: {
      '210': { ist: 'Rechnungseingang · Hauptlauf', stand: stand['210'] },
      '211': { ist: 'MW_ERECH_Config_UTIL', istConfig: true, stand: stand['211'] },
      '212': { ist: 'Postfach auslesen', stand: stand['212'] },
      '213': { ist: 'Rechnung prüfen', stand: stand['213'] },
      '214': { ist: 'Ablage und Protokoll · Config', istConfig: true, stand: stand['214'] },
    },
    callGraph,
  };
  const briefe = new Map(baueSteckbriefe(input).map((s) => [s.nr, s]));

  test('210 ruft andere, wird nicht gerufen → MP maschinell abgeleitet', () => {
    expect(briefe.get('210')!.typ).toBe('MP');
    expect(briefe.get('210')!.typQuelle).toBe('abgeleitet');
    expect(briefe.get('210')!.gerufen.length).toBeGreaterThan(0);
    expect(briefe.get('210')!.aufrufer).toEqual([]);
  });

  test('CFG-Prozesse 211/214 → SP (config), nie geraten', () => {
    expect(briefe.get('211')!.typ).toBe('SP');
    expect(briefe.get('211')!.typQuelle).toBe('config');
    expect(briefe.get('214')!.typ).toBe('SP');
  });

  test('213 (gerufen, Fachlogik) bleibt UNENTSCHIEDEN — TP/SP wird nie geraten', () => {
    expect(briefe.get('213')!.typ).toBe('UNENTSCHIEDEN');
    expect(briefe.get('213')!.typQuelle).toBe('offen');
  });

  test('Soll-Vorschlag (D-095) folgt dem Schema NS_FAMILIE_Funktion_Rolle', () => {
    expect(briefe.get('210')!.soll).toBe('MW_ERECH_Rechnungseingang_MASTER');
    expect(briefe.get('210')!.sollQuelle).toBe('vorschlag');
  });

  test('213 steht auf altem Stand (Juli) → Alt-Stand-Badge', () => {
    expect(briefe.get('213')!.altStand).toBe(true);
    expect(briefe.get('210')!.altStand).toBe(false);
  });

  test('Kritikalität bleibt leer, wenn nicht belegt (nie geraten)', () => {
    expect(briefe.get('210')!.krit).toBeUndefined();
  });
});

describe('Steckbriefe · gesetzter Typ + Soll-Kaskade', () => {
  test('gesetzter Typ gewinnt; entschiedener Soll schlägt Twin + Vorschlag', () => {
    const s = baueSteckbriefe({
      namensraum: 'MW', familie: 'ERECH',
      prozesse: {
        '213': { ist: 'Rechnung prüfen', typGesetzt: 'TP', sollEntschieden: 'MW_ERECH_Rechnung-Pruefen_SUB', sollTwin: 'X', krit: 'hoch', kritGrund: 'Fachkern' },
      },
      callGraph: [{ von: '210', nach: '213' }],
    })[0]!;
    expect(s.typ).toBe('TP');
    expect(s.typQuelle).toBe('gesetzt');
    expect(s.soll).toBe('MW_ERECH_Rechnung-Pruefen_SUB');
    expect(s.sollQuelle).toBe('entschieden');
    expect(s.krit).toBe('hoch');
  });

  test('Twin-Import greift, wenn nichts entschieden ist', () => {
    const s = baueSteckbriefe({
      prozesse: { '213': { ist: 'Rechnung prüfen', sollTwin: 'MW_ERECH_Twin_SUB' } },
      callGraph: [],
    })[0]!;
    expect(s.sollQuelle).toBe('twin');
    expect(s.soll).toBe('MW_ERECH_Twin_SUB');
  });
});
