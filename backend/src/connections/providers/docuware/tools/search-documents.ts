/**
 * Docuware Search Documents Tool
 */

import type { ToolDefinition, ToolContext } from '../../../../tools/types';
import type { ConnectionTool } from '../../../types';
import { connectionRegistry } from '../../../registry';
import { getDocumentsUrl } from '../config';

export function createSearchDocumentsTool(providerId: string): ConnectionTool {
  return {
    name: 'docuware_search_documents',
    type: 'connection',
    providerId,

    getDefinition(): ToolDefinition {
      return {
        type: 'function',
        function: {
          name: 'docuware_search_documents',
          description: 'Search for documents in a Docuware file cabinet. Use list_cabinets first to get available cabinet IDs.',
          parameters: {
            type: 'object',
            properties: {
              cabinet_id: {
                type: 'string',
                description: 'The file cabinet ID to search in',
              },
              query: {
                type: 'string',
                description: 'Fulltext search query',
              },
              max_results: {
                type: 'number',
                description: 'Maximum number of results (default: 20, max: 100)',
              },
            },
            required: ['cabinet_id', 'query'],
          },
        },
      };
    },

    async execute(args: Record<string, any>, context?: ToolContext): Promise<string> {
      const { cabinet_id, query, max_results = 20 } = args;

      if (!cabinet_id || !query) {
        return 'Error: cabinet_id and query are required';
      }

      if (!context?.userId) {
        return 'Error: User authentication required to use Docuware';
      }

      const tokens = await connectionRegistry.getTokens(context.userId, providerId);
      if (!tokens) {
        return 'Error: Not connected to Docuware. Please connect first in the Connections page.';
      }

      try {
        const maxResults = Math.min(max_results, 100);
        const documentsUrl = getDocumentsUrl(tokens.apiDomain, cabinet_id);

        // Docuware fulltext search via dialog
        const response = await fetch(`${documentsUrl}?count=${maxResults}&searchTerm=${encodeURIComponent(query)}`, {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          const text = await response.text();
          if (response.status === 401 || response.status === 403) {
            return 'Error: Docuware access denied. Your token may have expired. Please reconnect.';
          }
          return `Error: Docuware API request failed: ${response.status} - ${text}`;
        }

        const data = await response.json() as any;
        const items = data.Items || data.items || [];

        if (items.length === 0) {
          return `No documents found for "${query}" in cabinet ${cabinet_id}.`;
        }

        let output = `Found ${items.length} document(s) for "${query}":\n\n`;

        for (const doc of items) {
          const fields = doc.Fields || doc.fields || [];
          const getField = (name: string) => {
            const field = fields.find((f: any) => f.FieldName === name || f.fieldName === name);
            return field?.Item || field?.item || '';
          };

          output += `### ${getField('DWDOCID') || doc.Id || 'Unknown'}\n`;
          output += `- **Title**: ${getField('Title') || getField('DOCUMENT_TITLE') || getField('DWDOCID') || 'Untitled'}\n`;
          output += `- **Document ID**: ${doc.Id || getField('DWDOCID')}\n`;
          output += `- **Created**: ${getField('DWSTOREDATETIME') || getField('DWSTOREDATE') || 'Unknown'}\n`;
          output += `- **File Size**: ${doc.FileSize || doc.ContentSize || 'Unknown'}\n`;
          output += `- **Cabinet**: ${cabinet_id}\n\n`;
        }

        return output;
      } catch (error: any) {
        console.error('Docuware search error:', error);
        return `Error searching Docuware: ${error.message}`;
      }
    },

    async isAvailable(): Promise<boolean> {
      return connectionRegistry.has(providerId);
    },
  };
}
