/**
 * Pipedrive Search Contacts Tool
 */

import type { ToolDefinition, ToolContext, ConnectionTool } from '@platform/sdk';
import { connectionRegistry } from '@platform/sdk';
import { getPipedriveApiUrl } from '../config';

interface Person {
  id: number;
  name: string;
  email: Array<{ value: string; primary: boolean }>;
  phone: Array<{ value: string; primary: boolean }>;
  org_name?: string;
  org_id?: number;
  owner_name?: string;
  add_time: string;
  update_time: string;
  open_deals_count: number;
  closed_deals_count: number;
}

export function createSearchContactsTool(providerId: string): ConnectionTool {
  return {
    name: 'pipedrive_search_contacts',
    type: 'connection',
    providerId,

    getDefinition(): ToolDefinition {
      return {
        type: 'function',
        function: {
          name: 'pipedrive_search_contacts',
          description: 'Search for contacts (persons) in Pipedrive CRM.',
          parameters: {
            type: 'object',
            properties: {
              term: {
                type: 'string',
                description: 'Search term to filter contacts by name, email, or phone',
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
      const { term, limit = 10 } = args;

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

        let url: string;
        let searchDescription: string;

        if (term) {
          // Use search endpoint
          const params = new URLSearchParams({
            term,
            item_types: 'person',
            limit: maxLimit.toString(),
          });
          url = `${apiUrl}/itemSearch?${params}`;
          searchDescription = `matching "${term}"`;
        } else {
          // List all persons
          const params = new URLSearchParams({
            limit: maxLimit.toString(),
            sort: 'update_time DESC',
          });
          url = `${apiUrl}/persons?${params}`;
          searchDescription = 'recent';
        }

        const response = await fetch(url, {
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

        const result = await response.json() as { success: boolean; error?: string; data?: any };
        if (!result.success) {
          return `Error: ${result.error || 'Search failed'}`;
        }

        // Handle different response formats
        let contacts: any[];
        if (term) {
          // Search endpoint returns items array
          contacts = (result.data?.items || []).map((item: any) => item.item);
        } else {
          contacts = result.data || [];
        }

        if (contacts.length === 0) {
          return term
            ? `No contacts found matching "${term}".`
            : 'No contacts found.';
        }

        let output = `Found ${contacts.length} ${searchDescription} contact(s):\n\n`;

        for (const person of contacts) {
          output += `### ${person.name}\n`;
          output += `- **ID**: ${person.id}\n`;

          // Handle email - can be array or single value
          const email = Array.isArray(person.email)
            ? person.email.find((e: any) => e.primary)?.value || person.email[0]?.value
            : person.email;
          if (email) output += `- **Email**: ${email}\n`;

          // Handle phone - can be array or single value
          const phone = Array.isArray(person.phone)
            ? person.phone.find((p: any) => p.primary)?.value || person.phone[0]?.value
            : person.phone;
          if (phone) output += `- **Phone**: ${phone}\n`;

          if (person.org_name || person.organization_name) {
            output += `- **Organization**: ${person.org_name || person.organization_name}\n`;
          }

          if (person.open_deals_count !== undefined) {
            output += `- **Open Deals**: ${person.open_deals_count}\n`;
          }

          output += '\n';
        }

        return output;
      } catch (error: any) {
        console.error('Pipedrive search contacts error:', error);
        return `Error searching Pipedrive contacts: ${error.message}`;
      }
    },

    async isAvailable(): Promise<boolean> {
      return connectionRegistry.has(providerId);
    },
  };
}
