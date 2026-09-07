import { test, expect } from 'bun:test';
import { fieldsToArray, fieldsToObject, scopedRuleFields } from '../../../../frontend/src/utils/extractionFields';
import { exampleContext, boundedExampleContexts } from './example-context';
import { createSnapshot } from './snapshot';
import { ruleFields, ruleData } from './rule-scope';
import { evaluateRules } from './rules';
import { evaluateProjectRules } from './service';
import { validateProjectSegments } from './validators';
import { validateSegmentPlan, segmentExamples } from '../segmentation/corrections';
import { extractWithSegments } from '../segmentation/segment-extract';
import { visualExampleMessages } from '../../services/extraction/visual-examples';
import { extractionProjectToExtractionSchema } from './pipeline-adapter';
import type { ExtractionProject, TrainingExample } from './types';

const field = { type: 'text' as const, label: 'Nummer', required: true };
const project: ExtractionProject = { id: 'c', name: 'C', description: '', created: '', updated: '', fields: { number: field }, guidelines: '',
  learning: { guideline_version: 0, total_examples: 0, accuracy_estimate: 0 } };
const sample = (patch: Partial<TrainingExample> = {}): TrainingExample => ({ id: 'one', created: '', source_filename: 'one.pdf',
  document_text: 'Nummer: ABC-999', initial_extraction: { number: 'ABC-998' }, corrected_extraction: { number: 'ABC-999' },
  corrections: [{ field: 'number', was: 'ABC-998', corrected_to: 'ABC-999' }], confirmed_correct: false, ...patch });

test('editor roundtrip preserves aliases, catalogs, extension metadata and list column identity', () => {
  const fields = { number: { ...field, aliases: ['Belegnummer'], extension: { format: 'id' } },
    rows: { type: 'list', required: false, label: 'Positionen', item_fields: { sku: { type: 'text', label: 'SKU', aliases: ['Artikel'], catalog: { source: 'list', values: [{ value: 'A', synonyms: ['a'] }] } } } } };
  expect(fieldsToObject(fieldsToArray(fields))).toEqual(fields);
  const edited = fieldsToArray(fields);
  edited[0]!.label = 'Neue Bezeichnung';
  const result = fieldsToObject(edited);
  expect((result as Record<string, any>).number.aliases).toEqual(['Belegnummer']);
  expect(Object.keys(result)).toEqual(['number', 'rows']);
});

test('duplicate field and list column IDs cannot silently overwrite definitions', () => {
  expect(() => fieldsToObject([{ ...field, id: 'same' }, { ...field, id: 'same' }])).toThrow('doppelt');
  expect(() => fieldsToObject([{ type: 'list', id: 'rows', label: 'Rows', item_fields: [{ ...field, id: 'x' }, { ...field, id: 'x' }] }])).toThrow('doppelt');
  expect(() => fieldsToObject([{ ...field, id: '__proto__' }])).toThrow('Ungültige');
});

test('learning includes a correction on a late page instead of the document header', () => {
  const context = exampleContext(sample({ document_text: 'Header '.repeat(1200) + '\nSeite 9\nNummer: ABC-999\nEnde' }));
  expect(context).toContain('Seite 9');
  expect(context).toContain('ABC-999');
  expect(context).toContain('ABC-998');
  expect(context.length).toBeLessThan(5000);
});

test('unseen fields and incomplete lists are excluded; numeric substrings are not a source context', () => {
  expect(exampleContext(sample({ document_text: 'Nur eine Überschrift' }))).toBe('');
  expect(exampleContext(sample({ document_text: '12345', corrected_extraction: { number: 123 } }))).toBe('');
  expect(exampleContext(sample({ document_text: 'A 1', corrected_extraction: { rows: [{ name: 'A', count: 1 }, { name: 'B', count: 2 }] } }))).toBe('');
  expect(exampleContext(sample({ dataset: { purpose: 'test' } }))).toBe('');
  expect(boundedExampleContexts(Array.from({ length: 100 }, () => sample()), 1500).length).toBeLessThanOrEqual(1500);
});

test('candidate examples do not enter production snapshots until approved', () => {
  const candidate = sample({ dataset: { purpose: 'train', activation: 'candidate' } });
  expect(createSnapshot(project, [candidate]).examples).toHaveLength(0);
  expect(createSnapshot({ ...project, learning: { ...project.learning, approved_example_ids: ['one'] } }, [candidate]).examples).toHaveLength(1);
});

test('visual examples are separate reference turns with the actual extraction schema', () => {
  const schema = extractionProjectToExtractionSchema(project, [sample({ dataset: { purpose: 'train', visual: [{ page: 1, dataUri: 'data:image/png;base64,AAAA' }] } })]);
  const messages = visualExampleMessages(schema.profile);
  expect(messages).toHaveLength(2);
  expect(messages[0]!.role).toBe('user');
  expect(messages[1]!.content).toBe(JSON.stringify({ felder: { number: 'ABC-999' } }));
});

