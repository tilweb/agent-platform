/**
 * Plattform-Anschluss des WZ-Branchen-Matchers.
 *
 * Die EINZIGE Datei der App, die Code ausserhalb von `apps/wzbar-matcher/`
 * importiert. Wer die App in eine andere Plattform einpasst, schreibt diese
 * Datei um — Pipeline, Prompts, Retrieval, Persistenz-Logik und Routen bleiben
 * unveraendert. Vorausgesetzter Stack (Bibliotheken, keine Plattform): Bun,
 * Hono, Drizzle/Postgres.
 *
 * Ausserhalb dieser Datei kennt die Plattform die App nur an zwei Stellen:
 *   - `apps/registry.ts` registriert `wzbarMatcherConfig` (index.ts)
 *   - `routes/apps.ts` haengt `wzbarMatcherRoutes` unter /api/apps/wzbar-matcher ein
 * Dazu kommen Tabelle + Migration (`db/schema/wzbar.ts`, drizzle/0000 + 0038)
 * und im Frontend `apps/wzbar-matcher/platform.js`.
 */

import type { Context, MiddlewareHandler } from 'hono';
import { llmService, type Message, type ToolDefinition } from '../../services/llm';
import type { UsageContext } from '../../services/usageTracking';
import { getPlatformModel } from '../../config/platformModels';
import { getSystemDefaultModel } from '../../services/providers';
import { getCurrentUserId } from '../../auth/middleware';

export { getDb } from '../../db';
export { wzbarMatches } from '../../db/schema/wzbar';
export type { AppConfig } from '../types';
export type { JsonSchema, PublicFunction } from '../../public-api/types';

export const APP_ID = 'wzbar-matcher';

// --- LLM ----------------------------------------------------------------------

/** Nachrichten der Matcher-Prompts: immer genau eine System- und eine User-Nachricht. */
export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

/** Function-Schema im OpenAI-Format (JSON-Schema unter `parameters`). */
export type ToolSchema = ToolDefinition;

export interface ToolCallOptions {
  temperature: number;
  timeoutMs: number;
  maxRetries: number;
}

export interface ToolCallResult {
  /** JSON-String der Function-Arguments, null wenn das Modell keinen Tool-Call geliefert hat. */
  toolArguments: string | null;
  /** Freitext-Antwort (Fallback-Pfad im Classifier). */
  content: string | null;
}

/**
 * Ein Chat-Call mit ERZWUNGENEM Function-Call auf `tool`. Laeuft ueber das
 * gepinnte Apps-Modell (siehe chatModel), sonst ueber den Chat-Default.
 */
export async function callTool(messages: ChatMessage[], tool: ToolSchema, options: ToolCallOptions): Promise<ToolCallResult> {
  const model = await chatModel();
  const response = await llmService.chat(
    messages as Message[],
    [tool],
    // Laufzeit-Wert 'wzbar-matcher' bleibt (bestehende Usage-Auswertungen), der Union-Typ kennt ihn nicht.
    { source: APP_ID as UsageContext['source'], userId: 'user_default' },
    {
      toolChoice: { type: 'function', function: { name: tool.function.name } },
      temperature: options.temperature,
      timeoutMs: options.timeoutMs,
      maxRetries: options.maxRetries,
      ...(model ? { modelOverride: { providerId: model.providerId, modelId: model.modelId } } : {}),
    },
  );
  return {
    toolArguments: response.tool_calls?.[0]?.function.arguments ?? null,
    content: typeof response.content === 'string' ? response.content : null,
  };
}

/**
 * Embedding eines Suchtexts. MUSS dasselbe Modell sein, mit dem die Vektoren
 * in assets/ gebaut wurden (heute multilingual-e5-large, 1024 Dim.) — sonst
 * sind die Similarities wertlos. service.ts prueft Katalog- gegen
 * Alias-Modell; das Abfrage-Modell prueft niemand automatisch.
 */
export function embed(text: string): Promise<number[]> {
  return llmService.embed(text);
}

/** Modell-ID des konfigurierten Embedding-Modells (nur Builder: Vektoren bauen/wiederverwenden). */
export async function embeddingModelId(): Promise<string | null> {
  const resolved = await getPlatformModel('embeddings');
  return resolved?.model.id ?? null;
}

/**
 * Das per ENV gepinnte Apps-Modell (PLATFORM_APPS_*), NICHT der globale
 * Chat-Default. null = nicht gepinnt, Calls laufen ueber den Chat-Default.
 */
async function chatModel(): Promise<{ providerId: string; modelId: string } | null> {
  try {
    const m = await getPlatformModel('apps');
    if (m) return { providerId: m.provider.id, modelId: m.model.id };
  } catch {
    /* ignore — Fallback auf Chat-Default */
  }
  return null;
}

/**
 * Anzeige-Label des Modells fuer das Audit-Log. Muss dieselbe Aufloesung
 * nutzen wie callTool — nie ein Modell anzeigen, das nicht wirklich rechnet.
 */
export async function chatModelLabel(): Promise<string> {
  const pinned = await chatModel();
  if (pinned) return `${pinned.providerId}/${pinned.modelId}`;
  try {
    const fallback = await getSystemDefaultModel('chat');
    if (fallback) return `${fallback.provider.id}/${fallback.model.id}`;
  } catch {
    /* ignore */
  }
  return 'default-chat';
}

// --- Auth ---------------------------------------------------------------------

/**
 * Middleware: 401 ohne Login, 403 ohne App-Berechtigung. Lazy importiert —
 * permissions.ts haengt an der Registry, die wiederum diese App importiert;
 * ein statischer Import wuerde einen Zyklus mit der Registry bilden.
 */
export function appAccessGuard(): MiddlewareHandler {
  return async (c, next) => {
    const { requireAppAccess } = await import('../permissions-middleware');
    return requireAppAccess(APP_ID)(c, next);
  };
}

/** Eingeloggter User der Anfrage (fuer das Audit-Log der Matches). */
export function currentUserId(c: Context): string {
  return getCurrentUserId(c) ?? 'user_default';
}
