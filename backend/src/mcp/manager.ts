/**
 * MCP Manager
 *
 * High-level manager for MCP servers and tool registration.
 */

import { mcpClient } from './client';
import {
  loadMcpConfig,
  getMcpServers,
  getMcpServer,
  addMcpServer,
  updateMcpServer,
  deleteMcpServer,
  getEnabledMcpServers,
} from './config';
import { McpToolWrapper, createMcpToolWrappers, createMcpOAuthToolWrappers, getMcpToolName } from './tool';
import { mcpUserSessions } from './userSessions';
import { mcpConnectionProviderId } from './oauth/provider';
import { toolRegistry } from '../tools/registry';
import { listUserConnections } from '../connections';
import type { McpServerConfig, McpServerStatus, McpToolInfo } from './types';

class McpManager {
  private initialized = false;
  private registeredTools = new Map<string, Set<string>>(); // serverId -> Set of tool names
  private ensuredUsers = new Set<string>(); // userIds, deren OAuth-Tools schon (re-)registriert wurden

  /**
   * Initialize the MCP manager
   * Connects to all enabled servers and registers their tools
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('Initializing MCP Manager...');

    const servers = await getEnabledMcpServers();

    for (const server of servers) {
      if (server.autoConnect !== false) {
        try {
          await this.connectServer(server.id);
        } catch (err: any) {
          console.error(`Failed to connect to MCP server ${server.id}:`, err.message);
        }
      }
    }

    this.initialized = true;
    console.log(`MCP Manager initialized (${servers.length} servers configured)`);
  }

  /**
   * Shutdown the MCP manager
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down MCP Manager...');

    // Unregister all MCP tools
    for (const [serverId] of this.registeredTools) {
      await this.unregisterToolsFromServer(serverId);
    }

    // Disconnect all servers
    await mcpClient.disconnectAll();

    this.initialized = false;
    console.log('MCP Manager shut down');
  }

  /**
   * Connect to a specific server
   */
  async connectServer(serverId: string): Promise<void> {
    const config = await getMcpServer(serverId);
    if (!config) {
      throw new Error(`MCP server "${serverId}" not found`);
    }

    // OAuth-Server werden NICHT global verbunden — sie laufen pro User mit
    // dem jeweiligen OAuth-Token (per-User-Session). Ein globaler Connect-Versuch
    // waere unauthentifiziert und wuerde 401en.
    if (config.auth === 'oauth') {
      console.log(`Skipping global connect for OAuth MCP server (per-user): ${serverId}`);
      return;
    }

    await mcpClient.connect(config);
    await this.registerToolsFromServer(serverId);
  }

  /**
   * Disconnect from a specific server
   */
  async disconnectServer(serverId: string): Promise<void> {
    await this.unregisterToolsFromServer(serverId);
    await mcpClient.disconnect(serverId);
  }

  /**
   * Reconnect to a server
   */
  async reconnectServer(serverId: string): Promise<void> {
    const config = await getMcpServer(serverId);
    if (!config) {
      throw new Error(`MCP server "${serverId}" not found`);
    }

    await this.disconnectServer(serverId);
    await mcpClient.connect(config);
    await this.registerToolsFromServer(serverId);
  }

  /**
   * Register tools from a connected server into the tool registry
   */
  async registerToolsFromServer(serverId: string): Promise<void> {
    const connection = mcpClient.getConnection(serverId);
    if (!connection || connection.status !== 'connected') {
      return;
    }

    const tools = connection.getTools();
    const wrappers = createMcpToolWrappers(tools);

    // Track registered tools
    const toolNames = new Set<string>();

    for (const wrapper of wrappers) {
      toolRegistry.register(wrapper);
      toolNames.add(wrapper.name);
    }

    this.registeredTools.set(serverId, toolNames);
    console.log(`Registered ${wrappers.length} tools from MCP server ${serverId}`);
  }

  /**
   * Discover + register tools for an OAuth MCP server (per-user model).
   * Wird nach einem erfolgreichen OAuth-Connect aufgerufen. Die Tools werden
   * EINMAL (mit der Session des ersten verbundenen Users) discovert und global
   * als per-User-Wrapper registriert.
   */
  async registerOAuthServerTools(userId: string, serverId: string): Promise<void> {
    if (this.registeredTools.has(serverId)) {
      return;
    }

    const tools = await mcpUserSessions.listTools(userId, serverId);
    const wrappers = createMcpOAuthToolWrappers(tools);

    const toolNames = new Set<string>();
    for (const wrapper of wrappers) {
      toolRegistry.register(wrapper);
      toolNames.add(wrapper.name);
    }

    this.registeredTools.set(serverId, toolNames);
    console.log(`Registered ${wrappers.length} OAuth MCP tools from ${serverId}`);
  }

