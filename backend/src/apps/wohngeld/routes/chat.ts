/**
 * Wohngeld Fall-Chat — grounded Fall-Q&A (Stufe C1) + Recht-Q&A mit §-Zitaten (C2).
 *
 * Antworten stützen sich AUSSCHLIESSLICH auf zwei bereitgestellte Quellen:
 *  - Fall-Kontext (Vorgangsdaten/Nachweise) → Dokument-Belege (C1).
 *  - Rechts-Kontext (deterministisch aus dem statischen WoGG/WoGV-Korpus
 *    retrievte §-Chunks) → §-Fundstellen (C2).
 * SSE-Streaming der Antwort + Quellen-Auflösung (Dokumente + §). Verlauf
 * append-only pro Vorgang. Viewer dürfen fragen — das App-Access-Gate greift
 * bereits im Aggregator; für den Chat kein Editor-Gate.
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
import { sucheRecht } from '../recht/retrieval';
import { chunkLabel } from '../recht/corpus';
import type { ChatSource, ChatAction } from '../types';

export const chatRoutes = new Hono();

/**
 * Whitelist der vom Modell vorschlagbaren App-Aktionen (Stufe G / C4).
 * id → deutscher Anzeige-Label. Alles außerhalb dieser Map wird ignoriert.
 * Die Ausführung passiert NIE automatisch — nur nach Klick + Bestätigung im UI.
 */
export const AKTION_WHITELIST: Record<string, string> = {
  pruefen: 'Prüfung ausführen',
  schreiben_generieren: 'Anforderungsschreiben erzeugen',
  bwz_uebernehmen: 'Bewilligungszeitraum-Vorschlag übernehmen',
};

/** Modell-Wahl (per ENV überschreibbar, Fallback wie App-Default). */
const CHAT_MODEL = {
  providerId: process.env.WOHNGELD_CHAT_PROVIDER || process.env.WOHNGELD_LLM_PROVIDER || 'adacor',
  modelId: process.env.WOHNGELD_CHAT_MODEL || process.env.WOHNGELD_LLM_MODEL || 'qwen3-5-a3b-35b-256k',
} as const;

/** Wie viele vorangegangene Nachrichten in den Prompt-Verlauf gehen. */
const MAX_HISTORY = 12;

/** Maschinenlesbarer Quellen-Block, den das Modell am Ende der Antwort setzt. */
const QUELLEN_MARKER = '<<QUELLEN:';
/** Maschinenlesbarer Aktions-Vorschlag (C4), den das Modell am Ende setzen kann. */
const AKTION_MARKER = '<<AKTION:';

