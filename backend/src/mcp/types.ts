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
