import { verifyPackageD } from './document-processing-paket-d-db-test';
/** Integration check against a disposable localhost PostgreSQL database only. */
import assert from 'node:assert/strict';
import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import { getSql, closeSql } from '../backend/src/db/client';
import { createProject, getProject, updateProject, mutateProject, deleteProject } from '../backend/src/extraction/learning/projects';
import { saveExample, getExamples, deleteExample, selectFewShotExamples } from '../backend/src/extraction/learning/examples';
import { createSnapshot } from '../backend/src/extraction/learning/snapshot';
import { createBatchRun, saveRunSnapshot, getRunSnapshot, upsertFileResult, getBatchRunFileDetail } from '../backend/src/extraction/learning/batch-runs';
import { saveEvaluation, getEvaluation } from '../backend/src/extraction/learning/evaluation-store';

if (process.env.PACKAGE_B_TEST_DATABASE !== '1' || !process.env.SCALINGO_POSTGRES?.startsWith('postgres://localhost:55439/')) {
  throw new Error('Only the explicitly enabled disposable localhost:55439 database is permitted');
}
process.env.EXTRACTION_SIMILARITY_FEWSHOT = '0';
const sql = getSql();
try {
  // Reconstruct the previous extraction schema, then apply the new migration.
  for (const name of ['0000_little_junta', '0001_phase2_additions', '0020_extraction_project_strategy',
    '0021_extraction_project_instructions', '0024_extraction_batch_runs', '0025_batch_file_audit',
    '0026_batch_review', '0029_extraction_rules', '0030_extraction_webhooks', '0031_example_embeddings',
    '0032_extraction_segments', '0035_extraction_dataset', '0036_extraction_jobs']) {
    await sql.unsafe(await readFile(new URL(`../backend/drizzle/${name}.sql`, import.meta.url), 'utf8'));
  }
  const project = await createProject({ name: 'Package B local test', fields: { number: { type: 'text', label: 'Number', required: true } } });
  const payload = (id: string, purpose: 'train' | 'test') => {
    const bytes = Buffer.from(id);
    return { source_filename: `${id}.txt`, document_text: `document ${id}`, initial_extraction: { number: id }, corrected_extraction: { number: id },
      dataset: { purpose, original: { filename: `${id}.txt`, base64: bytes.toString('base64'), sha256: createHash('sha256').update(bytes).digest('hex') } } };
  };
  const results = await Promise.allSettled([saveExample(project.id, payload('one', 'train')), saveExample(project.id, payload('one', 'test'))]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1, 'Concurrent cross-purpose duplicates must not both save');
  const training = await saveExample(project.id, payload('training', 'train'));
  const test = await saveExample(project.id, payload('heldout', 'test'));
  const pendingPayload = payload('pending', 'train');
  const pending = await saveExample(project.id, { ...pendingPayload, dataset: { ...pendingPayload.dataset, activation: 'candidate' } });
  assert(!(await selectFewShotExamples(project.id)).some(example => example.id === pending.id));
  await mutateProject(project.id, current => ({ learning: { ...current.learning, approved_example_ids: [pending.id] } }));
  assert((await selectFewShotExamples(project.id)).some(example => example.id === pending.id));
  const all = await getExamples(project.id);
  const fewShot = await selectFewShotExamples(project.id);
  assert(fewShot.every(e => e.dataset?.purpose === 'train'));
  assert.equal((await getProject(project.id))!.learning.total_examples, all.filter(e => e.dataset?.purpose === 'train').length);
  await deleteExample(project.id, training.id);
  await assert.rejects(() => saveExample(project.id, payload('training', 'test')), /anderen Zweck/);

  await Promise.all(Array.from({ length: 10 }, () => mutateProject(project.id, p => ({ learning: { ...p.learning, guideline_version: p.learning.guideline_version + 1 } }))));
  assert.equal((await getProject(project.id))!.learning.guideline_version, 10, 'Concurrent learning updates must not be lost');
  const current = (await getProject(project.id))!;
  const snapshot = createSnapshot(current, await getExamples(project.id));
  const run = await createBatchRun(project.id, ['heldout.txt']);
  await saveRunSnapshot(project.id, run.runId, snapshot);
  assert.equal((await saveRunSnapshot(project.id, run.runId, { ...snapshot, hash: 'must-not-overwrite' })).hash, snapshot.hash);
  await upsertFileResult(project.id, run.runId, run.files[0]!.id, { status: 'completed', data: { number: 'heldout' }, original: test.dataset!.original });
  await upsertFileResult(project.id, run.runId, run.files[0]!.id, { status: 'completed', reviewDraft: { number: 'unfinished correction' } });
  const draftDetail = await getBatchRunFileDetail(project.id, run.runId, run.files[0]!.id);
  assert.equal(draftDetail?.data?.number, 'heldout');
  assert.equal(draftDetail?.reviewDraft?.number, 'unfinished correction');
  assert.notEqual(draftDetail?.reviewStatus, 'reviewed');
  await updateProject(project.id, { fields: { replacement: { type: 'text', label: 'New', required: true } } });
  const detail = await getBatchRunFileDetail(project.id, run.runId, run.files[0]!.id);
  assert(detail?.snapshot?.project.fields.number);
  assert.equal(detail?.original?.sha256, test.dataset!.original!.sha256);
  await upsertFileResult(project.id, run.runId, run.files[0]!.id, { status: 'completed', boxes: {}, data: { number: 'heldout' }, reviewStatus: 'reviewed', reviewDraft: null });
  assert.equal((await getBatchRunFileDetail(project.id, run.runId, run.files[0]!.id))?.reviewDraft, null);
  assert.equal((await getBatchRunFileDetail(project.id, run.runId, run.files[0]!.id))?.original?.sha256, test.dataset!.original!.sha256);
  assert.equal((await getRunSnapshot(project.id, run.runId))!.hash, snapshot.hash);

  const evidenceId = await saveEvaluation(project.id, { snapshot, tests: [test], score: { overall: 100, by_field: { number: 100 }, examples: 1, failed: false, failures: 0 } });
  await deleteExample(project.id, test.id);
  assert.equal((await getEvaluation(project.id, evidenceId))!.tests[0]!.dataset!.original!.base64, test.dataset!.original!.base64);
  assert.equal(await getEvaluation('wrong-project', evidenceId), null);
  await verifyPackageD(project.id, snapshot);
  await deleteProject(project.id);
  assert.equal(await getEvaluation(project.id, evidenceId), null);
  console.log('PASS: migration, concurrent duplicate protection, role retention, few-shot separation, atomic updates, frozen batch schema, original retention, durable evaluation evidence and project cascade.');
} finally {
  await closeSql();
}
