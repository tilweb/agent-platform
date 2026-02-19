/**
 * MCP Runner Types
 */

export interface ConnectRequest {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface McpToolInfo {
  name: string;
  description: string;
  serverId: string;
  serverName: string;
  inputSchema: Record<string, any>;
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

export interface ServerStatus {
  id: string;
  name: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  error?: string;
  toolCount: number;
  connectedAt?: number;
  pid?: number;
  memoryMB?: number;
}

export interface ToolCallRequest {
  arguments: Record<string, any>;
}
