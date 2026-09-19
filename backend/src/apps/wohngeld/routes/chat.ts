/**
 * Wohngeld Fall-Chat — grounded Fall-Q&A (Stufe C1).
 *
 * Antworten NUR aus den Vorgangsdaten/Nachweisen (Fall-Kontext). Keine Rechts-KB
 * (folgt in C2). SSE-Streaming der Assistenz-Antwort + Quellen-Auflösung auf
 * Fall-Dokumente. Verlauf append-only pro Vorgang. Viewer dürfen fragen — das
 * App-Access-Gate greift bereits im Aggregator; für den Chat kein Editor-Gate.
 */
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { getCurrentUserId } from '../../../auth/middleware';
import { llmService, type Message } from '../../../services/llm';
import {
  getVorgang, getVorgangSnapshot, listPruefschritte,
  listChatMessages, addChatMessage,
} from '../storage';
import { buildFallKontext } from '../chat-context';
import type { ChatSource } from '../types';

export const chatRoutes = new Hono();

/** Modell-Wahl (per ENV überschreibbar, Fallback wie App-Default). */
const CHAT_MODEL = {
  providerId: process.env.WOHNGELD_CHAT_PROVIDER || process.env.WOHNGELD_LLM_PROVIDER || 'adacor',
  modelId: process.env.WOHNGELD_CHAT_MODEL || process.env.WOHNGELD_LLM_MODEL || 'qwen3-5-a3b-35b-256k',
} as const;

/** Wie viele vorangegangene Nachrichten in den Prompt-Verlauf gehen. */
const MAX_HISTORY = 12;

/** Maschinenlesbarer Quellen-Block, den das Modell am Ende der Antwort setzt. */
const QUELLEN_MARKER = '<<QUELLEN:';

const SYSTEM_PROMPT = `Du bist eine Assistenz für die Wohngeld-Sachbearbeitung (Vollständigkeits- und Plausibilitätsprüfung).

Grundregeln:
- Antworte AUSSCHLIESSLICH auf Basis des bereitgestellten Fall-Kontexts (Vorgangsdaten, Personen, Einkommen, Dokumente, Prüfschritte). Erfinde keine Fall-Daten.
- Nenne für fachliche Aussagen das zugrunde liegende Dokument (per Label bzw. Name), damit die Sachbearbeitung es nachvollziehen kann.
- Wenn die Antwort nicht im Fall-Kontext steht, sage das offen und schlage vor, welche Unterlage oder Prüfung Klarheit bringen würde. Nichts erfinden.
- Für allgemeine Rechtsfragen (WoGG/WoGV/Verwaltungsvorschrift): Weise darauf hin, dass die Rechts-Wissensbasis mit Paragraphen-Fundstellen noch nicht angebunden ist (kommt in einem späteren Ausbauschritt) und daher keine belastbare Rechtsauskunft möglich ist. Beantworte die Frage nicht aus dem Gedächtnis.
- Die Entscheidung im Einzelfall trifft immer der Mensch.
- Antworte auf Deutsch, knapp und sachlich.

Quellenangabe: Setze GANZ AM ENDE deiner Antwort — nur wenn du Fall-Dokumente genutzt hast — eine einzige maschinenlesbare Zeile im Format:
${QUELLEN_MARKER} dok-id-1, dok-id-2>>
Verwende dort ausschließlich die Dokument-IDs, die im Fall-Kontext in eckigen Klammern vor jedem Dokument stehen (z. B. [dok-abc123]). Hast du keine Dokumente genutzt, lasse diese Zeile weg.`;

/** GET — Chat-Verlauf des Vorgangs. */
chatRoutes.get('/vorgaenge/:id/chat', async (c) => {
  const vorgangId = c.req.param('id');
  if (!(await getVorgang(vorgangId))) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
  return c.json({ messages: await listChatMessages(vorgangId) });
});

/**
 * Berechnet, wie viel des akkumulierten sichtbaren Textes gefahrlos als Delta
 * emittiert werden kann, ohne einen (auch nur partiellen) Quellen-Marker
 * durchblitzen zu lassen.
 */
