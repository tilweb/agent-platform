/**
 * NK-Gate G1–G7 gegen die Übungsfall-Golden-Referenz (nk-namensmodul.json,
 * portiert aus _varliste_demo_namen.py + _NK-STAND_DEMO.json).
 *
 * Golden: 24 Zielnamen → 21 entschieden · G1–G3/G5–G7 erfüllt · G4 offen
 * (eine Dublette H_BetragZahl in P213, plus gewollte Konsolidierung
 * RechnungenAnzahl über P210/P212) · quote_umformatiert 4,2 % (Protokolldatei).
 * Die Prozess-Fundorte kommen aus der echten Koordinaten-Extraktion.
 */
import { test, expect, describe } from 'bun:test';
import { pruefeNK, type NkNamensmodul, type VarFundort } from './nk';
import { extractProcessFromPdf } from '../extract/emma';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const FIX = join(import.meta.dir, '..', 'extract', '__fixtures__', 'uebungsfall');
const modul = JSON.parse(readFileSync(join(FIX, 'nk-namensmodul.json'), 'utf8')) as NkNamensmodul & { _golden: Record<string, unknown> };

// Fundorte (Name → Prozess) aus der Extraktion aller Prozess-PDFs.
const fundorte: VarFundort[] = [];
for (const f of readdirSync(join(FIX, 'prozesse')).filter((f) => f.endsWith('.pdf'))) {
  const nr = f.match(/Prozess_(\d+)/)?.[1] ?? '';
  const p = await extractProcessFromPdf(new Uint8Array(readFileSync(join(FIX, 'prozesse', f))), nr);
  for (const v of p.variablen) fundorte.push({ name: v.name, p: v.p });
}

const r = pruefeNK(modul, fundorte);

describe('NK-Gate · Übungsfall-Golden', () => {
  test('24 Zielnamen → 21 entschieden (Konsolidierung)', () => {
    expect(r.zielnamen).toBe(24);
    expect(r.entschieden).toBe(21);
  });

  test('Entscheidungsquote: 2 fertig · 1 umformatiert · 21 entschieden · 4,2 %', () => {
    expect(r.entscheidungsquote.fertig).toBe(2);
    expect(r.entscheidungsquote.umformatiert).toBe(1);
    expect(r.entscheidungsquote.entschieden).toBe(21);
    expect(r.entscheidungsquote.quoteUmformatiert).toBe(4.2);
    expect(r.nurUmformatiert).toEqual(['Protokolldatei → C_ProtokollDatei']);
  });

  test('Gate-Ampel: G1–G3/G5–G7 erfüllt, G4 offen', () => {
    expect(r.gates.G1.erfuellt).toBe(true);
    expect(r.gates.G2.erfuellt).toBe(true);
    expect(r.gates.G3.erfuellt).toBe(true);
    expect(r.gates.G4.erfuellt).toBe(false);
    expect(r.gates.G5.erfuellt).toBe(true);
    expect(r.gates.G6.erfuellt).toBe(true);
    expect(r.gates.G7.erfuellt).toBe(true);
    expect(r.offen).toEqual(['G4']);
    expect(r.gold).toBe(false);
  });

  test('G4: H_BetragZahl = Dublette (P213), RechnungenAnzahl = Konsolidierung', () => {
    expect(r.g4.H_BetragZahl?.art).toBe('dublette');
    expect(r.g4.H_BetragZahl?.prozesse).toEqual(['213']);
    expect(r.g4.RechnungenAnzahl?.art).toBe('konsolidierung');
    // C_ArchivPfad ist ein Kopplungsriss (eine Alt ist die Selbst-Umbenennung), KEIN g4.
    expect(r.g4.C_ArchivPfad).toBeUndefined();
  });

  test('kein harter (sperrender) Kanon-Verstoß', () => {
    expect(r.sperrend).toBe(false);
    expect(r.hartVerstoss).toEqual([]);
  });
});

describe('NK-Gate · harte Regeln', () => {
  test('Fachwert mit Präfix → harter G1-Verstoß (sperrend)', () => {
    const bad = pruefeNK({ map: [{ alt: 'X', neu: 'U_Falsch', rolle: 'U' }] });
    expect(bad.gates.G1.erfuellt).toBe(false);
    expect(bad.sperrend).toBe(true);
  });
  test('A_Ergebnis ist von G1 ausgenommen', () => {
    const ok = pruefeNK({ map: [{ alt: 'Ergebnis', neu: 'A_Ergebnis', rolle: 'T' }] });
    expect(ok.gates.G1.erfuellt).toBe(true);
  });
  test('verworfenes Kategorie-Wort → G6-Verstoß', () => {
    const bad = pruefeNK({ map: [{ alt: 'Rechnungsordner', neu: 'C_RechnungOrdner', rolle: 'C' }] });
    expect(bad.gates.G6.erfuellt).toBe(false);
  });
  test('Negation im Namen → G2-Verstoß', () => {
    const bad = pruefeNK({ map: [{ alt: 'x', neu: 'T_NichtGefundenStatus', rolle: 'T' }] });
    expect(bad.gates.G2.erfuellt).toBe(false);
  });
});
