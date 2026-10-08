/**
 * Vertragsauswertung — gemeinsamer Modellaufruf (Transkription + Auswertung).
 *
 * Erzwungenes JSON-Schema (response_format json_schema), bei Fehlschlag ein
 * Versuch als Freitext-JSON — gleiches Muster wie `vision-per-page`. Laeuft
 * ueber `extractionChat` (Modell-Slots, Prioritaeten) mit Temperatur 0.
 */

import { extractionChat } from '../runtime';
import { EXTRACTION_SAMPLING, parseJsonObject, withTimeoutRetry } from '../extract-call';
import type { ChatOptions, Message } from '../../llm';
import type { UsageContext } from '../../usageTracking';

export type ChatFn = typeof extractionChat;

export interface ModellKontext {
  userId: string;
  modelOverride?: { providerId: string; modelId: string } | null;
  /** Austauschbar fuer Tests. */
  chat?: ChatFn;
}

export interface ModellAntwort {
  json: Record<string, unknown> | null;
  roh: string;
  promptTokens?: number;
  completionTokens?: number;
  ms: number;
}

/**
 * Antwort-Skelett aus einem JSON-Schema (fuer Freitext-JSON): Typen und
 * erlaubte Werte als Platzhalter, Listen mit genau einem Beispielelement.
 */
export function skelett(schema: Record<string, unknown>): unknown {
  const s = schema as { type?: string | string[]; enum?: unknown[]; properties?: Record<string, Record<string, unknown>>; items?: Record<string, unknown> };
  if (s.enum) return s.enum.filter((x) => x !== null).join('|') + (s.enum.includes(null) ? '|null' : '');
  const typ = Array.isArray(s.type) ? s.type.filter((t) => t !== 'null')[0] : s.type;
  const nullbar = Array.isArray(s.type) && s.type.includes('null');
  if (typ === 'object' && s.properties) return Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, skelett(v)]));
  if (typ === 'array') return s.items ? [skelett(s.items)] : [];
  return `${typ ?? 'string'}${nullbar ? '|null' : ''}`;
}

/** Freitext-Anweisung: JSON exakt in dieser Struktur, kompakt. */
export function freitextAnweisung(schema: Record<string, unknown>): string {
  return `Antworte AUSSCHLIESSLICH mit einem JSON-Objekt in genau dieser Struktur (Platzhalter durch Werte ersetzen; "a|b" = einer der Werte; Listen dürfen leer sein oder mehrere Einträge haben). Kein Markdown, keine Erklärung, kompaktes JSON:\n${JSON.stringify(skelett(schema))}`;
}

function mitFreitextAnweisung(messages: Message[], schema: Record<string, unknown>): Message[] {
  const out = [...messages];
  const letzte = out[out.length - 1]!;
  const zusatz = `\n\n${freitextAnweisung(schema)}`;
  out[out.length - 1] = typeof letzte.content === 'string'
    ? { ...letzte, content: letzte.content + zusatz }
    : { ...letzte, content: [...(letzte.content as Array<{ type: string; text?: string }>), { type: 'text', text: zusatz }] } as Message;
  return out;
}

export async function rufeModell(
  kontext: ModellKontext,
  opts: {
    messages: Message[]; schema: Record<string, unknown>; name: string; operation: string; timeoutMs: number; maxTokens?: number; label: string;
    /** 'frei': kein erzwungenes Schema (grosse Ausgaben — Guided Decoding entgleist dort in Leerraum-Schleifen). */
    modus?: 'erzwungen' | 'frei';
  },
): Promise<ModellAntwort> {
  const chat = kontext.chat ?? extractionChat;
  const options: ChatOptions = {
    userId: kontext.userId,
    ...EXTRACTION_SAMPLING,
    ...(opts.maxTokens ? { maxTokens: opts.maxTokens } : {}),
    timeoutMs: opts.timeoutMs,
    ...(kontext.modelOverride ? { modelOverride: kontext.modelOverride } : {}),
  };
  const usage: UsageContext = { userId: kontext.userId, source: 'extraction', operation: opts.operation };
  const guided = process.env.EXTRACTION_GUIDED_JSON === '0' || opts.modus === 'frei'
    ? null
    : { response_format: { type: 'json_schema', json_schema: { name: opts.name, schema: opts.schema } } };
  const freiMessages = mitFreitextAnweisung(opts.messages, opts.schema);
  const frei = (label: string, retries: number) => withTimeoutRetry(() => chat(freiMessages, undefined, usage, options),
    { queued: true, timeoutMs: opts.timeoutMs, retries, label });
  const t0 = Date.now();
  let response: Awaited<ReturnType<ChatFn>>;
  if (guided) {
    try {
      response = await withTimeoutRetry(() => chat(opts.messages, undefined, usage, { ...options, extraBody: guided }),
        { queued: true, timeoutMs: opts.timeoutMs, retries: 0, label: `${opts.label} (guided)` });
      // Unlesbar (z. B. Leerraum-Schleife bis zum Tokenlimit) → einmal als Freitext-JSON.
      if (!parseJsonObject(response.content)) response = await frei(`${opts.label} (frei nach unlesbarer Antwort)`, 0);
    } catch {
      response = await frei(`${opts.label} (fallback)`, 0);
    }
  } else {
    response = await frei(opts.label, 0);
    if (!parseJsonObject(response.content)) response = await frei(`${opts.label} (2. Versuch)`, 0);
  }
  const roh = response.content ?? '';
  const usageInfo = (response as { usage?: { promptTokens?: number; completionTokens?: number; prompt_tokens?: number; completion_tokens?: number } }).usage;
  return {
    json: parseJsonObject(roh),
    roh,
    promptTokens: usageInfo?.promptTokens ?? usageInfo?.prompt_tokens,
    completionTokens: usageInfo?.completionTokens ?? usageInfo?.completion_tokens,
    ms: Date.now() - t0,
  };
}

/** Parallelitaet begrenzen, Reihenfolge der Ergebnisse bleibt erhalten. */
export async function parallelBegrenzt<T, R>(items: T[], grenze: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.max(1, Math.min(grenze, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!, i);
    }
  }));
  return out;
}
