import { expect, test } from 'bun:test';
import { istKatalogFeld, katalogFelder, katalogWerte, mitKatalogFeldern, ohneKatalogFelder } from './vertragskatalog';
import { erweiterungsFelder, katalogInProfilform } from '../services/extraction/strategies/contract-structured';
import { extractionProjectToExtractionSchema } from './learning/pipeline-adapter';
import type { ExtractionProject } from './learning/types';

test('katalogFelder: je Element Status + Werte + Fundstellen, Listen mit Spalten, verschachtelte Frist aufgeloest', () => {
  const f = katalogFelder();
  expect(Object.values(f).every((x) => x.group === 'Vertragskatalog' && !x.required)).toBe(true);
  expect(f.katalog_beginn_status).toMatchObject({ type: 'text', label: 'Beginn: Status' });
  expect(f.katalog_beginn_status!.catalog?.values?.map((v) => v.value)).toContain('nicht_geregelt');
  expect(f.katalog_beginn_datum).toMatchObject({ type: 'date', label: 'Beginn: Datum' });
  expect(f.katalog_kuendigung_frist_dauer).toMatchObject({ type: 'number', label: 'Kündigung: Frist – Dauer' });
  expect(f.katalog_kuendigung_frist_einheit!.catalog?.values?.map((v) => v.value)).toEqual(['tage', 'werktage', 'wochen', 'monate', 'jahre']);
  expect(f.katalog_vertragsstrafe).toMatchObject({ type: 'text', label: 'Vertragsstrafe' });
  expect(f.katalog_parteien!.type).toBe('list');
  expect(Object.keys(f.katalog_parteien!.item_fields!)).toEqual(['rolle', 'name', 'anschrift', 'aliasse']);
  expect(f.katalog_anlagen_fundstellen!.type).toBe('text');
  expect(istKatalogFeld('katalog_beginn_datum')).toBe(true);
  expect(istKatalogFeld('katalog_eigenes_feld')).toBe(false);
});

test('katalogWerte: Status, Werte, Listen, Fundstellen, nicht geregelt leer; Konfidenz-Faustregel', () => {
  const { werte, konfidenz } = katalogWerte({
    beginn: { status: 'gefunden', wert: { datum: '2024-07-01', regel: null }, klauseln: ['§2.1'] },
    kuendigung: { status: 'bedingt', wert: { frist: { dauer: 3, einheit: 'monate', richtung: 'vor', bezug: 'Laufzeitende', zum: null, wortlaut: '3 Monate' }, form: 'schriftlich', ausserordentlich: null }, bedingung: 'nur Kaufleute', klauseln: ['§6'] },
    parteien: { status: 'gefunden', wert: [{ rolle: 'Kunde', name: 'Muster GmbH', anschrift: null, aliasse: ['MG', 'Muster'] }], klauseln: ['rubrum'] },
    vertragsstrafe: { status: 'nicht_geregelt', wert: { text: 'x' }, klauseln: [] },
  } as never);
  expect(werte).toMatchObject({
    katalog_beginn_status: 'gefunden', katalog_beginn_datum: '2024-07-01', katalog_beginn_regel: null, katalog_beginn_fundstellen: '§2.1',
    katalog_kuendigung_frist_dauer: 3, katalog_kuendigung_form: 'schriftlich',
    katalog_parteien: [{ rolle: 'Kunde', name: 'Muster GmbH', anschrift: null, aliasse: 'MG; Muster' }],
    katalog_vertragsstrafe_status: 'nicht_geregelt', katalog_vertragsstrafe: null,
    katalog_haftung_status: 'nicht_geregelt', katalog_entgelte: [],
  });
  expect(konfidenz).toMatchObject({ katalog_beginn_datum: 0.85, katalog_kuendigung_frist_dauer: 0.6, katalog_beginn_regel: 0, katalog_vertragsstrafe_status: 0.85 });
});

