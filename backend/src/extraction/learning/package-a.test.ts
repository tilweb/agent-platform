import { test, expect, spyOn } from 'bun:test';
import { correctDate, correctNumber } from '../value-parsers';
import { validateExtraction } from '../validator';
import { extractionProjectToExtractionSchema } from './pipeline-adapter';
import { computeReviewStatus } from './review';
import { checkReview } from './review-result';
import { isReleased, modelReviewIssue, validateProjectResult } from './result-validation';
import { fuseWithOcr, applyFusionToConfidences } from '../../services/extraction/fusion';
import { finalizeResult } from '../../services/extraction/finalize';
import { hybridStrategy } from '../../services/extraction/strategies/hybrid';
import { visionPerPageStrategy } from '../../services/extraction/strategies/vision-per-page';
import { longTextChunkedStrategy } from '../../services/extraction/strategies/long-text-chunked';
import * as pdf from '../../services/extraction/pdf';
import * as fusion from '../../services/extraction/fusion';
import { llmService } from '../../services/llm';
import { isExtractionReleased } from '../../../../frontend/src/utils/extractionRelease';
import { mergeChunks } from '../../services/extraction/merger';
import { evaluateLookupRule } from './rules';
import type { ExtractionProject } from './types';
import type { StrategyResult } from '../../services/extraction/types';

const p: ExtractionProject = {
  id: 'p', name: 'P', description: '', created: '', updated: '', guidelines: '',
  learning: { total_examples: 0, accuracy_estimate: 0, guideline_version: 0 },
  fields: { number: { label: 'Nummer', type: 'text', required: true } },
};
const schema = extractionProjectToExtractionSchema(p);
const blank = (): StrategyResult => ({ extracted: {}, fieldConfidences: {}, provenance: [], warnings: [], strategyUsed: 'hybrid', llmCalls: 0 });

test('UI-created hybrid enables vision, explicit opt-out remains respected', () => {
  expect(extractionProjectToExtractionSchema({ ...p, extraction: { strategy: 'hybrid' } }).config.vision_fallback).toBe(true);
  expect(extractionProjectToExtractionSchema({ ...p, extraction: { strategy: 'hybrid', vision_fallback: false } }).config.vision_fallback).toBe(false);
});

test('hybrid sends image bytes directly to vision without an empty text extraction', async () => {
  const run = spyOn(visionPerPageStrategy, 'run').mockResolvedValue({ ...blank(), strategyUsed: 'vision-per-page' });
  const buffer = Buffer.from('synthetic-image');
  try {
    await hybridStrategy.run({ schema, userId: '', files: [{ filename: 'image', mimeType: 'image/png', text: '', rawBuffer: buffer }] }, () => {});
    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0]![0].files[0]!.rawBuffer).toBe(buffer);
  } finally { run.mockRestore(); }
});

test('empty required value blocks even at confidence 1', () => {
  expect(computeReviewStatus(p, { number: null }, { number: 1 })).toBe('needs_review');
});

const listProject: ExtractionProject = { ...p, fields: { items: { type: 'list', required: true, label: 'Positionen', item_fields: {
  quantity: { type: 'number', required: true, label: 'Menge' },
} } } };
test('required list and required cells are checked independently of aggregate confidence', () => {
  expect(computeReviewStatus(listProject, { items: [] }, { items: 1 })).toBe('needs_review');
  expect(computeReviewStatus(listProject, { items: [{ quantity: null }] }, { items: 1 })).toBe('needs_review');
  expect(computeReviewStatus(listProject, { items: [{ quantity: 2 }] }, { items: 1, 'items[0].quantity': .1 })).toBe('needs_review');
});
test('required segment field cannot disappear behind null confidence', () => {
  const segmented = { ...p, fields: {}, segments: { recipe: { label: 'Rezept', description: 'Test-Rezept', mode: 'extract' as const, fields: p.fields } } };
  expect(computeReviewStatus(segmented, { recipe: { number: null } }, { 'recipe.number': 0 })).toBe('needs_review');
  expect(validateProjectResult({ ...segmented, segments: { recipe: { ...segmented.segments.recipe, repeatable: true } } }, { recipe: [{ number: '1' }, {}] })).toHaveLength(1);
});

