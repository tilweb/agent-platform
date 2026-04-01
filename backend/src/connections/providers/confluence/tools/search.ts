/**
 * Confluence Search Tool
 */

import type { ToolDefinition, ToolContext } from '../../../../tools/types';
import type { ConnectionTool, TokenSet } from '../../../types';
import { connectionRegistry } from '../../../registry';
import { getConfluenceRestApiUrl } from '../config';

interface SearchResult {
  id: string;
  title: string;
  type: string;
  space: {
    key: string;
    name: string;
  };
  excerpt?: string;
  url: string;
  lastModified?: string;
}

interface CQLSearchResponse {
  results: Array<{
    content: {
      id: string;
      type: string;
      title: string;
      _links: {
        webui: string;
      };
      space?: {
        key: string;
        name: string;
      };
      history?: {
        lastUpdated?: {
          when: string;
        };
      };
    };
    excerpt?: string;
  }>;
  _links: {
    base: string;
  };
}

export function createSearchTool(providerId: string): ConnectionTool {
  return {
    name: 'confluence_search',
    type: 'connection',
    providerId,

    getDefinition(): ToolDefinition {
      return {
        type: 'function',
        function: {
          name: 'confluence_search',
          description: 'Search for content in Confluence. Returns pages and blog posts matching the query.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The search query text',
              },
              spaceKey: {
                type: 'string',
                description: 'Optional: Limit search to a specific space (e.g., "DOCS")',
              },
              limit: {
                type: 'string',
                description: 'Maximum number of results (default: 10, max: 50)',
              },
            },
            required: ['query'],
          },
        },
      };
    },

    async execute(args: Record<string, any>, context?: ToolContext): Promise<string> {
      const { query, spaceKey, limit = '10' } = args;

      if (!query) {
        return 'Error: Search query is required';
      }

      if (!context?.userId) {
        return 'Error: User authentication required to use Confluence';
      }

      // Get tokens for the user
      const tokens = await connectionRegistry.getTokens(context.userId, providerId);
      if (!tokens) {
        return 'Error: Not connected to Confluence. Please connect first in the Connections page.';
      }

      if (!tokens.cloudId) {
        return 'Error: Confluence cloud ID not available. Please reconnect.';
      }

      try {
        const maxLimit = Math.min(parseInt(limit, 10) || 10, 50);
        const apiUrl = getConfluenceRestApiUrl(tokens.cloudId);

        // CQL search via V1 REST API (V2 has no CQL search endpoint)
        // Search both title and body text for better results
        const escaped = query.replace(/"/g, '\\"');
        let cql = `type in (page, blogpost) AND (title ~ "${escaped}" OR text ~ "${escaped}")`;
        if (spaceKey) {
          cql += ` AND space.key = "${spaceKey}"`;
        }

        const params = new URLSearchParams({
          cql,
          limit: maxLimit.toString(),
        });

        const response = await fetch(`${apiUrl}/search?${params}`, {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          const text = await response.text();
          console.log('[Confluence search] Error:', response.status, text.substring(0, 300));
          if (response.status === 401 || response.status === 403) {
            return 'Error: Confluence access denied. Your token may have expired. Please reconnect.';
          }
          return `Error: Confluence API request failed: ${response.status} - ${text}`;
        }

        const data = await response.json() as any;

        if (!data.results || data.results.length === 0) {
          return `No results found for "${query}"${spaceKey ? ` in space ${spaceKey}` : ''}.`;
        }

        // Format results from V2 search response
        const results: SearchResult[] = data.results.map((r: any) => ({
          id: r.content?.id || r.id || '',
          title: r.content?.title || r.title || 'Untitled',
          type: r.content?.type || r.type || 'page',
          space: {
            key: r.content?.space?.key || r.space?.key || 'Unknown',
            name: r.content?.space?.name || r.space?.name || 'Unknown Space',
          },
          excerpt: (r.excerpt || '').replace(/<[^>]*>/g, '').slice(0, 200),
          url: r.url || r.content?._links?.webui || '',
          lastModified: r.lastModified || r.content?.history?.lastUpdated?.when,
        }));

        // Format output
        let output = `Found ${results.length} result(s) for "${query}":\n\n`;

        for (const result of results) {
          output += `### ${result.title}\n`;
          output += `- **Type**: ${result.type}\n`;
          output += `- **Space**: ${result.space.name} (${result.space.key})\n`;
          output += `- **ID**: ${result.id}\n`;
          if (result.lastModified) {
            output += `- **Last Modified**: ${new Date(result.lastModified).toLocaleDateString()}\n`;
          }
          if (result.excerpt) {
            output += `- **Excerpt**: ${result.excerpt}...\n`;
          }
          output += `- **URL**: ${result.url}\n\n`;
        }

        return output;
      } catch (error: any) {
        console.error('Confluence search error:', error);
        return `Error searching Confluence: ${error.message}`;
      }
    },

    async isAvailable(): Promise<boolean> {
      // Check if provider is registered
      return connectionRegistry.has(providerId);
    },
  };
}
