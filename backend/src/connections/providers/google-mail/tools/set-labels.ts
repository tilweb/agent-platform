/**
 * Gmail Set Labels Tool
 *
 * Add or remove labels on Gmail messages.
 * Requires gmail.modify scope.
 */

import type { ToolDefinition, ToolContext } from '../../../../tools/types';
import type { ConnectionTool } from '../../../types';
import { connectionRegistry } from '../../../registry';
import { getMessageUrl } from '../config';

export function createSetLabelsTool(providerId: string): ConnectionTool {
  return {
    name: 'gmail_set_labels',
    type: 'connection',
    providerId,

    getDefinition(): ToolDefinition {
      return {
        type: 'function',
        function: {
          name: 'gmail_set_labels',
          description: 'Add or remove labels (tags) on a Gmail message. Use gmail_list_labels to get available label IDs first.',
          parameters: {
            type: 'object',
            properties: {
              message_id: {
                type: 'string',
                description: 'The ID of the Gmail message to modify',
              },
              add_labels: {
                type: 'array',
                items: { type: 'string', description: 'Label-ID' },
                description: 'Label IDs to add to the message (e.g., ["STARRED", "IMPORTANT", "Label_123"])',
              },
              remove_labels: {
                type: 'array',
                items: { type: 'string', description: 'Label-ID' },
                description: 'Label IDs to remove from the message (e.g., ["UNREAD", "INBOX"])',
              },
            },
            required: ['message_id'],
          },
        },
      };
    },

    async execute(args: Record<string, any>, context?: ToolContext): Promise<string> {
      const { message_id, add_labels = [], remove_labels = [] } = args;

      if (!message_id) {
        return 'Error: message_id is required';
      }

      if (add_labels.length === 0 && remove_labels.length === 0) {
        return 'Error: At least one of add_labels or remove_labels must be provided';
      }

      if (!context?.userId) {
        return 'Error: User authentication required to use Gmail';
      }

      const tokens = await connectionRegistry.getTokens(context.userId, providerId);
      if (!tokens) {
        return 'Error: Not connected to Google Mail. Please connect first in the Connections page.';
      }

      try {
        const url = `${getMessageUrl(message_id)}/modify`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `${tokens.tokenType} ${tokens.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            addLabelIds: add_labels,
            removeLabelIds: remove_labels,
          }),
        });

        if (!response.ok) {
          const text = await response.text();
          if (response.status === 401 || response.status === 403) {
            return 'Error: Gmail access denied. Your token may have expired. Please reconnect.';
          }
          if (response.status === 404) {
            return `Error: Message not found: ${message_id}`;
          }
          return `Error: Gmail API request failed: ${response.status} - ${text}`;
        }

        const data = await response.json() as { id: string; labelIds?: string[] };

        let output = `Labels updated for message ${data.id}.\n`;
        if (add_labels.length > 0) {
          output += `Added: ${add_labels.join(', ')}\n`;
        }
        if (remove_labels.length > 0) {
          output += `Removed: ${remove_labels.join(', ')}\n`;
        }
        output += `Current labels: ${(data.labelIds || []).join(', ')}`;

        return output;
      } catch (error: any) {
        console.error('Gmail set labels error:', error);
        return `Error setting labels: ${error.message}`;
      }
    },

    async isAvailable(): Promise<boolean> {
      return connectionRegistry.has(providerId);
    },
  };
}
