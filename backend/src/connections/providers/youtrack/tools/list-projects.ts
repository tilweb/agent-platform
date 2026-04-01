/**
 * YouTrack List Projects Tool
 */

import type { ToolDefinition, ToolContext } from '../../../../tools/types';
import type { ConnectionTool } from '../../../types';
import { connectionRegistry } from '../../../registry';
import { getYouTrackApiUrl } from '../config';

export function createListProjectsTool(providerId: string): ConnectionTool {
  return {
    name: 'youtrack_list_projects',
    type: 'connection',
    providerId,

    getDefinition(): ToolDefinition {
      return {
        type: 'function',
        function: {
          name: 'youtrack_list_projects',
          description: 'List all accessible projects in YouTrack with their short names and descriptions.',
          parameters: {
            type: 'object',
            properties: {
              max_results: {
                type: 'number',
                description: 'Maximum number of projects (default: 50, max: 100)',
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
        return 'Error: User authentication required to use YouTrack';
      }

      const tokens = await connectionRegistry.getTokens(context.userId, providerId);
      if (!tokens) {
        return 'Error: Not connected to YouTrack. Please connect first in the Connections page.';
      }

      try {
        const apiUrl = getYouTrackApiUrl();
        const maxResults = Math.min(max_results, 100);

        const fields = 'id,shortName,name,description,archived,leader(fullName)';
        const params = new URLSearchParams({
          fields,
          $top: String(maxResults),
        });

        const response = await fetch(`${apiUrl}/admin/projects?${params}`, {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          const text = await response.text();
          if (response.status === 401 || response.status === 403) {
            return 'Error: YouTrack access denied. Your token may have expired. Please reconnect.';
          }
          return `Error: YouTrack API request failed: ${response.status} - ${text}`;
        }

        const projects = await response.json() as any[];

        if (!projects || projects.length === 0) {
          return 'No projects found.';
        }

        // Filter out archived by default
        const activeProjects = projects.filter(p => !p.archived);

        let output = `Found ${activeProjects.length} project(s):\n\n`;

        for (const project of activeProjects) {
          output += `### ${project.name} (${project.shortName})\n`;
          output += `- **ID**: ${project.id}\n`;
          if (project.leader?.fullName) {
            output += `- **Lead**: ${project.leader.fullName}\n`;
          }
          if (project.description) {
            output += `- **Description**: ${project.description.slice(0, 200)}\n`;
          }
          output += `\n`;
        }

        return output;
      } catch (error: any) {
        console.error('YouTrack list projects error:', error);
        return `Error listing YouTrack projects: ${error.message}`;
      }
    },

    async isAvailable(): Promise<boolean> {
      return connectionRegistry.has(providerId);
    },
  };
}
