/**
 * Jira Create Issue Tool
 */

import type { ToolDefinition, ToolContext } from '../../../../tools/types';
import type { ConnectionTool } from '../../../types';
import { connectionRegistry } from '../../../registry';
import { getJiraApiUrl } from '../config';

export function createCreateIssueTool(providerId: string): ConnectionTool {
  return {
    name: 'jira_create_issue',
    type: 'connection',
    providerId,

    getDefinition(): ToolDefinition {
      return {
        type: 'function',
        function: {
          name: 'jira_create_issue',
          description: 'Create a new issue (Task, Bug, Story, etc.) in Jira. Requires project key and summary at minimum.',
          parameters: {
            type: 'object',
            properties: {
              project_key: {
                type: 'string',
                description: 'The project key (e.g., "PROJ")',
              },
              summary: {
                type: 'string',
                description: 'Issue title/summary',
              },
              issue_type: {
                type: 'string',
                description: 'Issue type: Task, Bug, Story, Epic, Sub-task (default: Task)',
              },
              description: {
                type: 'string',
                description: 'Issue description (plain text)',
              },
              priority: {
                type: 'string',
                description: 'Priority: Highest, High, Medium, Low, Lowest (optional)',
              },
              assignee_id: {
                type: 'string',
                description: 'Atlassian account ID of the assignee (optional)',
              },
              labels: {
                type: 'string',
                description: 'Comma-separated labels (optional, e.g., "backend,urgent")',
              },
              parent_key: {
                type: 'string',
                description: 'Parent issue key for Sub-tasks (e.g., "PROJ-100")',
              },
            },
            required: ['project_key', 'summary'],
          },
        },
      };
    },

    async execute(args: Record<string, any>, context?: ToolContext): Promise<string> {
      const {
        project_key,
        summary,
        issue_type = 'Task',
        description,
        priority,
        assignee_id,
        labels,
        parent_key,
      } = args;

      if (!project_key) {
        return 'Error: project_key is required';
      }

      if (!summary) {
        return 'Error: summary is required';
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

        // Build issue fields
        const fields: Record<string, any> = {
          project: { key: project_key },
          summary,
          issuetype: { name: issue_type },
        };

        // Description in Atlassian Document Format (ADF)
        if (description) {
          fields.description = {
            version: 1,
            type: 'doc',
            content: description.split('\n\n').map((paragraph: string) => ({
              type: 'paragraph',
              content: paragraph.split('\n').flatMap((line: string, i: number, arr: string[]) => {
                const nodes: any[] = [{ type: 'text', text: line }];
                if (i < arr.length - 1) {
                  nodes.push({ type: 'hardBreak' });
                }
                return nodes;
              }),
            })),
          };
        }

        if (priority) {
          fields.priority = { name: priority };
        }

        if (assignee_id) {
          fields.assignee = { id: assignee_id };
        }

        if (labels) {
          fields.labels = labels.split(',').map((l: string) => l.trim()).filter(Boolean);
        }

        if (parent_key) {
          fields.parent = { key: parent_key };
        }

        const response = await fetch(`${apiUrl}/issue`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fields }),
        });

        if (!response.ok) {
          const text = await response.text();
          console.error('[Jira create issue] Error:', response.status, text.substring(0, 500));

          if (response.status === 401 || response.status === 403) {
            return 'Error: Jira access denied. Your token may have expired or you lack write permissions. Please reconnect.';
          }

          // Try to parse error details
          try {
            const errorData = JSON.parse(text);
            const errors = errorData.errors || {};
            const errorMessages = errorData.errorMessages || [];
            const details = [
              ...errorMessages,
              ...Object.entries(errors).map(([k, v]) => `${k}: ${v}`),
            ].join('; ');
            return `Error creating issue: ${details || text}`;
          } catch {
            return `Error creating issue: ${response.status} - ${text}`;
          }
        }

        const created = await response.json() as { id: string; key: string; self: string };

        return `Issue created successfully!\n\n` +
          `- **Key**: ${created.key}\n` +
          `- **ID**: ${created.id}\n` +
          `- **Type**: ${issue_type}\n` +
          `- **Project**: ${project_key}\n` +
          `- **Summary**: ${summary}\n`;
      } catch (error: any) {
        console.error('Jira create issue error:', error);
        return `Error creating Jira issue: ${error.message}`;
      }
    },

    async isAvailable(): Promise<boolean> {
      return connectionRegistry.has(providerId);
    },
  };
}
