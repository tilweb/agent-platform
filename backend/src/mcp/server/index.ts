#!/usr/bin/env bun
/**
 * KI-Workplace MCP Server
 *
 * Exposes the KI-Workplace tools via the Model Context Protocol.
 * Can be used as an MCP server for Claude Desktop, Cursor, and other MCP clients.
 *
 * Usage:
 *   bun run src/mcp/server/index.ts
 *
 * In Claude Desktop config:
 *   {
 *     "mcpServers": {
 *       "adacor-workplace": {
 *         "command": "bun",
 *         "args": ["run", "/path/to/backend/src/mcp/server/index.ts"]
 *       }
 *     }
 *   }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { toolRegistry, setupTools } from '../../tools';

const SERVER_NAME = 'adacor-workplace';
const SERVER_VERSION = '1.0.0';

/**
 * Initialize the MCP server
 */
async function initializeServer(): Promise<Server> {
  // Set up tools in the registry
  await setupTools();

  // Create the MCP server
  const server = new Server(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle tools/list request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = toolRegistry.getEnabled();

    return {
      tools: tools.map((tool) => {
        const def = tool.getDefinition();
        return {
          name: def.function.name,
          description: def.function.description || '',
          inputSchema: def.function.parameters,
        };
      }),
    };
  });

  // Handle tools/call request
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const tool = toolRegistry.get(name);
    if (!tool) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: Unknown tool "${name}". Available tools: ${toolRegistry.getNames().join(', ')}`,
          },
        ],
        isError: true,
      };
    }

    try {
      // Check if tool is available
      if (tool.isAvailable) {
        const available = await tool.isAvailable();
        if (!available) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: Tool "${name}" is not available or not configured properly`,
              },
            ],
            isError: true,
          };
        }
      }

      // Execute the tool
      const result = await tool.execute(args || {});

      return {
        content: [
          {
            type: 'text',
            text: result,
          },
        ],
      };
    } catch (error: any) {
      console.error(`Tool "${name}" execution error:`, error);
      return {
        content: [
          {
            type: 'text',
            text: `Error executing tool "${name}": ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

/**
 * Main entry point
 */
async function main() {
  try {
    const server = await initializeServer();

    // Connect via stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);

    // Log to stderr (stdout is reserved for MCP protocol)
    console.error(`[${SERVER_NAME}] MCP server started`);
    console.error(`[${SERVER_NAME}] Tools available: ${toolRegistry.getNames().join(', ')}`);
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

// Run the server
main();
