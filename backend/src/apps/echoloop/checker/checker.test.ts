import { test, expect } from 'bun:test';
import { runChecker, parseProcess } from './index';

/**
 * Synthetische Fixtures im real beobachteten `pdftotext -layout`-Format
 * (verifiziert gegen die Signal-Nacharbeit-Familie in docs/EMMA-Echo-Loop).
 * Bewusst KEINE echten Kundendaten in getrackten Test-Dateien.
 */

const MASTER_900 = `      Prozess 900

Master Testprozess
                 Informationen zum Schritt
    ID            Typ                      Name             Kommentar        Schritt-Eigenschaften
0        Start              Start
1        Verschachtelter    Sub B                                    TestCaseID:901
         Prozess
2        Verschachtelter    Sub C                                    TestCaseID:902
         Prozess
3        Verschachtelter    Fehlt extern                             TestCaseID:999
         Prozess
4        Verschachtelter    Kaputt                                   TestCaseID:-1
         Prozess
`;

const SUB_901 = `      Prozess 901

Sub B mit Scrollschleife
                 Informationen zum Schritt
    ID            Typ                      Name             Kommentar        Schritt-Eigenschaften
0        Start              Start
1        Schleife           Scrollschleife    endlos             MaxLoopCount:5
                                                                 ResetOnMax:False
                                                                 ResetBeforeStart:True
2        Lesen              Vera anklicken    OCR-Find           Subject:RegEx
                                                                 TextExtractionMode:Accurate
                                                                 TimeOut:5000
`;

const SUB_902 = `      Prozess 902

Sub C sauber
                 Informationen zum Schritt
    ID            Typ                      Name             Kommentar        Schritt-Eigenschaften
0        Start              Start
1        Schleife           Zeilen             Variable 4         MaxLoopCount:{CV:Anzahl}
                                                                  ResetBeforeStart:False
`;

const ORPHAN_903 = `      Prozess 903

Verwaiste Funktion
                 Informationen zum Schritt
    ID            Typ                      Name             Kommentar        Schritt-Eigenschaften
0        Start              Start
1        Klicken            OK                                       Subject:Object
`;

function family() {
  return runChecker([
    { name: 'Prozess_900.pdf', text: MASTER_900 },
    { name: 'Prozess_901.pdf', text: SUB_901 },
    { name: 'Prozess_902.pdf', text: SUB_902 },
    { name: 'Prozess_903.pdf', text: ORPHAN_903 },
  ]);
}

test('Parser: Prozessnummer, Calls, Loops, OCR korrekt', () => {
  const p = parseProcess('Prozess_901.pdf', SUB_901);
  expect(p.nr).toBe('901');
  expect(p.loops.length).toBe(1);
  expect(p.loops[0]!.resetBeforeStart).toBe(true);
  expect(p.loops[0]!.maxIstLiteral).toBe(true);
  expect(p.ocrReads.length).toBe(1);
  expect(p.ocrReads[0]!.subject).toBe('RegEx');
  expect(p.ocrReads[0]!.textExtractionMode).toBe('Accurate');
  expect(p.ocrReads[0]!.timeoutMs).toBe(5000);
});

test('PM-01: ResetBeforeStart:True ohne gebundenen Zähler → kritisch (P901)', () => {
  const f = family().findings.filter((x) => x.pm === 'PM-01');
  expect(f.length).toBe(1);
  expect(f[0]!.prozessNr).toBe('901');
  expect(f[0]!.schwere).toBe('kritisch');
});

test('PM-02: Waise (903) kritisch, Master (900) niedrig, Referenz-ohne-Export (999) frage', () => {
  const f = family().findings.filter((x) => x.pm === 'PM-02');
  const waise = f.find((x) => x.prozessNr === '903');
  const master = f.find((x) => x.prozessNr === '900');
  const ext = f.find((x) => x.prozessNr === '999');
  expect(waise?.schwere).toBe('kritisch');
  expect(master?.schwere).toBe('niedrig');
  expect(ext?.schwere).toBe('frage');
});

test('PM-03: TestCaseID:-1 → toter Aufruf kritisch (P900 S4)', () => {
  const f = family().findings.filter((x) => x.pm === 'PM-03');
  expect(f.length).toBe(1);
  expect(f[0]!.prozessNr).toBe('900');
  expect(f[0]!.schwere).toBe('kritisch');
});

