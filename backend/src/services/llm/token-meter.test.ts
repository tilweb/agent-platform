import { afterEach, expect, test } from 'bun:test';
import { meldeTokenVerbrauch, mitTokenMessung, tokenMessungAktiv } from './token-meter';
import { OpenAIAdapter } from './adapters/openai';
import { OllamaAdapter } from './adapters/ollama';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test('ohne Messbereich ist Melden ein No-op', () => {
  expect(tokenMessungAktiv()).toBe(false);
  meldeTokenVerbrauch('m', { prompt_tokens: 5, completion_tokens: 1 }); // wirft nicht
});

test('summiert je Modell, zählt Aufrufe ohne Angabe und über parallele Aufrufe', async () => {
  const { messung } = await mitTokenMessung(async () => {
    expect(tokenMessungAktiv()).toBe(true);
    await Promise.all([
      (async () => meldeTokenVerbrauch('a', { prompt_tokens: 100, completion_tokens: 10 }))(),
      (async () => meldeTokenVerbrauch('a', { prompt_tokens: 50, completion_tokens: 5 }))(),
      (async () => meldeTokenVerbrauch('b', null))(),
    ]);
  });
  expect(messung.aufrufe).toBe(3);
  expect(messung.promptTokens).toBe(150);
  expect(messung.completionTokens).toBe(15);
  expect(messung.ohneAngabe).toBe(1);
  expect(messung.modelle.a).toEqual({ aufrufe: 2, promptTokens: 150, completionTokens: 15, ohneAngabe: 0 });
  expect(messung.modelle.b!.ohneAngabe).toBe(1);
});

test('geschachtelte Bereiche zählen in beiden; beiEnde läuft auch bei Fehler', async () => {
  let innen = 0;
  const { messung } = await mitTokenMessung(async () => {
    meldeTokenVerbrauch('x', { prompt_tokens: 1, completion_tokens: 1 });
    await mitTokenMessung(async () => { meldeTokenVerbrauch('x', { prompt_tokens: 10, completion_tokens: 0 }); throw new Error('boom'); },
      (m) => { innen = m.promptTokens; }).catch(() => null);
  });
  expect(innen).toBe(10);
  expect(messung.promptTokens).toBe(11);
});

function sseAntwort(zeilen: unknown[]): Response {
  const text = zeilen.map((z) => `data: ${JSON.stringify(z)}\n\n`).join('') + 'data: [DONE]\n\n';
  return new Response(text, { status: 200 });
}

test('OpenAI-Stream: include_usage nur im Messbereich, Usage-Chunk wird verbraucht', async () => {
  const bodies: Record<string, unknown>[] = [];
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)));
    return sseAntwort([
      { choices: [{ index: 0, delta: { content: 'Hal' } }] },
      { choices: [{ index: 0, delta: { content: 'lo' } }] },
      { choices: [], usage: { prompt_tokens: 42, completion_tokens: 2 } },
    ]);
  }) as typeof fetch;
  const adapter = new OpenAIAdapter({ baseUrl: 'http://x', apiKey: null, defaultModel: 'qwen' });

  // ohne Messung: keine stream_options, nichts verändert
  const ohne: unknown[] = [];
  for await (const c of adapter.streamChat([{ role: 'user', content: 'hi' }])) ohne.push(c);
  expect(bodies[0]!.stream_options).toBeUndefined();

  const { messung } = await mitTokenMessung(async () => {
    const chunks: Array<{ choices: unknown[] }> = [];
    for await (const c of adapter.streamChat([{ role: 'user', content: 'hi' }])) chunks.push(c as never);
    expect(chunks.every((c) => c.choices.length > 0)).toBe(true);
    expect(chunks.length).toBe(2);
  });
  expect(bodies[1]!.stream_options).toEqual({ include_usage: true });
  expect(messung).toMatchObject({ aufrufe: 1, promptTokens: 42, completionTokens: 2, ohneAngabe: 0 });
});

test('OpenAI-Chat meldet usage; fehlende usage zählt als ohne Angabe', async () => {
  let mitUsage = true;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    ...(mitUsage ? { usage: { prompt_tokens: 7, completion_tokens: 3 } } : {}),
    choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
  }), { status: 200 })) as unknown as typeof fetch;
  const adapter = new OpenAIAdapter({ baseUrl: 'http://x', apiKey: null, defaultModel: 'qwen' });
  const { messung } = await mitTokenMessung(async () => {
    await adapter.chat([{ role: 'user', content: 'a' }], 'mistral');
    mitUsage = false;
    await adapter.chat([{ role: 'user', content: 'b' }]);
  });
  expect(messung.modelle.mistral).toEqual({ aufrufe: 1, promptTokens: 7, completionTokens: 3, ohneAngabe: 0 });
  expect(messung.modelle.qwen!.ohneAngabe).toBe(1);
});

test('Ollama-Chat übersetzt prompt_eval_count/eval_count', async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({
    message: { content: 'ok' }, done_reason: 'stop', prompt_eval_count: 20, eval_count: 4,
  }), { status: 200 })) as unknown as typeof fetch;
  const adapter = new OllamaAdapter({ baseUrl: 'http://x', defaultModel: 'llama' });
  const { messung } = await mitTokenMessung(() => adapter.chat([{ role: 'user', content: 'a' }]));
  expect(messung).toMatchObject({ aufrufe: 1, promptTokens: 20, completionTokens: 4 });
});
