/**
 * Tool Types and Interfaces
 */

export interface ToolParameter {
  type: string;
  description: string;
  enum?: string[];
  additionalProperties?: boolean | ToolParameter;
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
  required?: string[];
}

export interface ToolParameters {
  type: 'object';
  properties: Record<string, ToolParameter>;
  required: string[];
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: ToolParameters;
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

export type ToolType = 'local' | 'api' | 'mcp' | 'delegation' | 'connection';

export interface ToolMetadata {
  name: string;
  description: string;
  type: ToolType;
  category?: string;
  version?: string;
  author?: string;
}

/**
 * Base interface for all tools
 */
export interface Tool {
  /** Unique tool name */
  readonly name: string;

  /** Tool type (local, api, mcp, delegation) */
  readonly type: ToolType;

  /** Get the tool definition for LLM */
  getDefinition(): ToolDefinition;

  /** Execute the tool with parsed arguments */
  execute(args: Record<string, any>, context?: ToolContext): Promise<string>;

  /** Optional: Check if tool is available/configured */
  isAvailable?(): Promise<boolean>;

  /** Optional: Get tool metadata */
  getMetadata?(): ToolMetadata;
}

/**
 * Context passed to tool execution
 */
export interface ToolContext {
  sessionId?: string;
  agentId?: string;
  delegationDepth?: number;
  userId?: string;
  /** Original session ID for finding attachments during delegation */
  parentSessionId?: string;
}

/**
 * Configuration for API-based tools
 */
export interface ApiToolConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  headers?: Record<string, string>;
}

/**
 * Configuration for MCP tools
 */
export interface McpServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
}

/**
 * Global tools configuration
 */
export interface ToolsConfig {
  // Data directory for local file tools
  dataDir: string;

  // API configurations by tool name
  api: Record<string, ApiToolConfig>;

  // MCP server configurations
  mcp: McpServerConfig[];

  // Enabled tools (if not specified, all are enabled)
  enabled?: string[];

  // Disabled tools
  disabled?: string[];
}