test('PM-04: fester MaxLoopCount → neutraler Prompt (frage); {CV:…} löst NICHT aus', () => {
  const f = family().findings.filter((x) => x.pm === 'PM-04');
  // nur P901 (MaxLoopCount:5 literal); P902 ist {CV:Anzahl} → kein PM-04
  expect(f.length).toBe(1);
  expect(f[0]!.prozessNr).toBe('901');
  expect(f[0]!.schwere).toBe('frage');
});

test('PM-09: OCR-Read unter Aufruf-Baum-Multiplikator (P901 via P900)', () => {
  const f = family().findings.filter((x) => x.pm === 'PM-09');
  expect(f.length).toBe(1);
  expect(f[0]!.prozessNr).toBe('901');
  // 901 lokal ×5 (MaxLoopCount:5), aufgerufen von 900 (×1) → Multiplikator ≥5
  expect(f[0]!.beleg).toContain('Multiplikator');
});

const BAUTECHNIK_905 = `      Prozess 905

Bautechnik-Test
                 Informationen zum Schritt
    ID            Typ                      Name             Kommentar        Schritt-Eigenschaften
0        Start              Start
1        Warten             Ladezeit           warte kurz         Subject:Time
                                                                  Timeout:2000
2        Warten             Manipulation       Manipulation vor   Subject:Time
                                                                  Timeout:1
3        Klicken            Fester Klick       feste Position     X:655
                                                                  Y:759
                                                                  OffsetX:0
                                                                  OffsetY:0
4        Klicken            Fundklick          am Fundort         X:0
                                                                  Y:0
                                                                  OffsetX:0
                                                                  OffsetY:0
5        Finden & Klicken   Ankerklick         stabil             Subject:Shape
                                                                  ImageCompositionId:12
`;

test('Parser: feste Wartezeit (ms→s) + Manipulations-Erkennung + feste Klicks', () => {
  const p = parseProcess('Prozess_905.pdf', BAUTECHNIK_905);
  expect(p.fixedWaits.length).toBe(2);
  const s1 = p.fixedWaits.find((w) => w.schrittId === 1);
  expect(s1?.sekunden).toBe(2); // 2000 ms → 2 s
  expect(s1?.istManipulation).toBe(false);
  expect(p.fixedWaits.find((w) => w.schrittId === 2)?.istManipulation).toBe(true);
  // Anker-Klick (S5, Finden & Klicken) NICHT als feste Position; S3 absolut, S4 fundgebunden
  expect(p.fixedClicks.length).toBe(2);
  expect(p.fixedClicks.find((c) => c.schrittId === 3)?.vermutlichFundgebunden).toBe(false);
  expect(p.fixedClicks.find((c) => c.schrittId === 4)?.vermutlichFundgebunden).toBe(true);
});

test('PM-13: blindes Warten (≥0,5 s) → D2; Manipulations-/Mini-Waits ausgeschlossen', () => {
  const f = runChecker([{ name: 'Prozess_905.pdf', text: BAUTECHNIK_905 }]).findings.filter((x) => x.pm === 'PM-13');
  expect(f.length).toBe(1);
  expect(f[0]!.dimensionen).toContain('D2');
  expect(f[0]!.befund).toContain('2 s'); // nur S1, nicht der 1-ms-Manipulationsknoten
});

test('PM-14: feste Klick-Position (D1) absolut=mittel, X:0/Y:0=frage; Anker nicht geflaggt', () => {
  const f = runChecker([{ name: 'Prozess_905.pdf', text: BAUTECHNIK_905 }]).findings.filter((x) => x.pm === 'PM-14');
  const absolut = f.find((x) => x.aspekt === 'Feste Klick-Position');
  const fund = f.find((x) => x.aspekt === 'Klick am Fundort');
  expect(absolut?.schwere).toBe('mittel');
  expect(absolut?.dimensionen).toContain('D1');
  expect(absolut?.befund).toContain('S3');
  expect(fund?.schwere).toBe('frage');
});

test('Call-Graph enthält 900→901/902/999/-1', () => {
  const cg = family().family.callGraph.filter((e) => e.von === '900').map((e) => e.nach);
  expect(cg).toContain('901');
  expect(cg).toContain('999');
  expect(cg).toContain('-1');
});
