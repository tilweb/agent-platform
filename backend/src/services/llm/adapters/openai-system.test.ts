import { expect, test } from 'bun:test';
import { normalisiereSystemNachrichten } from './openai';

test('führende Systemnachrichten werden zu einer zusammengeführt', () => {
  const r = normalisiereSystemNachrichten([
    { role: 'system', content: 'A' }, { role: 'system', content: 'B' }, { role: 'system', content: 'C' },
    { role: 'user', content: 'Frage' },
  ]);
  expect(r).toEqual([{ role: 'system', content: 'A\n\nB\n\nC' }, { role: 'user', content: 'Frage' }]);
});

test('Systemnachricht mitten im Verlauf wird zur gekennzeichneten User-Nachricht', () => {
  const r = normalisiereSystemNachrichten([
    { role: 'system', content: 'S' }, { role: 'user', content: 'u' }, { role: 'assistant', content: 'a' },
    { role: 'system', content: 'Limit erreicht' },
  ]);
  expect(r.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
  expect(r[3]!.content).toBe('[Systemhinweis]\nLimit erreicht');
});

test('unveränderte Folgen bleiben gleich', () => {
  const m = [{ role: 'system' as const, content: 'S' }, { role: 'user' as const, content: 'u' }];
  expect(normalisiereSystemNachrichten(m)).toEqual(m);
  expect(normalisiereSystemNachrichten([{ role: 'user', content: 'u' }])).toEqual([{ role: 'user', content: 'u' }]);
});