  /**
   * Stellt sicher, dass die OAuth-MCP-Tools eines Users (re-)registriert sind.
   * Wird beim Start eines Chat-Runs aufgerufen — re-registriert nach einem
   * Backend-Neustart lazy mit dem gespeicherten User-Token. Idempotent, pro
   * User nur einmal pro Prozess.
   */
  async ensureUserOAuthToolsRegistered(userId: string): Promise<void> {
    if (!userId || this.ensuredUsers.has(userId)) return;
    this.ensuredUsers.add(userId);

    try {
      const conns = await listUserConnections(userId);
      for (const conn of conns) {
        const prefix = mcpConnectionProviderId('');
        if (!conn.providerId.startsWith(prefix)) continue;
        const serverId = conn.providerId.slice(prefix.length);
        if (this.registeredTools.has(serverId)) continue;
        try {
          await this.registerOAuthServerTools(userId, serverId);
        } catch (err: any) {
          console.warn(`Lazy OAuth tool registration failed for ${serverId}:`, err?.message);
        }
      }
    } catch (err: any) {
      console.warn(`ensureUserOAuthToolsRegistered failed for ${userId}:`, err?.message);
    }
  }

  /**
   * Unregister tools from a server
   */
  async unregisterToolsFromServer(serverId: string): Promise<void> {
    const toolNames = this.registeredTools.get(serverId);
    if (!toolNames) return;

    for (const name of toolNames) {
      toolRegistry.unregister(name);
    }

    this.registeredTools.delete(serverId);
    console.log(`Unregistered tools from MCP server ${serverId}`);
  }

  /**
   * Refresh tools from a server
   */
  async refreshServerTools(serverId: string): Promise<McpToolInfo[]> {
    // First unregister existing tools
    await this.unregisterToolsFromServer(serverId);

    // Refresh from server
    const tools = await mcpClient.refreshTools(serverId);

    // Re-register
    await this.registerToolsFromServer(serverId);

    return tools;
  }

  // =====================
  // Server Configuration
  // =====================

  /**
   * Get all configured servers with their status
   */
  async getServers(): Promise<Array<McpServerConfig & McpServerStatus>> {
    const configs = await getMcpServers();
    const statuses = mcpClient.getServerStatuses();

    return configs.map(config => {
      const status = statuses.find(s => s.id === config.id);
      return {
        ...config,
        status: status?.status || 'disconnected',
        error: status?.error,
        toolCount: status?.toolCount || 0,
        connectedAt: status?.connectedAt,
      };
    });
  }

  /**
   * Get a single server
   */
  async getServer(serverId: string): Promise<(McpServerConfig & McpServerStatus) | null> {
    const config = await getMcpServer(serverId);
    if (!config) return null;

    const connection = mcpClient.getConnection(serverId);
    const tools = connection?.getTools() || [];

    return {
      ...config,
      status: connection?.status || 'disconnected',
      error: connection?.error || undefined,
      toolCount: tools.length,
      connectedAt: connection?.connectedAt || undefined,
    };
  }

  /**
   * Add a new server
   */
  async addServer(config: McpServerConfig): Promise<McpServerConfig> {
    const server = await addMcpServer(config);

    // Auto-connect if enabled
    if (server.enabled !== false && server.autoConnect !== false) {
      try {
        await this.connectServer(server.id);
      } catch (err: any) {
        console.error(`Failed to auto-connect to ${server.id}:`, err.message);
      }
    }

    return server;
  }

  /**
   * Update a server
   */
  async updateServer(serverId: string, updates: Partial<McpServerConfig>): Promise<McpServerConfig> {
    const wasConnected = mcpClient.getConnection(serverId)?.status === 'connected';

    // Disconnect if connected
    if (wasConnected) {
      await this.disconnectServer(serverId);
    }

    // Update config
    const updated = await updateMcpServer(serverId, updates);

    // Reconnect if was connected and still enabled
    if (wasConnected && updated.enabled !== false) {
      try {
        await this.connectServer(serverId);
      } catch (err: any) {
        console.error(`Failed to reconnect to ${serverId}:`, err.message);
      }
    }

    return updated;
  }

  /**
   * Delete a server
   */
  async deleteServer(serverId: string): Promise<void> {
    // Disconnect first
    await this.disconnectServer(serverId);

    // Delete config
    await deleteMcpServer(serverId);
  }

  /**
   * Toggle server enabled state
   */
  async toggleServer(serverId: string, enabled: boolean): Promise<void> {
    await this.updateServer(serverId, { enabled });

    if (enabled) {
      await this.connectServer(serverId);
    } else {
      await this.disconnectServer(serverId);
    }
  }

  // =====================
  // Tools
  // =====================

  /**
   * Get all MCP tools
   */
  getAllTools(): McpToolInfo[] {
    return mcpClient.getAllTools();
  }

  /**
   * Get tools from a specific server
   */
  getServerTools(serverId: string): McpToolInfo[] {
    const connection = mcpClient.getConnection(serverId);
    return connection?.getTools() || [];
  }

  /**
   * Test a tool
   */
  async testTool(serverId: string, toolName: string, args: Record<string, any>): Promise<{
    success: boolean;
    result?: string;
    error?: string;
    duration: number;
  }> {
    const start = Date.now();

    try {
      const result = await mcpClient.callTool(serverId, toolName, args);
      return {
        success: true,
        result,
        duration: Date.now() - start,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
        duration: Date.now() - start,
      };
    }
  }

  /**
   * Call a tool and get the result
   */
  async callTool(serverId: string, toolName: string, args: Record<string, any>): Promise<string> {
    return mcpClient.callTool(serverId, toolName, args);
  }
}

// Singleton instance
export const mcpManager = new McpManager();
