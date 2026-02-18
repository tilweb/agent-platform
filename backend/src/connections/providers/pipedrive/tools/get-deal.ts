/**
 * Pipedrive Get Deal Tool
 */

import type { ToolDefinition, ToolContext } from '../../../../tools/types';
import type { ConnectionTool } from '../../../types';
import { connectionRegistry } from '../../../registry';
import { getPipedriveApiUrl } from '../config';

export function createGetDealTool(providerId: string): ConnectionTool {
  return {
    name: 'pipedrive_get_deal',
    type: 'connection',
    providerId,

    getDefinition(): ToolDefinition {
      return {
        type: 'function',
        function: {
          name: 'pipedrive_get_deal',
          description: 'Get detailed information about a specific deal in Pipedrive CRM, including activities and participants.',
          parameters: {
            type: 'object',
            properties: {
              deal_id: {
                type: 'number',
                description: 'The ID of the deal to retrieve',
              },
            },
            required: ['deal_id'],
          },
        },
      };
    },

    async execute(args: Record<string, any>, context?: ToolContext): Promise<string> {
      const { deal_id } = args;

      if (!deal_id) {
        return 'Error: deal_id is required';
      }

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

        // Fetch deal details
        const response = await fetch(`${apiUrl}/deals/${deal_id}`, {
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
          if (response.status === 404) {
            return `Error: Deal with ID ${deal_id} not found.`;
          }
          return `Error: Pipedrive API request failed: ${response.status} - ${text}`;
        }

        const result = await response.json() as { success: boolean; error?: string; data?: any };
        if (!result.success) {
          return `Error: ${result.error || 'Failed to fetch deal'}`;
        }

        const deal = result.data;
        if (!deal) {
          return `Error: Deal with ID ${deal_id} not found.`;
        }

        // Build detailed output
        let output = `## Deal: ${deal.title}\n\n`;

        output += `### Basic Information\n`;
        output += `- **ID**: ${deal.id}\n`;
        output += `- **Value**: ${deal.value || 0} ${deal.currency || ''}\n`;
        output += `- **Status**: ${deal.status}\n`;
        output += `- **Stage**: ${deal.stage_id} (Pipeline: ${deal.pipeline_id})\n`;

        if (deal.expected_close_date) {
          output += `- **Expected Close Date**: ${deal.expected_close_date}\n`;
        }

        if (deal.probability !== undefined && deal.probability !== null) {
          output += `- **Probability**: ${deal.probability}%\n`;
        }

        output += '\n### Associations\n';

        if (deal.person_name) {
          output += `- **Contact**: ${deal.person_name}`;
          if (deal.person_id) output += ` (ID: ${deal.person_id})`;
          output += '\n';
        }

        if (deal.org_name) {
          output += `- **Organization**: ${deal.org_name}`;
          if (deal.org_id) output += ` (ID: ${deal.org_id})`;
          output += '\n';
        }

        if (deal.owner_name) {
          output += `- **Owner**: ${deal.owner_name}\n`;
        }

        output += '\n### Timeline\n';
        output += `- **Created**: ${new Date(deal.add_time).toLocaleString()}\n`;
        output += `- **Last Updated**: ${new Date(deal.update_time).toLocaleString()}\n`;

        if (deal.won_time) {
          output += `- **Won**: ${new Date(deal.won_time).toLocaleString()}\n`;
        }

        if (deal.lost_time) {
          output += `- **Lost**: ${new Date(deal.lost_time).toLocaleString()}\n`;
          if (deal.lost_reason) {
            output += `- **Lost Reason**: ${deal.lost_reason}\n`;
          }
        }

        // Fetch activities for this deal
        try {
          const activitiesResponse = await fetch(`${apiUrl}/deals/${deal_id}/activities?limit=5`, {
            headers: {
              Authorization: `Bearer ${tokens.accessToken}`,
              Accept: 'application/json',
            },
          });

          if (activitiesResponse.ok) {
            const activitiesResult = await activitiesResponse.json() as { data?: any[] };
            const activities = activitiesResult.data || [];

            if (activities.length > 0) {
              output += '\n### Recent Activities\n';
              for (const activity of activities) {
                const statusIcon = activity.done ? '✅' : '⏳';
                output += `- ${statusIcon} **${activity.type}**: ${activity.subject} (Due: ${activity.due_date})\n`;
              }
            }
          }
        } catch {
          // Ignore activity fetch errors
        }

        return output;
      } catch (error: any) {
        console.error('Pipedrive get deal error:', error);
        return `Error fetching Pipedrive deal: ${error.message}`;
      }
    },

    async isAvailable(): Promise<boolean> {
      return connectionRegistry.has(providerId);
    },
  };
}