test('Profil: Katalogfelder nur bei Vertragsprofilen angehaengt, beim Speichern entfernt; eigene katalog_*-Felder bleiben', () => {
  const eigen = { anzahl_ladepunkte: { type: 'number', required: false, label: 'Ladepunkte' }, katalog_eigenes_feld: { type: 'text', required: false, label: 'x' } } as ExtractionProject['fields'];
  const vertrag = mitKatalogFeldern({ fields: eigen, extraction: { strategy: 'contract-structured' } });
  expect(Object.keys(vertrag.fields).slice(0, 2)).toEqual(['anzahl_ladepunkte', 'katalog_eigenes_feld']);
  expect(vertrag.fields.katalog_beginn_status).toBeDefined();
  expect(mitKatalogFeldern({ fields: eigen, extraction: { strategy: 'hybrid' } }).fields).toBe(eigen);
  expect(Object.keys(ohneKatalogFelder(vertrag.fields))).toEqual(['anzahl_ladepunkte', 'katalog_eigenes_feld']);
});

test('Strategie: Katalogfelder nicht ans Modell (Erweiterung), Werte landen in der Profilform', () => {
  const project = mitKatalogFeldern({
    id: 'v', name: 'V', description: '', created: '', updated: '', guidelines: '',
    learning: { total_examples: 0, accuracy_estimate: 0, guideline_version: 0 },
    fields: { anzahl_ladepunkte: { type: 'number', required: false, label: 'Ladepunkte' } },
    extraction: { strategy: 'contract-structured' },
  } as ExtractionProject);
  const profilFelder = extractionProjectToExtractionSchema(project).profile.fields;
  expect(Object.keys(erweiterungsFelder(profilFelder).felder)).toEqual(['anzahl_ladepunkte']);
  const ziel = { extracted: { felder: { anzahl_ladepunkte: 4 } } as Record<string, unknown>, fieldConfidences: {} as Record<string, number> };
  katalogInProfilform({ beginn: { status: 'gefunden', wert: { datum: '2024-07-01', regel: null }, klauseln: ['§2'] }, parteien: { status: 'gefunden', wert: [{ rolle: 'Kunde', name: 'M', anschrift: null, aliasse: [] }], klauseln: ['rubrum'] } } as never, profilFelder, ziel);
  expect((ziel.extracted.felder as Record<string, unknown>).anzahl_ladepunkte).toBe(4);
  expect((ziel.extracted.felder as Record<string, unknown>).katalog_beginn_datum).toBe('2024-07-01');
  expect(ziel.extracted.katalog_parteien).toEqual([{ rolle: 'Kunde', name: 'M', anschrift: null, aliasse: null }]);
  expect(ziel.fieldConfidences['felder.katalog_beginn_datum']).toBe(0.85);
  expect(ziel.fieldConfidences['katalog_parteien[0].name']).toBe(0.85);
});

test('Katalogdatum im deutschen Format: nach der Angleichung in der Strategie kein „erneut pruefen" im Abschluss-Schritt', async () => {
  const { finalizeResult } = await import('../services/extraction/finalize');
  const { validateExtraction } = await import('./validator');
  const project = mitKatalogFeldern({
    id: 'v', name: 'V', description: '', created: '', updated: '', guidelines: '',
    learning: { total_examples: 0, accuracy_estimate: 0, guideline_version: 0 },
    fields: {}, extraction: { strategy: 'contract-structured' },
  } as ExtractionProject);
  const profil = extractionProjectToExtractionSchema(project).profile;
  const ziel = { extracted: {} as Record<string, unknown>, fieldConfidences: {} as Record<string, number> };
  katalogInProfilform({ beginn: { status: 'gefunden', wert: { datum: '01.11.2022', regel: null }, klauseln: ['§6.1'] } } as never, profil.fields, ziel);
  validateExtraction(ziel.extracted, profil); // wie in der Strategie
  const vorher = structuredClone(ziel.extracted);
  const r = finalizeResult({ extracted: ziel.extracted, fieldConfidences: ziel.fieldConfidences, provenance: [], warnings: [], llmCalls: 0, strategyUsed: 'contract-structured' } as never, vorher, profil);
  expect((r.processingIssues ?? []).some((i) => i.code === 'changed')).toBe(false);
  expect(r.fieldConfidences['felder.katalog_beginn_datum']).toBe(0.85);
});
