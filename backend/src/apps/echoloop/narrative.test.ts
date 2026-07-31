import { test, expect } from 'bun:test';
import { parseNarrativResponse } from './narrative';

test('parseNarrativResponse: strippt <think>-Block + ```json und extrahiert JSON', () => {
  const raw = `<think>Ich überlege... D2 hat feste Wartezeiten, also L1.</think>
\`\`\`json
{"exec":{"was":"X","findings":["f"],"staerken":["s"]},"prosa":["p"],"dims":{"d2":{"beleg":"b","recs":["r1","r2"]}},"stabilityNote":"note"}
\`\`\``;
  const p = parseNarrativResponse(raw);
  expect(p).not.toBeNull();
  expect(p!.exec!.was).toBe('X');
  expect(p!.dims!.d2!.beleg).toBe('b');
  expect(p!.dims!.d2!.recs).toEqual(['r1', 'r2']);
});

test('parseNarrativResponse: reines JSON ohne <think>', () => {
  const p = parseNarrativResponse('{"exec":{"was":"Y"},"dims":{}}');
  expect(p!.exec!.was).toBe('Y');
});

test('parseNarrativResponse: kein JSON → null', () => {
  expect(parseNarrativResponse('nur Fließtext, kein JSON')).toBeNull();
});

test('parseNarrativResponse: fehlendes exec/dims → null', () => {
  expect(parseNarrativResponse('{"prosa":["x"]}')).toBeNull();
});
