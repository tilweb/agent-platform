/**
 * Confluence List Spaces Tool
 */

import type { ToolDefinition, ToolContext } from '../../../../tools/types';
import type { ConnectionTool } from '../../../types';
import { connectionRegistry } from '../../../registry';
import { getConfluenceApiUrl } from '../config';

interface Space {
  id: string;
  key: string;
  name: string;
  type: string;
  status: string;
  description?: {
    plain?: {
      value: string;
    };
  };
  _links: {
    webui: string;
  };
}

interface SpacesResponse {
  results: Space[];
  _links: {
    base: string;
    next?: string;
  };
}

export function createListSpacesTool(providerId: string): ConnectionTool {
  return {
    name: 'confluence_list_spaces',
    type: 'connection',
    providerId,

    getDefinition(): ToolDefinition {
      return {
        type: 'function',
        function: {
          name: 'confluence_list_spaces',
          description: 'List available Confluence spaces. Use this to discover what spaces exist and their keys.',
          parameters: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                description: 'Filter by space type: "global" or "personal"',
                enum: ['global', 'personal'],
              },
              limit: {
                type: 'string',
                description: 'Maximum number of spaces to return (default: 25, max: 100)',
              },
            },
            required: [],
          },
        },
      };
    },

    async execute(args: Record<string, any>, context?: ToolContext): Promise<string> {
      const { type, limit = '25' } = args;

      if (!context?.userId) {
        return 'Error: User authentication required to use Confluence';
      }

      const tokens = await connectionRegistry.getTokens(context.userId, providerId);
      if (!tokens) {
        return 'Error: Not connected to Confluence. Please connect first in the Connections page.';
      }

      if (!tokens.cloudId) {
        return 'Error: Confluence cloud ID not available. Please reconnect.';
      }

      try {
        const apiUrl = getConfluenceApiUrl(tokens.cloudId);
        const maxLimit = Math.min(parseInt(limit, 10) || 25, 100);

        const params = new URLSearchParams({
          limit: maxLimit.toString(),
        });

        if (type === 'global') {
          params.set('type', 'global');
        } else if (type === 'personal') {
          params.set('type', 'personal');
        }

        const response = await fetch(`${apiUrl}/spaces?${params}`, {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          const text = await response.text();
          if (response.status === 401 || response.status === 403) {
            return 'Error: Confluence access denied. Your token may have expired. Please reconnect.';
          }
          return `Error: Confluence API request failed: ${response.status} - ${text}`;
        }

        const data = await response.json() as SpacesResponse;

        if (!data.results || data.results.length === 0) {
          return type
            ? `No ${type} spaces found.`
            : 'No spaces found.';
        }

        // Format output
        let output = `Found ${data.results.length} space(s)`;
        if (type) {
          output += ` (type: ${type})`;
        }
        output += ':\n\n';

        for (const space of data.results) {
          output += `### ${space.name}\n`;
          output += `- **Key**: ${space.key}\n`;
          output += `- **Type**: ${space.type}\n`;
          output += `- **Status**: ${space.status}\n`;
          output += `- **ID**: ${space.id}\n`;
          if (space.description?.plain?.value) {
            const desc = space.description.plain.value.slice(0, 150);
            output += `- **Description**: ${desc}${desc.length >= 150 ? '...' : ''}\n`;
          }
          output += `- **URL**: ${data._links.base}${space._links.webui}\n\n`;
        }

        if (data._links.next) {
          output += `_More spaces available. Increase limit to see more._\n`;
        }

        return output;
      } catch (error: any) {
        console.error('Confluence list spaces error:', error);
        return `Error listing Confluence spaces: ${error.message}`;
      }
    },

    async isAvailable(): Promise<boolean> {
      return connectionRegistry.has(providerId);
    },
  };
}
