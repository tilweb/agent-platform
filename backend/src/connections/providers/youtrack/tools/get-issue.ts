/**
 * YouTrack Get Issue Tool
 */

import type { ToolDefinition, ToolContext } from '../../../../tools/types';
import type { ConnectionTool } from '../../../types';
import { connectionRegistry } from '../../../registry';
import { getYouTrackApiUrl } from '../config';

export function createGetIssueTool(providerId: string): ConnectionTool {
  return {
    name: 'youtrack_get_issue',
    type: 'connection',
    providerId,

    getDefinition(): ToolDefinition {
      return {
        type: 'function',
        function: {
          name: 'youtrack_get_issue',
          description: 'Get detailed information about a specific YouTrack issue by its ID (e.g., "PROJ-123"). Includes description and optionally comments.',
          parameters: {
            type: 'object',
            properties: {
              issue_id: {
                type: 'string',
                description: 'The YouTrack issue ID (e.g., "PROJ-123")',
              },
              include_comments: {
                type: 'boolean',
                description: 'Whether to include comments (default: true)',
              },
            },
            required: ['issue_id'],
          },
        },
      };
    },

    async execute(args: Record<string, any>, context?: ToolContext): Promise<string> {
      const { issue_id, include_comments = true } = args;

      if (!issue_id) {
        return 'Error: issue_id is required';
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

        let fields = 'idReadable,summary,description,resolved,created,updated,project(shortName,name),reporter(fullName),tags(name),customFields(name,value(name,fullName))';
        if (include_comments) {
          fields += ',comments(text,author(fullName),created)';
        }

        const response = await fetch(`${apiUrl}/issues/${encodeURIComponent(issue_id)}?fields=${encodeURIComponent(fields)}`, {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          const text = await response.text();
          if (response.status === 404) {
            return `Issue ${issue_id} not found`;
          }
          if (response.status === 401 || response.status === 403) {
            return 'Error: YouTrack access denied. Your token may have expired. Please reconnect.';
          }
          return `Error: YouTrack API request failed: ${response.status} - ${text}`;
        }

        const issue = await response.json() as any;

        const state = getCustomField(issue, 'State');
        const priority = getCustomField(issue, 'Priority');
        const type = getCustomField(issue, 'Type');
        const assignee = getCustomField(issue, 'Assignee');

        let output = `# ${issue.idReadable}: ${issue.summary}\n\n`;
        if (type) output += `**Type**: ${type}\n`;
        if (state) output += `**State**: ${state}\n`;
        if (priority) output += `**Priority**: ${priority}\n`;
        if (assignee) output += `**Assignee**: ${assignee}\n`;
        output += `**Project**: ${issue.project?.name || ''} (${issue.project?.shortName || ''})\n`;
        output += `**Reporter**: ${issue.reporter?.fullName || 'Unknown'}\n`;
        if (issue.created) output += `**Created**: ${new Date(issue.created).toLocaleString()}\n`;
        if (issue.updated) output += `**Updated**: ${new Date(issue.updated).toLocaleString()}\n`;

        if (issue.tags?.length > 0) {
          output += `**Tags**: ${issue.tags.map((t: any) => t.name).join(', ')}\n`;
        }

        output += `\n---\n\n`;

        // Description
        if (issue.description) {
          output += `## Description\n\n${issue.description}\n\n`;
        }

        // Comments
        if (include_comments && issue.comments?.length > 0) {
          output += `## Comments (${issue.comments.length})\n\n`;
          for (const comment of issue.comments) {
            output += `**${comment.author?.fullName || 'Unknown'}** (${new Date(comment.created).toLocaleString()}):\n`;
            output += `${comment.text || ''}\n\n`;
          }
        }

        return output;
      } catch (error: any) {
        console.error('YouTrack get issue error:', error);
        return `Error getting YouTrack issue: ${error.message}`;
      }
    },

    async isAvailable(): Promise<boolean> {
      return connectionRegistry.has(providerId);
    },
  };
}

function getCustomField(issue: any, fieldName: string): string | null {
  const field = issue.customFields?.find((f: any) => f.name === fieldName);
  if (!field || !field.value) return null;
  return field.value.name || field.value.fullName || String(field.value);
}
