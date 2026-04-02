/**
 * Gmail Get Attachment Tool
 *
 * Downloads an email attachment and converts it to readable text
 * using the Markitdown API (supports PDF, DOCX, etc.).
 * Requires gmail.modify or gmail.readonly scope.
 */

import type { ToolDefinition, ToolContext } from '../../../../tools/types';
import type { ConnectionTool } from '../../../types';
import { connectionRegistry } from '../../../registry';
import { GMAIL_API_BASE } from '../config';

/** MIME types that can be converted to text */
const CONVERTIBLE_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/html',
  'text/csv',
]);

function decodeBase64Url(data: string): Uint8Array {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function createGetAttachmentTool(providerId: string): ConnectionTool {
  return {
    name: 'gmail_get_attachment',
    type: 'connection',
    providerId,

    getDefinition(): ToolDefinition {
      return {
        type: 'function',
        function: {
          name: 'gmail_get_attachment',
          description: 'Download and read an email attachment (PDF, DOCX, etc.). First use gmail_read_email to find the attachment details, then use this tool with the message_id. Returns the attachment content as readable text.',
          parameters: {
            type: 'object',
            properties: {
              message_id: {
                type: 'string',
                description: 'The Gmail message ID containing the attachment',
              },
              attachment_index: {
                type: 'number',
                description: 'Index of the attachment to read (0-based, default: 0 for first attachment)',
              },
            },
            required: ['message_id'],
          },
        },
      };
    },

    async execute(args: Record<string, any>, context?: ToolContext): Promise<string> {
      const { message_id, attachment_index = 0 } = args;

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
        // Step 1: Get message with full payload to find attachments
        const msgResponse = await fetch(`${GMAIL_API_BASE}/messages/${message_id}?format=full`, {
          headers: {
            Authorization: `${tokens.tokenType} ${tokens.accessToken}`,
          },
        });

        if (!msgResponse.ok) {
          const text = await msgResponse.text();
          if (msgResponse.status === 401 || msgResponse.status === 403) {
            return 'Error: Gmail access denied. Your token may have expired. Please reconnect.';
          }
          return `Error: Failed to get message: ${msgResponse.status} - ${text}`;
        }

        const message = await msgResponse.json() as any;

        // Step 2: Find attachments in MIME parts
        const attachments: Array<{ filename: string; mimeType: string; attachmentId: string; size: number }> = [];
        findAttachments(message.payload, attachments);

        if (attachments.length === 0) {
          return 'No attachments found in this email.';
        }

        if (attachment_index >= attachments.length) {
          const list = attachments.map((a, i) => `  ${i}: ${a.filename} (${a.mimeType}, ${Math.round(a.size / 1024)}KB)`).join('\n');
          return `Attachment index ${attachment_index} out of range. Available attachments:\n${list}`;
        }

        const attachment = attachments[attachment_index];

        // Step 3: Download attachment data
        const attResponse = await fetch(
          `${GMAIL_API_BASE}/messages/${message_id}/attachments/${attachment.attachmentId}`,
          {
            headers: {
              Authorization: `${tokens.tokenType} ${tokens.accessToken}`,
            },
          }
        );

        if (!attResponse.ok) {
          return `Error: Failed to download attachment: ${attResponse.status}`;
        }

        const attData = await attResponse.json() as { data: string; size: number };
        const fileBytes = decodeBase64Url(attData.data);

        // Step 4: Convert to text
        let textContent: string;

        if (attachment.mimeType === 'text/plain' || attachment.mimeType === 'text/csv') {
          textContent = new TextDecoder().decode(fileBytes);
        } else if (CONVERTIBLE_TYPES.has(attachment.mimeType)) {
          // Use Markitdown API for PDF, DOCX, etc.
          textContent = await convertViaMarkitdown(fileBytes, attachment.filename, attachment.mimeType);
        } else {
          return `Attachment "${attachment.filename}" has type ${attachment.mimeType} which cannot be converted to text. Supported: PDF, DOCX, DOC, XLSX, TXT, CSV.`;
        }

        // Limit output size
        const maxChars = 50000;
        if (textContent.length > maxChars) {
          textContent = textContent.substring(0, maxChars) + '\n\n[... truncated at 50,000 characters]';
        }

        let output = `## Attachment: ${attachment.filename}\n`;
        output += `Type: ${attachment.mimeType} | Size: ${Math.round(attData.size / 1024)}KB\n\n`;

        if (attachments.length > 1) {
          const others = attachments
            .filter((_, i) => i !== attachment_index)
            .map((a, i) => `  ${i >= attachment_index ? i + 1 : i}: ${a.filename} (${a.mimeType})`)
            .join('\n');
          output += `Other attachments:\n${others}\n\n`;
        }

        output += textContent;
        return output;
      } catch (error: any) {
        console.error('Gmail get attachment error:', error);
        return `Error reading attachment: ${error.message}`;
      }
    },

    async isAvailable(): Promise<boolean> {
      return connectionRegistry.has(providerId);
    },
  };
}

/**
 * Recursively find attachments in MIME parts
 */
function findAttachments(
  part: any,
  results: Array<{ filename: string; mimeType: string; attachmentId: string; size: number }>
) {
  if (part.body?.attachmentId && part.filename) {
    results.push({
      filename: part.filename,
      mimeType: part.mimeType || 'application/octet-stream',
      attachmentId: part.body.attachmentId,
      size: part.body.size || 0,
    });
  }

  if (part.parts) {
    for (const child of part.parts) {
      findAttachments(child, results);
    }
  }
}

/**
 * Convert document bytes to text via Markitdown API
 */
async function convertViaMarkitdown(
  fileBytes: Uint8Array,
  filename: string,
  mimeType: string
): Promise<string> {
  const markitdownUrl = process.env.MARKITDOWN_API_URL || 'https://api.adacor.ai/v1/documentMarkdown/';
  const apiKey = process.env.ADACOR_AI_API_KEY || '';

  const blob = new Blob([fileBytes], { type: mimeType });
  const formData = new FormData();
  formData.append('document', blob, filename);

  const response = await fetch(markitdownUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Markitdown conversion failed: ${response.status} - ${error}`);
  }

  // Markitdown API may return JSON or plain text depending on version
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const result = await response.json() as { markdown?: string; text?: string; content?: string };
    return result.markdown || result.text || result.content || '';
  }
  // Plain text response
  return await response.text();
}
