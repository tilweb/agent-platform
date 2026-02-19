/**
 * Process Manager
 *
 * Manages the lifecycle of all MCP server connections.
 */

import { McpConnection } from './connection';
import type { ConnectRequest, ServerStatus, McpToolInfo, McpCallResult } from './types';

class ProcessManager {
  private connections = new Map<string, McpConnection>();

  async connect(request: ConnectRequest): Promise<McpConnection> {
    // Disconnect existing if any
    const existing = this.connections.get(request.id);
    if (existing && existing.status === 'connected') {
      return existing;
    }
    if (existing) {
      await existing.disconnect();
    }

    const connection = new McpConnection(request);
    this.connections.set(request.id, connection);
    await connection.connect();
    return connection;
  }

  async disconnect(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    if (connection) {
      await connection.disconnect();
      this.connections.delete(serverId);
    }
  }

  async disconnectAll(): Promise<void> {
    const ids = Array.from(this.connections.keys());
    await Promise.all(ids.map(id => this.disconnect(id)));
  }

  getConnection(serverId: string): McpConnection | undefined {
    return this.connections.get(serverId);
  }

  getAllStatuses(): ServerStatus[] {
    return Array.from(this.connections.values()).map(conn => ({
      id: conn.serverId,
      name: conn.serverName,
      status: conn.status,
      error: conn.error || undefined,
      toolCount: conn.getTools().length,
      connectedAt: conn.connectedAt || undefined,
      pid: conn.pid || undefined,
      memoryMB: conn.getMemoryMB() || undefined,
    }));
  }

  getStatus(serverId: string): ServerStatus | null {
    const conn = this.connections.get(serverId);
    if (!conn) return null;

    return {
      id: conn.serverId,
      name: conn.serverName,
      status: conn.status,
      error: conn.error || undefined,
      toolCount: conn.getTools().length,
      connectedAt: conn.connectedAt || undefined,
      pid: conn.pid || undefined,
      memoryMB: conn.getMemoryMB() || undefined,
    };
  }

  getTools(serverId: string): McpToolInfo[] {
    const conn = this.connections.get(serverId);
    return conn ? conn.getTools() : [];
  }

  async callTool(serverId: string, toolName: string, args: Record<string, any>): Promise<McpCallResult> {
    const conn = this.connections.get(serverId);
    if (!conn) {
      throw new Error(`Server "${serverId}" not found`);
    }
    return conn.callTool(toolName, args);
  }

  async refreshTools(serverId: string): Promise<McpToolInfo[]> {
    const conn = this.connections.get(serverId);
    if (!conn) {
      throw new Error(`Server "${serverId}" not found`);
    }
    return conn.refreshTools();
  }

  get serverCount(): number {
    return this.connections.size;
  }

  get connectedCount(): number {
    let count = 0;
    for (const conn of this.connections.values()) {
      if (conn.status === 'connected') count++;
    }
    return count;
  }
}

export const processManager = new ProcessManager();
