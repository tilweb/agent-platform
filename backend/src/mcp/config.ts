/**
 * MCP Configuration Management
 *
 * Loads and saves MCP server configurations from YAML files.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname } from 'path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { McpServerConfig, McpServersConfig } from './types';
import { MCP_SERVERS_CONFIG } from '../utils/paths';

const CONFIG_PATH = MCP_SERVERS_CONFIG;

// Default servers (presets)
export const MCP_SERVER_PRESETS: Record<string, Omit<McpServerConfig, 'id' | 'enabled'>> = {
  github: {
    name: 'GitHub MCP Server',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: {
      GITHUB_PERSONAL_ACCESS_TOKEN: '${GITHUB_TOKEN}',
    },
  },
  filesystem: {
    name: 'Filesystem MCP Server',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '../data'],
  },
  sqlite: {
    name: 'SQLite MCP Server',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sqlite', '../data/database.sqlite'],
  },
  'brave-search': {
    name: 'Brave Search MCP Server',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    env: {
      BRAVE_API_KEY: '${BRAVE_API_KEY}',
    },
  },
  puppeteer: {
    name: 'Puppeteer MCP Server',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-puppeteer'],
  },
  memory: {
    name: 'Memory MCP Server',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
  },
};

/**
 * Load MCP server configurations
 */
export async function loadMcpConfig(): Promise<McpServersConfig> {
  try {
    if (!existsSync(CONFIG_PATH)) {
      return { servers: [] };
    }

    const content = await readFile(CONFIG_PATH, 'utf-8');
    const config = parseYaml(content) as McpServersConfig;

    return {
      servers: config.servers || [],
    };
  } catch (err: any) {
    console.error('Error loading MCP config:', err);
    return { servers: [] };
  }
}

/**
 * Save MCP server configurations
 */
export async function saveMcpConfig(config: McpServersConfig): Promise<void> {
  try {
    // Ensure directory exists
    const dir = dirname(CONFIG_PATH);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    const content = stringifyYaml(config, { lineWidth: 0 });
    await writeFile(CONFIG_PATH, content, 'utf-8');
  } catch (err: any) {
    console.error('Error saving MCP config:', err);
    throw err;
  }
}

/**
 * Get all configured servers
 */
export async function getMcpServers(): Promise<McpServerConfig[]> {
  const config = await loadMcpConfig();
  return config.servers;
}

/**
 * Get a single server by ID
 */
export async function getMcpServer(serverId: string): Promise<McpServerConfig | null> {
  const config = await loadMcpConfig();
  return config.servers.find(s => s.id === serverId) || null;
}

/**
 * Add a new MCP server
 */
export async function addMcpServer(server: McpServerConfig): Promise<McpServerConfig> {
  const config = await loadMcpConfig();

  // Check for duplicate ID
  if (config.servers.some(s => s.id === server.id)) {
    throw new Error(`MCP server with ID "${server.id}" already exists`);
  }

  config.servers.push(server);
  await saveMcpConfig(config);

  return server;
}

/**
 * Update an existing MCP server
 */
export async function updateMcpServer(
  serverId: string,
  updates: Partial<McpServerConfig>
): Promise<McpServerConfig> {
  const config = await loadMcpConfig();

  const existing = config.servers.find(s => s.id === serverId);
  if (!existing) {
    throw new Error(`MCP server "${serverId}" not found`);
  }

  const index = config.servers.indexOf(existing);
  const updated: McpServerConfig = {
    id: serverId, // ID cannot be changed
    name: updates.name ?? existing.name,
    command: updates.command ?? existing.command,
    args: updates.args ?? existing.args,
    env: updates.env ?? existing.env,
    enabled: updates.enabled ?? existing.enabled,
    autoConnect: updates.autoConnect ?? existing.autoConnect,
    timeout: updates.timeout ?? existing.timeout,
  };

  config.servers[index] = updated;
  await saveMcpConfig(config);

  return updated;
}

/**
 * Delete an MCP server
 */
export async function deleteMcpServer(serverId: string): Promise<void> {
  const config = await loadMcpConfig();

  const index = config.servers.findIndex(s => s.id === serverId);
  if (index === -1) {
    throw new Error(`MCP server "${serverId}" not found`);
  }

  config.servers.splice(index, 1);
  await saveMcpConfig(config);
}

/**
 * Get enabled servers
 */
export async function getEnabledMcpServers(): Promise<McpServerConfig[]> {
  const config = await loadMcpConfig();
  return config.servers.filter(s => s.enabled !== false);
}

/**
 * Get available presets
 */
export function getMcpPresets(): Array<{ id: string } & Omit<McpServerConfig, 'id' | 'enabled'>> {
  return Object.entries(MCP_SERVER_PRESETS).map(([id, preset]) => ({
    id,
    ...preset,
  }));
}
