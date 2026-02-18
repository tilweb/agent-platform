/**
 * MCP Client
 *
 * Manages connections to multiple MCP servers.
 */

import { McpConnection } from './connection';
import type { McpServerConfig, McpServerStatus, McpToolInfo } from './types';

export class McpClient {
  private connections = new Map<string, McpConnection>();

  /**
   * Connect to an MCP server
   */
  async connect(config: McpServerConfig): Promise<McpConnection> {
    // Check if already connected
    const existing = this.connections.get(config.id);
    if (existing && existing.status === 'connected') {
      return existing;
    }

    // Create and connect
    const connection = new McpConnection(config);
    this.connections.set(config.id, connection);

    await connection.connect();
    return connection;
  }

  /**
   * Disconnect from an MCP server
   */
  async disconnect(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    if (connection) {
      await connection.disconnect();
      this.connections.delete(serverId);
    }
  }

  /**
   * Reconnect to an MCP server
   */
  async reconnect(config: McpServerConfig): Promise<McpConnection> {
    await this.disconnect(config.id);
    return this.connect(config);
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll(): Promise<void> {
    const promises = Array.from(this.connections.keys()).map(id => this.disconnect(id));
    await Promise.all(promises);
  }

  /**
   * Get a connection by server ID
   */
  getConnection(serverId: string): McpConnection | undefined {
    return this.connections.get(serverId);
  }

  /**
   * Get all connections
   */
  getAllConnections(): McpConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get status of all servers
   */
  getServerStatuses(): McpServerStatus[] {
    return this.getAllConnections().map(conn => ({
      id: conn.serverId,
      name: conn.serverName,
      status: conn.status,
      error: conn.error || undefined,
      toolCount: conn.getTools().length,
      connectedAt: conn.connectedAt || undefined,
    }));
  }

  /**
   * Get all tools from all connected servers
   */
  getAllTools(): McpToolInfo[] {
    const tools: McpToolInfo[] = [];
    for (const connection of this.connections.values()) {
      if (connection.status === 'connected') {
        tools.push(...connection.getTools());
      }
    }
    return tools;
  }

  /**
   * Call a tool on a specific server
   */
  async callTool(serverId: string, toolName: string, args: Record<string, any>): Promise<string> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      throw new Error(`MCP server "${serverId}" not found`);
    }

    const result = await connection.callTool(toolName, args);

    // Format result to string
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

  /**
   * Refresh tools from a specific server
   */
  async refreshTools(serverId: string): Promise<McpToolInfo[]> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      throw new Error(`MCP server "${serverId}" not found`);
    }

    return connection.refreshTools();
  }
}

// Singleton instance
export const mcpClient = new McpClient();
