import { test, expect } from 'bun:test';
import { repairExtraction, parseExtractionResponse, type ChatFn } from './extract-call';
import type { ExtractionProfile } from '../../extraction/types';

const profile: ExtractionProfile = {
  id: 'proj_test',
  name: 'Test',
  description: 'Test',
  version: '1.0',
  detection: { keywords: [] },
  fields: {
    felder: {
      name: { type: 'text', required: true, label: 'Name' },
      betrag: { type: 'number', required: false, label: 'Betrag' },
    },
  },
};

function toolResponse(obj: unknown) {
  return { tool_calls: [{ function: { name: 'x', arguments: JSON.stringify(obj) } }] } as never;
}

test('parseExtractionResponse liest tool_calls und content-JSON', () => {
  expect(parseExtractionResponse(toolResponse({ a: 1 }))).toEqual({ a: 1 });
  expect(parseExtractionResponse({ content: 'Hier: {"b":2} fertig' } as never)).toEqual({ b: 2 });
  expect(parseExtractionResponse({ content: 'kein json' } as never)).toBeNull();
});

test('kein Repair-Call wenn Ergebnis valide', async () => {
  let calls = 0;
  const chat: ChatFn = async () => { calls += 1; return toolResponse({}); };
  const res = await repairExtraction({
    extracted: { felder: { name: 'Acme', betrag: 10 } },
    profile,
    documentText: 'Acme GmbH, 10 EUR',
    userId: 'u1',
    chat,
  });
  expect(calls).toBe(0);
  expect(res.calls).toBe(0);
  expect(res.warnings).toEqual([]);
  expect((res.extracted.felder as Record<string, unknown>).name).toBe('Acme');
});

test('Repair-Call korrigiert fehlendes Pflichtfeld', async () => {
  let calls = 0;
  const chat: ChatFn = async () => {
    calls += 1;
    return toolResponse({ felder: { name: 'Acme GmbH', betrag: 10 } });
  };
  const res = await repairExtraction({
    extracted: { felder: { name: null, betrag: 10 } }, // name fehlt → invalid
    profile,
    documentText: 'Acme GmbH, 10 EUR',
    userId: 'u1',
    chat,
  });
  expect(calls).toBe(1);
  expect(res.calls).toBe(1);
  expect(res.warnings).toEqual([]);
  expect((res.extracted.felder as Record<string, unknown>).name).toBe('Acme GmbH');
});

test('ohne Dokumenttext kein Repair-Call (z.B. reine Bildquelle)', async () => {
  let calls = 0;
  const chat: ChatFn = async () => { calls += 1; return toolResponse({}); };
  const res = await repairExtraction({
    extracted: { felder: { name: null } },
    profile,
    documentText: '',
    userId: 'u1',
    chat,
  });
  expect(calls).toBe(0);
  expect(res.warnings.length).toBeGreaterThan(0); // Pflichtfeld-Warnung durchgereicht
});

test('Format-Auto-Korrektur (DE-Zahl) ohne LLM-Call', async () => {
  let calls = 0;
  const chat: ChatFn = async () => { calls += 1; return toolResponse({}); };
  const res = await repairExtraction({
    extracted: { felder: { name: 'Acme', betrag: '1.234,56' } }, // String → wird in-place korrigiert
    profile,
    documentText: 'irrelevant',
    userId: 'u1',
    chat,
  });
  expect(calls).toBe(0); // validateExtraction korrigiert die Zahl selbst → valid
  expect((res.extracted.felder as Record<string, unknown>).betrag).toBe(1234.56);
});
