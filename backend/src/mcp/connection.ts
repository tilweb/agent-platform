/**
 * MCP Server Connection
 *
 * Manages a connection to a single MCP server process.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { spawn, type ChildProcess } from 'child_process';
import type { McpServerConfig, McpToolInfo, McpCallResult } from './types';

/** Ersetzt ${VAR}-Platzhalter in einem String durch die entsprechende Env-Variable. */
function resolveEnvPlaceholders(value: string): string {
  return value.replace(/\$\{(\w+)\}/g, (_, name) => process.env[name] || '');
}

export class McpConnection {
  private config: McpServerConfig;
  private process: ChildProcess | null = null;
  private transport: Transport | null = null;
  private client: Client | null = null;
  private tools: McpToolInfo[] = [];
  private _status: 'connected' | 'connecting' | 'disconnected' | 'error' = 'disconnected';
  private _error: string | null = null;
  private _connectedAt: number | null = null;

  constructor(config: McpServerConfig) {
    this.config = config;
  }

  get serverId(): string {
    return this.config.id;
  }

  get serverName(): string {
    return this.config.name;
  }

  get status(): 'connected' | 'connecting' | 'disconnected' | 'error' {
    return this._status;
  }

  get error(): string | null {
    return this._error;
  }

  get connectedAt(): number | null {
    return this._connectedAt;
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    if (this._status === 'connected') {
      return;
    }

    this._status = 'connecting';
    this._error = null;

    try {
      const transportType = this.config.transport || 'stdio';

      // Transport je nach Art aufbauen: lokaler Prozess (stdio) oder Remote (http/sse)
      this.transport =
        transportType === 'http' || transportType === 'sse'
          ? this.createRemoteTransport(transportType)
          : this.createStdioTransport();

      // Create client
      this.client = new Client({
        name: 'agent-platform',
        version: '1.0.0',
      }, {
        capabilities: {},
      });

      // Connect
      await this.client.connect(this.transport);

      // List available tools
      await this.refreshTools();

      this._status = 'connected';
      this._connectedAt = Date.now();

      console.log(`Connected to MCP server: ${this.config.name} (${this.tools.length} tools, ${transportType})`);
    } catch (err: any) {
      this._status = 'error';
      this._error = err.message;
      console.error(`Failed to connect to MCP server ${this.config.id}:`, err);
      throw err;
    }
  }

  /**
   * Lokalen stdio-Transport aufbauen (Subprozess via command/args/env).
   */
  private createStdioTransport(): StdioClientTransport {
    if (!this.config.command) {
      throw new Error(`MCP server ${this.config.id}: 'command' ist fuer stdio-Transport erforderlich`);
    }

    // Resolve environment variables
    const env: Record<string, string> = { ...process.env } as Record<string, string>;
    if (this.config.env) {
      for (const [key, value] of Object.entries(this.config.env)) {
        // Replace ${VAR} with actual env value
        env[key] = resolveEnvPlaceholders(value);
      }
    }

    // Spawn the server process
    this.process = spawn(this.config.command, this.config.args || [], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Handle process errors
    this.process.on('error', (err) => {
      console.error(`MCP server ${this.config.id} process error:`, err);
      this._status = 'error';
      this._error = err.message;
    });

    this.process.on('exit', (code) => {
      console.log(`MCP server ${this.config.id} exited with code ${code}`);
      if (this._status === 'connected') {
        this._status = 'disconnected';
      }
    });

    // Log stderr for debugging
    this.process.stderr?.on('data', (data) => {
      console.error(`MCP ${this.config.id} stderr:`, data.toString());
    });

    return new StdioClientTransport({
      command: this.config.command,
      args: this.config.args || [],
      env,
    });
  }

  /**
   * Remote-Transport aufbauen (Streamable HTTP oder SSE) inkl. Auth-Header.
   * Header-Werte koennen ${ENV_VAR} referenzieren (z.B. Authorization: Bearer ${GMAIL_TOKEN}).
   */
  private createRemoteTransport(type: 'http' | 'sse'): Transport {
    if (!this.config.url) {
      throw new Error(`MCP server ${this.config.id}: 'url' ist fuer ${type}-Transport erforderlich`);
    }

    let url: URL;
    try {
      url = new URL(this.config.url);
    } catch {
      throw new Error(`MCP server ${this.config.id}: ungueltige URL "${this.config.url}"`);
    }

    // Header aufloesen (mit ${ENV}-Substitution)
    const headers: Record<string, string> = {};
    if (this.config.headers) {
      for (const [key, value] of Object.entries(this.config.headers)) {
        headers[key] = resolveEnvPlaceholders(value);
      }
    }
    const hasHeaders = Object.keys(headers).length > 0;
    const requestInit = hasHeaders ? { headers } : undefined;

    if (type === 'sse') {
      // Bei SSE muss der Custom-Header auch der EventSource-Verbindung mitgegeben werden.
      return new SSEClientTransport(url, {
        requestInit,
        eventSourceInit: hasHeaders
          ? { fetch: (input, init) => fetch(input, { ...init, headers: { ...init?.headers, ...headers } }) }
          : undefined,
      });
    }

    return new StreamableHTTPClientTransport(url, { requestInit });
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.close();
        this.client = null;
      }

      if (this.transport) {
        await this.transport.close();
        this.transport = null;
      }

      if (this.process) {
        this.process.kill();
        this.process = null;
      }

      this.tools = [];
      this._status = 'disconnected';
      this._connectedAt = null;

      console.log(`Disconnected from MCP server: ${this.config.name}`);
    } catch (err: any) {
      console.error(`Error disconnecting from MCP server ${this.config.id}:`, err);
    }
  }

  /**
   * Refresh the list of available tools
   */
  async refreshTools(): Promise<McpToolInfo[]> {
    if (!this.client || this._status !== 'connected' && this._status !== 'connecting') {
      return [];
    }

    try {
      const result = await this.client.listTools();

      this.tools = result.tools.map((tool) => ({
        name: tool.name,
        description: tool.description || '',
        serverId: this.config.id,
        serverName: this.config.name,
        inputSchema: tool.inputSchema as Record<string, any>,
      }));

      return this.tools;
    } catch (err: any) {
      console.error(`Failed to list tools from ${this.config.id}:`, err);
      return [];
    }
  }

  /**
   * Get all tools from this server
   */
  getTools(): McpToolInfo[] {
    return this.tools;
  }

  /**
   * Call a tool on the MCP server
   */
  async callTool(toolName: string, args: Record<string, any>): Promise<McpCallResult> {
    if (!this.client || this._status !== 'connected') {
      throw new Error(`MCP server ${this.config.id} is not connected`);
    }

    try {
      const result = await this.client.callTool({
        name: toolName,
        arguments: args,
      });

      return {
        content: result.content as McpCallResult['content'],
        isError: Boolean(result.isError),
      };
    } catch (err: any) {
      console.error(`MCP tool call failed (${this.config.id}/${toolName}):`, err);
      throw err;
    }
  }

  /**
   * Get server info
   */
  getInfo(): {
    id: string;
    name: string;
    status: string;
    error: string | null;
    toolCount: number;
    connectedAt: number | null;
  } {
    return {
      id: this.config.id,
      name: this.config.name,
      status: this._status,
      error: this._error,
      toolCount: this.tools.length,
      connectedAt: this._connectedAt,
    };
  }
}
