/**
 * Confluence Read Page Tool
 */

import type { ToolDefinition, ToolContext } from '../../../../tools/types';
import type { ConnectionTool } from '../../../types';
import { connectionRegistry } from '../../../registry';
import { getConfluenceApiUrl, getConfluenceRestApiUrl } from '../config';

interface PageContent {
  id: string;
  title: string;
  status: string;
  body: {
    storage?: {
      value: string;
    };
    view?: {
      value: string;
    };
  };
  version: {
    number: number;
    createdAt: string;
  };
  _links: {
    webui: string;
  };
}

export function createReadPageTool(providerId: string): ConnectionTool {
  return {
    name: 'confluence_read_page',
    type: 'connection',
    providerId,

    getDefinition(): ToolDefinition {
      return {
        type: 'function',
        function: {
          name: 'confluence_read_page',
          description: 'Read a Confluence page content. Can look up by page ID or by title and space key.',
          parameters: {
            type: 'object',
            properties: {
              pageId: {
                type: 'string',
                description: 'The page ID (if known)',
              },
              title: {
                type: 'string',
                description: 'The page title (used with spaceKey)',
              },
              spaceKey: {
                type: 'string',
                description: 'The space key (required when using title)',
              },
            },
            required: [],
          },
        },
      };
    },

    async execute(args: Record<string, any>, context?: ToolContext): Promise<string> {
      const { pageId, title, spaceKey } = args;

      if (!pageId && !title) {
        return 'Error: Either pageId or title (with spaceKey) is required';
      }

      if (title && !spaceKey) {
        return 'Error: spaceKey is required when looking up by title';
      }

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
        let resolvedPageId = pageId;

        // If using title, first search for the page
        if (!resolvedPageId && title && spaceKey) {
          const restApiUrl = getConfluenceRestApiUrl(tokens.cloudId);
          const searchParams = new URLSearchParams({
            cql: `title = "${title.replace(/"/g, '\\"')}" AND space.key = "${spaceKey}"`,
            limit: '1',
          });

          const searchResponse = await fetch(`${restApiUrl}/search?${searchParams}`, {
            headers: {
              Authorization: `Bearer ${tokens.accessToken}`,
              Accept: 'application/json',
            },
          });

          if (!searchResponse.ok) {
            const text = await searchResponse.text();
            return `Error searching for page: ${searchResponse.status} - ${text}`;
          }

          const searchData = await searchResponse.json() as { results?: Array<{ content: { id: string } }> };

          if (!searchData.results || searchData.results.length === 0) {
            return `Page "${title}" not found in space ${spaceKey}`;
          }

          resolvedPageId = searchData.results[0]?.content.id;
        }

        // Fetch the page content via V2 API
        const apiUrl = getConfluenceApiUrl(tokens.cloudId);
        const response = await fetch(`${apiUrl}/pages/${resolvedPageId}?body-format=storage`, {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          const text = await response.text();
          if (response.status === 404) {
            return `Page with ID ${resolvedPageId} not found`;
          }
          if (response.status === 401 || response.status === 403) {
            return 'Error: Access denied. Your token may have expired or you lack permission to view this page.';
          }
          return `Error fetching page: ${response.status} - ${text}`;
        }

        const page = await response.json() as PageContent;

        // Convert storage format to readable text
        let content = page.body?.storage?.value || page.body?.view?.value || '';

        // Simple HTML to text conversion
        content = content
          // Replace common block elements with newlines
          .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<hr\s*\/?>/gi, '\n---\n')
          // Remove remaining tags
          .replace(/<[^>]*>/g, '')
          // Decode HTML entities
          .replace(/&nbsp;/g, ' ')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          // Clean up whitespace
          .replace(/\n\s*\n\s*\n/g, '\n\n')
          .trim();

        // Format output
        let output = `# ${page.title}\n\n`;
        output += `**ID**: ${page.id}\n`;
        output += `**Version**: ${page.version.number}\n`;
        output += `**Last Updated**: ${new Date(page.version.createdAt).toLocaleString()}\n`;
        output += `**Status**: ${page.status}\n\n`;
        output += `---\n\n`;
        output += content;

        return output;
      } catch (error: any) {
        console.error('Confluence read page error:', error);
        return `Error reading Confluence page: ${error.message}`;
      }
    },

    async isAvailable(): Promise<boolean> {
      return connectionRegistry.has(providerId);
    },
  };
}
