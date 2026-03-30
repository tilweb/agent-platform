/**
 * Gmail Search Emails Tool
 */

import type { ToolContext } from '../../../../tools/types';
import type { ConnectionTool } from '../../../types';
import { connectionRegistry } from '../../../registry';
import { getMessagesUrl, getMessageUrl } from '../config';

export function createSearchEmailsTool(providerId: string): ConnectionTool {
  return {
    type: 'connection',
    providerId,
    name: 'gmail_search_emails',

    getDefinition() {
      return {
        type: 'function',
        function: {
          name: 'gmail_search_emails',
          description: 'Search emails in Gmail using Gmail search syntax. Returns matching emails with subject, sender, date and snippet.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Gmail search query (e.g., "from:user@example.com", "subject:meeting", "is:unread", "after:2024/01/01")',
              },
              max_results: {
                type: 'number',
                description: 'Maximum number of emails to return (default: 10, max: 50)',
              },
            },
            required: ['query'],
          },
        },
      };
    },

    async execute(args: Record<string, any>, context?: ToolContext) {
      const { query, max_results = 10 } = args;

      if (!query) {
        return JSON.stringify({ error: 'Search query is required' });
      }

      if (!context?.userId) {
        return JSON.stringify({ error: 'User authentication required to use Gmail' });
      }

      const tokens = await connectionRegistry.getTokens(context.userId, providerId);
      if (!tokens) {
        return JSON.stringify({ error: 'Not connected to Google Mail. Please connect first in the Connections page.' });
      }

      try {
        const maxResults = Math.min(max_results, 50);
        const params = new URLSearchParams({
          q: query,
          maxResults: String(maxResults),
        });

        // Search for message IDs
        const listResponse = await fetch(`${getMessagesUrl()}?${params.toString()}`, {
          headers: {
            Authorization: `${tokens.tokenType} ${tokens.accessToken}`,
          },
        });

        if (!listResponse.ok) {
          const text = await listResponse.text();
          if (listResponse.status === 401 || listResponse.status === 403) {
            return JSON.stringify({ error: 'Gmail access denied. Your token may have expired. Please reconnect.' });
          }
          throw new Error(`Failed to search emails: ${listResponse.status} - ${text}`);
        }

        const listData = await listResponse.json() as { messages?: Array<{ id: string }>, resultSizeEstimate?: number };

        if (!listData.messages || listData.messages.length === 0) {
          return JSON.stringify({ emails: [], count: 0, message: `No emails found for query: ${query}` });
        }

        // Fetch metadata for each message
        const emails = await Promise.all(
          listData.messages.slice(0, maxResults).map(async (msg) => {
            try {
              const msgResponse = await fetch(`${getMessageUrl(msg.id)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`, {
                headers: {
                  Authorization: `${tokens.tokenType} ${tokens.accessToken}`,
                },
              });

              if (!msgResponse.ok) return null;

              const msgData = await msgResponse.json() as any;
              const headers = msgData.payload?.headers || [];
              const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

              return {
                id: msgData.id,
                threadId: msgData.threadId,
                subject: getHeader('Subject'),
                from: getHeader('From'),
                to: getHeader('To'),
                date: getHeader('Date'),
                snippet: msgData.snippet,
                labelIds: msgData.labelIds,
              };
            } catch {
              return null;
            }
          })
        );

        const validEmails = emails.filter(Boolean);

        return JSON.stringify({
          emails: validEmails,
          count: validEmails.length,
          totalEstimate: listData.resultSizeEstimate,
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
