/**
 * Google Drive Read File Tool
 */

import type { ToolContext, ConnectionTool } from '@platform/sdk';
import { connectionRegistry } from '@platform/sdk';
import { getDriveFileUrl, getDriveExportUrl } from '../config';

export function createReadFileTool(providerId: string): ConnectionTool {
  return {
    type: 'connection',
    providerId,
    name: 'gdrive_read_file',

    getDefinition() {
      return {
        type: 'function',
        function: {
          name: 'gdrive_read_file',
          description: 'Read the content of a file from Google Drive. Supports Google Docs, text files, and other readable formats.',
          parameters: {
            type: 'object',
            properties: {
              file_id: {
                type: 'string',
                description: 'The ID of the file to read',
              },
            },
            required: ['file_id'],
          },
        },
      };
    },

    async execute(args: Record<string, any>, context?: ToolContext) {
      const { file_id } = args;

      if (!file_id) {
        return JSON.stringify({ error: 'file_id is required' });
      }

      if (!context?.userId) {
        return JSON.stringify({ error: 'User authentication required to use Google Drive' });
      }

      // Get tokens for the user
      const tokens = await connectionRegistry.getTokens(context.userId, providerId);
      if (!tokens) {
        return JSON.stringify({ error: 'Not connected to Google Drive. Please connect first in the Connections page.' });
      }

      try {
        const headers = {
          Authorization: `${tokens.tokenType} ${tokens.accessToken}`,
        };

        // First, get file metadata to determine type
        const metaResponse = await fetch(`${getDriveFileUrl(file_id)}?fields=id,name,mimeType,size`, {
          headers,
        });

        if (!metaResponse.ok) {
          const text = await metaResponse.text();
          if (metaResponse.status === 401 || metaResponse.status === 403) {
            return JSON.stringify({ error: 'Google Drive access denied. Your token may have expired. Please reconnect.' });
          }
          throw new Error(`Failed to get file metadata: ${metaResponse.status} - ${text}`);
        }

        const metadata = await metaResponse.json() as { id: string; name: string; mimeType: string; size?: string };
        const mimeType = metadata.mimeType;

        let content: string;

        // Google Docs/Sheets/Slides need to be exported
        if (mimeType === 'application/vnd.google-apps.document') {
          // Export as plain text
          const exportResponse = await fetch(`${getDriveExportUrl(file_id)}?mimeType=text/plain`, {
            headers,
          });
          if (!exportResponse.ok) {
            throw new Error(`Failed to export document: ${exportResponse.status}`);
          }
          content = await exportResponse.text();
        } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
          // Export as CSV
          const exportResponse = await fetch(`${getDriveExportUrl(file_id)}?mimeType=text/csv`, {
            headers,
          });
          if (!exportResponse.ok) {
            throw new Error(`Failed to export spreadsheet: ${exportResponse.status}`);
          }
          content = await exportResponse.text();
        } else if (mimeType === 'application/vnd.google-apps.presentation') {
          // Export as plain text
          const exportResponse = await fetch(`${getDriveExportUrl(file_id)}?mimeType=text/plain`, {
            headers,
          });
          if (!exportResponse.ok) {
            throw new Error(`Failed to export presentation: ${exportResponse.status}`);
          }
          content = await exportResponse.text();
        } else if (mimeType.startsWith('text/') || mimeType === 'application/json') {
          // Download directly for text files
          const downloadResponse = await fetch(`${getDriveFileUrl(file_id)}?alt=media`, {
            headers,
          });
          if (!downloadResponse.ok) {
            throw new Error(`Failed to download file: ${downloadResponse.status}`);
          }
          content = await downloadResponse.text();
        } else {
          return JSON.stringify({
            file: {
              id: metadata.id,
              name: metadata.name,
              type: mimeType,
              size: metadata.size,
            },
            error: `Cannot read content of file type: ${mimeType}. Use gdrive_list_files to find readable files.`,
          });
        }

        // Truncate very long content
        const maxLength = 50000;
        const truncated = content.length > maxLength;
        if (truncated) {
          content = content.substring(0, maxLength) + '\n\n[Content truncated...]';
        }

        return JSON.stringify({
          file: {
            id: metadata.id,
            name: metadata.name,
            type: mimeType,
          },
          content,
          truncated,
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
