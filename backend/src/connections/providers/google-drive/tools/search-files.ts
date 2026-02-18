/**
 * Google Drive Search Files Tool
 */

import type { ToolContext } from '../../../../tools/types';
import type { ConnectionTool } from '../../../types';
import { connectionRegistry } from '../../../registry';
import { getDriveFilesUrl } from '../config';

export function createSearchFilesTool(providerId: string): ConnectionTool {
  return {
    type: 'connection',
    providerId,
    name: 'gdrive_search',

    getDefinition() {
      return {
        type: 'function',
        function: {
          name: 'gdrive_search',
          description: 'Search for files in Google Drive by name or content.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query. Searches in file names and content.',
              },
              page_size: {
                type: 'number',
                description: 'Maximum number of results (default: 10, max: 50)',
              },
            },
            required: ['query'],
          },
        },
      };
    },

    async execute(args: Record<string, any>, context?: ToolContext) {
      const { query, page_size = 10 } = args;

      if (!query) {
        return JSON.stringify({ error: 'query is required' });
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
        const params = new URLSearchParams({
          pageSize: String(Math.min(page_size, 50)),
          fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink)',
          q: `fullText contains '${query.replace(/'/g, "\\'")}' and trashed = false`,
        });

        const response = await fetch(`${getDriveFilesUrl()}?${params.toString()}`, {
          headers: {
            Authorization: `${tokens.tokenType} ${tokens.accessToken}`,
          },
        });

        if (!response.ok) {
          const text = await response.text();
          if (response.status === 401 || response.status === 403) {
            return JSON.stringify({ error: 'Google Drive access denied. Your token may have expired. Please reconnect.' });
          }
          throw new Error(`Search failed: ${response.status} - ${text}`);
        }

        const data = await response.json() as { files?: any[] };

        const results = (data.files || []).map((file: any) => ({
          id: file.id,
          name: file.name,
          type: file.mimeType,
          size: file.size ? `${Math.round(parseInt(file.size) / 1024)} KB` : undefined,
          modified: file.modifiedTime,
          link: file.webViewLink,
        }));

        return JSON.stringify({
          query,
          results,
          count: results.length,
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
