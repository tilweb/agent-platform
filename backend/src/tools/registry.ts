/**
 * Tool Registry - Central management for all tools
 */

import type { Tool, ToolDefinition, ToolCall, ToolContext, ToolType, ToolsConfig } from './types';
import type { ConnectionTool } from '../connections/types';

class ToolRegistry {
  private tools = new Map<string, Tool>();
  private config: ToolsConfig;
  private disabledPlugins = new Set<string>();

  constructor(config?: Partial<ToolsConfig>) {
    this.config = {
      dataDir: config?.dataDir || '../data',
      api: config?.api || {},
      mcp: config?.mcp || [],
      enabled: config?.enabled,
      disabled: config?.disabled || [],
    };
  }

  /**
   * Register a tool
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      console.warn(`Tool "${tool.name}" is already registered, replacing...`);
    }
    this.tools.set(tool.name, tool);
    console.log(`Registered tool: ${tool.name} (${tool.type})`);
  }

  /**
   * Register multiple tools
   */
  registerAll(tools: Tool[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Get a tool by name
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Check if a tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get all registered tools
   */
  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by type
   */
  getByType(type: ToolType): Tool[] {
    return this.getAll().filter(t => t.type === type);
  }

  /**
   * Get tool names
   */
  getNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Mark a plugin's tools as disabled/enabled at runtime.
   */
  setPluginDisabled(pluginId: string, disabled: boolean): void {
    if (disabled) {
      this.disabledPlugins.add(pluginId);
    } else {
      this.disabledPlugins.delete(pluginId);
    }
  }

  /**
   * Check if a tool belongs to a disabled plugin.
   */
  private isToolDisabledByPlugin(tool: Tool): boolean {
    if (tool.type === 'connection' && 'providerId' in tool) {
      return this.disabledPlugins.has((tool as ConnectionTool).providerId);
    }
    return false;
  }

  /**
   * Get enabled tools (respecting config and plugin status)
   */
  getEnabled(): Tool[] {
    const all = this.getAll();

    return all.filter(tool => {
      // Check if tool's plugin is disabled
      if (this.isToolDisabledByPlugin(tool)) {
        return false;
      }

      // Check if explicitly disabled
      if (this.config.disabled?.includes(tool.name)) {
        return false;
      }

      // If enabled list is specified, tool must be in it
      if (this.config.enabled && !this.config.enabled.includes(tool.name)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Get tools for a specific agent (by tool names)
   */
  getForAgent(toolNames: string[]): Tool[] {
    console.log(`[ToolRegistry.getForAgent] Looking up tools: ${toolNames.join(', ')}`);
    const result = toolNames
      .map(name => {
        const tool = this.tools.get(name);
        if (!tool) {
          console.log(`[ToolRegistry.getForAgent] Tool NOT FOUND: ${name}`);
        }
        return tool;
      })
      .filter((tool): tool is Tool => {
        if (!tool) return false;
        if (this.isToolDisabledByPlugin(tool)) {
          console.log(`[ToolRegistry.getForAgent] Tool DISABLED by plugin: ${tool.name}`);
          return false;
        }
        return true;
      });
    console.log(`[ToolRegistry.getForAgent] Found ${result.length}/${toolNames.length} tools`);
    return result;
  }

  /**
   * Get tool definitions for LLM (OpenAI format)
   */
  getDefinitions(toolNames?: string[]): ToolDefinition[] {
    const tools = toolNames
      ? this.getForAgent(toolNames)
      : this.getEnabled();

    return tools.map(t => t.getDefinition());
  }

  /**
   * Execute a tool call
   */
  async execute(call: ToolCall, context?: ToolContext): Promise<string> {
    const { name, arguments: argsString } = call.function;

    const tool = this.tools.get(name);
    if (!tool) {
      return `Error: Unknown tool "${name}". Available tools: ${this.getNames().join(', ')}`;
    }

    // Check if tool's plugin is disabled
    if (this.isToolDisabledByPlugin(tool)) {
      return `Error: Tool "${name}" is currently disabled`;
    }

    // Check if tool is available
    if (tool.isAvailable) {
      const available = await tool.isAvailable();
      if (!available) {
        return `Error: Tool "${name}" is not available or not configured properly`;
      }
    }

    // Parse arguments
    let args: Record<string, any>;
    try {
      args = JSON.parse(argsString || '{}');
    } catch (e) {
      return `Error: Invalid JSON in tool arguments: ${e}`;
    }

    // Execute tool
    try {
      return await tool.execute(args, context);
    } catch (error: any) {
      console.error(`Tool "${name}" execution error:`, error);
      return `Error executing tool "${name}": ${error.message}`;
    }
  }

  /**
   * Get configuration
   */
  getConfig(): ToolsConfig {
    return this.config;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ToolsConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get API config for a specific tool
   */
  getApiConfig(toolName: string): Record<string, any> | undefined {
    return this.config.api[toolName];
  }

  /**
   * Set API config for a tool
   */
  setApiConfig(toolName: string, config: Record<string, any>): void {
    this.config.api[toolName] = config;
  }

  /**
   * Get statistics about registered tools
   */
  getStats(): { total: number; byType: Record<ToolType, number> } {
    const tools = this.getAll();
    const byType: Record<string, number> = {};

    for (const tool of tools) {
      byType[tool.type] = (byType[tool.type] || 0) + 1;
    }

    return {
      total: tools.length,
      byType: byType as Record<ToolType, number>,
    };
  }

  /**
   * Clear all registered tools
   */
  clear(): void {
    this.tools.clear();
  }
}

// Singleton instance
export const toolRegistry = new ToolRegistry();

// Export class for testing or multiple instances
export { ToolRegistry };
