/**
 * MCP Integration Module
 *
 * Provides MCP (Model Context Protocol) integration for the Agent Platform.
 *
 * Two modes:
 *
 * 1. MCP Client Mode (default):
 *    Connect to external MCP servers and use their tools
 *    ```typescript
 *    import { mcpManager } from './mcp';
 *    await mcpManager.initialize();
 *    ```
 *
 * 2. MCP Server Mode:
 *    Expose Agent Platform tools to external MCP clients
 *    ```bash
 *    bun run src/mcp/server/index.ts
 *    ```
 *
 * Client Usage:
 * ```typescript
 * import { mcpManager } from './mcp';
 *
 * // Initialize (connects to all enabled servers)
 * await mcpManager.initialize();
 *
 * // Add a new server
 * await mcpManager.addServer({
 *   id: 'github',
 *   name: 'GitHub MCP Server',
 *   command: 'npx',
 *   args: ['-y', '@modelcontextprotocol/server-github'],
 *   env: { GITHUB_TOKEN: '...' },
 *   enabled: true,
 * });
 *
 * // Get all tools
 * const tools = mcpManager.getAllTools();
 *
 * // Shutdown
 * await mcpManager.shutdown();
 * ```
 */

// Export types
export * from './types';

// Export client
export { McpClient, mcpClient } from './client';

// Export connections
export { McpConnection } from './connection';
export { RemoteMcpConnection } from './remote-connection';

// Export config functions
export {
  loadMcpConfig,
  saveMcpConfig,
  getMcpServers,
  getMcpServer,
  addMcpServer,
  updateMcpServer,
  deleteMcpServer,
  getEnabledMcpServers,
  getMcpPresets,
  MCP_SERVER_PRESETS,
} from './config';

// Export tool wrapper
export {
  McpToolWrapper,
  createMcpToolWrappers,
  getMcpToolName,
  parseMcpToolName,
} from './tool';

// Export manager (main entry point)
export { mcpManager } from './manager';
