/**
 * Docuware Get Document Tool
 */

import type { ToolDefinition, ToolContext } from '../../../../tools/types';
import type { ConnectionTool } from '../../../types';
import { connectionRegistry } from '../../../registry';
import { getFileCabinetsUrl } from '../config';

export function createGetDocumentTool(providerId: string): ConnectionTool {
  return {
    name: 'docuware_get_document',
    type: 'connection',
    providerId,

    getDefinition(): ToolDefinition {
      return {
        type: 'function',
        function: {
          name: 'docuware_get_document',
          description: 'Get metadata of a specific document from Docuware. Optionally includes text content.',
          parameters: {
            type: 'object',
            properties: {
              cabinet_id: {
                type: 'string',
                description: 'The file cabinet ID',
              },
              document_id: {
                type: 'string',
                description: 'The document ID',
              },
              include_content: {
                type: 'boolean',
                description: 'Whether to include the text content of the document (default: false)',
              },
            },
            required: ['cabinet_id', 'document_id'],
          },
        },
      };
    },

    async execute(args: Record<string, any>, context?: ToolContext): Promise<string> {
      const { cabinet_id, document_id, include_content = false } = args;

      if (!cabinet_id || !document_id) {
        return 'Error: cabinet_id and document_id are required';
      }

      if (!context?.userId) {
        return 'Error: User authentication required to use Docuware';
      }

      const tokens = await connectionRegistry.getTokens(context.userId, providerId);
      if (!tokens) {
        return 'Error: Not connected to Docuware. Please connect first in the Connections page.';
      }

      try {
        const cabinetUrl = getFileCabinetsUrl(tokens.apiDomain);
        const docUrl = `${cabinetUrl}/${cabinet_id}/Documents/${document_id}`;

        // Get document metadata
        const response = await fetch(docUrl, {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          const text = await response.text();
          if (response.status === 404) {
            return `Document ${document_id} not found in cabinet ${cabinet_id}`;
          }
          if (response.status === 401 || response.status === 403) {
            return 'Error: Docuware access denied. Your token may have expired. Please reconnect.';
          }
          return `Error: Docuware API request failed: ${response.status} - ${text}`;
        }

        const doc = await response.json() as any;
        const fields = doc.Fields || doc.fields || [];
        const getField = (name: string) => {
          const field = fields.find((f: any) => f.FieldName === name || f.fieldName === name);
          return field?.Item || field?.item || '';
        };

        let output = `# Document ${document_id}\n\n`;
        output += `**Title**: ${getField('Title') || getField('DOCUMENT_TITLE') || 'Untitled'}\n`;
        output += `**Document ID**: ${doc.Id || document_id}\n`;
        output += `**Cabinet**: ${cabinet_id}\n`;
        output += `**Created**: ${getField('DWSTOREDATETIME') || getField('DWSTOREDATE') || 'Unknown'}\n`;
        output += `**File Size**: ${doc.FileSize || doc.ContentSize || 'Unknown'}\n`;
        output += `**Sections**: ${doc.Sections?.length || 0}\n\n`;

        // List all index fields
        if (fields.length > 0) {
          output += `## Index Fields\n\n`;
          for (const field of fields) {
            const name = field.FieldName || field.fieldName;
            const value = field.Item || field.item;
            if (value && name && !name.startsWith('DW')) {
              output += `- **${name}**: ${value}\n`;
            }
          }
          output += `\n`;
        }

        // Optionally fetch text content
        if (include_content) {
          try {
            const textResponse = await fetch(`${docUrl}/Textshot`, {
              headers: {
                Authorization: `Bearer ${tokens.accessToken}`,
                Accept: 'text/plain',
              },
            });

            if (textResponse.ok) {
              const textContent = await textResponse.text();
              if (textContent) {
                output += `## Content\n\n`;
                const trimmed = textContent.slice(0, 50000);
                output += trimmed;
                if (textContent.length > 50000) {
                  output += `\n\n...[truncated at 50k characters]`;
                }
              }
            }
          } catch {
            output += `\n_Text content could not be retrieved._\n`;
          }
        }

        return output;
      } catch (error: any) {
        console.error('Docuware get document error:', error);
        return `Error getting Docuware document: ${error.message}`;
      }
    },

    async isAvailable(): Promise<boolean> {
      return connectionRegistry.has(providerId);
    },
  };
}
