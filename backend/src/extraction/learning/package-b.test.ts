import { test, expect } from 'bun:test';
import { readFile } from 'fs/promises';
import { createHash } from 'crypto';
import { scoreEvalRows, decideAcceptance, runEval, documentInterval } from './eval';
import { createSnapshot, profileHash, sameDocument, documentKeys } from './snapshot';
import type { ExtractionProject, TrainingExample } from './types';

const project: ExtractionProject = {
  id: 'test', name: 'Test', description: '', created: '', updated: '', guidelines: '',
  fields: { a: { type: 'text', required: true, label: 'A' }, b: { type: 'number', required: true, label: 'B' } },
  learning: { total_examples: 0, accuracy_estimate: 0, guideline_version: 0, dataset_version: 1 },
  extraction: { strategy: 'vision-per-page' },
};
function example(id: string, purpose: 'test' | 'train' = 'test'): TrainingExample {
  const bytes = Buffer.from(`original-${id}`);
  return { id, created: '', source_filename: `${id}.pdf`, document_text: `text-${id}`,
    initial_extraction: {}, corrected_extraction: { a: 'x', b: 2 }, corrections: [], confirmed_correct: true,
    dataset: { purpose, group: 'Scan', original: { base64: bytes.toString('base64'), filename: `${id}.pdf`, sha256: createHash('sha256').update(bytes).digest('hex') } } };
}

test('one correct result and one timeout score 50%, never 100%', () => {
  const result = scoreEvalRows(project, [{ expected: { a: 'x', b: 2 }, actual: { a: 'x', b: 2 } }, { error: 'timeout' }]);
  expect(result.overall).toBe(50);
  expect(result.document_accuracy).toBe(50);
  expect(result.by_field).toEqual({ a: 50, b: 50 });
  expect(result.examples).toBe(2);
  expect(decideAcceptance(49, result).accept).toBe(false);
});

test('a required field regression cannot hide behind improved average', () => {
  const champion = { overall: 75, examples: 2, by_field: { a: 100, b: 50 }, dataset_hash: 'same' };
  const challenger = { overall: 80, examples: 2, by_field: { a: 60, b: 100 }, dataset_hash: 'same', failed: false, failures: 0 };
  expect(decideAcceptance(champion, challenger).accept).toBe(false);
});

test('document variant regression blocks an otherwise better candidate', () => {
  const score = { overall: 80, examples: 10, by_field: { a: 80 }, by_group: { Scan: 100, Foto: 60 }, dataset_hash: 'same' };
  expect(decideAcceptance(score, { ...score, overall: 90, by_field: { a: 90 }, by_group: { Scan: 90, Foto: 90 }, failures: 0, failed: false }).accept).toBe(false);
});

test('changed test set and unaligned measurements cannot be promoted', () => {
  const score = { overall: 80, examples: 10, by_field: {}, dataset_hash: 'old' };
  expect(decideAcceptance(score, { ...score, overall: 100, dataset_hash: 'new', failed: false, failures: 0 }).accept).toBe(false);
  expect(decideAcceptance(10, { ...score, aligned: false, failed: false, failures: 0 }).accept).toBe(false);
});

test('validation errors prevent a document from counting as completely correct', () => {
  const score = scoreEvalRows(project, [{ expected: { a: 'x', b: 2 }, actual: { a: 'x', b: 2 }, valid: false }]);
  expect(score.overall).toBe(100);
  expect(score.document_accuracy).toBe(0);
});

test('snapshots isolate schema, defaults and examples and omit webhook secrets', () => {
  const mutable = structuredClone(project);
  mutable.webhook = { secret: 'do-not-store', url: 'https://example.org' };
  const training = example('train', 'train');
  const snapshot = createSnapshot(mutable, [training, example('holdout')]);
  mutable.fields.a!.label = 'Changed';
  training.corrected_extraction.a = 'Changed';
  expect(snapshot.project.fields.a!.label).toBe('A');
  expect(snapshot.examples[0]!.corrected_extraction.a).toBe('x');
  expect(snapshot.examples).toHaveLength(1);
  expect(snapshot.examples[0]!.dataset?.original).toBeUndefined();
  expect(snapshot.project.webhook).toBeUndefined();
  expect(snapshot.project.extraction?.model_override).toBeDefined();
});

