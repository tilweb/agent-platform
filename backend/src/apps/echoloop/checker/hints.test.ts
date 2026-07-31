import { test, expect } from 'bun:test';
import { parseFamily } from './parse';
import { deriveHints } from './hints';

/** Fixture mit fester Wartezeit (D2), fester Klick-Position (D1), Hardcoding-Pfad (D6). */
const P = `      Prozess 700

Hints-Test
                 Informationen zum Schritt
    ID            Typ                      Name             Kommentar        Schritt-Eigenschaften
0        Start              Start
1        Warten             Ladezeit           warte              Subject:Time
                                                                  Timeout:2000
2        Klicken            Fester Klick       feste Position     X:655
                                                                  Y:759
                                                                  OffsetX:0
3        Datei              Excel wählen       lädt Datei         Subject:GetFileName
                                                                  FileFrom:C:\\EMMA\\Prozesse\\daten.xlsx
`;

test('deriveHints: D2 L1 (feste Waits), D1 L2 (feste Klicks), D6 L1 (Pfad), D8 L2 (kein Klartext)', () => {
  const h = deriveHints(parseFamily([{ name: 'Prozess_700.pdf', text: P }]));
  expect(h.dims.d2?.suggest).toBe(1);
  expect(h.dims.d1?.suggest).toBe(2);
  expect(h.dims.d6?.suggest).toBe(1);
  expect(h.dims.d8?.suggest).toBe(2);
  expect(h.dims.d2?.evidence.join(' ')).toContain('2 s');
  expect(h.topHebel.some((t) => t.dim === 'D2')).toBe(true);
  expect(h.topHebel.some((t) => t.dim === 'D1')).toBe(true);
});

test('deriveHints Fallback-Boden: Vorschlag für alle Kern-Dimensionen + D6b', () => {
  const h = deriveHints(parseFamily([{ name: 'Prozess_700.pdf', text: P }]));
  for (const d of ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd6b', 'd7', 'd8', 'd9', 'd10']) {
    expect(typeof (h.dims as Record<string, { suggest: number }>)[d]?.suggest).toBe('number');
  }
});

test('deriveHints: ohne Signale konservative Defaults (D1 L3, D2 L2, D8 L2)', () => {
  const leer = `      Prozess 701

Leer
                 Informationen zum Schritt
    ID            Typ                      Name             Kommentar        Schritt-Eigenschaften
0        Start              Start
1        Finden & Klicken   Anker              stabil             Subject:Shape
                                                                  ImageCompositionId:5
`;
  const h = deriveHints(parseFamily([{ name: 'Prozess_701.pdf', text: leer }]));
  expect(h.dims.d1?.suggest).toBe(3); // nur Anker-Klick, keine feste Position/OCR
  expect(h.dims.d2?.suggest).toBe(2); // keine festen Waits
  expect(h.dims.d8?.suggest).toBe(2); // kein Klartext-Kennwort
});
