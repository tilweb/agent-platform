/**
 * YouTrack Create Issue Tool
 */

import type { ToolDefinition, ToolContext } from '../../../../tools/types';
import type { ConnectionTool } from '../../../types';
import { connectionRegistry } from '../../../registry';
import { getYouTrackApiUrl } from '../config';

export function createCreateIssueTool(providerId: string): ConnectionTool {
  return {
    name: 'youtrack_create_issue',
    type: 'connection',
    providerId,

    getDefinition(): ToolDefinition {
      return {
        type: 'function',
        function: {
          name: 'youtrack_create_issue',
          description: 'Create a new issue in YouTrack. Requires project ID and summary at minimum.',
          parameters: {
            type: 'object',
            properties: {
              project_id: {
                type: 'string',
                description: 'The project short name / ID (e.g., "PROJ")',
              },
              summary: {
                type: 'string',
                description: 'Issue title/summary',
              },
              description: {
                type: 'string',
                description: 'Issue description (Markdown supported)',
              },
            },
            required: ['project_id', 'summary'],
          },
        },
      };
    },

    async execute(args: Record<string, any>, context?: ToolContext): Promise<string> {
      const { project_id, summary, description } = args;

      if (!project_id) {
        return 'Error: project_id is required';
      }

      if (!summary) {
        return 'Error: summary is required';
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

        const body: Record<string, any> = {
          project: { id: project_id },
          summary,
        };

        if (description) {
          body.description = description;
        }

        const fields = 'idReadable,summary,project(shortName,name)';
        const response = await fetch(`${apiUrl}/issues?fields=${encodeURIComponent(fields)}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const text = await response.text();
          console.error('[YouTrack create issue] Error:', response.status, text.substring(0, 500));

          if (response.status === 401 || response.status === 403) {
            return 'Error: YouTrack access denied. Your token may have expired or you lack write permissions. Please reconnect.';
          }
          return `Error creating issue: ${response.status} - ${text}`;
        }

        const created = await response.json() as any;

        return `Issue created successfully!\n\n` +
          `- **ID**: ${created.idReadable}\n` +
          `- **Project**: ${created.project?.name || project_id} (${created.project?.shortName || ''})\n` +
          `- **Summary**: ${summary}\n`;
      } catch (error: any) {
        console.error('YouTrack create issue error:', error);
        return `Error creating YouTrack issue: ${error.message}`;
      }
    },

    async isAvailable(): Promise<boolean> {
      return connectionRegistry.has(providerId);
    },
  };
}
