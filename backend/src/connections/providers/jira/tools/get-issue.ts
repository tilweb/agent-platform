/**
 * Jira Get Issue Tool
 */

import type { ToolDefinition, ToolContext } from '../../../../tools/types';
import type { ConnectionTool } from '../../../types';
import { connectionRegistry } from '../../../registry';
import { getJiraApiUrl } from '../config';

export function createGetIssueTool(providerId: string): ConnectionTool {
  return {
    name: 'jira_get_issue',
    type: 'connection',
    providerId,

    getDefinition(): ToolDefinition {
      return {
        type: 'function',
        function: {
          name: 'jira_get_issue',
          description: 'Get detailed information about a specific Jira issue by its key (e.g., "PROJ-123"). Includes description and optionally comments.',
          parameters: {
            type: 'object',
            properties: {
              issue_key: {
                type: 'string',
                description: 'The Jira issue key (e.g., "PROJ-123")',
              },
              include_comments: {
                type: 'boolean',
                description: 'Whether to include comments (default: true)',
              },
            },
            required: ['issue_key'],
          },
        },
      };
    },

    async execute(args: Record<string, any>, context?: ToolContext): Promise<string> {
      const { issue_key, include_comments = true } = args;

      if (!issue_key) {
        return 'Error: issue_key is required';
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
        const apiUrl = getJiraApiUrl(tokens.cloudId);

        const params = new URLSearchParams({
          expand: 'renderedFields',
        });

        const response = await fetch(`${apiUrl}/issue/${encodeURIComponent(issue_key)}?${params}`, {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          const text = await response.text();
          if (response.status === 404) {
            return `Issue ${issue_key} not found`;
          }
          if (response.status === 401 || response.status === 403) {
            return 'Error: Jira access denied. Your token may have expired. Please reconnect.';
          }
          return `Error: Jira API request failed: ${response.status} - ${text}`;
        }

        const issue = await response.json() as any;
        const fields = issue.fields;
        const rendered = issue.renderedFields || {};

        // Format output
        let output = `# ${issue.key}: ${fields.summary}\n\n`;
        output += `**Type**: ${fields.issuetype?.name || 'Unknown'}\n`;
        output += `**Status**: ${fields.status?.name || 'Unknown'}\n`;
        output += `**Priority**: ${fields.priority?.name || 'None'}\n`;
        output += `**Assignee**: ${fields.assignee?.displayName || 'Unassigned'}\n`;
        output += `**Reporter**: ${fields.reporter?.displayName || 'Unknown'}\n`;
        output += `**Created**: ${fields.created ? new Date(fields.created).toLocaleString() : 'Unknown'}\n`;
        output += `**Updated**: ${fields.updated ? new Date(fields.updated).toLocaleString() : 'Unknown'}\n`;

        if (fields.labels?.length > 0) {
          output += `**Labels**: ${fields.labels.join(', ')}\n`;
        }

        if (fields.components?.length > 0) {
          output += `**Components**: ${fields.components.map((c: any) => c.name).join(', ')}\n`;
        }

        output += `\n---\n\n`;

        // Description
        const description = rendered.description || fields.description;
        if (description) {
          output += `## Description\n\n`;
          output += stripHtml(typeof description === 'string' ? description : JSON.stringify(description));
          output += `\n\n`;
        }

        // Comments
        if (include_comments && fields.comment?.comments?.length > 0) {
          output += `## Comments (${fields.comment.comments.length})\n\n`;
          for (const comment of fields.comment.comments) {
            const renderedComment = comment.renderedBody || comment.body;
            output += `**${comment.author?.displayName || 'Unknown'}** (${new Date(comment.created).toLocaleString()}):\n`;
            output += stripHtml(typeof renderedComment === 'string' ? renderedComment : JSON.stringify(renderedComment));
            output += `\n\n`;
          }
        }

        return output;
      } catch (error: any) {
        console.error('Jira get issue error:', error);
        return `Error getting Jira issue: ${error.message}`;
      }
    },

    async isAvailable(): Promise<boolean> {
      return connectionRegistry.has(providerId);
    },
  };
}

/**
 * Strip HTML tags and convert to plain text
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<hr\s*\/?>/gi, '\n---\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}