test('strict numbers accept DE notation but reject partial or nonfinite values', () => {
  expect(correctNumber('1.234,56')).toBe(1234.56);
  expect(correctNumber('1.234')).toBe(1234);
  expect(correctNumber('12,5')).toBe(12.5);
  for (const bad of ['12abc', '2 mg', '', '1,2,3', Infinity, NaN]) expect(correctNumber(bad)).toBeNull();
});
test('dates must exist on the calendar', () => {
  expect(correctDate('29.02.2024')).toBe('2024-02-29');
  for (const bad of ['2026-02-31', '2025-02-29', '2026-13-01', '2026-00-01']) expect(correctDate(bad)).toBeNull();
});
test('engine validates invalid dates, boolean objects and malformed list rows', () => {
  const def = { ...schema.profile, fields: { felder: { date: { type: 'date' as const }, check: { type: 'boolean' as const } }, items: { _array: true as const, _item_fields: { quantity: { type: 'number' as const } } } } };
  expect(validateExtraction({ felder: { date: '2026-02-31', check: {} }, items: [false] }, def).errors).toHaveLength(3);
});

test('numeric OCR substring is not evidence; exact occurrence never increases confidence', async () => {
  const page = { pageNumber: 1, width: 1000, height: 1000, pngBuffer: Buffer.alloc(0) };
  const word = (text: string) => ({ text, conf: 99, left: 10, top: 10, width: 100, height: 20 });
  const out = await fuseWithOcr([page], { felder: { number: '12345' } }, schema.profile, { wordsByPage: [[word('991234599')]] });
  expect(out.verdicts['felder.number']).toBe('not_found_numeric');
  const exact = await fuseWithOcr([page], { felder: { number: '12345' } }, schema.profile, { wordsByPage: [[word('12345')]] });
  const confidences = { 'felder.number': .5 };
  applyFusionToConfidences(confidences, exact);
  expect(confidences['felder.number']).toBe(.5);
});

test('one OCR occurrence cannot ground two repeated extracted rows', async () => {
  const def = { ...schema.profile, fields: { items: { _array: true as const, _item_fields: { article: { type: 'text' as const } } } } };
  const out = await fuseWithOcr([{ pageNumber: 1, width: 1000, height: 1000, pngBuffer: Buffer.alloc(0) }], { items: [{ article: '123456' }, { article: '123456' }] }, def, {
    wordsByPage: [[{ text: '123456', conf: 99, left: 10, top: 10, width: 100, height: 20 }]],
  });
  expect(out.verdicts['items[0].article']).toBe('located');
  expect(out.verdicts['items[1].article']).toBe('not_found_numeric');
});

test('repair invalidates stale boxes and confidence', () => {
  const result = finalizeResult({ ...blank(), extracted: { felder: { number: 'new' } }, fieldConfidences: { 'felder.number': .99 },
    boxes: { 'felder.number': { page: 1, x: 0, y: 0, w: .1, h: .1 } },
    provenance: [{ field: 'felder.number', value: 'old', source: 'p:1' }],
  }, { felder: { number: 'old' } }, schema.profile);
  expect(result.boxes).toEqual({});
  expect(result.provenance).toEqual([]);
  expect(result.fieldConfidences['felder.number']).toBe(0);
  expect(result.processingIssues?.some(i => i.code === 'changed')).toBe(true);
});

