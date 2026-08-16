/**
 * Gold-Runner / Regressionstest der EMMA-Koordinaten-Extraktion.
 *
 * Fährt den fiktiven Übungsfall (5 Prozesse, 30 Variablenzeilen, compliance-sicher)
 * und vergleicht Feld für Feld gegen die eingefrorene Golden-Referenz
 * `__fixtures__/uebungsfall/_varliste_demo_daten.json` (Herkunft: PAKET_2
 * `_varliste_demo_daten.json`, Engine v3.11). Jede Änderung an `emma.ts`/`bbox.ts`
 * muss hier grün bleiben, bevor eine echte Kundenfamilie sie sieht (LIESMICH_ADACOR:
 * „Beides fahren, in dieser Reihenfolge" — der Übungsfall zuerst).
 *
 * Deckt jeden Extraktions-Diff-Fall genau einmal ab: Umbruch-Klebung (Name+Init),
 * Schritt-Erkennung über x-Position (fremde Typ-Vokabeln), {CV:}-Fund über Namen
 * (designierter Wertfehler nnn≠Name), Ausgänge-Zählung, Prozess-/Druck-Stand.
 */
import { test, expect, describe } from 'bun:test';
import { extractProcessFromPdf, type EmmaProcessExtract } from './emma';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const FIX = join(import.meta.dir, '__fixtures__', 'uebungsfall');
const REF = JSON.parse(readFileSync(join(FIX, '_varliste_demo_daten.json'), 'utf8')) as {
  variablen: { p: string; id: string; name: string; typ: string; init?: string; schnitt: string; fund: unknown[] }[];
  prozesse: Record<string, { aufrufe: string[]; cvrefs: unknown[]; ausgaenge: { erfolg: number; fehler: number }; prozess_stand: string; druck_stand: string }>;
};

const procs: Record<string, EmmaProcessExtract> = {};
for (const f of readdirSync(join(FIX, 'prozesse')).filter((f) => f.endsWith('.pdf')).sort()) {
  const nr = f.match(/Prozess_(\d+)/)?.[1] ?? '';
  procs[nr] = await extractProcessFromPdf(new Uint8Array(readFileSync(join(FIX, 'prozesse', f))), nr);
}
const allVars = Object.values(procs).flatMap((p) => p.variablen);
const refVar = new Map(REF.variablen.map((v) => [`${v.p}/${v.id}`, v]));

describe('EMMA-Extraktion · Übungsfall gegen Golden-Referenz', () => {
  test('Gesamtzahl Variablenzeilen = 30 (5 Prozesse)', () => {
    expect(allVars.length).toBe(30);
    expect(Object.keys(procs).length).toBe(5);
  });

  for (const v of REF.variablen) {
    const key = `${v.p}/${v.id}`;
    test(`Variable ${key} „${v.name}" — Felder + Fundstellen`, () => {
      const got = allVars.find((x) => `${x.p}/${x.id}` === key);
      expect(got, `Variable ${key} nicht extrahiert`).toBeDefined();
      expect(got!.name).toBe(v.name);
      expect(got!.typ).toBe(v.typ);
      expect(got!.init ?? '').toBe(v.init ?? '');
      expect(got!.schnitt).toBe(v.schnitt);
      expect(got!.fund).toEqual(v.fund as EmmaProcessExtract['variablen'][number]['fund']);
    });
  }

  for (const [nr, r] of Object.entries(REF.prozesse)) {
    test(`Prozess ${nr} — Call-Graph, {CV:}-Refs, Ausgänge, Zeitstände`, () => {
      const p = procs[nr];
      expect(p, `Prozess ${nr} nicht extrahiert`).toBeDefined();
      expect(p!.aufrufe).toEqual(r.aufrufe);
      expect(p!.cvrefs).toEqual(r.cvrefs as EmmaProcessExtract['cvrefs']);
      expect(p!.ausgaenge).toEqual(r.ausgaenge);
      expect(p!.prozess_stand).toBe(r.prozess_stand);
      expect(p!.druck_stand).toBe(r.druck_stand);
    });
  }
});

test('Referenz deckt alle extrahierten Variablen ab (keine Waisen)', () => {
  for (const v of allVars) expect(refVar.has(`${v.p}/${v.id}`), `Extra-Variable ${v.p}/${v.id} ohne Referenz`).toBe(true);
});
