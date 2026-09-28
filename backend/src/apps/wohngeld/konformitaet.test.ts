/**
 * Konformitätstests Wohngeld (Muster `docs/antragspruefung-muster.md`, Abschnitt 8).
 *
 * Statische Prüfung der Routen und Module über `_antrag-kern/konformitaet.ts`:
 *  a) Audit — jede direkt registrierte Schreibroute protokolliert.
 *  b) KI-Verbrauch — jede Route, die ein LLM erreicht, misst; LLM-Aufrufe nur in deklarierten Modulen.
 *  c) Regelkatalog/Goldfälle — liegen in `checker/regeln.test.ts` bzw. `checker/checker.test.ts`;
 *     hier nur sichergestellt, dass es sie gibt.
 *  d) Einschränkung (Art. 18) — jede vorgangsbezogene Schreibroute prüft die Einschränkung.
 *
 * AUSNAHMEN sind begründet und fachlich gewollt. OFFENE_VERSTOESSE sind echte Abweichungen vom
 * Muster, die noch zu beheben sind — der Test hält sie sichtbar fest und schlägt an, sobald
 * einer behoben ist (dann aus der Liste streichen) oder ein neuer dazukommt.
 */
import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  findeLlmModule, fremdeAppImporte, pruefeAudit, pruefeEinschraenkung, pruefeKiVerbrauch, schluesselVon,
  type KonformitaetsKonfig, type PruefErgebnis,
} from '../_antrag-kern/konformitaet';

const AUSNAHMEN = {
  audit: {},
  ki: {},
  einschraenkung: {
    'PUT /vorgaenge/:id/einschraenkung': 'Setzt bzw. hebt die Einschränkung selbst auf (Aufheben nur Owner).',
    'PUT /vorgaenge/:id/legal-hold': 'Owner-Schutzmaßnahme (Löschsperre), ändert keine Fachdaten; muss auch bei Einschränkung möglich sein.',
  },
} satisfies KonformitaetsKonfig['ausnahmen'];

/** Echte Verstöße, bewusst offen gehalten bis zur Entscheidung (siehe Rückmeldung/Changelog). */
const OFFENE_VERSTOESSE = { audit: {}, ki: {}, einschraenkung: {} };

const KONFIG: KonformitaetsKonfig = {
  appDir: import.meta.dir,
  llmModule: {
    'extraction.ts': ['klassifiziereUndExtrahiere'],
    'dp-erkennung.ts': ['erkenneDokumente'],
  },
  ausnahmen: AUSNAHMEN,
};

function erwarte(e: PruefErgebnis, offen: Record<string, string>) {
  expect(e.ungenutzteAusnahmen).toEqual([]);
  expect([...new Set(e.verstoesse.map(schluesselVon))].sort()).toEqual(Object.keys(offen).sort());
}

describe('Konformität Wohngeld', () => {
  test('a) Audit: jede Schreibroute protokolliert', () => {
    const e = pruefeAudit(KONFIG);
    expect(e.geprueft.length).toBeGreaterThan(25);
    erwarte(e, OFFENE_VERSTOESSE.audit);
  });

  test('b) KI-Verbrauch: LLM-Module sind deklariert', () => {
    expect(findeLlmModule(KONFIG).sort()).toEqual(Object.keys(KONFIG.llmModule).sort());
  });

  test('b) KI-Verbrauch: jede LLM-Route misst', () => {
    const e = pruefeKiVerbrauch(KONFIG);
    expect(e.geprueft).toEqual(expect.arrayContaining([
      'POST /vorgaenge/:id/chat', 'POST /vorgaenge/:id/chat/gesetz', 'POST /vorgaenge/:vorgangId/dokumente/upload',
    ]));
    erwarte(e, OFFENE_VERSTOESSE.ki);
  });

  test('c) Regelkatalog und Goldfälle haben eigene Wächter-Tests', () => {
    expect(existsSync(join(import.meta.dir, 'checker/regeln.test.ts'))).toBe(true);
    expect(existsSync(join(import.meta.dir, 'checker/checker.test.ts'))).toBe(true);
  });

  test('Apps importieren einander nicht (Gemeinsames in _antrag-kern bzw. _vorrang)', () => {
    expect(fremdeAppImporte(import.meta.dir, ['grundsicherung'])).toEqual([]);
  });

  test('d) Einschränkung: vorgangsbezogene Schreibrouten prüfen Art. 18', () => {
    const e = pruefeEinschraenkung(KONFIG);
    expect(e.geprueft.length).toBeGreaterThan(20);
    erwarte(e, OFFENE_VERSTOESSE.einschraenkung);
  });

  test('Ausnahmen und offene Verstöße sind begründet', () => {
    for (const liste of [...Object.values(AUSNAHMEN), ...Object.values(OFFENE_VERSTOESSE)]) {
      for (const grund of Object.values(liste)) expect(String(grund).length).toBeGreaterThan(15);
    }
  });
});