const SYSTEM_PROMPT = `Du bist eine Assistenz für die Wohngeld-Sachbearbeitung (Vollständigkeits- und Plausibilitätsprüfung).

Grundregeln:
- Du hast ZWEI zulässige Wissensquellen: (1) den Fall-Kontext (Vorgangsdaten, Personen, Einkommen, Dokumente, Prüfschritte) und (2) den Rechts-Kontext (bereitgestellte Auszüge aus WoGG/WoGV mit Paragraphen-Fundstelle). Nutze ausschließlich diese beiden Quellen.
- Fall-Aussagen (was gilt in DIESEM Vorgang?) belegst du mit dem zugrunde liegenden Dokument (Label bzw. Name), damit die Sachbearbeitung es nachvollziehen kann. Erfinde keine Fall-Daten.
- Rechtliche Aussagen (was sagt das Gesetz?) stützt du NUR auf die bereitgestellten Rechts-Chunks und belegst sie mit der §-Fundstelle (z. B. „§ 14 Abs. 2 WoGG"). Zitiere kein Recht aus dem Gedächtnis und erfinde keine Paragraphen; nutze nur die bereitgestellten Auszüge.
- Wenn WEDER Fall-Kontext NOCH die bereitgestellten Rechtsquellen die Frage abdecken, sage das offen und schlage vor, welche Unterlage, Prüfung oder Rechtsquelle Klarheit bringen würde. Nichts erfinden.
- Nenne bei rechtlichen Aussagen den Rechtsstand, wenn er relevant ist (er steht bei den Rechts-Chunks).
- Keine verbindliche Rechtsauskunft: Formuliere als Einordnung/Vorschlag. Die Entscheidung im Einzelfall trifft immer der Mensch.
- Antworte auf Deutsch, knapp und sachlich.

Quellenangabe: Setze GANZ AM ENDE deiner Antwort — nur wenn du Quellen genutzt hast — eine einzige maschinenlesbare Zeile im Format:
${QUELLEN_MARKER} dok-id-1, recht:chunk-id-1, recht:chunk-id-2>>
Verwende dort ausschließlich:
- die Dokument-IDs, die im Fall-Kontext in eckigen Klammern vor jedem Dokument stehen (z. B. [dok-abc123]), und
- die Rechts-IDs mit Präfix „recht:", die im Rechts-Kontext in eckigen Klammern vor jedem Auszug stehen (z. B. [recht:wogg-14-abs2]).
Hast du keine Quellen genutzt, lasse diese Zeile weg.

Aktions-Vorschlag: Wenn die Frage einer der folgenden App-Aktionen entspricht, schlage sie am ENDE deiner Antwort mit einer zusätzlichen maschinenlesbaren Zeile vor:
${AKTION_MARKER} id1, id2>>
Erlaubte ids (nichts anderes verwenden):
- pruefen — die Vollständigkeits-/Plausibilitätsprüfung des Vorgangs (neu) ausführen (z. B. bei „Was fehlt noch?", „Prüf den Vorgang").
- schreiben_generieren — ein Anforderungsschreiben aus den offenen Punkten erzeugen (z. B. bei „Schreib die Nachforderung", „Anschreiben erstellen").
- bwz_uebernehmen — den vorgeschlagenen Bewilligungszeitraum übernehmen (z. B. bei „Setz den Bewilligungszeitraum").
Der Marker ist NUR ein Vorschlag; ausgeführt wird die Aktion erst, wenn der Mensch sie im UI bestätigt. Schlage nur Aktionen vor, die zur Frage passen. Passt keine, lasse diese Zeile weg.`;

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
  // Vollständiger oder partieller Marker (QUELLEN oder AKTION) am Ende → zurückhalten,
  // damit nichts vom maschinenlesbaren Block durchblitzt.
  if (
    QUELLEN_MARKER.startsWith(tail) || tail.startsWith('<<QUELLEN') ||
    AKTION_MARKER.startsWith(tail) || tail.startsWith('<<AKTION')
  ) return idx;
  return s.length;
}

/**
 * Zerlegt die Roh-Antwort in sichtbaren Text, genutzte Quellen-Refs und
 * vorgeschlagene Aktions-IDs. Reine Funktion (testbar).
 *  - Quellen-Refs mit Präfix `recht:` sind Rechts-Chunks, alle übrigen Dokument-IDs.
 *  - `actionIds` sind roh (kleingeschrieben, noch nicht gegen die Whitelist gefiltert).
 * Beide Marker-Typen werden aus dem sichtbaren Text entfernt.
 */
