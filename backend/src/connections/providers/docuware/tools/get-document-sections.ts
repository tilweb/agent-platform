/**
 * Docuware Get Document Sections Tool
 *
 * Listet die Sections eines Dokuments (Original + ggfs. Anhaenge) und die
 * Seitenzahl pro Section. Notwendig fuer Viewer-Apps, die ein Doc seitenweise
 * rendern wollen — manche DocuWare-Tenants verlangen die Section-ID fuer
 * Image-Endpoints (`/Sections/{sectionId}/Image?page=N`).
 */

import type { ToolDefinition, ToolContext } from '../../../../tools/types';
import type { ConnectionTool } from '../../../types';
import { connectionRegistry } from '../../../registry';
import { getDocumentSectionsUrl } from '../config';

export function createGetDocumentSectionsTool(providerId: string): ConnectionTool {
  return {
    name: 'docuware_get_document_sections',
    type: 'connection',
    providerId,

    getDefinition(): ToolDefinition {
      return {
        type: 'function',
        function: {
          name: 'docuware_get_document_sections',
          description:
            'List the sections of a Docuware document (original + attachments) including page counts and content types. Use this before requesting page images.',
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
            },
            required: ['cabinet_id', 'document_id'],
          },
        },
      };
    },

    async execute(args: Record<string, any>, context?: ToolContext): Promise<string> {
      const { cabinet_id, document_id } = args;

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
        const url = getDocumentSectionsUrl(tokens.apiDomain, cabinet_id, document_id);
        const response = await fetch(url, {
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
          if (response.status === 404) {
            return `Document ${document_id} or its sections not found in cabinet ${cabinet_id}.`;
          }
          return `Error: Docuware API request failed: ${response.status} - ${text}`;
        }

        const data = await response.json() as any;
        const sections = data.Section || data.Sections || data.section || data.sections || [];

        if (!Array.isArray(sections) || sections.length === 0) {
          return `No sections found for document ${document_id}.`;
        }

        let output = `Document ${document_id} has ${sections.length} section(s):\n\n`;
        for (let i = 0; i < sections.length; i++) {
          const section = sections[i];
          const id = section.Id || section.id || `section-${i}`;
          const name = section.OriginalFileName || section.originalFileName || section.Name || section.name || '';
          const pages = section.PageCount ?? section.pageCount ?? section.Pages ?? section.pages ?? 'unknown';
          const contentType = section.ContentType || section.contentType || section.MimeType || section.mimeType || '';
          const size = section.FileSize || section.fileSize || section.ContentSize || section.contentSize || '';
          output += `### Section ${i + 1}\n`;
          output += `- **Section ID**: ${id}\n`;
          if (name) output += `- **Filename**: ${name}\n`;
          output += `- **Pages**: ${pages}\n`;
          if (contentType) output += `- **Content-Type**: ${contentType}\n`;
          if (size) output += `- **Size**: ${size} bytes\n`;
          output += `\n`;
        }

        return output;
      } catch (error: any) {
        console.error('Docuware get sections error:', error);
        return `Error getting Docuware document sections: ${error.message}`;
      }
    },

    async isAvailable(): Promise<boolean> {
      return connectionRegistry.has(providerId);
    },
  };
}
