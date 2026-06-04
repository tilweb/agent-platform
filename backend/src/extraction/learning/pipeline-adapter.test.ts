import { test, expect } from 'bun:test';
import {
  extractionProjectToExtractionSchema,
  buildLearningGuidelines,
  PROJECT_FIELD_GROUP,
} from './pipeline-adapter';
import type { ExtractionProject, TrainingExample } from './types';

function makeProject(overrides: Partial<ExtractionProject> = {}): ExtractionProject {
  return {
    id: 'rechnungs-pruefung',
    name: 'Rechnungspruefung',
    description: 'Extrahiere Rechnungsdaten',
    created: '2026-01-01T00:00:00.000Z',
    updated: '2026-01-01T00:00:00.000Z',
    fields: {
      rechnungsnummer: { type: 'text', required: true, label: 'Rechnungsnummer' },
      betrag: { type: 'number', required: true, label: 'Betrag', description: 'Bruttobetrag in EUR' },
      faellig: { type: 'date', required: false, label: 'Faelligkeit' },
    },
    guidelines: '',
    learning: { total_examples: 0, accuracy_estimate: 0, guideline_version: 0 },
    ...overrides,
  };
}

test('wickelt flache Projekt-Felder in EINE synthetische Gruppe', () => {
  const schema = extractionProjectToExtractionSchema(makeProject());
  const groups = Object.keys(schema.profile.fields);
  expect(groups).toEqual([PROJECT_FIELD_GROUP]);

  const group = schema.profile.fields[PROJECT_FIELD_GROUP] as Record<string, { type: string; required?: boolean; hint?: string }>;
  expect(Object.keys(group)).toEqual(['rechnungsnummer', 'betrag', 'faellig']);
  expect(group.rechnungsnummer!.type).toBe('text');
  // Felder werden bewusst NICHT als required ins Function-Schema uebernommen
  // (Vision-Modelle erfuellen required-Schemas sonst minimal — Kollaps auf
  // Pflichtfelder). Trotz project.required=true → false im Profil.
  expect(group.rechnungsnummer!.required).toBe(false);
  // description → hint
  expect(group.betrag!.hint).toBe('Bruttobetrag in EUR');
});

test('Default-Strategie ist hybrid + validation_repair an', () => {
  const schema = extractionProjectToExtractionSchema(makeProject());
  expect(schema.profile.id).toBe('proj_rechnungs_pruefung'); // sanitized
  expect(schema.config.strategy).toBe('hybrid');
  expect(schema.config.vision_fallback).toBe(true);
  expect(schema.config.validation_repair).toBe(true);
});

test('respektiert explizite project.extraction-Config', () => {
  const schema = extractionProjectToExtractionSchema(
    makeProject({ extraction: { strategy: 'single-pass', validation_repair: false } }),
  );
  expect(schema.config.strategy).toBe('single-pass');
  expect(schema.config.validation_repair).toBe(false);
});

test('rendert gelernte Guidelines + Few-Shot in profile.guidelines', () => {
  const examples: TrainingExample[] = [
    {
      id: 'ex_1',
      created: '2026-01-02T00:00:00.000Z',
      source_filename: 'rechnung1.pdf',
      document_text: 'Rechnung Nr. R-2026-001 ueber 1.190,00 EUR',
      initial_extraction: { betrag: '1190' },
      corrected_extraction: { rechnungsnummer: 'R-2026-001', betrag: 1190 },
      corrections: [{ field: 'rechnungsnummer', was: null, corrected_to: 'R-2026-001' }],
      confirmed_correct: false,
    },
  ];
  const schema = extractionProjectToExtractionSchema(
    makeProject({ guidelines: 'Rechnungsnummer steht immer oben rechts.' }),
    examples,
  );
  const g = schema.profile.guidelines ?? '';
  expect(g).toContain('Rechnungsnummer steht immer oben rechts.');
  expect(g).toContain('Beispiele aus bisherigen Extraktionen');
  expect(g).toContain('R-2026-001');
});

test('ohne Guidelines/Examples bleibt profile.guidelines leer (undefined)', () => {
  const schema = extractionProjectToExtractionSchema(makeProject());
  expect(schema.profile.guidelines).toBeUndefined();
});

test('stabile instructions werden VOR gelernten guidelines gerendert', () => {
  const schema = extractionProjectToExtractionSchema(
    makeProject({
      instructions: 'STABILE REGEL: BSNR hat 9 Ziffern.',
      guidelines: 'GELERNT: Datum unten rechts.',
    }),
  );
  const g = schema.profile.guidelines ?? '';
  expect(g).toContain('STABILE REGEL: BSNR hat 9 Ziffern.');
  expect(g).toContain('GELERNT: Datum unten rechts.');
  // instructions zuerst
  expect(g.indexOf('STABILE REGEL')).toBeLessThan(g.indexOf('GELERNT'));
});

test('nur instructions (ohne guidelines/examples) landen in profile.guidelines', () => {
  const schema = extractionProjectToExtractionSchema(
    makeProject({ instructions: 'Nur Domänen-Regeln.' }),
  );
  expect(schema.profile.guidelines).toBe('Nur Domänen-Regeln.');
});

test('buildLearningGuidelines ist leer ohne Input', () => {
  expect(buildLearningGuidelines(makeProject(), [])).toBe('');
});

test('Round-trip: pipeline-Ergebnis (felder.<id>) entpackt zu flach', () => {
  // Simuliert, was service.extract() nach runPipeline macht.
  const pipelineExtracted: Record<string, unknown> = {
    [PROJECT_FIELD_GROUP]: { rechnungsnummer: 'R-1', betrag: 99 },
  };
  const flat = (pipelineExtracted[PROJECT_FIELD_GROUP] ?? {}) as Record<string, unknown>;
  expect(flat).toEqual({ rechnungsnummer: 'R-1', betrag: 99 });

  const pipelineConfidences: Record<string, number> = {
    [`${PROJECT_FIELD_GROUP}.rechnungsnummer`]: 1.0,
    [`${PROJECT_FIELD_GROUP}.betrag`]: 0.6,
  };
  const prefix = `${PROJECT_FIELD_GROUP}.`;
  const flatConf: Record<string, number> = {};
  for (const [path, conf] of Object.entries(pipelineConfidences)) {
    flatConf[path.startsWith(prefix) ? path.slice(prefix.length) : path] = conf;
  }
  expect(flatConf).toEqual({ rechnungsnummer: 1.0, betrag: 0.6 });
});
