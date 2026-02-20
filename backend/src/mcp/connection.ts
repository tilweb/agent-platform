/**
 * MCP Server Connection
 *
 * Manages a connection to a single MCP server process.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn, type ChildProcess } from 'child_process';
import type { McpServerConfig, McpToolInfo, McpCallResult, IMcpConnection } from './types';

export class McpConnection implements IMcpConnection {
  private config: McpServerConfig;
  private process: ChildProcess | null = null;
  private transport: StdioClientTransport | null = null;
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
      // Resolve environment variables
      const env: Record<string, string> = { ...process.env } as Record<string, string>;
      if (this.config.env) {
        for (const [key, value] of Object.entries(this.config.env)) {
          // Replace ${VAR} with actual env value
          env[key] = value.replace(/\$\{(\w+)\}/g, (_, name) => process.env[name] || '');
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

      // Create transport
      this.transport = new StdioClientTransport({
        command: this.config.command,
        args: this.config.args || [],
        env,
      });

      // Create client
      this.client = new Client({
        name: 'adacor-workplace',
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

      console.log(`Connected to MCP server: ${this.config.name} (${this.tools.length} tools)`);
    } catch (err: any) {
      this._status = 'error';
      this._error = err.message;
      console.error(`Failed to connect to MCP server ${this.config.id}:`, err);
      throw err;
    }
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
