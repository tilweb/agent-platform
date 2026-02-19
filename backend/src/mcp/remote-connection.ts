/**
 * Remote MCP Connection
 *
 * Implements IMcpConnection by forwarding all operations to the MCP Runner via HTTP.
 */

import type {
  McpServerConfig,
  McpToolInfo,
  McpCallResult,
  IMcpConnection,
  RunnerConnectRequest,
  RunnerServerStatus,
} from './types';

export class RemoteMcpConnection implements IMcpConnection {
  private config: McpServerConfig;
  private runnerUrl: string;
  private secret: string;
  private tools: McpToolInfo[] = [];
  private _status: 'connected' | 'connecting' | 'disconnected' | 'error' = 'disconnected';
  private _error: string | null = null;
  private _connectedAt: number | null = null;

  constructor(config: McpServerConfig, runnerUrl: string, secret: string) {
    this.config = config;
    this.runnerUrl = runnerUrl.replace(/\/$/, '');
    this.secret = secret;
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

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.secret) {
      h['Authorization'] = `Bearer ${this.secret}`;
    }
    return h;
  }

  private resolveEnv(): Record<string, string> | undefined {
    if (!this.config.env) return undefined;

    const resolved: Record<string, string> = {};
    for (const [key, value] of Object.entries(this.config.env)) {
      resolved[key] = value.replace(/\$\{(\w+)\}/g, (_, name) => process.env[name] || '');
    }
    return resolved;
  }

  async connect(): Promise<void> {
    if (this._status === 'connected') return;

    this._status = 'connecting';
    this._error = null;

    try {
      const body: RunnerConnectRequest = {
        id: this.config.id,
        name: this.config.name,
        command: this.config.command,
        args: this.config.args,
        env: this.resolveEnv(),
      };

      const res = await fetch(`${this.runnerUrl}/api/servers/${this.config.id}/connect`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
        throw new Error(err.error || `Runner returned ${res.status}`);
      }

      const status = await res.json() as RunnerServerStatus;

      // Fetch tools
      await this.refreshTools();

      this._status = 'connected';
      this._connectedAt = status.connectedAt || Date.now();

      console.log(`Connected to MCP server via runner: ${this.config.name} (${this.tools.length} tools)`);
    } catch (err: any) {
      this._status = 'error';
      this._error = err.message;
      console.error(`Failed to connect to MCP server ${this.config.id} via runner:`, err);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await fetch(`${this.runnerUrl}/api/servers/${this.config.id}/disconnect`, {
        method: 'POST',
        headers: this.headers(),
      });

      this.tools = [];
      this._status = 'disconnected';
      this._connectedAt = null;

      console.log(`Disconnected from MCP server via runner: ${this.config.name}`);
    } catch (err: any) {
      console.error(`Error disconnecting from MCP server ${this.config.id} via runner:`, err);
    }
  }

  async refreshTools(): Promise<McpToolInfo[]> {
    try {
      const res = await fetch(`${this.runnerUrl}/api/servers/${this.config.id}/tools`, {
        headers: this.headers(),
      });

      if (!res.ok) {
        console.error(`Failed to fetch tools from runner for ${this.config.id}: ${res.status}`);
        return [];
      }

      this.tools = await res.json() as McpToolInfo[];
      return this.tools;
    } catch (err: any) {
      console.error(`Failed to refresh tools from runner for ${this.config.id}:`, err);
      return [];
    }
  }

  getTools(): McpToolInfo[] {
    return this.tools;
  }

  async callTool(toolName: string, args: Record<string, any>): Promise<McpCallResult> {
    if (this._status !== 'connected') {
      throw new Error(`MCP server ${this.config.id} is not connected`);
    }

    const res = await fetch(
      `${this.runnerUrl}/api/servers/${this.config.id}/tools/${encodeURIComponent(toolName)}/call`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ arguments: args }),
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
      throw new Error(err.error || `Runner returned ${res.status}`);
    }

    return await res.json() as McpCallResult;
  }

  getInfo() {
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