const segmented: ExtractionProject = { ...project, segments: {
  form: { label: 'Antrag', description: 'Ein Anschreiben mit Vorgangsnummer', required: true, fields: { number: field } },
  proof: { label: 'Nachweis', description: 'Ein Nachweis mit Vorgangsnummer', repeatable: true, fields: { number: field } },
} };

test('segment corrections require complete non-overlapping coverage and valid cardinality', () => {
  expect(validateSegmentPlan(segmented, [{ type: 'form', pageFrom: 1, pageTo: 1 }, { type: 'proof', pageFrom: 2, pageTo: 3 }], 3)[1]!.instance).toBe(1);
  for (const plan of [
    [{ type: 'form', pageFrom: 2, pageTo: 3 }],
    [{ type: 'form', pageFrom: 1, pageTo: 2 }, { type: 'proof', pageFrom: 2, pageTo: 3 }],
    [{ type: 'form', pageFrom: 1, pageTo: 1 }],
    [{ type: 'form', pageFrom: 1, pageTo: 1 }, { type: 'form', pageFrom: 2, pageTo: 3 }],
    [{ type: 'unbekannt', pageFrom: 1, pageTo: 3 }],
    [{ type: 'proof', pageFrom: 1, pageTo: 3 }],
  ]) expect(() => validateSegmentPlan(segmented, plan, 3)).toThrow();
});

test('scoped examples contain only the matching segment context and values', () => {
  const examples = segmentExamples(segmented, 'proof', [sample({ corrected_extraction: { form: { number: 'secret-other' }, proof: [{ number: 'P' }] },
    dataset: { purpose: 'train', segment_contexts: { 'proof[1]': 'Nachweis Nummer P' } } })]);
  expect(examples[0]!.document_text).toBe('Nachweis Nummer P');
  expect(examples[0]!.corrections).toEqual([{ field: 'number', was: undefined, corrected_to: 'P' }]);
  expect(segmentExamples(segmented, 'proof', [sample({ dataset: { purpose: 'test' } })])).toEqual([]);
  expect(examples[0]!.corrected_extraction).toEqual({ number: 'P' });
  expect(JSON.stringify(examples[0]!.corrected_extraction)).not.toContain('secret-other');
});

test('cross-document equality checks every repeated instance and blocks missing values', async () => {
  const definition = { ...segmented, rules: [{ id: 'same-number', type: 'match' as const, fields: ['form.number', 'proof.number'] }] };
  expect(scopedRuleFields(definition)).toEqual(ruleFields(definition));
  const evaluate = (data: Record<string, unknown>) => evaluateRules({ ...definition, fields: ruleFields(definition) }, ruleData(definition, data), async () => ({ error: 'not used' }));
  expect(await evaluate({ form: { number: 'A' }, proof: [{ number: 'A' }, { number: 'A' }] })).toHaveLength(0);
  expect((await evaluate({ form: { number: 'A' }, proof: [{ number: 'A' }, { number: 'B' }] }))[0]!.severity).toBe('error');
  expect((await evaluate({ form: { number: 'A' }, proof: [] }))[0]!.status).toBe('not_evaluated');
  expect((await evaluate({ form: { number: {} }, proof: [{ number: {} }] }))[0]!.status).toBe('not_evaluated');
});

test('segment-local rules are validated and evaluated during review', async () => {
  const definition = { ...segmented, segments: { form: { ...segmented.segments!.form!, fields: { number: field, repeated: field },
    rules: [{ id: 'match', type: 'match' as const, fields: ['number', 'repeated'] }] } } };
  expect(validateProjectSegments(definition.segments)).toBeNull();
  const issues = await evaluateProjectRules(definition, { form: { number: 'A', repeated: 'B' } });
  expect(issues[0]!.fields).toEqual(['form.number', 'form.repeated']);
  expect(issues[0]!.severity).toBe('error');
});

function twoPagePdf(): Buffer {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> >>'];
  let text = '%PDF-1.4\n'; const offsets: number[] = [];
  objects.forEach((object, index) => { offsets.push(text.length); text += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = text.length;
  text += `xref\n0 5\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(text);
}

test('corrected page assignment reruns only changed segments and keeps other corrections', async () => {
  let calls = 0;
  const previous = { segments: [{ type: 'form', instance: 1, pageFrom: 1, pageTo: 1, confidence: 0.7 }, { type: 'unbekannt', instance: 1, pageFrom: 2, pageTo: 2, confidence: 0 }],
    data: { form: { number: 'human-correction' } }, fieldConfidences: {}, boxes: {}, pageImages: [], validations: [], llmCalls: 0 };
  const result = await extractWithSegments(segmented, twoPagePdf(), '', async () => ({ values: [] }), [], {
    previous, segments: [{ type: 'form', pageFrom: 1, pageTo: 1 }, { type: 'proof', pageFrom: 2, pageTo: 2 }],
    run: async () => { calls++; return { extracted: { felder: { number: 'new-proof' } }, fieldConfidences: {}, strategyUsed: 'vision-per-page', warnings: [], llmCalls: 1 } as any; },
  });
  expect(calls).toBe(1);
  expect(result.data.form).toEqual({ number: 'human-correction' });
  expect(result.data.proof).toEqual([{ number: 'new-proof' }]);
});
