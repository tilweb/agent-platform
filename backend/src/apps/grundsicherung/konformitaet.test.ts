/**
 * Konformitätstests Grundsicherung (Muster `docs/antragspruefung-muster.md`, Abschnitt 8).
 *
 * Statische Prüfung der Routen und Module über `_antrag-kern/konformitaet.ts`:
 *  a) Audit — jede direkt registrierte Schreibroute protokolliert.
 *  b) KI-Verbrauch — jede Route, die ein LLM erreicht, misst; LLM-Aufrufe nur in deklarierten Modulen.
 *  c) Regelkatalog/Goldfälle — liegen in `checker/regeln.test.ts` bzw. `checker/goldfaelle.test.ts`;
 *     hier nur sichergestellt, dass es sie gibt.
 *  d) Einschränkung (Art. 18) — jede vorgangsbezogene Schreibroute prüft die Einschränkung.
 *
 * AUSNAHMEN sind begründet und fachlich gewollt. Offene Verstöße: keine.
 */
import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  findeLlmModule, fremdeAppImporte, pruefeAudit, pruefeEinschraenkung, pruefeKiVerbrauch,
  type KonformitaetsKonfig,
} from '../_antrag-kern/konformitaet';

const AUSNAHMEN = {
  audit: {},
  ki: {},
  einschraenkung: {
    'PUT /vorgaenge/:id/einschraenkung': 'Setzt bzw. hebt die Einschränkung selbst auf (Aufheben nur Owner).',
    'PUT /vorgaenge/:id/legal-hold': 'Owner-Schutzmaßnahme (Löschsperre), ändert keine Fachdaten; muss auch bei Einschränkung möglich sein.',
    'PUT /vorgaenge/:id/aufbewahrung': 'Owner/DSB korrigiert die Aufbewahrungsfrist (Verwaltungsdatum, keine Fachdaten).',
  },
} satisfies KonformitaetsKonfig['ausnahmen'];

const KONFIG: KonformitaetsKonfig = {
  appDir: import.meta.dir,
  llmModule: {
    'dp-erkennung.ts': ['erkenneDokumente'],
  },
  // Erkennung ist in posteingang-queue.ts als Abhängigkeit `d.erkenne` injiziert (= erkenneDokumente).
  llmAufrufeZusaetzlich: ['d.erkenne'],
  // Lokale Hülle in posteingang-queue.ts: messeKiVerbrauch mit Governance-Detail.
  kiMesser: ['messe'],
  ausnahmen: AUSNAHMEN,
};

describe('Konformität Grundsicherung', () => {
  test('a) Audit: jede Schreibroute protokolliert', () => {
    const e = pruefeAudit(KONFIG);
    expect(e.geprueft.length).toBeGreaterThan(20);
    expect(e.verstoesse).toEqual([]);
    expect(e.ungenutzteAusnahmen).toEqual([]);
  });

  test('b) KI-Verbrauch: LLM-Module sind deklariert', () => {
    expect(findeLlmModule(KONFIG).sort()).toEqual(Object.keys(KONFIG.llmModule).sort());
  });

  test('b) KI-Verbrauch: jede LLM-Route misst', () => {
    const e = pruefeKiVerbrauch(KONFIG);
    expect(e.geprueft).toContain('POST /vorgaenge/:vorgangId/dokumente/upload');
    expect(e.verstoesse).toEqual([]);
    expect(e.ungenutzteAusnahmen).toEqual([]);
  });

  test('c) Regelkatalog und Goldfälle haben eigene Wächter-Tests', () => {
    expect(existsSync(join(import.meta.dir, 'checker/regeln.test.ts'))).toBe(true);
    expect(existsSync(join(import.meta.dir, 'checker/goldfaelle.test.ts'))).toBe(true);
  });

  test('Apps importieren einander nicht (Gemeinsames in _antrag-kern bzw. _vorrang)', () => {
    expect(fremdeAppImporte(import.meta.dir, ['wohngeld'])).toEqual([]);
  });

  test('d) Einschränkung: vorgangsbezogene Schreibrouten prüfen Art. 18', () => {
    const e = pruefeEinschraenkung(KONFIG);
    expect(e.geprueft.length).toBeGreaterThan(15);
    expect(e.verstoesse).toEqual([]);
    expect(e.ungenutzteAusnahmen).toEqual([]);
  });
});
