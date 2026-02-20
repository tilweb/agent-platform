/**
 * Pipedrive Search Deals Tool
 */

import type { ToolDefinition, ToolContext, ConnectionTool, TokenSet } from '@platform/sdk';
import { connectionRegistry } from '@platform/sdk';
import { getPipedriveApiUrl } from '../config';

interface Deal {
  id: number;
  title: string;
  value: number;
  currency: string;
  status: string;
  stage_id: number;
  pipeline_id: number;
  person_name?: string;
  org_name?: string;
  expected_close_date?: string;
  add_time: string;
  update_time: string;
  won_time?: string;
  lost_time?: string;
}

export function createSearchDealsTool(providerId: string): ConnectionTool {
  return {
    name: 'pipedrive_search_deals',
    type: 'connection',
    providerId,

    getDefinition(): ToolDefinition {
      return {
        type: 'function',
        function: {
          name: 'pipedrive_search_deals',
          description: 'Search for deals in Pipedrive CRM. Can filter by status and search term.',
          parameters: {
            type: 'object',
            properties: {
              term: {
                type: 'string',
                description: 'Search term to filter deals by title',
              },
              status: {
                type: 'string',
                enum: ['open', 'won', 'lost', 'all_not_deleted'],
                description: 'Filter by deal status (default: open)',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results (default: 10, max: 50)',
              },
            },
            required: [],
          },
        },
      };
    },

    async execute(args: Record<string, any>, context?: ToolContext): Promise<string> {
      const { term, status = 'open', limit = 10 } = args;

      if (!context?.userId) {
        return 'Error: User authentication required to use Pipedrive';
      }

      const tokens = await connectionRegistry.getTokens(context.userId, providerId);
      if (!tokens) {
        return 'Error: Not connected to Pipedrive. Please connect first in the Connections page.';
      }

      if (!tokens.apiDomain) {
        return 'Error: Pipedrive API domain not available. Please reconnect.';
      }

      try {
        const apiUrl = getPipedriveApiUrl(tokens.apiDomain);
        const maxLimit = Math.min(limit, 50);

        const params = new URLSearchParams({
          status,
          limit: maxLimit.toString(),
          sort: 'update_time DESC',
        });

        if (term) {
          params.set('filter_id', ''); // Clear any filter
          // Use search endpoint for term-based search
          const searchParams = new URLSearchParams({
            term,
            item_types: 'deal',
            limit: maxLimit.toString(),
          });

          const searchResponse = await fetch(`${apiUrl}/itemSearch?${searchParams}`, {
            headers: {
              Authorization: `Bearer ${tokens.accessToken}`,
              Accept: 'application/json',
            },
          });

          if (!searchResponse.ok) {
            const text = await searchResponse.text();
            if (searchResponse.status === 401 || searchResponse.status === 403) {
              return 'Error: Pipedrive access denied. Your token may have expired. Please reconnect.';
            }
            return `Error: Pipedrive API request failed: ${searchResponse.status} - ${text}`;
          }

          const searchResult = await searchResponse.json() as { success: boolean; error?: string; data?: { items?: any[] } };
          if (!searchResult.success) {
            return `Error: ${searchResult.error || 'Search failed'}`;
          }

          const items = searchResult.data?.items || [];
          if (items.length === 0) {
            return `No deals found matching "${term}".`;
          }

          let output = `Found ${items.length} deal(s) matching "${term}":\n\n`;

          for (const item of items) {
            const deal = item.item;
            output += `### ${deal.title}\n`;
            output += `- **ID**: ${deal.id}\n`;
            output += `- **Value**: ${deal.value || 0} ${deal.currency || ''}\n`;
            output += `- **Status**: ${deal.status || 'unknown'}\n`;
            if (deal.person_name) output += `- **Contact**: ${deal.person_name}\n`;
            if (deal.organization_name) output += `- **Organization**: ${deal.organization_name}\n`;
            output += '\n';
          }

          return output;
        }

        // List deals with status filter
        const response = await fetch(`${apiUrl}/deals?${params}`, {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          const text = await response.text();
          if (response.status === 401 || response.status === 403) {
            return 'Error: Pipedrive access denied. Your token may have expired. Please reconnect.';
          }
          return `Error: Pipedrive API request failed: ${response.status} - ${text}`;
        }

        const result = await response.json() as { success: boolean; error?: string; data?: any[] };
        if (!result.success) {
          return `Error: ${result.error || 'Failed to fetch deals'}`;
        }

        const deals: Deal[] = (result.data || []) as Deal[];
        if (deals.length === 0) {
          return `No ${status} deals found.`;
        }

        let output = `Found ${deals.length} ${status} deal(s):\n\n`;

        for (const deal of deals) {
          output += `### ${deal.title}\n`;
          output += `- **ID**: ${deal.id}\n`;
          output += `- **Value**: ${deal.value || 0} ${deal.currency || ''}\n`;
          output += `- **Status**: ${deal.status}\n`;
          if (deal.person_name) output += `- **Contact**: ${deal.person_name}\n`;
          if (deal.org_name) output += `- **Organization**: ${deal.org_name}\n`;
          if (deal.expected_close_date) output += `- **Expected Close**: ${deal.expected_close_date}\n`;
          output += `- **Updated**: ${new Date(deal.update_time).toLocaleDateString()}\n`;
          output += '\n';
        }

        return output;
      } catch (error: any) {
        console.error('Pipedrive search deals error:', error);
        return `Error searching Pipedrive deals: ${error.message}`;
      }
    },

    async isAvailable(): Promise<boolean> {
      return connectionRegistry.has(providerId);
    },
  };
}
