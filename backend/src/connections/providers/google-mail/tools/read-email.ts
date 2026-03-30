/**
 * Gmail Read Email Tool
 */

import type { ToolContext } from '../../../../tools/types';
import type { ConnectionTool } from '../../../types';
import { connectionRegistry } from '../../../registry';
import { getMessageUrl } from '../config';

export function createReadEmailTool(providerId: string): ConnectionTool {
  return {
    type: 'connection',
    providerId,
    name: 'gmail_read_email',

    getDefinition() {
      return {
        type: 'function',
        function: {
          name: 'gmail_read_email',
          description: 'Read the full content of an email by its message ID. Returns headers and body text.',
          parameters: {
            type: 'object',
            properties: {
              message_id: {
                type: 'string',
                description: 'The Gmail message ID',
              },
              format: {
                type: 'string',
                enum: ['full', 'metadata'],
                description: 'Response format: "full" for complete email content, "metadata" for headers only (default: full)',
              },
            },
            required: ['message_id'],
          },
        },
      };
    },

    async execute(args: Record<string, any>, context?: ToolContext) {
      const { message_id, format = 'full' } = args;

      if (!message_id) {
        return 'Error: message_id is required';
      }

      if (!context?.userId) {
        return 'Error: User authentication required to use Gmail';
      }

      const tokens = await connectionRegistry.getTokens(context.userId, providerId);
      if (!tokens) {
        return 'Error: Not connected to Google Mail. Please connect first in the Connections page.';
      }

      try {
        const response = await fetch(`${getMessageUrl(message_id)}?format=${format}`, {
          headers: {
            Authorization: `${tokens.tokenType} ${tokens.accessToken}`,
          },
        });

        if (!response.ok) {
          const text = await response.text();
          if (response.status === 401 || response.status === 403) {
            return 'Error: Gmail access denied. Your token may have expired. Please reconnect.';
          }
          if (response.status === 404) {
            return `Error: Email with ID ${message_id} not found`;
          }
          throw new Error(`Failed to read email: ${response.status} - ${text}`);
        }

        const data = await response.json() as any;
        const headers = data.payload?.headers || [];
        const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

        // Extract body text
        let bodyText = '';
        if (format === 'full') {
          bodyText = extractBody(data.payload);
        }

        // Format output
        let output = `# ${getHeader('Subject') || '(No Subject)'}\n\n`;
        output += `**From**: ${getHeader('From')}\n`;
        output += `**To**: ${getHeader('To')}\n`;
        const cc = getHeader('Cc');
        if (cc) output += `**CC**: ${cc}\n`;
        output += `**Date**: ${getHeader('Date')}\n`;
        output += `**Labels**: ${(data.labelIds || []).join(', ')}\n\n`;
        output += `---\n\n`;

        if (bodyText) {
          // Limit to 50k characters
          if (bodyText.length > 50000) {
            bodyText = bodyText.slice(0, 50000) + '\n\n...[truncated]';
          }
          output += bodyText;
        } else if (data.snippet) {
          output += data.snippet;
        }

        return output;
      } catch (error: any) {
        return `Error reading email: ${error.message}`;
      }
    },

    async isAvailable(): Promise<boolean> {
      return connectionRegistry.has(providerId);
    },
  };
}

/**
 * Extract body text from MIME payload
 */
function extractBody(payload: any): string {
  if (!payload) return '';

  // Direct body data
  if (payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data);
    if (payload.mimeType === 'text/plain') {
      return decoded;
    }
    if (payload.mimeType === 'text/html') {
      return stripHtml(decoded);
    }
  }

  // Multipart - prefer text/plain
  if (payload.parts) {
    // First try text/plain
    const plainPart = payload.parts.find((p: any) => p.mimeType === 'text/plain');
    if (plainPart?.body?.data) {
      return decodeBase64Url(plainPart.body.data);
    }

    // Then try text/html
    const htmlPart = payload.parts.find((p: any) => p.mimeType === 'text/html');
    if (htmlPart?.body?.data) {
      return stripHtml(decodeBase64Url(htmlPart.body.data));
    }

    // Recurse into multipart parts
    for (const part of payload.parts) {
      if (part.parts) {
        const result = extractBody(part);
        if (result) return result;
      }
    }
  }

  return '';
}

/**
 * Decode base64url encoded string
 */
function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
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
    .replace(/&#39;/g, "'")
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}
