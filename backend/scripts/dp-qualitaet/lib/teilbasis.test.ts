import { expect, test } from 'bun:test';
import type { ExtractionProject } from '../../../src/extraction/learning/types';
import { aggregiere, bewerteFall } from './bewertung';
import { beurteile, kritischRichtigJeFall } from './bericht';
import { ausGespeichertem, teilbasisAus } from './teilbasis';

const profil = { fields: [{ id: 'betrag', type: 'number', label: 'Betrag' }, { id: 'name', type: 'text', label: 'Name' }] } as unknown as ExtractionProject;
const fall = (id: string, data: Record<string, unknown>) => bewerteFall(profil, { id, split: 'test', erwartet: { daten: { betrag: 10, name: 'X' } } },
  { success: true, data, seiten: 1, sekunden: 1 }, { kritische: [], sicherAb: 0.8 });

test('teilbasisAus: Smoke wird gegen dieselben Faelle verglichen, nicht gegen den Gesamtschnitt', () => {
  // Gesamt-Baseline: 4 Faelle, davon 2 leicht (100 %) und 2 schwer (50 %) → 75 %.
  const alle = [fall('leicht1', { betrag: 10, name: 'X' }), fall('leicht2', { betrag: 10, name: 'X' }), fall('schwer1', { betrag: 10 }), fall('schwer2', { betrag: 10 })];
  const voll = { metriken: aggregiere(alle), rauschband: { felder: 0.1 }, kritischRichtig: kritischRichtigJeFall(alle) };
  expect(voll.metriken.quoten.felder).toBe(75);
  // Smoke misst nur die beiden schweren Faelle, unveraendert gut/schlecht wie in der Baseline.
  const smoke = [fall('schwer1', { betrag: 10 }), fall('schwer2', { betrag: 10 })];
  expect(beurteile('s', aggregiere(smoke), smoke, voll).harte.some((h) => h.includes('felder 75 % → 50 %'))).toBe(true); // alter, schiefer Vergleich: falscher Rueckgang
  const teil = teilbasisAus(voll, [[fall('schwer1', { betrag: 10 }), fall('schwer2', { betrag: 10 })], [fall('schwer1', { betrag: 10 }), fall('schwer2', { betrag: 10, name: 'X' })]]);
  expect(teil.metriken.quoten.felder).toBe(50);
  expect(teil.rauschband.felder).toBe(12.5); // Spannweite 50–75 aus den Wiederholungen, halbiert
  expect(teil.metriken.betrieb).toEqual(voll.metriken.betrieb);
  expect(beurteile('s', aggregiere(smoke), smoke, teil).harte).toEqual([]);
  // Ein echter Rueckgang bleibt sichtbar.
  const schlechter = [fall('schwer1', {}), fall('schwer2', {})];
  expect(beurteile('s', aggregiere(schlechter), schlechter, teil).harte.some((h) => h.includes('felder 50 % → 0 %'))).toBe(true);
});

test('ausGespeichertem: Fehler und Verarbeitungsfehler wie im Lauf', () => {
  expect(ausGespeichertem({ error: 'Timeout' }).success).toBe(false);
  const e = ausGespeichertem({ data: { a: 1 }, validations: [{ rule_id: 'verarbeitung', severity: 'error', message: 'Seite 2: 503' }, { rule_id: 'quellenpruefung', severity: 'error', message: 'x' }] });
  expect(e).toMatchObject({ success: true, data: { a: 1 }, verarbeitungsfehler: ['Seite 2: 503'] });
});
