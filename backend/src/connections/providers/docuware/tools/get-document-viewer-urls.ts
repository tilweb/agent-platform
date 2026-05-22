/**
 * Docuware Get Document Viewer URLs Tool
 *
 * Statt ein Pixel-Binary zu returnen (mit dem ein LLM nichts anfangen kann)
 * liefert dieses Tool die Backend-Proxy-URLs fuer:
 *   - Thumbnail (kleines Vorschaubild)
 *   - Page-Image (skalierte Page-Render, page=1..N)
 *   - File-Download (Original-Binary)
 *
 * Die URLs zeigen auf unsere `/api/connections/docuware/...`-Routen, die
 * dann den DocuWare-Call mit User-Token im Backend ausfuehren — damit
 * darf das Frontend die URLs in `<img src>` oder `<iframe src>` einbinden,
 * ohne dass ein Token ins DOM gelangt.
 */

import type { ToolDefinition, ToolContext } from '../../../../tools/types';
import type { ConnectionTool } from '../../../types';
import { connectionRegistry } from '../../../registry';

export function createGetDocumentViewerUrlsTool(providerId: string): ConnectionTool {
  return {
    name: 'docuware_get_document_viewer_urls',
    type: 'connection',
    providerId,

    getDefinition(): ToolDefinition {
      return {
        type: 'function',
        function: {
          name: 'docuware_get_document_viewer_urls',
          description:
            'Get backend proxy URLs for thumbnail, page-image (page 1) and original-file-download of a Docuware document. Use these URLs to embed the document in the UI (img/iframe). Use docuware_get_document_sections first if you need page count or section IDs.',
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
              section_id: {
                type: 'string',
                description: 'Optional section ID — required by some DocuWare tenants to fetch images. If omitted, the route tries the doc-level endpoint first and falls back to the first section.',
              },
            },
            required: ['cabinet_id', 'document_id'],
          },
        },
      };
    },

    async execute(args: Record<string, any>, context?: ToolContext): Promise<string> {
      const { cabinet_id, document_id, section_id } = args;

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

      const base = `/api/connections/docuware/cabinets/${encodeURIComponent(cabinet_id)}/documents/${encodeURIComponent(String(document_id))}`;
      const sectionQs = section_id ? `?section_id=${encodeURIComponent(section_id)}` : '';
      const sectionQsAnd = section_id ? `&section_id=${encodeURIComponent(section_id)}` : '';

      const urls = {
        thumbnail: `${base}/thumbnail${sectionQs}`,
        firstPage: `${base}/pages/1${sectionQs}`,
        pageTemplate: `${base}/pages/{page}${sectionQs}`,
        file: `${base}/file`,
      };

      let output = `Viewer URLs for document ${document_id} (cabinet ${cabinet_id}):\n\n`;
      output += `- **Thumbnail**: ${urls.thumbnail}\n`;
      output += `- **First Page Image**: ${urls.firstPage}\n`;
      output += `- **Page Template** (replace {page} with 1..N): ${urls.pageTemplate}\n`;
      output += `- **Original File Download**: ${urls.file}\n\n`;
      output += `These URLs require the user's session cookie. Embed via <img src="..."> or <iframe src="..."> directly.`;
      return output;
    },

    async isAvailable(): Promise<boolean> {
      return connectionRegistry.has(providerId);
    },
  };
}
