import { createHash } from 'crypto';
import { applyExtractionDefaults } from '../../services/extraction/defaults';
import { EXTRACTION_SAMPLING } from '../../services/extraction/extract-call';
import { extractionModelConfig } from '../model';
import type { ExtractionProject, TrainingExample } from './types';

export function stableHash(value: unknown): string {
  const canonical = (v: any): any => Array.isArray(v) ? v.map(canonical)
    : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => [k, canonical(v[k])])) : v;
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

function runtimeSettings() {
  return { sampling: EXTRACTION_SAMPLING, guided_json: process.env.EXTRACTION_GUIDED_JSON !== '0',
    converter_config_hash: stableHash({ markitdown: process.env.MARKITDOWN_API_URL ?? 'default', docling: process.env.DOCLING_API_URL ?? '' }),
    build_revision: process.env.SOURCE_VERSION ?? null, model_revision: 'provider-managed' };
}

export function profileHash(project: ExtractionProject): string {
  return stableHash({ fields: project.fields, segments: project.segments, instructions: project.instructions,
    guidelines: project.guidelines, approved_examples: project.learning.approved_example_ids, rules: project.rules, extraction: applyExtractionDefaults({ strategy: 'hybrid', ...project.extraction,
      model_override: project.extraction?.model_override ?? extractionModelConfig() }), pipeline_version: 4, runtime: runtimeSettings() });
}

export interface ExtractionSnapshot {
  runtime?: ReturnType<typeof runtimeSettings>;
  references?: Record<string, { values: string[] } | { error: string }>;
  hash: string;
  project: ExtractionProject;
  examples: TrainingExample[];
  pipeline_version: number;
  created_at: string;
}

/** Captured once per run. No webhook secrets or mutable learning diagnostics in the artifact. */
export function createSnapshot(project: ExtractionProject, examples: TrainingExample[]): ExtractionSnapshot {
  const copy = structuredClone(project);
  delete copy.webhook;
  copy.learning = { approved_example_ids: project.learning.approved_example_ids, dataset_version: project.learning.dataset_version, total_examples: 0, accuracy_estimate: 0, guideline_version: project.learning.guideline_version };
  copy.extraction = applyExtractionDefaults({ strategy: 'hybrid', ...copy.extraction,
    model_override: copy.extraction?.model_override ?? extractionModelConfig() });
  const training = structuredClone(examples.filter(e => e.dataset?.purpose !== 'test' && (e.dataset?.activation !== 'candidate' || project.learning.approved_example_ids?.includes(e.id))));
  // Originals are not used by few-shot selection; omit their heavy payload from the snapshot.
  for (const e of training) if (e.dataset) delete e.dataset.original;
  return { hash: stableHash({ profile: profileHash(copy), examples: training }), project: copy,
    examples: training, runtime: runtimeSettings(), pipeline_version: 4, created_at: new Date().toISOString() };
}

export function documentKeys(example: Pick<TrainingExample, 'document_text' | 'dataset'>): string[] {
  const text = example.document_text.replace(/\s+/g, ' ').trim().toLowerCase();
  return [example.dataset?.original ? `bytes:${example.dataset.original.sha256}` : '', text ? `text:${stableHash(text)}` : ''].filter(Boolean);
}

export function sameDocument(a: TrainingExample, b: TrainingExample): boolean {
  const text = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  return !!(a.dataset?.original && b.dataset?.original && a.dataset.original.sha256 === b.dataset.original.sha256)
    || !!(text(a.document_text) && text(a.document_text) === text(b.document_text));
}
