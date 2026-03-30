/**
 * Gmail List Labels Tool
 */

import type { ToolContext } from '../../../../tools/types';
import type { ConnectionTool } from '../../../types';
import { connectionRegistry } from '../../../registry';
import { getLabelsUrl } from '../config';

export function createListLabelsTool(providerId: string): ConnectionTool {
  return {
    type: 'connection',
    providerId,
    name: 'gmail_list_labels',

    getDefinition() {
      return {
        type: 'function',
        function: {
          name: 'gmail_list_labels',
          description: 'List all labels in the Gmail account. Labels are like folders and categories for emails.',
          parameters: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      };
    },

    async execute(_args: Record<string, any>, context?: ToolContext) {
      if (!context?.userId) {
        return JSON.stringify({ error: 'User authentication required to use Gmail' });
      }

      const tokens = await connectionRegistry.getTokens(context.userId, providerId);
      if (!tokens) {
        return JSON.stringify({ error: 'Not connected to Google Mail. Please connect first in the Connections page.' });
      }

      try {
        const response = await fetch(getLabelsUrl(), {
          headers: {
            Authorization: `${tokens.tokenType} ${tokens.accessToken}`,
          },
        });

        if (!response.ok) {
          const text = await response.text();
          if (response.status === 401 || response.status === 403) {
            return JSON.stringify({ error: 'Gmail access denied. Your token may have expired. Please reconnect.' });
          }
          throw new Error(`Failed to list labels: ${response.status} - ${text}`);
        }

        const data = await response.json() as { labels?: any[] };

        const labels = (data.labels || []).map((label: any) => ({
          id: label.id,
          name: label.name,
          type: label.type,
          messagesTotal: label.messagesTotal,
          messagesUnread: label.messagesUnread,
        }));

        return JSON.stringify({
          labels,
          count: labels.length,
        });
      } catch (error: any) {
        return JSON.stringify({ error: error.message });
      }
    },

    async isAvailable(): Promise<boolean> {
      return connectionRegistry.has(providerId);
    },
  };
}
