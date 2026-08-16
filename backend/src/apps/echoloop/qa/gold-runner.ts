/**
 * Gold-Runner — der aufrufbare Regressions-/Drift-Läufer über ein Fixture-Set
 * (PAKET_2 §3.5 „Kalibrieren vor Bauen" + §5 „Übungsfall zuerst, in dieser
 * Reihenfolge"). Fährt die Koordinaten-Extraktion gegen eine eingefrorene
 * Golden-Referenz und meldet jeden Feld-Abweicher.
 *
 * Semantik (Prinzip §3.5/§3.6): **jede** Abweichung ist zunächst eine
 * REGRESSION — kein „≥"-Schwellwert, kein Auffangzweig. Ob eine Abweichung
 * eine gewollte DRIFT ist (dann Golden neu pinnen) oder ein Fehler (dann Code
 * reparieren), entscheidet der Mensch; der Runner klassifiziert nicht selbst.
 *
 * Zwei Konsumenten teilen sich diese Logik:
 *  · `emma.test.ts` — das `bun test`-CI-Gate (bricht den Build).
 *  · `scripts/echoloop-gold.ts` / App-Betrieb — der Report zur Ansicht + Telemetrie.
 *
 * Rein (kein LLM, kein DB) — Eingabe ist ein Fixture-Verzeichnis auf der Platte.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { extractProcessFromPdf, type EmmaProcessExtract } from '../extract/emma';

/** Standard-Fixture: der fiktive, compliance-sichere Übungsfall. */
export const UEBUNGSFALL_DIR = join(import.meta.dir, '..', 'extract', '__fixtures__', 'uebungsfall');

export interface GoldMismatch {
  entity: string;   // z.B. "P213/id503 Rechnungsbetrag" oder "P213"
  field: string;    // name | typ | init | schnitt | fund | aufrufe | cvrefs | ausgaenge | prozess_stand | druck_stand
  mine: unknown;
  golden: unknown;
}

export interface GoldReport {
  fixture: string;
  pass: boolean;
  prozesse: number;
  variablen: number;
  checked: number;      // Anzahl verglichener Felder
  mismatches: GoldMismatch[];
  summary: string;      // eine Zeile für Log/Telemetrie
}

interface GoldRef {
  variablen: { p: string; id: string; name: string; typ: string; init?: string; schnitt: string; fund: unknown[] }[];
  prozesse: Record<string, { aufrufe: string[]; cvrefs: unknown[]; ausgaenge: unknown; prozess_stand: string; druck_stand: string }>;
}

function eq(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Fährt die Extraktion über alle Prozess-PDFs eines Fixtures und vergleicht Feld für Feld. */
export async function runGold(fixtureDir: string = UEBUNGSFALL_DIR): Promise<GoldReport> {
  const ref = JSON.parse(readFileSync(join(fixtureDir, '_varliste_demo_daten.json'), 'utf8')) as GoldRef;
  const dir = join(fixtureDir, 'prozesse');

  const procs: Record<string, EmmaProcessExtract> = {};
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.pdf')).sort()) {
    const nr = f.match(/Prozess_(\d+)/)?.[1] ?? '';
    procs[nr] = await extractProcessFromPdf(new Uint8Array(readFileSync(join(dir, f))), nr);
  }
  const allVars = Object.values(procs).flatMap((p) => p.variablen);
  const mine = new Map(allVars.map((v) => [`${v.p}/${v.id}`, v]));

  const mismatches: GoldMismatch[] = [];
  let checked = 0;

  // Variablen (name · typ · init · schnitt · fund)
  for (const r of ref.variablen) {
    const key = `${r.p}/${r.id}`;
    const ent = `P${r.p}/id${r.id} ${r.name}`;
    const got = mine.get(key);
    if (!got) { mismatches.push({ entity: ent, field: 'präsenz', mine: null, golden: 'erwartet' }); continue; }
    const felder: [string, unknown, unknown][] = [
      ['name', got.name, r.name],
      ['typ', got.typ, r.typ],
      ['init', got.init ?? '', r.init ?? ''],
      ['schnitt', got.schnitt, r.schnitt],
      ['fund', got.fund, r.fund],
    ];
    for (const [field, a, b] of felder) {
      checked++;
      if (!eq(a, b)) mismatches.push({ entity: ent, field, mine: a, golden: b });
    }
  }

  // Prozess-Ebene (aufrufe · cvrefs · ausgaenge · zwei Zeitstände)
  for (const [nr, r] of Object.entries(ref.prozesse)) {
    const p = procs[nr];
    if (!p) { mismatches.push({ entity: `P${nr}`, field: 'präsenz', mine: null, golden: 'erwartet' }); continue; }
    const felder: [string, unknown, unknown][] = [
      ['aufrufe', p.aufrufe, r.aufrufe],
      ['cvrefs', p.cvrefs, r.cvrefs],
      ['ausgaenge', p.ausgaenge, r.ausgaenge],
      ['prozess_stand', p.prozess_stand, r.prozess_stand],
      ['druck_stand', p.druck_stand, r.druck_stand],
    ];
    for (const [field, a, b] of felder) {
      checked++;
      if (!eq(a, b)) mismatches.push({ entity: `P${nr}`, field, mine: a, golden: b });
    }
  }

  const pass = mismatches.length === 0;
  const summary = pass
    ? `GOLD PASS · ${Object.keys(procs).length} Prozesse · ${allVars.length} Variablen · ${checked} Felder geprüft`
    : `GOLD FAIL · ${mismatches.length} Abweichung(en) (jede = REGRESSION bis zum Re-Pin) · ${checked} Felder geprüft`;

  return {
    fixture: fixtureDir,
    pass,
    prozesse: Object.keys(procs).length,
    variablen: allVars.length,
    checked,
    mismatches,
    summary,
  };
}
