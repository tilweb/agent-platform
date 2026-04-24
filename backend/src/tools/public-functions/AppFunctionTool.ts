/**
 * Agent-Tool-Bridge: wraps a Public-Function as an Agent Tool.
 *
 * Jede in AppConfig.publicFunctions deklarierte Function wird beim Startup
 * automatisch als Tool im ToolRegistry angemeldet. Damit kann ein Agent sie
 * direkt aufrufen — OHNE HTTP-Round-Trip, OHNE API-Key. Agents sind innerhalb
 * der Plattform vertraut; der Scope-Check der Public-API greift hier nicht.
 *
 * Tool-Name-Konvention: `<appId>__<functionId>` (OpenAI-safe: a-zA-Z0-9_-).
 */

import type { Tool, ToolContext, ToolDefinition, ToolMetadata, ToolParameters } from '../types';
import type { PublicFunction, PublicFunctionContext } from '../../public-api/types';

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
    const pfCtx: PublicFunctionContext = {
      apiKeyId: context?.agentId ? `agent:${context.agentId}` : 'agent:internal',
      scope: { type: 'user', userId: context?.userId ?? 'agent' },
      permissions: ['app:*:*'],
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
