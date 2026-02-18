/**
 * Pipedrive Search Activities Tool
 */

import type { ToolDefinition, ToolContext } from '../../../../tools/types';
import type { ConnectionTool } from '../../../types';
import { connectionRegistry } from '../../../registry';
import { getPipedriveApiUrl } from '../config';

interface Activity {
  id: number;
  type: string;
  subject: string;
  due_date: string;
  due_time?: string;
  done: boolean;
  person_name?: string;
  org_name?: string;
  deal_title?: string;
  owner_name: string;
  add_time: string;
  update_time: string;
  note?: string;
}

export function createSearchActivitiesTool(providerId: string): ConnectionTool {
  return {
    name: 'pipedrive_search_activities',
    type: 'connection',
    providerId,

    getDefinition(): ToolDefinition {
      return {
        type: 'function',
        function: {
          name: 'pipedrive_search_activities',
          description: 'Search for activities (tasks, calls, meetings) in Pipedrive CRM.',
          parameters: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                description: 'Filter by activity type (e.g., "call", "meeting", "task", "email")',
              },
              done: {
                type: 'boolean',
                description: 'Filter by completion status (true = completed, false = pending)',
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
      const { type, done, limit = 10 } = args;

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
          limit: maxLimit.toString(),
          sort: 'due_date DESC',
        });

        if (type) {
          params.set('type', type);
        }

        if (done !== undefined) {
          params.set('done', done ? '1' : '0');
        }

        const response = await fetch(`${apiUrl}/activities?${params}`, {
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
          return `Error: ${result.error || 'Failed to fetch activities'}`;
        }

        const activities: Activity[] = (result.data || []) as Activity[];
        if (activities.length === 0) {
          let filterDesc = [];
          if (type) filterDesc.push(`type "${type}"`);
          if (done !== undefined) filterDesc.push(done ? 'completed' : 'pending');
          return filterDesc.length > 0
            ? `No activities found with ${filterDesc.join(' and ')}.`
            : 'No activities found.';
        }

        let filterDesc = [];
        if (type) filterDesc.push(`type "${type}"`);
        if (done !== undefined) filterDesc.push(done ? 'completed' : 'pending');

        let output = `Found ${activities.length} ${filterDesc.length > 0 ? filterDesc.join(', ') + ' ' : ''}activit${activities.length === 1 ? 'y' : 'ies'}:\n\n`;

        for (const activity of activities) {
          const statusIcon = activity.done ? '✅' : '⏳';
          output += `### ${statusIcon} ${activity.subject}\n`;
          output += `- **ID**: ${activity.id}\n`;
          output += `- **Type**: ${activity.type}\n`;
          output += `- **Status**: ${activity.done ? 'Completed' : 'Pending'}\n`;
          output += `- **Due**: ${activity.due_date}${activity.due_time ? ' ' + activity.due_time : ''}\n`;

          if (activity.person_name) output += `- **Contact**: ${activity.person_name}\n`;
          if (activity.org_name) output += `- **Organization**: ${activity.org_name}\n`;
          if (activity.deal_title) output += `- **Deal**: ${activity.deal_title}\n`;
          if (activity.note) output += `- **Note**: ${activity.note.slice(0, 200)}${activity.note.length > 200 ? '...' : ''}\n`;

          output += '\n';
        }

        return output;
      } catch (error: any) {
        console.error('Pipedrive search activities error:', error);
        return `Error searching Pipedrive activities: ${error.message}`;
      }
    },

    async isAvailable(): Promise<boolean> {
      return connectionRegistry.has(providerId);
    },
  };
}
