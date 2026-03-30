/**
 * Jira List Projects Tool
 */

import type { ToolDefinition, ToolContext } from '../../../../tools/types';
import type { ConnectionTool } from '../../../types';
import { connectionRegistry } from '../../../registry';
import { getJiraApiUrl } from '../config';

export function createListProjectsTool(providerId: string): ConnectionTool {
  return {
    name: 'jira_list_projects',
    type: 'connection',
    providerId,

    getDefinition(): ToolDefinition {
      return {
        type: 'function',
        function: {
          name: 'jira_list_projects',
          description: 'List all accessible Jira projects. Returns project key, name, type and lead.',
          parameters: {
            type: 'object',
            properties: {
              max_results: {
                type: 'number',
                description: 'Maximum number of projects to return (default: 50, max: 100)',
              },
            },
            required: [],
          },
        },
      };
    },

    async execute(args: Record<string, any>, context?: ToolContext): Promise<string> {
      const { max_results = 50 } = args;

      if (!context?.userId) {
        return 'Error: User authentication required to use Jira';
      }

      const tokens = await connectionRegistry.getTokens(context.userId, providerId);
      if (!tokens) {
        return 'Error: Not connected to Jira. Please connect first in the Connections page.';
      }

      if (!tokens.cloudId) {
        return 'Error: Jira cloud ID not available. Please reconnect.';
      }

      try {
        const apiUrl = getJiraApiUrl(tokens.cloudId);
        const maxResults = Math.min(max_results, 100);

        const params = new URLSearchParams({
          maxResults: maxResults.toString(),
          orderBy: 'name',
          expand: 'lead',
        });

        const response = await fetch(`${apiUrl}/project/search?${params}`, {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          const text = await response.text();
          if (response.status === 401 || response.status === 403) {
            return 'Error: Jira access denied. Your token may have expired. Please reconnect.';
          }
          return `Error: Jira API request failed: ${response.status} - ${text}`;
        }

        const data = await response.json() as { values?: any[], total?: number };

        if (!data.values || data.values.length === 0) {
          return 'No projects found.';
        }

        let output = `Found ${data.values.length} project(s) (total: ${data.total}):\n\n`;

        for (const project of data.values) {
          output += `### ${project.name}\n`;
          output += `- **Key**: ${project.key}\n`;
          output += `- **Type**: ${project.projectTypeKey || 'Unknown'}\n`;
          output += `- **Style**: ${project.style || 'Unknown'}\n`;
          if (project.lead) {
            output += `- **Lead**: ${project.lead.displayName}\n`;
          }
          output += `- **ID**: ${project.id}\n\n`;
        }

        return output;
      } catch (error: any) {
        console.error('Jira list projects error:', error);
        return `Error listing Jira projects: ${error.message}`;
      }
    },

    async isAvailable(): Promise<boolean> {
      return connectionRegistry.has(providerId);
    },
  };
}
