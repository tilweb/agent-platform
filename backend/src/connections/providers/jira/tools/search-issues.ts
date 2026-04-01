/**
 * Jira Search Issues Tool
 */

import type { ToolDefinition, ToolContext } from '../../../../tools/types';
import type { ConnectionTool } from '../../../types';
import { connectionRegistry } from '../../../registry';
import { getJiraApiUrl } from '../config';

export function createSearchIssuesTool(providerId: string): ConnectionTool {
  return {
    name: 'jira_search_issues',
    type: 'connection',
    providerId,

    getDefinition(): ToolDefinition {
      return {
        type: 'function',
        function: {
          name: 'jira_search_issues',
          description: 'Search for issues in Jira using JQL (Jira Query Language). Returns matching issues with key, summary, status, assignee and priority.',
          parameters: {
            type: 'object',
            properties: {
              jql: {
                type: 'string',
                description: 'JQL query string (e.g., "project = PROJ AND status = Open", "assignee = currentUser()", "text ~ search term")',
              },
              max_results: {
                type: 'number',
                description: 'Maximum number of results (default: 10, max: 50)',
              },
            },
            required: ['jql'],
          },
        },
      };
    },

    async execute(args: Record<string, any>, context?: ToolContext): Promise<string> {
      const { jql, max_results = 10 } = args;

      if (!jql) {
        return 'Error: JQL query is required';
      }

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
        const maxResults = Math.min(max_results, 50);
        const apiUrl = getJiraApiUrl(tokens.cloudId);

        const params = new URLSearchParams({
          jql,
          maxResults: String(maxResults),
          fields: 'summary,status,assignee,priority,issuetype,created,updated',
        });

        const response = await fetch(`${apiUrl}/search/jql?${params}`, {
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

        const data = await response.json() as { issues?: any[], total?: number };

        if (!data.issues || data.issues.length === 0) {
          return `No issues found for JQL: ${jql}`;
        }

        let output = `Found ${data.issues.length} issue(s) (total: ${data.total}):\n\n`;

        for (const issue of data.issues) {
          const fields = issue.fields;
          output += `### ${issue.key}: ${fields.summary}\n`;
          output += `- **Type**: ${fields.issuetype?.name || 'Unknown'}\n`;
          output += `- **Status**: ${fields.status?.name || 'Unknown'}\n`;
          output += `- **Priority**: ${fields.priority?.name || 'None'}\n`;
          output += `- **Assignee**: ${fields.assignee?.displayName || 'Unassigned'}\n`;
          output += `- **Created**: ${fields.created ? new Date(fields.created).toLocaleDateString() : 'Unknown'}\n`;
          output += `- **Updated**: ${fields.updated ? new Date(fields.updated).toLocaleDateString() : 'Unknown'}\n\n`;
        }

        return output;
      } catch (error: any) {
        console.error('Jira search error:', error);
        return `Error searching Jira: ${error.message}`;
      }
    },

    async isAvailable(): Promise<boolean> {
      return connectionRegistry.has(providerId);
    },
  };
}
