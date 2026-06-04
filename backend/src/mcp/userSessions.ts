/**
 * Per-User MCP Sessions (OAuth)
 *
 * Fuer OAuth-MCP-Server wird pro (userId, serverId) eine eigene MCP-Session
 * aufgebaut — mit dem User-eigenen OAuth-Token. Das MCP-SDK uebernimmt via
 * `authProvider` das Injizieren + Refreshen des Bearer-Tokens.
 *
 * Sessions werden gecached und nach Leerlauf evictet (Idle-Eviction).
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js';
import { getMcpServer } from './config';
import { McpOAuthClientProvider } from './oauth/provider';
import type { McpToolInfo, McpCallResult } from './types';

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 Min Leerlauf → Session schliessen
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

/** Fehler, der signalisiert: User hat diesen OAuth-Server (noch) nicht verbunden. */
export class McpNotConnectedError extends Error {
  constructor(serverId: string) {
    super(`MCP-Server "${serverId}" ist fuer diesen User nicht verbunden`);
    this.name = 'McpNotConnectedError';
  }
}

interface UserSession {
  client: Client;
  transport: StreamableHTTPClientTransport;
  lastUsed: number;
}

function resolveBaseUrl(): string {
  return (process.env.API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
}

function sessionKey(userId: string, serverId: string): string {
  return `${userId}::${serverId}`;
}

/** MCP-Call-Result → String (gleiche Formatierung wie McpClient.callTool). */
function formatResult(result: McpCallResult): string {
  if (result.isError) {
    const errorText = result.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n');
    throw new Error(errorText || 'Unknown MCP error');
  }
  return result.content
    .map(c => {
      if (c.type === 'text') return c.text;
      if (c.type === 'image') return `[Image: ${c.mimeType}]`;
      if (c.type === 'resource') return `[Resource: ${c.text}]`;
      return JSON.stringify(c);
    })
    .join('\n');
}

class McpUserSessionManager {
  private sessions = new Map<string, UserSession>();
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  private ensureSweeper(): void {
    if (this.sweepTimer) return;
    this.sweepTimer = setInterval(() => this.sweepIdle(), SWEEP_INTERVAL_MS);
    // Nicht den Prozess am Leben halten nur wegen des Sweepers.
    (this.sweepTimer as { unref?: () => void }).unref?.();
  }

  private async sweepIdle(): Promise<void> {
    const now = Date.now();
    for (const [key, session] of this.sessions) {
      if (now - session.lastUsed > IDLE_TIMEOUT_MS) {
        this.sessions.delete(key);
        try {
          await session.client.close();
        } catch {
          // best effort
        }
      }
    }
  }

  /** Holt (oder baut) die OAuth-Session fuer (userId, serverId). */
  private async getSession(userId: string, serverId: string): Promise<UserSession> {
    const key = sessionKey(userId, serverId);
    const existing = this.sessions.get(key);
    if (existing) {
      existing.lastUsed = Date.now();
      return existing;
    }

    const server = await getMcpServer(serverId);
    if (!server?.url) {
      throw new Error(`MCP-Server "${serverId}" nicht gefunden oder ohne URL`);
    }

    const authProvider = new McpOAuthClientProvider({
      userId,
      serverId,
      baseUrl: resolveBaseUrl(),
    });

    const transport = new StreamableHTTPClientTransport(new URL(server.url), { authProvider });
    const client = new Client({ name: 'agent-platform', version: '1.0.0' }, { capabilities: {} });

    try {
      await client.connect(transport);
    } catch (err) {
      // Ohne gueltiges Token wirft das SDK UnauthorizedError → klare Meldung.
      if (err instanceof UnauthorizedError) {
        throw new McpNotConnectedError(serverId);
      }
      throw err;
    }

    const session: UserSession = { client, transport, lastUsed: Date.now() };
    this.sessions.set(key, session);
    this.ensureSweeper();
    return session;
  }

  /** Listet die Tools des Servers fuer diesen User (erfordert gueltige Verbindung). */
  async listTools(userId: string, serverId: string): Promise<McpToolInfo[]> {
    const server = await getMcpServer(serverId);
    const session = await this.getSession(userId, serverId);
    const result = await session.client.listTools();
    return result.tools.map(tool => ({
      name: tool.name,
      description: tool.description || '',
      serverId,
      serverName: server?.name || serverId,
      inputSchema: tool.inputSchema as Record<string, any>,
    }));
  }

  /** Ruft ein Tool in der User-Session auf und gibt das Ergebnis als String zurueck. */
  async callTool(
    userId: string,
    serverId: string,
    toolName: string,
    args: Record<string, any>,
  ): Promise<string> {
    const session = await this.getSession(userId, serverId);
    const result = await session.client.callTool({ name: toolName, arguments: args });
    return formatResult({
      content: result.content as McpCallResult['content'],
      isError: Boolean(result.isError),
    });
  }

  /** Schliesst die Session eines Users (z.B. nach Disconnect). */
  async disconnect(userId: string, serverId: string): Promise<void> {
    const key = sessionKey(userId, serverId);
    const session = this.sessions.get(key);
    if (!session) return;
    this.sessions.delete(key);
    try {
      await session.client.close();
    } catch {
      // best effort
    }
  }
}

export const mcpUserSessions = new McpUserSessionManager();
