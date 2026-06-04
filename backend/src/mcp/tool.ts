/**
 * MCP Tool Wrapper
 *
 * Wraps MCP server tools for use in the tool registry.
 */

import type { Tool, ToolDefinition, ToolParameters, ToolContext, ToolMetadata } from '../tools/types';
import type { McpToolInfo } from './types';
import { mcpClient } from './client';
import { mcpUserSessions, McpNotConnectedError } from './userSessions';

/**
 * Creates a unique tool name for an MCP tool
 */
export function getMcpToolName(serverId: string, toolName: string): string {
  return `mcp_${serverId}_${toolName}`;
}

/**
 * Sanitize MCP-Server-supplied descriptions before they land im LLM-Prompt.
 * Entfernt Control-Chars und kappt auf `maxLen` Zeichen.
 *
 * Default-Cap 8192: Tool-Beschreibungen mancher Server (z.B. Notions
 * `create-pages` mit dem vollstaendigen Notion-flavored-Markdown-Format)
 * sind laenger als 1k — bei zu aggressiver Kappung fehlt dem LLM das
 * Aufruf-Format und es raet (und scheitert). Server-Namen kappen separat auf 64.
 */
function sanitizeMcpDescription(input: string | undefined, maxLen = 8192): string {
  if (!input) return '';
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
    .slice(0, maxLen);
}

/**
 * Parses an MCP tool name to extract server ID and original tool name
 */
export function parseMcpToolName(name: string): { serverId: string; toolName: string } | null {
  const match = name.match(/^mcp_([^_]+)_(.+)$/);
  if (!match || !match[1] || !match[2]) return null;
  return {
    serverId: match[1],
    toolName: match[2],
  };
}

/**
 * Converts MCP input schema to tool parameters format
 */
function convertInputSchema(inputSchema: Record<string, any>): ToolParameters {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  if (inputSchema.properties) {
    for (const [name, prop] of Object.entries(inputSchema.properties)) {
      const p = prop as Record<string, any>;
      properties[name] = {
        type: p.type || 'string',
        description: p.description || '',
        ...(p.enum ? { enum: p.enum } : {}),
      };
    }
  }

  if (inputSchema.required && Array.isArray(inputSchema.required)) {
    required.push(...inputSchema.required);
  }

  return {
    type: 'object',
    properties,
    required,
  };
}

/**
 * Wrapper class for MCP tools
 */
export class McpToolWrapper implements Tool {
  readonly name: string;
  readonly type = 'mcp' as const;

  private toolInfo: McpToolInfo;
  private parameters: ToolParameters;

  constructor(toolInfo: McpToolInfo) {
    this.name = getMcpToolName(toolInfo.serverId, toolInfo.name);
    this.toolInfo = toolInfo;
    this.parameters = convertInputSchema(toolInfo.inputSchema);
  }

  getDefinition(): ToolDefinition {
    // MCP-Server-Descriptions kommen aus untrusted Quellen (lokaler/remote
    // MCP-Server kann boese Anweisungen einschmuggeln). Strip Control-Chars,
    // kappen auf 1024 Zeichen, plus Server-Name als sichtbarer Quellen-Tag.
    // Siehe security-review H1.
    const safeDesc = sanitizeMcpDescription(this.toolInfo.description);
    const safeServer = sanitizeMcpDescription(this.toolInfo.serverName).slice(0, 64);
    return {
      type: 'function',
      function: {
        name: this.name,
        description: `[MCP: ${safeServer}] ${safeDesc}`,
        parameters: this.parameters,
      },
    };
  }

  async execute(args: Record<string, any>, context?: ToolContext): Promise<string> {
    try {
      const result = await mcpClient.callTool(
        this.toolInfo.serverId,
        this.toolInfo.name,
        args
      );
      return result;
    } catch (err: any) {
      return `Error calling MCP tool: ${err.message}`;
    }
  }

  async isAvailable(): Promise<boolean> {
    const connection = mcpClient.getConnection(this.toolInfo.serverId);
    return connection?.status === 'connected';
  }

  getMetadata(): ToolMetadata {
    return {
      name: this.name,
      description: this.toolInfo.description,
      type: this.type,
      category: `mcp-${this.toolInfo.serverId}`,
    };
  }

  /**
   * Get the original MCP tool info
   */
  getMcpInfo(): McpToolInfo {
    return this.toolInfo;
  }
}

/**
 * Create tool wrappers for all tools from an MCP server
 */
export function createMcpToolWrappers(tools: McpToolInfo[]): McpToolWrapper[] {
  return tools.map(tool => new McpToolWrapper(tool));
}

/**
 * Wrapper fuer Tools eines OAuth-MCP-Servers (per-User).
 *
 * Im Gegensatz zu McpToolWrapper (globale Session) loest dieser Wrapper zur
 * Laufzeit den `context.userId` auf und ruft das Tool in der User-eigenen
 * MCP-Session auf (mit dem OAuth-Token dieses Users). Das Tool ist global in
 * der Registry sichtbar; ohne User-Verbindung liefert execute() einen klaren
 * Hinweis statt zu crashen — analog zum Connection-Tool-Muster.
 */
export class McpOAuthToolWrapper implements Tool {
  readonly name: string;
  readonly type = 'mcp' as const;

  private toolInfo: McpToolInfo;
  private parameters: ToolParameters;

  constructor(toolInfo: McpToolInfo) {
    this.name = getMcpToolName(toolInfo.serverId, toolInfo.name);
    this.toolInfo = toolInfo;
    this.parameters = convertInputSchema(toolInfo.inputSchema);
  }

  getDefinition(): ToolDefinition {
    const safeDesc = sanitizeMcpDescription(this.toolInfo.description);
    const safeServer = sanitizeMcpDescription(this.toolInfo.serverName).slice(0, 64);
    return {
      type: 'function',
      function: {
        name: this.name,
        description: `[MCP: ${safeServer}] ${safeDesc}`,
        parameters: this.parameters,
      },
    };
  }

  async execute(args: Record<string, any>, context?: ToolContext): Promise<string> {
    if (!context?.userId) {
      return `Dieses Tool benoetigt einen angemeldeten User (keine userId im Kontext).`;
    }
    try {
      return await mcpUserSessions.callTool(
        context.userId,
        this.toolInfo.serverId,
        this.toolInfo.name,
        args,
      );
    } catch (err: any) {
      if (err instanceof McpNotConnectedError) {
        return `Der MCP-Server "${this.toolInfo.serverName}" ist noch nicht verbunden. Bitte zuerst unter MCP-Server verbinden (OAuth-Login).`;
      }
      return `Error calling MCP tool: ${err.message}`;
    }
  }

  async isAvailable(): Promise<boolean> {
    // Verfuegbarkeit ist per-User und wird erst bei execute() final geprueft.
    return true;
  }

  getMetadata(): ToolMetadata {
    return {
      name: this.name,
      description: this.toolInfo.description,
      type: this.type,
      category: `mcp-${this.toolInfo.serverId}`,
    };
  }

  getMcpInfo(): McpToolInfo {
    return this.toolInfo;
  }
}

export function createMcpOAuthToolWrappers(tools: McpToolInfo[]): McpOAuthToolWrapper[] {
  return tools.map(tool => new McpOAuthToolWrapper(tool));
}