export function parseAntwort(raw: string): { content: string; dokIds: string[]; rechtIds: string[]; actionIds: string[] } {
  const dokIds: string[] = [];
  const rechtIds: string[] = [];
  const actionIds: string[] = [];

  const mQuellen = raw.match(/<<QUELLEN:\s*([^>]*)>>/i);
  if (mQuellen) {
    for (const ref of (mQuellen[1] ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
      if (ref.toLowerCase().startsWith('recht:')) rechtIds.push(ref.slice(ref.indexOf(':') + 1).trim());
      else dokIds.push(ref);
    }
  }

  // Mehrere AKTION-Marker sind erlaubt; ids je Marker kommagetrennt.
  const reAktion = /<<AKTION:\s*([^>]*)>>/gi;
  let mAktion: RegExpExecArray | null;
  while ((mAktion = reAktion.exec(raw)) !== null) {
    for (const id of (mAktion[1] ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
      actionIds.push(id.toLowerCase());
    }
  }

  const content = raw
    .replace(/<<QUELLEN:[^>]*>>/gi, '')
    .replace(/<<AKTION:[^>]*>>/gi, '')
    .trim();
  return { content, dokIds, rechtIds, actionIds };
}

/** Roh-Aktions-IDs gegen die Whitelist filtern und in {id,label} mappen (dedupliziert, Reihenfolge erhalten). */
export function resolveAktionen(actionIds: string[]): ChatAction[] {
  const seen = new Set<string>();
  const actions: ChatAction[] = [];
  for (const id of actionIds) {
    if (seen.has(id) || !(id in AKTION_WHITELIST)) continue;
    seen.add(id);
    actions.push({ id, label: AKTION_WHITELIST[id]! });
  }
  return actions;
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

  // Recht-Retrieval (C2): deterministisch die einschlägigen §-Chunks holen.
  const rechtChunks = sucheRecht(frage);
  const rechtById = new Map(rechtChunks.map((c) => [c.id, c]));

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

  // Rechts-Kontextblock: die retrievten §-Chunks mit ihren IDs für Zitate.
  const rechtBlock = rechtChunks.length
    ? rechtChunks
        .map((c) => {
          const abs = c.absatz ? ` ${c.absatz}` : '';
          return `[recht:${c.id}] ${c.paragraph}${abs} ${c.gesetz} — ${c.titel} (Rechtsstand: ${c.rechtsstand})\n${c.text}`;
        })
        .join('\n\n')
    : '(keine einschlägigen Rechtsquellen zu dieser Frage gefunden)';

  const messages: Message[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'system',
      content: `# Fall-Kontext (Quelle für Fall-Aussagen)\n\n${kontext.text}\n\n## Verfügbare Dokument-IDs für Quellenangaben\n${dokIdsHinweis}`,
    },
    {
      role: 'system',
      content: `# Rechts-Kontext (Quelle für rechtliche Aussagen — WoGG/WoGV-Auszüge)\n\nBelege rechtliche Aussagen nur mit diesen Auszügen und ihrer §-Fundstelle. Nutze für die Quellen-Marker die IDs mit Präfix „recht:".\n\n${rechtBlock}`,
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

      const { content, dokIds, rechtIds, actionIds } = parseAntwort(raw);
      const actions = resolveAktionen(actionIds);
      const dokSources: ChatSource[] = dokIds
        .filter((id) => dokLabelById.has(id))
        .map((id) => ({ art: 'dokument', dokumentId: id, label: dokLabelById.get(id)! }));
      const rechtSources: ChatSource[] = rechtIds
        .filter((id) => rechtById.has(id))
        .map((id) => {
          const chunk = rechtById.get(id)!;
          return { art: 'recht', ref: id, label: chunkLabel(chunk), url: chunk.url };
        });
      const sources: ChatSource[] = [...dokSources, ...rechtSources];

      // Assistant-Nachricht persistieren (bereinigter Text + Quellen + Aktions-Vorschläge).
      const saved = await addChatMessage({
        vorgangId, rolle: 'assistant', content, sources,
        actions: actions.length ? actions : undefined,
        model: CHAT_MODEL.modelId,
      });

      await stream.writeSSE({ event: 'sources', data: JSON.stringify({ sources }) });
      await stream.writeSSE({ event: 'done', data: JSON.stringify({ message: saved, actions }) });
    } catch (err) {
      console.error('[wohngeld] Fall-Chat fehlgeschlagen:', err);
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({ message: err instanceof Error ? err.message : 'Antwort fehlgeschlagen' }),
      });
    }
  });
});
