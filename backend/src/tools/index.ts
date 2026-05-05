/**
 * Tools Module - Main entry point
 *
 * This module provides a modular tool system that supports:
 * - Local tools (filesystem operations)
 * - API tools (external service integrations)
 * - MCP tools (Model Context Protocol servers)
 * - Special tools (delegation, etc.)
 *
 * Usage:
 * ```typescript
 * import { setupTools, toolRegistry } from './tools';
 *
 * // Initialize all tools
 * await setupTools();
 *
 * // Get tool definitions for LLM
 * const definitions = toolRegistry.getDefinitions();
 *
 * // Execute a tool call
 * const result = await toolRegistry.execute(toolCall);
 * ```
 */

// Export types
export * from './types';

// Export registry
export { toolRegistry, ToolRegistry } from './registry';

// Export base classes
export { LocalTool, ApiTool, McpTool, mcpClient } from './base';

// Export tools
export { localTools, fileReadTool, fileWriteTool, fileListTool } from './local';
export { WebSearchTool, createWebSearchTool, WebFetchTool, createWebFetchTool, ImageGenerationTool, createImageGenerationTool, ImageEditTool, createImageEditTool } from './api';
export { DelegateToAgentTool, type DelegationHandler, UserMemoryTool, CreateTaskTool, ReadChatAttachmentTool, ExportDocumentTool, LoadSkillTool, type LoadSkillHandler, type SkillToolsCallback, ExtractDocumentTool, FillTemplateTool } from './special';

// Export knowledge tools
export { KbSearchTool, KbIndexTool, KbManageTool, knowledgeTools } from './knowledge';

// Export table tools
export { tableTools, TableListTool, TableQueryTool, TableAddTool, TableUpdateTool, TableDeleteTool } from './tables';

// Export custom tools
export {
  CustomApiTool,
  registerCustomTools,
  registerCustomTool,
  unregisterCustomTool,
  testCustomTool,
  loadCustomTools,
  getCustomTool,
  createCustomTool,
  updateCustomTool,
  deleteCustomTool,
  type CustomToolConfig,
  type CustomToolParameter,
  type CustomToolAuth,
} from './custom';

// Export config
export { toolsConfig, isToolConfigured, getConfiguredApiTools } from './config';

// Import for setup
import { toolRegistry } from './registry';
import { toolsConfig } from './config';
import { localTools } from './local';
import { WebSearchTool, WebFetchTool, ImageGenerationTool, ImageEditTool } from './api';
import { DelegateToAgentTool, UserMemoryTool, CreateTaskTool, ReadChatAttachmentTool, ExportDocumentTool, LoadSkillTool, ExtractDocumentTool, FillTemplateTool } from './special';
import { registerCustomTools } from './custom';
import { knowledgeTools } from './knowledge';
import { tableTools } from './tables';
import { listDelegatableAgents } from '../services/agents';
import { AppFunctionTool } from './public-functions/AppFunctionTool';
import { getApps } from '../apps/registry';
import type { PublicFunction } from '../public-api/types';

// Store delegation tool reference for handler management
let delegationTool: DelegateToAgentTool | null = null;

// Store load_skill tool reference for handler management
let loadSkillTool: LoadSkillTool | null = null;

/**
 * Setup and register all tools
 */
