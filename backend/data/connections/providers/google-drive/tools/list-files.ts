/**
 * Google Drive List Files Tool
 */

import type { ToolContext, ConnectionTool } from '@platform/sdk';
import { connectionRegistry } from '@platform/sdk';
import { getDriveFilesUrl } from '../config';

export function createListFilesTool(providerId: string): ConnectionTool {
  return {
    type: 'connection',
    providerId,
    name: 'gdrive_list_files',

    getDefinition() {
      return {
        type: 'function',
        function: {
          name: 'gdrive_list_files',
          description: 'List files and folders in Google Drive. Can filter by folder or file type.',
          parameters: {
            type: 'object',
            properties: {
              folder_id: {
                type: 'string',
                description: 'Folder ID to list files from. Use "root" for the root folder. Omit to list all files.',
              },
              page_size: {
                type: 'number',
                description: 'Maximum number of files to return (default: 20, max: 100)',
              },
              file_type: {
                type: 'string',
                enum: ['all', 'documents', 'spreadsheets', 'presentations', 'pdfs', 'images', 'folders'],
                description: 'Filter by file type',
              },
            },
            required: [],
          },
        },
      };
    },

    async execute(args: Record<string, any>, context?: ToolContext) {
      const { folder_id, page_size = 20, file_type = 'all' } = args;

      console.log(`[gdrive_list_files] context.userId: ${context?.userId}, providerId: ${providerId}`);

      if (!context?.userId) {
        return JSON.stringify({ error: 'User authentication required to use Google Drive' });
      }

      // Get tokens for the user
      const tokens = await connectionRegistry.getTokens(context.userId, providerId);
      console.log(`[gdrive_list_files] tokens found: ${!!tokens}`);
      if (!tokens) {
        return JSON.stringify({ error: 'Not connected to Google Drive. Please connect first in the Connections page.' });
      }

      try {
        const params = new URLSearchParams({
          pageSize: String(Math.min(page_size, 100)),
          fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink,parents)',
        });

        // Build query
        const queryParts: string[] = ['trashed = false'];

        if (folder_id) {
          queryParts.push(`'${folder_id}' in parents`);
        }

        // File type filter
        const mimeTypeFilters: Record<string, string[]> = {
          documents: ['application/vnd.google-apps.document', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
          spreadsheets: ['application/vnd.google-apps.spreadsheet', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
          presentations: ['application/vnd.google-apps.presentation', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
          pdfs: ['application/pdf'],
          images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
          folders: ['application/vnd.google-apps.folder'],
        };

        if (file_type !== 'all' && mimeTypeFilters[file_type]) {
          const mimeTypes = mimeTypeFilters[file_type].map(m => `mimeType = '${m}'`).join(' or ');
          queryParts.push(`(${mimeTypes})`);
        }

        params.set('q', queryParts.join(' and '));

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
          throw new Error(`Failed to list files: ${response.status} - ${text}`);
        }

        const data = await response.json() as { files?: any[] };

        const files = (data.files || []).map((file: any) => ({
          id: file.id,
          name: file.name,
          type: file.mimeType,
          size: file.size ? `${Math.round(parseInt(file.size) / 1024)} KB` : undefined,
          modified: file.modifiedTime,
          link: file.webViewLink,
        }));

        return JSON.stringify({
          files,
          count: files.length,
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