test('profile hashes change for schema, instructions, rules, strategy and model', () => {
  const base = profileHash(project);
  for (const changes of [
    { instructions: 'new' }, { guidelines: 'new' },
    { fields: { ...project.fields, c: { type: 'text' as const, required: true, label: 'C' } } },
    { extraction: { strategy: 'single-pass' as const } },
    { extraction: { strategy: 'vision-per-page' as const, model_override: { provider_id: 'other', model_id: 'other' } } },
  ]) expect(profileHash({ ...project, ...changes })).not.toBe(base);
  expect(profileHash({ ...project, name: 'renamed' })).toBe(base);
});

test('renamed original and normalized text are duplicate documents', () => {
  const a = example('one');
  const b = example('two');
  b.dataset!.original = { ...a.dataset!.original!, filename: 'renamed.pdf' };
  expect(sameDocument(a, b)).toBe(true);
  b.dataset!.original = undefined;
  b.document_text = '  TEXT-ONE   ';
  expect(sameDocument(a, b)).toBe(true);
  expect(documentKeys(a).some(key => documentKeys(b).includes(key))).toBe(true);
});

test('small flawless sample retains substantial statistical uncertainty', () => {
  expect(documentInterval(5, 5).low).toBeLessThan(60);
  expect(documentInterval(100, 100).low).toBeGreaterThan(95);
  expect(documentInterval(0, 0)).toEqual({ low: 0, high: 100 });
});

test('evaluation replays exact originals using frozen production settings and few-shot pool', async () => {
  const holdout = example('heldout');
  const training = example('training', 'train');
  const snapshot = createSnapshot(project, [training]);
  let path = '';
  const result = await runEval(project, 'candidate', [holdout], undefined, [training], snapshot,
    async (_id, source, _user, captured) => {
      expect(source.type).toBe('file');
      if (source.type !== 'file') throw new Error('wrong source');
      path = source.path;
      expect((await readFile(path)).toString()).toBe('original-heldout');
      expect(captured?.project.extraction?.strategy).toBe('vision-per-page');
      expect(captured?.project.guidelines).toBe('candidate');
      expect(captured?.examples.map(e => e.id)).toEqual(['training']);
      return { success: true, data: { a: 'x', b: 2 }, document_text: '', fieldConfidences: { a: 0.4, b: 0.7 } };
    });
  expect(result.aligned).toBe(true);
  expect(result.overall).toBe(100);
  expect(result.calibration?.samples).toBe(2);
  expect(result.dataset_manifest?.[0]?.source_sha256).toBe(holdout.dataset!.original!.sha256);
  expect(await Bun.file(path).exists()).toBe(false);
});

test('missing originals, corrupted bytes, and train/test overlap count as failures without calling model', async () => {
  for (const kind of ['missing', 'corrupted', 'overlap']) {
    const heldout = example('heldout');
    const training = kind === 'overlap' ? [{ ...heldout, dataset: { ...heldout.dataset!, purpose: 'train' as const } }] : [];
    if (kind === 'missing') heldout.dataset!.original = undefined;
    if (kind === 'corrupted') heldout.dataset!.original!.base64 = Buffer.from('changed').toString('base64');
    let calls = 0;
    const result = await runEval(project, '', [heldout], undefined, training, createSnapshot(project, []), async () => { calls++; throw new Error('must not run'); });
    expect(calls).toBe(0);
    expect(result.failures).toBe(1);
    expect(result.examples).toBe(1);
    expect(result.overall).toBe(0);
  }
});

test('processing outages count in subgroup and overall scores and clean up temp files', async () => {
  let path = '';
  const result = await runEval(project, '', [example('heldout')], undefined, [], createSnapshot(project, []), async (_id, source) => {
    if (source.type === 'file') path = source.path;
    return { success: true, data: { a: 'x', b: 2 }, document_text: '', validations: [{ rule_id: 'verarbeitung', type: 'processing', fields: [], severity: 'error', message: 'page missing' }] };
  });
  expect(result.by_group?.Scan).toBe(0);
  expect(result.failures).toBe(1);
  expect(await Bun.file(path).exists()).toBe(false);
});
