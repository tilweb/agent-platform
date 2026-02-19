/**
 * MCP Integration Types
 */

export interface McpServerConfig {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
  autoConnect?: boolean;
  timeout?: number;
}

export interface McpServerStatus {
  id: string;
  name: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  error?: string;
  toolCount: number;
  connectedAt?: number;
}

export interface McpToolInfo {
  name: string;
  description: string;
  serverId: string;
  serverName: string;
  inputSchema: Record<string, any>;
}

export interface McpServersConfig {
  servers: McpServerConfig[];
}

export interface McpCallResult {
  content: Array<{
    type: string;
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

/**
 * IMcpConnection — Common interface for local and remote MCP connections.
 */
export interface IMcpConnection {
  readonly serverId: string;
  readonly serverName: string;
  readonly status: 'connected' | 'connecting' | 'disconnected' | 'error';
  readonly error: string | null;
  readonly connectedAt: number | null;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  refreshTools(): Promise<McpToolInfo[]>;
  getTools(): McpToolInfo[];
  callTool(toolName: string, args: Record<string, any>): Promise<McpCallResult>;
  getInfo(): {
    id: string;
    name: string;
    status: string;
    error: string | null;
    toolCount: number;
    connectedAt: number | null;
  };
}

/**
 * MCP Runner API Types
 */
export interface RunnerConnectRequest {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface RunnerServerStatus {
  id: string;
  name: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  error?: string;
  toolCount: number;
  connectedAt?: number;
  pid?: number;
  memoryMB?: number;
}
