/**
 * Custom API Tools Module
 */

export * from './types';
export { CustomApiTool } from './CustomApiTool';
export {
  loadCustomTools,
  getCustomTool,
  saveCustomTool,
  createCustomTool,
  updateCustomTool,
  deleteCustomTool,
  clearCustomToolsCache,
  customToolExists,
} from './storage';

import { toolRegistry } from '../registry';
import { CustomApiTool } from './CustomApiTool';
import { loadCustomTools, getCustomTool } from './storage';
import type { CustomToolConfig } from './types';

// Track registered custom tools
const registeredCustomTools = new Set<string>();

/**
 * Register all custom tools with the tool registry
 */
export async function registerCustomTools(): Promise<number> {
  const configs = await loadCustomTools();
  let count = 0;

  for (const config of configs) {
    if (config.enabled) {
      try {
        const tool = new CustomApiTool(config);
        toolRegistry.register(tool);
        registeredCustomTools.add(config.id);
        count++;
      } catch (error) {
        console.error(`Failed to register custom tool "${config.id}":`, error);
      }
    }
  }

  console.log(`Registered ${count} custom API tools`);
  return count;
}

/**
 * Register a single custom tool
 */
export function registerCustomTool(config: CustomToolConfig): void {
  if (!config.enabled) {
    console.log(`Custom tool "${config.id}" is disabled, skipping registration`);
    return;
  }

  // Unregister if already exists
  if (registeredCustomTools.has(config.id)) {
    toolRegistry.unregister(config.id);
  }

  const tool = new CustomApiTool(config);
  toolRegistry.register(tool);
  registeredCustomTools.add(config.id);
}

/**
 * Unregister a custom tool
 */
export function unregisterCustomTool(toolId: string): void {
  if (registeredCustomTools.has(toolId)) {
    toolRegistry.unregister(toolId);
    registeredCustomTools.delete(toolId);
  }
}

/**
 * Test a custom tool with given parameters
 */
export async function testCustomTool(
  toolId: string,
  parameters: Record<string, any>
): Promise<{
  success: boolean;
  response?: string;
  error?: string;
  duration?: number;
}> {
  const config = await getCustomTool(toolId);
  if (!config) {
    return { success: false, error: `Tool "${toolId}" not found` };
  }

  const tool = new CustomApiTool(config);

  const startTime = Date.now();
  try {
    const response = await tool.execute(parameters);
    const duration = Date.now() - startTime;

    // Check if response contains an error
    if (response.startsWith('Error:') || response.startsWith('API Error')) {
      return { success: false, error: response, duration };
    }

    return { success: true, response, duration };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    return { success: false, error: error.message, duration };
  }
}

/**
 * Get list of registered custom tools
 */
export function getRegisteredCustomTools(): string[] {
  return Array.from(registeredCustomTools);
}
