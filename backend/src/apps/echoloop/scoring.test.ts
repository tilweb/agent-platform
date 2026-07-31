import { test, expect } from 'bun:test';
import { computeScores } from './scoring';

/**
 * Referenz: docs/Echo-Loop-App/02_Standards/SOLL-PROFIL_METHODE.md §4
 * Pilot Signal-Lagerverwaltung (Stand 19.07.):
 *   Maskiert (relevanz=0): D4, D5, D10
 *   Relevant: D1 2/2 · D2 3/3 · D3 1/1 · D6 3/3 · D7 3/3 · D8 2/2 · D9 4/4 · D6b 2/3
 *   → SE = 20/21 = 95 % · RG* = 1 (Treiber D3) · RGQ = 44 %
 */
test('Pilot Lagerverwaltung: SE=95%, RG*=1, RGQ=44%', () => {
  const r = computeScores({
    d1: { ist: 2, soll: 2, relevanz: 1 },
    d2: { ist: 3, soll: 3, relevanz: 1 },
    d3: { ist: 1, soll: 1, relevanz: 1 },
    d4: { ist: 2, soll: 2, relevanz: 0 }, // maskiert
    d5: { ist: 1, soll: 1, relevanz: 0 }, // maskiert
    d6: { ist: 3, soll: 3, relevanz: 1 },
    d6b: { ist: 2, soll: 3, relevanz: 1 },
    d7: { ist: 3, soll: 3, relevanz: 1 },
    d8: { ist: 2, soll: 2, relevanz: 1 },
    d9: { ist: 4, soll: 4, relevanz: 1 },
    d10: { ist: 1, soll: 1, relevanz: 0 }, // maskiert
  });
  expect(r.seQuotient).toBe(95);
  expect(r.rgStar).toBe(1);
  expect(r.rgq).toBe(44); // Σ Ist(D1..D10)=22 → 22/50
  expect(r.levelSum).toBe(22);
});

/**
 * What-if aus §4: „Fehler-Doku in Excel" (D3→2/2, D7→4/4) → RG*=2;
 * mit Text-Zweig (D6b→3/3) → SE=100 %.
 */
test('What-if: D3=2/2, D7=4/4, D6b=3/3 → RG*=2, SE=100%', () => {
  const r = computeScores({
    d1: { ist: 2, soll: 2, relevanz: 1 },
    d2: { ist: 3, soll: 3, relevanz: 1 },
    d3: { ist: 2, soll: 2, relevanz: 1 },
    d4: { ist: 2, soll: 2, relevanz: 0 },
    d5: { ist: 1, soll: 1, relevanz: 0 },
    d6: { ist: 3, soll: 3, relevanz: 1 },
    d6b: { ist: 3, soll: 3, relevanz: 1 },
    d7: { ist: 4, soll: 4, relevanz: 1 },
    d8: { ist: 2, soll: 2, relevanz: 1 },
    d9: { ist: 4, soll: 4, relevanz: 1 },
    d10: { ist: 1, soll: 1, relevanz: 0 },
  });
  expect(r.rgStar).toBe(2);
  expect(r.seQuotient).toBe(100);
});

test('Über-Soll wird gekappt (SE ≤ 100%)', () => {
  const r = computeScores({
    d1: { ist: 5, soll: 2, relevanz: 1 },
    d2: { ist: 5, soll: 3, relevanz: 1 },
  });
  // Nur D1,D2 relevant: min(5,2)+min(5,3)=2+3=5 ; Soll=2+3=5 → 100%, kein Über-Soll-Bonus
  expect(r.seQuotient).toBe(100);
});

test('Pflicht-Raster: All-L5 → RG5, RGQ=100%', () => {
  const full: Record<string, { ist: number; soll: number; relevanz: 1 }> = {};
  for (const d of ['d1','d2','d3','d4','d5','d6','d7','d8','d9','d10','d6b']) {
    full[d] = { ist: 5, soll: 5, relevanz: 1 };
  }
  const r = computeScores(full);
  expect(r.gesamtRg).toBe(5);
  expect(r.rgq).toBe(100);
});

test('Weakest link: D8 L0 hält Gesamt-RG auf RG0', () => {
  const r = computeScores({
    d1: { ist: 5, soll: 5, relevanz: 1 },
    d2: { ist: 5, soll: 5, relevanz: 1 },
    d3: { ist: 5, soll: 5, relevanz: 1 },
    d4: { ist: 5, soll: 5, relevanz: 1 },
    d5: { ist: 5, soll: 5, relevanz: 1 },
    d6: { ist: 5, soll: 5, relevanz: 1 },
    d7: { ist: 5, soll: 5, relevanz: 1 },
    d8: { ist: 0, soll: 5, relevanz: 1 }, // Klartext-Passwort
    d9: { ist: 5, soll: 5, relevanz: 1 },
    d10: { ist: 5, soll: 5, relevanz: 1 },
  });
  expect(r.gesamtRg).toBe(0);
  expect(r.limiter.some((l) => l.startsWith('D8'))).toBe(true);
});

test('Leere Eingabe → alles 0, kein Crash', () => {
  const r = computeScores({});
  expect(r.gesamtRg).toBe(0);
  expect(r.rgq).toBe(0);
  expect(r.seQuotient).toBe(0);
  expect(r.rgStar).toBe(0);
});
