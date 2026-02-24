/**
 * MCP Server Connection (stdio-based)
 *
 * Adapted from backend/src/mcp/connection.ts for the runner context.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { ConnectRequest, McpToolInfo, McpCallResult } from './types';

/** Env vars safe to inherit from the runner process into MCP child processes */
const SAFE_ENV_KEYS = ['HOME', 'PATH', 'LANG', 'TZ', 'NODE_ENV', 'TERM'];

/** Username of the sandboxed user created in the Dockerfile (UID 1001) */
const MCP_USER = 'mcp';

/** Restricted PATH for MCP child processes — no access to npm/npx/bun */
const MCP_PATH = '/mcp-packages/node_modules/.bin:/usr/local/bin:/usr/bin:/bin';

export class McpConnection {
  private config: ConnectRequest;
  private transport: StdioClientTransport | null = null;
  private client: Client | null = null;
  private tools: McpToolInfo[] = [];
  private _status: 'connected' | 'connecting' | 'disconnected' | 'error' = 'disconnected';
  private _error: string | null = null;
  private _connectedAt: number | null = null;
  private _pid: number | null = null;

  constructor(config: ConnectRequest) {
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

  get pid(): number | null {
    return this._pid;
  }

  async connect(): Promise<void> {
    if (this._status === 'connected') {
      return;
    }

    this._status = 'connecting';
    this._error = null;

    try {
      // Sanitize env: only pass safe vars + backend-provided env (no MCP_RUNNER_SECRET etc.)
      const env: Record<string, string> = {};
      for (const key of SAFE_ENV_KEYS) {
        if (process.env[key]) env[key] = process.env[key]!;
      }
      env['PATH'] = MCP_PATH;
      if (this.config.env) {
        Object.assign(env, this.config.env);
      }

      // Wrap command with su-exec to run as sandboxed mcp user (UID 1001)
      // su-exec is Alpine's lightweight SUID helper — execs directly (no extra process)
      const originalCommand = this.config.command;
      const originalArgs = this.config.args || [];
      const sandboxCommand = '/sbin/su-exec';
      const sandboxArgs = [MCP_USER, originalCommand, ...originalArgs];

      // Create transport (StdioClientTransport spawns the process internally)
      this.transport = new StdioClientTransport({
        command: sandboxCommand,
        args: sandboxArgs,
        env,
      });

      // Capture PID when process starts
      this.transport.onclose = () => {
        if (this._status === 'connected') {
          console.log(`MCP server ${this.config.id} transport closed`);
          this._status = 'disconnected';
        }
      };

      // Create client
      this.client = new Client({
        name: 'mcp-runner',
        version: '1.0.0',
      }, {
        capabilities: {},
      });

      // Connect
      await this.client.connect(this.transport);

      // Try to capture PID from transport's internal process
      try {
        const proc = (this.transport as any)._process;
        if (proc?.pid) {
          this._pid = proc.pid;
        }
      } catch {
        // PID capture is best-effort
      }

      // List available tools
      await this.refreshTools();

      this._status = 'connected';
      this._connectedAt = Date.now();

      console.log(`Connected to MCP server: ${this.config.name} (${this.tools.length} tools, PID: ${this._pid})`);
    } catch (err: any) {
      this._status = 'error';
      this._error = err.message;
      console.error(`Failed to connect to MCP server ${this.config.id}:`, err);
      throw err;
    }
  }

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

      this.tools = [];
      this._status = 'disconnected';
      this._connectedAt = null;
      this._pid = null;

      console.log(`Disconnected from MCP server: ${this.config.name}`);
    } catch (err: any) {
      console.error(`Error disconnecting from MCP server ${this.config.id}:`, err);
    }
  }

  async refreshTools(): Promise<McpToolInfo[]> {
    if (!this.client || (this._status !== 'connected' && this._status !== 'connecting')) {
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

  getTools(): McpToolInfo[] {
    return this.tools;
  }

  async callTool(toolName: string, args: Record<string, any>): Promise<McpCallResult> {
    if (!this.client || this._status !== 'connected') {
      throw new Error(`MCP server ${this.config.id} is not connected`);
    }

    const result = await this.client.callTool({
      name: toolName,
      arguments: args,
    });

    return {
      content: result.content as McpCallResult['content'],
      isError: Boolean(result.isError),
    };
  }

  getMemoryMB(): number | null {
    if (!this._pid) return null;
    try {
      const proc = (this.transport as any)?._process;
      if (proc?.memoryUsage) {
        return Math.round(proc.memoryUsage().rss / 1024 / 1024);
      }
    } catch {
      // Best-effort
    }
    return null;
  }
}
