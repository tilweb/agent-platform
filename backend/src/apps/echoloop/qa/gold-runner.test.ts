/**
 * Verankert den Gold-Runner selbst: auf dem aktuellen Extraktions-Stand muss der
 * Übungsfall vollständig durchlaufen (kein Feld-Abweicher). Schlägt hier etwas
 * fehl, ist es eine REGRESSION bis der Mensch die Golden-Referenz bewusst neu pinnt.
 */
import { test, expect } from 'bun:test';
import { runGold } from './gold-runner';

test('Gold-Runner · Übungsfall läuft ohne Abweichung (PASS)', async () => {
  const r = await runGold();
  if (!r.pass) console.error(r.summary, JSON.stringify(r.mismatches, null, 2));
  expect(r.mismatches).toEqual([]);
  expect(r.pass).toBe(true);
  expect(r.prozesse).toBe(5);
  expect(r.variablen).toBe(30);
});
