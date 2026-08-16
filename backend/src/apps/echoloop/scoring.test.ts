import { test, expect, describe } from 'bun:test';
import {
  computeScores, levelKlasse, bewerteVereinbarungsGates, papierLevelWarnungen,
  VEREINBARUNGS_GATES,
} from './scoring';

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

// ── Zwei-Naturen der Reife ────────────────────────────────────────────────────

describe('Zwei-Naturen · Level-Klassen', () => {
  test('L0 Boden · L1–L3 Robustheit · L4–L5 Skalierung', () => {
    expect(levelKlasse(0)).toBe('boden');
    expect([1, 2, 3].map(levelKlasse)).toEqual(['robustheit', 'robustheit', 'robustheit']);
    expect([4, 5].map(levelKlasse)).toEqual(['skalierung', 'skalierung']);
  });
});

describe('Zwei-Naturen · Vereinbarungs-Gates (R2/R3)', () => {
  test('genau vier Gates an D6-L3/D7-L4/D9-L4/D10-L2', () => {
    expect(VEREINBARUNGS_GATES.map((g) => g.id)).toEqual(['D6-L3', 'D7-L4', 'D9-L4', 'D10-L2']);
  });

  test('Doppel-Nachweis: Statik+gelebt → nachgewiesen', () => {
    const g = bewerteVereinbarungsGates(
      { d6: { ist: 3, soll: 3, relevanz: 1 } },
      { 'D6-L3': { statik: true, gelebt: true } },
    ).find((x) => x.id === 'D6-L3')!;
    expect(g.status).toBe('nachgewiesen');
    expect(g.hinweis).toBeUndefined();
  });

  test('Statik ohne gelebt → Papier-Level (hebt Ist NICHT)', () => {
    const g = bewerteVereinbarungsGates(
      { d7: { ist: 4, soll: 4, relevanz: 1 } },
      { 'D7-L4': { statik: true, gelebt: false } },
    ).find((x) => x.id === 'D7-L4')!;
    expect(g.status).toBe('papier');
    expect(g.hinweis).toContain('Papier-Level');
    // Ist bleibt unangetastet (A-1: keine normative Absenkung).
    expect(g.istLevel).toBe(4);
  });

  test('Level erreicht, aber Statik fehlt → nicht_belegt', () => {
    const g = bewerteVereinbarungsGates(
      { d9: { ist: 4, soll: 4, relevanz: 1 } },
      { 'D9-L4': { statik: false } },
    ).find((x) => x.id === 'D9-L4')!;
    expect(g.status).toBe('nicht_belegt');
  });

  test('Level erreicht, kein Nachweis erhoben → ungeprueft (❓ Panel)', () => {
    const g = bewerteVereinbarungsGates({ d6: { ist: 3, soll: 3, relevanz: 1 } })
      .find((x) => x.id === 'D6-L3')!;
    expect(g.status).toBe('ungeprueft');
    expect(g.hinweis).toContain('❓');
  });

  test('Soll strebt Gate-Level an, Ist darunter → offen mit Org-Träger (R6)', () => {
    const g = bewerteVereinbarungsGates({ d7: { ist: 2, soll: 4, relevanz: 1 } })
      .find((x) => x.id === 'D7-L4')!;
    expect(g.status).toBe('offen');
    expect(g.hinweis).toContain('Management');
  });

  test('weder erreicht noch angestrebt → nicht_relevant', () => {
    const g = bewerteVereinbarungsGates({ d9: { ist: 1, soll: 1, relevanz: 1 } })
      .find((x) => x.id === 'D9-L4')!;
    expect(g.status).toBe('nicht_relevant');
  });

  test('maskierte Dimension (relevanz=0) → Gate nicht_relevant', () => {
    const g = bewerteVereinbarungsGates({ d10: { ist: 5, soll: 5, relevanz: 0 } })
      .find((x) => x.id === 'D10-L2')!;
    expect(g.status).toBe('nicht_relevant');
  });

  test('papierLevelWarnungen sammelt Papier + unbelegte Gates', () => {
    const bew = bewerteVereinbarungsGates(
      { d6: { ist: 3, soll: 3, relevanz: 1 }, d7: { ist: 4, soll: 4, relevanz: 1 } },
      { 'D6-L3': { statik: true, gelebt: false }, 'D7-L4': { statik: false } },
    );
    const warn = papierLevelWarnungen(bew).map((w) => w.id).sort();
    expect(warn).toEqual(['D6-L3', 'D7-L4']);
  });
});
