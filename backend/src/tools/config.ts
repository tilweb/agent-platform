/**
 * Tools Configuration
 *
 * Configure API keys, endpoints, and MCP servers here.
 * For sensitive values, use environment variables.
 */

import type { ToolsConfig } from './types';
import { DATA_DIR } from '../utils/paths';

export const toolsConfig: ToolsConfig = {
  // Data directory for local file tools
  dataDir: DATA_DIR,

  // API configurations
  api: {
    // Web Search (Tavily)
    // Get your API key at: https://tavily.com
    web_search: {
      apiKey: process.env.TAVILY_API_KEY || process.env.WEB_SEARCH_API_KEY,
      // provider: 'tavily', // or 'serper'
    },

    // Example: Weather API
    // weather: {
    //   apiKey: process.env.WEATHER_API_KEY,
    //   baseUrl: 'https://api.weatherapi.com/v1',
    // },

    // Example: Translation API
    // translation: {
    //   apiKey: process.env.DEEPL_API_KEY,
    //   baseUrl: 'https://api-free.deepl.com/v2',
    // },
  },

  // MCP Server configurations
  mcp: [
    // Example: Local filesystem MCP server
    // {
    //   name: 'filesystem',
    //   command: 'npx',
    //   args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/allowed/dir'],
    //   enabled: true,
    // },

    // Example: GitHub MCP server
    // {
    //   name: 'github',
    //   command: 'npx',
    //   args: ['-y', '@modelcontextprotocol/server-github'],
    //   env: {
    //     GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN || '',
    //   },
    //   enabled: !!process.env.GITHUB_TOKEN,
    // },

    // Example: Brave Search MCP server
    // {
    //   name: 'brave-search',
    //   command: 'npx',
    //   args: ['-y', '@modelcontextprotocol/server-brave-search'],
    //   env: {
    //     BRAVE_API_KEY: process.env.BRAVE_API_KEY || '',
    //   },
    //   enabled: !!process.env.BRAVE_API_KEY,
    // },
  ],

  // Optionally restrict which tools are enabled
  // enabled: ['file_read', 'file_write', 'file_list', 'web_search'],

  // Optionally disable specific tools
  disabled: [],
};

/**
 * Helper to check if a tool is configured
 */
export function isToolConfigured(toolName: string): boolean {
  const config = toolsConfig.api[toolName];
  if (!config) return false;

  // Check if API key is set
  if (config.apiKey) return true;

  return false;
}

/**
 * Get all configured API tool names
 */
export function getConfiguredApiTools(): string[] {
  return Object.entries(toolsConfig.api)
    .filter(([_, config]) => config?.apiKey)
    .map(([name]) => name);
}