export async function setupTools(): Promise<void> {
  console.log('Setting up tools...');

  // Clear existing tools
  toolRegistry.clear();

  // Update registry config
  toolRegistry.updateConfig(toolsConfig);

  // Register local tools
  toolRegistry.registerAll(localTools);

  // Register API tools (always register, isAvailable() determines if usable)
  const webSearchConfig = toolsConfig.api.web_search;
  const webSearchTool = new WebSearchTool({
    apiKey: webSearchConfig?.apiKey,
    provider: (webSearchConfig as any)?.provider || 'tavily',
  });
  toolRegistry.register(webSearchTool);

  // Register web fetch tool
  const webFetchTool = new WebFetchTool();
  toolRegistry.register(webFetchTool);

  // Register delegation tool
  delegationTool = new DelegateToAgentTool(async () => {
    const agents = await listDelegatableAgents();
    return agents.map(a => ({
      id: a.id,
      name: a.name,
      description: a.description,
    }));
  });
  toolRegistry.register(delegationTool);

  // Register knowledge base tools
  toolRegistry.registerAll(knowledgeTools);

  // Register table tools
  toolRegistry.registerAll(tableTools);

  // Register user memory tool
  const userMemoryTool = new UserMemoryTool();
  toolRegistry.register(userMemoryTool);

  // Register create task tool
  const createTaskTool = new CreateTaskTool();
  toolRegistry.register(createTaskTool);

  // Register read chat attachment tool
  const readChatAttachmentTool = new ReadChatAttachmentTool();
  toolRegistry.register(readChatAttachmentTool);

  // Register export document tool
  const exportDocumentTool = new ExportDocumentTool();
  toolRegistry.register(exportDocumentTool);

  // Register fill template tool — vorlagen-getriebener Document-Builder
  const fillTemplateTool = new FillTemplateTool();
  toolRegistry.register(fillTemplateTool);

  // Register image generation tools
  const imageGenerationTool = new ImageGenerationTool();
  toolRegistry.register(imageGenerationTool);

  const imageEditTool = new ImageEditTool();
  toolRegistry.register(imageEditTool);

  // Register load_skill tool
  loadSkillTool = new LoadSkillTool();
  toolRegistry.register(loadSkillTool);

  // Register extract_document tool
  const extractDocumentTool = new ExtractDocumentTool();
  toolRegistry.register(extractDocumentTool);

  // Register custom API tools
  await registerCustomTools();

  // Register Public-Functions from apps as agent tools
  await registerAppPublicFunctions();

  // Log stats
  const stats = toolRegistry.getStats();
  console.log(`Tools initialized: ${stats.total} total`);
  console.log(`  - Local: ${stats.byType.local || 0}`);
  console.log(`  - API: ${stats.byType.api || 0}`);
  console.log(`  - MCP: ${stats.byType.mcp || 0}`);
  console.log(`  - Delegation: ${stats.byType.delegation || 0}`);
}

/**
 * Register each publicFunction of every enabled app as an agent tool.
 * Idempotent: re-registering overwrites previous handler instance.
 */
async function registerAppPublicFunctions(): Promise<void> {
  try {
    const apps = await getApps();
    let count = 0;
    for (const app of apps) {
      if (!app.enabled || !Array.isArray(app.publicFunctions)) continue;
      for (const fn of app.publicFunctions as PublicFunction[]) {
        toolRegistry.register(new AppFunctionTool(app.id, fn));
        count++;
      }
    }
    if (count > 0) {
      console.log(`Registered ${count} app public function(s) as agent tools`);
    }
  } catch (err) {
    console.error('Failed to register app public functions as tools:', err);
  }
}

/**
 * Set the delegation handler (called by agent loop)
 */
export function setDelegationHandler(
  handler: ((agentId: string, task: string, context?: string) => Promise<string>) | null
): void {
  if (delegationTool) {
    delegationTool.setHandler(handler);
  }
}

/**
 * Get delegation handler
 */
export function getDelegationHandler(): ((agentId: string, task: string, context?: string) => Promise<string>) | null {
  return delegationTool?.getHandler() || null;
}

/**
 * Set the load_skill handler (called by agent loop)
 */
export function setLoadSkillHandler(
  handler: import('./special').LoadSkillHandler | null
): void {
  if (loadSkillTool) {
    loadSkillTool.setHandler(handler);
  }
}

/**
 * Get the load_skill tool instance
 */
export function getLoadSkillTool(): LoadSkillTool | null {
  return loadSkillTool;
}

/**
 * Get tools for an agent by tool names
 */
export function getToolsForAgent(toolNames: string[]): import('./types').ToolDefinition[] {
  return toolRegistry.getDefinitions(toolNames);
}

/**
 * Execute a tool call
 */
export async function executeToolCall(
  toolCall: import('./types').ToolCall,
  context?: import('./types').ToolContext
): Promise<string> {
  return toolRegistry.execute(toolCall, context);
}

/**
 * Register a custom tool
 */
export function registerTool(tool: import('./types').Tool): void {
  toolRegistry.register(tool);
}

/**
 * Get all tool definitions (for backwards compatibility)
 */
export function getAllToolDefinitions(): import('./types').ToolDefinition[] {
  return toolRegistry.getDefinitions();
}
