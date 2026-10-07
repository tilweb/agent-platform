/**
 * Agent-Tool-Bridge: wraps a Public-Function as an Agent Tool.
 *
 * Jede in AppConfig.publicFunctions deklarierte Function wird beim Startup
 * automatisch als Tool im ToolRegistry angemeldet. Damit kann ein Agent sie
 * direkt aufrufen — OHNE HTTP-Round-Trip, OHNE API-Key. Statt des Schluessel-
 * Scopes der Public-API gilt hier die App-Zugriffspruefung fuer den User, in
 * dessen Auftrag der Agent laeuft (freigeschaltet + Gruppenrecht) — bei jedem
 * Aufruf, damit Freischalten/Abschalten sofort wirkt.
 *
 * Tool-Name-Konvention: `<appId>__<functionId>` (OpenAI-safe: a-zA-Z0-9_-).
 */

import type { Tool, ToolContext, ToolDefinition, ToolMetadata, ToolParameters } from '../types';
import type { PublicFunction, PublicFunctionContext } from '../../public-api/types';
import { resolveAppAccess } from '../../apps/permissions';

export class AppFunctionTool implements Tool {
  readonly name: string;
  readonly type = 'api' as const;

  private appId: string;
  private fn: PublicFunction;

  constructor(appId: string, fn: PublicFunction) {
    this.appId = appId;
    this.fn = fn;
    this.name = buildToolName(appId, fn.id);
  }

  getDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: `[${this.appId}] ${this.fn.description}`,
        parameters: this.fn.input as ToolParameters,
      },
    };
  }

  async execute(args: Record<string, unknown>, context?: ToolContext): Promise<string> {
    const userId = context?.userId;
    if (!userId) {
      return `${this.name} ist nur im Auftrag eines angemeldeten Nutzers verfügbar.`;
    }
    const access = await resolveAppAccess(userId, this.appId);
    if (!access.allowed) {
      return access.reason === 'not_found' || access.reason === 'disabled'
        ? `Die App „${this.appId}" ist nicht freigeschaltet — ${this.name} ist nicht verfügbar.`
        : `Keine Berechtigung für die App „${this.appId}" — ${this.name} ist für diesen Nutzer nicht verfügbar.`;
    }
    const pfCtx: PublicFunctionContext = {
      apiKeyId: context?.agentId ? `agent:${context.agentId}` : 'agent:internal',
      scope: { type: 'user', userId },
      permissions: [`app:${this.appId}:${this.fn.id}`],
      requestId: `agent_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    };
    try {
      const result = await this.fn.handler(args, pfCtx);
      // Tools must return a string — JSON-stringify complex objects for the LLM.
      return typeof result === 'string' ? result : JSON.stringify(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return `Fehler beim Aufruf von ${this.name}: ${msg}`;
    }
  }

  getMetadata(): ToolMetadata {
    return {
      name: this.name,
      description: this.fn.description,
      type: 'api',
      category: 'app-functions',
    };
  }
}

export function buildToolName(appId: string, functionId: string): string {
  return `${appId}__${functionId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}