test('identical source rows remain separate and retain row provenance', () => {
  const profile = extractionProjectToExtractionSchema(listProject).profile;
  const result = mergeChunks([{ chunkIndex: 0, data: { items: [{ quantity: 2 }, { quantity: 2 }] } }, { chunkIndex: 1, data: { items: [{ quantity: 2 }] } }], profile, 'first-non-null');
  expect(result.merged.items).toHaveLength(3);
  expect(result.provenance.filter(p => p.sourceRow !== undefined).map(p => [p.field, p.source, p.sourceRow])).toEqual([
    ['items[0]', 'c:0', 0], ['items[1]', 'c:0', 1], ['items[2]', 'c:1', 0],
  ]);
});
test('mandatory lookup outage blocks even confident results', () => {
  const issue = evaluateLookupRule({ id: 'r', type: 'lookup', field: 'number', table_id: 't', column_id: 'c', severity: 'error' }, { number: 'A' }, null, p);
  expect(computeReviewStatus(p, { number: 'A' }, { number: 1 }, [issue!])).toBe('needs_review');
});
test('model self-confidence is never a release permission', () => {
  expect(computeReviewStatus(p, { number: 'A' }, { number: 1 }, modelReviewIssue('hybrid'))).toBe('needs_review');
  expect(isReleased({ status: 'completed', reviewStatus: 'reviewed', validations: [{ rule_id: 'x', type: 'processing', fields: [], severity: 'error', message: 'x' }] })).toBe(false);
  expect(isReleased({ status: 'completed', reviewStatus: 'needs_review' })).toBe(false);
  expect(isReleased({ status: 'completed', reviewStatus: 'reviewed', validations: [] })).toBe(true);
  expect(isReleased({ status: 'failed', reviewStatus: 'reviewed' })).toBe(false);
});
test('review without learning text validates before approval and rejects missing/unknown fields', async () => {
  let evaluated = 0;
  const evaluate = async () => { evaluated++; return []; };
  expect((await checkReview(p, { number: null }, [], evaluate)).allowed).toBe(false);
  expect(evaluated).toBe(0);
  expect((await checkReview(p, { number: 'A', surprise: 1 }, [], evaluate)).allowed).toBe(false);
  expect((await checkReview(p, { number: 'A' }, modelReviewIssue('hybrid'), evaluate)).allowed).toBe(true);
});
test('editing fields cannot clear missing-page errors', async () => {
  const previous = [{ rule_id: 'verarbeitung', type: 'processing' as const, severity: 'error' as const, fields: [], message: 'Seite fehlt' }];
  expect((await checkReview(p, { number: 'A' }, previous, async () => [])).allowed).toBe(false);
});

test('UI and backend agree on release, including legacy auto scores', () => {
  for (const status of ['completed', 'failed', 'processing']) {
    for (const reviewStatus of ['auto_ok', 'reviewed', 'needs_review', undefined]) {
      for (const strategy of ['hybrid', 'template-labelmap', undefined]) {
        const file = { status, reviewStatus, strategy, validations: [] };
        expect(isExtractionReleased(file)).toBe(isReleased(file));
      }
    }
  }
  expect(isReleased({ status: 'completed', reviewStatus: 'auto_ok', strategy: 'hybrid' })).toBe(false);
});

for (const failure of ['invalid-response', 'missing-pages', 'render-failure'] as const) {
  test(`hybrid with just one uncertain field exposes ${failure}`, async () => {
    const text = spyOn(longTextChunkedStrategy, 'run').mockResolvedValue({
      ...blank(), extracted: { felder: { number: 'A' } }, fieldConfidences: { 'felder.number': .2 },
    });
    const available = spyOn(pdf, 'isPdfRendererAvailable').mockResolvedValue(true);
    const render = spyOn(pdf, 'renderPdfToImages');
    if (failure === 'render-failure') render.mockRejectedValue(new Error('renderer unavailable'));
    else render.mockResolvedValue([{ pageNumber: 1, width: 1000, height: 1000, pngBuffer: Buffer.from('fake-image') }]);
    const count = spyOn(pdf, 'countPdfPages').mockResolvedValue(failure === 'missing-pages' ? 2 : 1);
    const chat = spyOn(llmService, 'chat').mockResolvedValue({ content: failure === 'invalid-response' ? 'not JSON' : '{"felder":{"number":"B"}}' } as never);
    const ocr = spyOn(fusion, 'fuseWithOcr').mockResolvedValue({ ocrRan: false, verdicts: {}, boxes: {}, decidedPaths: new Set(), findings: [] });
    try {
      const result = await hybridStrategy.run({
        schema: extractionProjectToExtractionSchema({ ...p, extraction: { strategy: 'hybrid' } }), userId: '',
        files: [{ filename: 'source.pdf', mimeType: 'application/pdf', rawBuffer: Buffer.from('pdf'), text: 'text '.repeat(60) }],
      }, () => {});
      expect(render).toHaveBeenCalledTimes(1);
      expect(result.processingIssues?.some(i => i.severity === 'error')).toBe(true);
      if (failure !== 'render-failure') expect(chat).toHaveBeenCalledTimes(1);
    } finally {
      text.mockRestore(); available.mockRestore(); render.mockRestore(); count.mockRestore(); chat.mockRestore(); ocr.mockRestore();
    }
  });
}
