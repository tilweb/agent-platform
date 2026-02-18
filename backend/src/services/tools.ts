/**
 * Tools Service - Compatibility Layer
 *
 * This file is maintained for backwards compatibility.
 * The actual tool implementation has moved to src/tools/
 *
 * For new development, import directly from '../tools' instead.
 */

// Re-export everything from the new tools module
export {
  toolRegistry,
  executeToolCall,
  setDelegationHandler,
  getDelegationHandler,
  getToolsForAgent,
  getAllToolDefinitions,
  registerTool,
  setupTools,
  toolsConfig,
  type Tool,
  type ToolDefinition,
  type ToolCall,
  type ToolContext,
  type ToolsConfig,
} from '../tools';

// Legacy exports for backwards compatibility
import { toolRegistry } from '../tools';

/**
 * @deprecated Use toolRegistry.getDefinitions() instead
 */
export const toolDefinitions = toolRegistry.getDefinitions();

/**
 * @deprecated Use toolRegistry.get('delegate_to_agent')?.getDefinition() instead
 */
export const delegationToolDefinition = toolRegistry.get('delegate_to_agent')?.getDefinition();
