/** Offline counterexamples for the 2026-09-06 review. No documents or services used.
 * Run from repository root: bun tools/document-processing-audit-2026-09-06.ts
 * Updated after Packages A and B: offline regressions for extraction and evaluation.
 */
import { strict as assert } from 'node:assert';
import { computeReviewStatus } from '../backend/src/extraction/learning/review';
import { scoreEvalRows, decideAcceptance } from '../backend/src/extraction/learning/eval';
import { dedupeListItems } from '../backend/src/extraction/learning/list-utils';
import { extractionProjectToExtractionSchema } from '../backend/src/extraction/learning/pipeline-adapter';
import { fuseWithOcr, applyFusionToConfidences } from '../backend/src/services/extraction/fusion';
import { validateExtraction } from '../backend/src/extraction/validator';
import { hybridStrategy } from '../backend/src/services/extraction/strategies/hybrid';
import { visionPerPageStrategy } from '../backend/src/services/extraction/strategies/vision-per-page';
import { evaluateLookupRule } from '../backend/src/extraction/learning/rules';
import type { ExtractionProject } from '../backend/src/extraction/learning/types';

const project = (fields: ExtractionProject['fields'], extra = {}): ExtractionProject => ({
  id: 'offline-audit', name: 'Offline audit', description: '', created: '', updated: '',
  fields, guidelines: '', learning: { total_examples: 0, accuracy_estimate: 0, guideline_version: 0 }, ...extra,
});
const report: Record<string, unknown> = {};
const listFields = { article: { type: 'text' as const, label: 'Artikel' }, quantity: { type: 'number' as const, label: 'Menge', required: true } };
const lp = project({ items: { type: 'list', label: 'Positionen', required: true, item_fields: listFields } });
const rows = [{ article: 'A', quantity: 2 }, { article: 'A', quantity: 2 }];
const deduped = dedupeListItems(rows, listFields);
assert.equal(deduped.length, 2);
report.identical_real_rows = { before: rows.length, after: deduped.length };

const status = computeReviewStatus(lp, { items: [{ article: 'A', quantity: null }] }, { items: .99, 'items[0].quantity': 0 });
assert.equal(status, 'needs_review');
report.missing_required_list_cell = status;
const emptyStatus = computeReviewStatus(lp, { items: [] }, { items: 1 });
assert.equal(emptyStatus, 'needs_review');
report.empty_required_list_high_confidence = emptyStatus;

const sp = project({}, { segments: { recipe: { label: 'Rezept', description: 'Ein Rezept mit einer Pflichtnummer', mode: 'extract', fields: { number: { type: 'text', label: 'Nummer', required: true } } } } });
const segStatus = computeReviewStatus(sp, { recipe: { number: null } }, { 'recipe.number': 0 });
assert.equal(segStatus, 'needs_review');
report.missing_required_segment_field = segStatus;

const p = project({ number: { type: 'text', label: 'Nummer', required: true } });
const score = scoreEvalRows(p, [{ expected: { number: 'A' }, actual: { number: 'A' } }, { error: 'timeout' }]);
assert.equal(score.overall, 50);
assert.equal(decideAcceptance(99, score).accept, false);
report.eval_half_failed = { ...score, acceptance_against_99: decideAcceptance(99, score) };
if (score.overall !== 50 || decideAcceptance(99, score).accept) throw new Error('Eval failure denominator regression');

const schema = extractionProjectToExtractionSchema(p);
const uiHybrid = extractionProjectToExtractionSchema({ ...p, extraction: { strategy: 'hybrid' } });
assert.equal(uiHybrid.config.vision_fallback, true);
assert.equal(schema.config.vision_fallback, true);
report.ui_created_hybrid = { vision_fallback: uiHybrid.config.vision_fallback, without_extraction_config: schema.config.vision_fallback };
const fusion = await fuseWithOcr([{ pageNumber: 1, width: 1000, height: 1000, pngBuffer: Buffer.alloc(0) }], { felder: { number: '12345' } }, schema.profile, {
  wordsByPage: [[{ text: '991234599', conf: 99, left: 10, top: 10, width: 100, height: 20 }]],
});
const confidences = { 'felder.number': .7 };
applyFusionToConfidences(confidences, fusion);
assert.equal(fusion.verdicts['felder.number'], 'not_found_numeric');
assert.equal(confidences['felder.number'], .4);
report.numeric_substring_false_evidence = { verdict: fusion.verdicts['felder.number'], confidence: confidences['felder.number'] };

const vp = project({ amount: { type: 'number', label: 'Betrag', required: true }, date: { type: 'date', label: 'Datum', required: true } });
const invalid = { felder: { amount: '12abc', date: '2026-02-31' } };
const validation = validateExtraction(invalid, extractionProjectToExtractionSchema(vp).profile);
assert.equal(validation.valid, false);
assert.equal(invalid.felder.amount, '12abc');
report.invalid_types = { data: invalid, validation };

const lookup = evaluateLookupRule({ id: 'lookup', type: 'lookup', field: 'number', table_id: 't', column_id: 'c', severity: 'error' }, { number: 'A' }, null, p, 'unavailable');
assert.equal(lookup?.severity, 'error');
assert.equal(computeReviewStatus(p, { number: 'A' }, { number: .99 }, [lookup!]), 'needs_review');
report.unavailable_mandatory_lookup = { severity: lookup?.severity, review: 'needs_review' };

// Stub the vision boundary: routing must pass the original image bytes.
const originalRun = visionPerPageStrategy.run;
let imageSeen = false;
visionPerPageStrategy.run = async (input) => {
  imageSeen = !!input.files[0]?.rawBuffer;
  return { extracted: {}, fieldConfidences: {}, provenance: [], warnings: [], llmCalls: 0, strategyUsed: 'vision-per-page' };
};
try {
  const result = await hybridStrategy.run({
    files: [{ filename: 'image', mimeType: 'image/png', text: '', rawBuffer: Buffer.from('synthetic-image') }],
    schema: extractionProjectToExtractionSchema(p), userId: '',
  }, async () => {});
  assert.equal(imageSeen, true);
  report.hybrid_image = { image_reaches_vision: imageSeen, strategy: result.strategyUsed };
} finally { visionPerPageStrategy.run = originalRun; }
console.log(JSON.stringify(report, null, 2));
