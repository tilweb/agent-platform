/**
 * Tests der PAKET_2-Prüfmuster (PM-12/17/W-b/W-c) — konstruiert EmmaFamily-
 * Fixtures direkt, damit die Detektionslogik unabhängig vom PDF-Textformat
 * geprüft ist. Alle Muster sind beobachtend (dürfen nicht hart eskalieren).
 */
import { test, expect, describe } from 'bun:test';
import { pm12, pm17, pmWa, pmWb, pmWc } from './patterns';
import type { EmmaProcess, EmmaFamily, EmmaLoop, EmmaFixedWait, EmmaVariable, EmmaKeyTippen } from './types';

function proc(nr: string, over: Partial<EmmaProcess> = {}): EmmaProcess {
  return {
    nr, name: `Prozess ${nr}`, sourceFile: `Prozess_${nr}.pdf`,
    loops: [], ocrReads: [], calls: [], fixedWaits: [], fixedClicks: [], keyTippen: [],
    variables: [], dateLiterals: [], hardcodedPaths: [], hasPlaintextPassword: false,
    schrittCount: 0, ...over,
  };
}
const kt = (schrittId: number, text: string, keybased = true, noMod = false): EmmaKeyTippen =>
  ({ schrittId, text, keybased, noMod, nameHint: '' });
function fam(...processes: EmmaProcess[]): EmmaFamily {
  return { processes, byNr: new Map(processes.map((p) => [p.nr, p])) };
}
const loop = (schrittId: number, maxLoopCount: string | null, maxIstLiteral: boolean): EmmaLoop =>
  ({ schrittId, maxLoopCount, maxIstLiteral, resetBeforeStart: null, resetOnMax: null, zaehlerVariabel: false, nameHint: '' });
const wait = (schrittId: number, sekunden: number, istManipulation = false): EmmaFixedWait =>
  ({ schrittId, sekunden, istManipulation, nameHint: '' });
const v = (varId: string, name: string, typ: string): EmmaVariable =>
  ({ varId, name, typ, init: '', schnittstelle: 'Privat' });

describe('PM-12 · Endlosschleifen-Verdacht', () => {
  test('fester Deckel ≥ 1000 → Verdacht (❓), beobachtend', () => {
    const f = pm12(fam(proc('1', { loops: [loop(5, '1000', true), loop(9, '2500', true)] })));
    expect(f).toHaveLength(1);
    expect(f[0]!.schwere).toBe('frage');
    expect(f[0]!.beobachtend).toBe(true);
    expect(f[0]!.befund).toContain('S5=1000');
  });
  test('kleiner Deckel (50) → kein Befund', () => {
    expect(pm12(fam(proc('1', { loops: [loop(5, '50', true)] })))).toHaveLength(0);
  });
  test('variabler Deckel {CV:…} → kein Befund (nicht literal)', () => {
    expect(pm12(fam(proc('1', { loops: [loop(5, '{CV:Anzahl}', false)] })))).toHaveLength(0);
  });
});

describe('PM-17 · Warte-Schritt-Summe', () => {
  test('summiert wirksame Wartezeiten je Prozess', () => {
    const f = pm17(fam(proc('1', { fixedWaits: [wait(2, 5), wait(4, 7.5)] })));
    expect(f).toHaveLength(1);
    expect(f[0]!.befund).toContain('12.5 s');
    expect(f[0]!.beobachtend).toBe(true);
  });
  test('nur Kleinstwerte (< 50 ms) → kein Befund', () => {
    expect(pm17(fam(proc('1', { fixedWaits: [wait(2, 0.02), wait(3, 0.01)] })))).toHaveLength(0);
  });
});

describe('PM-W-a · Key-basiertes Tippen', () => {
  test('Keybased + Pfad-Klartext → Befund (beobachtend)', () => {
    const f = pmWa(fam(proc('1', { keyTippen: [kt(12, 'C:\\Kunde\\Rechnung.pdf')] })));
    expect(f).toHaveLength(1);
    expect(f[0]!.pm).toBe('PM-W-a');
    expect(f[0]!.beobachtend).toBe(true);
  });
  test('Keybased + {CV:…Pfad}-Variable → Befund', () => {
    const f = pmWa(fam(proc('1', { keyTippen: [kt(5, '{CV:12 - O_ArchivPfad}')] })));
    expect(f).toHaveLength(1);
  });
  test('_NoModificationText:True (einsetzen statt tippen) → kein Befund', () => {
    expect(pmWa(fam(proc('1', { keyTippen: [kt(12, 'C:\\x\\y.pdf', true, true)] })))).toHaveLength(0);
  });
  test('nicht keybased → kein Befund', () => {
    expect(pmWa(fam(proc('1', { keyTippen: [kt(12, 'C:\\x\\y.pdf', false)] })))).toHaveLength(0);
  });
  test('harmloser Kurztext (kein Pfad/Kennung) → kein Befund', () => {
    expect(pmWa(fam(proc('1', { keyTippen: [kt(12, 'Hallo')] })))).toHaveLength(0);
  });
});

describe('PM-W-b · Text-zu-Zahl bei Betrags-Variablen', () => {
  test('Betrag als Text + numerischer Zwilling → Befund', () => {
    const f = pmWb(fam(proc('1', { variables: [v('1', 'Rechnungsbetrag', 'string'), v('2', 'RechnungsbetragNum', 'Dezimal')] })));
    expect(f).toHaveLength(1);
    expect(f[0]!.beobachtend).toBe(true);
  });
  test('nur Text-Betrag ohne numerischen Zwilling → kein Befund', () => {
    expect(pmWb(fam(proc('1', { variables: [v('1', 'Rechnungsbetrag', 'string')] })))).toHaveLength(0);
  });
});

describe('PM-W-c · int-Typ für Betrags-Variablen', () => {
  test('Betrag als int → Befund (Cent-Verlust)', () => {
    const f = pmWc(fam(proc('1', { variables: [v('1', 'Bruttobetrag', 'int')] })));
    expect(f).toHaveLength(1);
    expect(f[0]!.seedOrBug).toBe('bug');
  });
  test('Anzahl/Zeile als int → kein Befund (legitim ganzzahlig)', () => {
    expect(pmWc(fam(proc('1', { variables: [v('1', 'Anzahl Positionen', 'int'), v('2', 'Zeilennummer', 'int')] })))).toHaveLength(0);
  });
  test('Betrag als Dezimal → kein Befund', () => {
    expect(pmWc(fam(proc('1', { variables: [v('1', 'Preis', 'Dezimal')] })))).toHaveLength(0);
  });
});