function safeEmitLength(s: string): number {
  const idx = s.lastIndexOf('<<');
  if (idx === -1) return s.length;
  const tail = s.slice(idx).toUpperCase();
  // Vollständiger oder partieller Marker am Ende → zurückhalten.
  if (QUELLEN_MARKER.startsWith(tail) || tail.startsWith('<<QUELLEN')) return idx;
  return s.length;
}

/** Zerlegt die Roh-Antwort in sichtbaren Text + genutzte Dokument-IDs. */
function parseAntwort(raw: string): { content: string; dokIds: string[] } {
  const m = raw.match(/<<QUELLEN:\s*([^>]*)>>/i);
  if (!m) return { content: raw.trim(), dokIds: [] };
  const dokIds = (m[1] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const content = raw.slice(0, m.index ?? 0).trim();
  return { content, dokIds };
}

/** POST — Frage stellen, Antwort als SSE streamen. */
chatRoutes.post('/vorgaenge/:id/chat', async (c) => {
  const vorgangId = c.req.param('id');
  if (!(await getVorgang(vorgangId))) return c.json({ error: 'Vorgang nicht gefunden' }, 404);

  const body = await c.req.json<{ message?: string }>().catch(() => ({} as { message?: string }));
  const frage = (body?.message ?? '').trim();
  if (!frage) return c.json({ error: 'message ist erforderlich' }, 400);

  const userId = getCurrentUserId(c);

  // Fall-Kontext frisch aufbauen (kein veralteter Kontext).
  const snapshot = await getVorgangSnapshot(vorgangId);
  if (!snapshot) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
  const pruefschritte = await listPruefschritte(vorgangId);
  const kontext = buildFallKontext(snapshot, pruefschritte);
  const dokLabelById = new Map(kontext.dokumente.map((d) => [d.id, d.label]));

  // Bisheriger Verlauf (append-only) → Prompt-Historie.
  const verlauf = await listChatMessages(vorgangId);
  const history: Message[] = verlauf
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.rolle, content: m.content }));

  // User-Nachricht persistieren (vor dem LLM-Aufruf).
  await addChatMessage({ vorgangId, rolle: 'user', content: frage });

  const dokIdsHinweis = kontext.dokumente.length
    ? kontext.dokumente.map((d) => `[${d.id}] ${d.label}`).join('\n')
    : '(keine Dokumente vorhanden)';

  const messages: Message[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'system',
      content: `# Fall-Kontext (einzige zulässige Wissensquelle)\n\n${kontext.text}\n\n## Verfügbare Dokument-IDs für Quellenangaben\n${dokIdsHinweis}`,
    },
    ...history,
    { role: 'user', content: frage },
  ];

  return streamSSE(c, async (stream) => {
    let raw = '';
    let emitted = 0;
    try {
      for await (const chunk of llmService.streamChat(messages, undefined, {
        source: 'chat',
        operation: 'wohngeld_fall_chat',
        resourceId: vorgangId,
        userId,
        triggeringUserId: userId,
      }, { modelOverride: { providerId: CHAT_MODEL.providerId, modelId: CHAT_MODEL.modelId } })) {
        const delta = chunk?.choices?.[0]?.delta?.content;
        if (!delta) continue;
        raw += delta;
        const safeLen = safeEmitLength(raw);
        if (safeLen > emitted) {
          const piece = raw.slice(emitted, safeLen);
          emitted = safeLen;
          await stream.writeSSE({ event: 'delta', data: JSON.stringify({ content: piece }) });
        }
      }

      const { content, dokIds } = parseAntwort(raw);
      const sources: ChatSource[] = dokIds
        .filter((id) => dokLabelById.has(id))
        .map((id) => ({ art: 'dokument', dokumentId: id, label: dokLabelById.get(id)! }));

      // Assistant-Nachricht persistieren (bereinigter Text + Quellen).
      const saved = await addChatMessage({
        vorgangId, rolle: 'assistant', content, sources,
        model: CHAT_MODEL.modelId,
      });

      await stream.writeSSE({ event: 'sources', data: JSON.stringify({ sources }) });
      await stream.writeSSE({ event: 'done', data: JSON.stringify({ message: saved }) });
    } catch (err) {
      console.error('[wohngeld] Fall-Chat fehlgeschlagen:', err);
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({ message: err instanceof Error ? err.message : 'Antwort fehlgeschlagen' }),
      });
    }
  });
});
