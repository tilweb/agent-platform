/**
 * YouTrack Search Issues Tool
 */

import type { ToolDefinition, ToolContext } from '../../../../tools/types';
import type { ConnectionTool } from '../../../types';
import { connectionRegistry } from '../../../registry';
import { getYouTrackApiUrl } from '../config';

export function createSearchIssuesTool(providerId: string): ConnectionTool {
  return {
    name: 'youtrack_search_issues',
    type: 'connection',
    providerId,

    getDefinition(): ToolDefinition {
      return {
        type: 'function',
        function: {
          name: 'youtrack_search_issues',
          description: 'Search for issues in YouTrack using query syntax. Examples: "project: PROJ", "for: me State: Open", "summary: bug fix", "#Unresolved assigned to: me".',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'YouTrack search query (e.g., "project: PROJ State: Open")',
              },
              max_results: {
                type: 'number',
                description: 'Maximum number of results (default: 10, max: 50)',
              },
            },
            required: ['query'],
          },
        },
      };
    },

    async execute(args: Record<string, any>, context?: ToolContext): Promise<string> {
      const { query, max_results = 10 } = args;

      if (!query) {
        return 'Error: Search query is required';
      }

      if (!context?.userId) {
        return 'Error: User authentication required to use YouTrack';
      }

      const tokens = await connectionRegistry.getTokens(context.userId, providerId);
      if (!tokens) {
        return 'Error: Not connected to YouTrack. Please connect first in the Connections page.';
      }

      try {
        const apiUrl = getYouTrackApiUrl();
        const maxResults = Math.min(max_results, 50);

        const fields = 'idReadable,summary,resolved,created,updated,project(shortName,name),reporter(fullName),customFields(name,value(name,fullName))';
        const params = new URLSearchParams({
          query,
          fields,
          $top: String(maxResults),
        });

        const response = await fetch(`${apiUrl}/issues?${params}`, {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          const text = await response.text();
          console.log('[YouTrack search] Error:', response.status, text.substring(0, 300));
          if (response.status === 401 || response.status === 403) {
            return 'Error: YouTrack access denied. Your token may have expired. Please reconnect.';
          }
          return `Error: YouTrack API request failed: ${response.status} - ${text}`;
        }

        const issues = await response.json() as any[];

        if (!issues || issues.length === 0) {
          return `No issues found for query: ${query}`;
        }

        let output = `Found ${issues.length} issue(s) for "${query}":\n\n`;

        for (const issue of issues) {
          const state = getCustomField(issue, 'State');
          const priority = getCustomField(issue, 'Priority');
          const type = getCustomField(issue, 'Type');
          const assignee = getCustomField(issue, 'Assignee');

          output += `### ${issue.idReadable}: ${issue.summary}\n`;
          if (type) output += `- **Type**: ${type}\n`;
          if (state) output += `- **State**: ${state}\n`;
          if (priority) output += `- **Priority**: ${priority}\n`;
          if (assignee) output += `- **Assignee**: ${assignee}\n`;
          output += `- **Project**: ${issue.project?.name || ''} (${issue.project?.shortName || ''})\n`;
          if (issue.created) {
            output += `- **Created**: ${new Date(issue.created).toLocaleDateString()}\n`;
          }
          if (issue.updated) {
            output += `- **Updated**: ${new Date(issue.updated).toLocaleDateString()}\n`;
          }
          output += `\n`;
        }

        return output;
      } catch (error: any) {
        console.error('YouTrack search error:', error);
        return `Error searching YouTrack: ${error.message}`;
      }
    },

    async isAvailable(): Promise<boolean> {
      return connectionRegistry.has(providerId);
    },
  };
}

/**
 * Extract a custom field value by name from a YouTrack issue
 */
function getCustomField(issue: any, fieldName: string): string | null {
  const field = issue.customFields?.find((f: any) => f.name === fieldName);
  if (!field || !field.value) return null;
  return field.value.name || field.value.fullName || String(field.value);
}
