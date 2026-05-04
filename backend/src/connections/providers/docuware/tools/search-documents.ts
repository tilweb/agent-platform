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

        // Felder die wir im Title bevorzugen (in dieser Reihenfolge).
        const TITLE_FIELDS = ['DOCUMENT_TITLE', 'TITLE', 'TITEL', 'BETREFF', 'SUBJECT', 'NAME'];
        // Technische Docuware-System-Felder die wir nicht als User-Metadata zeigen.
        const HIDE_FIELDS = new Set([
          'DWDOCID', 'DWFCID', 'DWSYSCREATOR', 'DWSYSEDITOR', 'DWPATH', 'DWBARCODES',
          'DWEXTENSION', 'DWWASTEBASKET', 'DWCONTENTHASH', 'DWREVISION',
          'DWVERSION', 'DWVERSIONSEQUENCEID', 'DWWORKFLOWORIGNAME',
        ]);

        for (const doc of items) {
          const fields = doc.Fields || doc.fields || [];
          const fieldMap = new Map<string, any>();
          for (const f of fields) {
            const name = f.FieldName || f.fieldName;
            const val = f.Item ?? f.item;
            if (name && val !== undefined && val !== null && val !== '') fieldMap.set(name, val);
          }
          const getField = (name: string) => fieldMap.get(name) || '';

          // Title: erst die typischen Title-Felder, dann erstes User-Index-Feld
          // mit String-Wert, dann Filename, dann Fallback DocId.
          let title = '';
          for (const key of TITLE_FIELDS) {
            if (fieldMap.has(key) && typeof fieldMap.get(key) === 'string') {
              title = String(fieldMap.get(key));
              break;
            }
          }
          if (!title) {
            for (const [name, val] of fieldMap.entries()) {
              if (HIDE_FIELDS.has(name) || name.startsWith('DW')) continue;
              if (typeof val !== 'string' || !val.trim()) continue;
              title = val;
              break;
            }
          }
          if (!title) title = String(doc.Title || doc.FileName || `Document ${doc.Id}`);

          // User-Index-Felder (alle nicht-DW-Felder) als kompakte Key:Value-Liste.
          const indexFields: string[] = [];
          for (const [name, val] of fieldMap.entries()) {
            if (HIDE_FIELDS.has(name) || name.startsWith('DW')) continue;
            if (TITLE_FIELDS.includes(name) && val === title) continue; // schon im Title
            const valStr = typeof val === 'string' ? val : JSON.stringify(val);
            if (!valStr || valStr === 'null') continue;
            indexFields.push(`${name}: ${valStr}`);
          }

          // /Date(ms)/ → ISO falls vorhanden.
          const rawCreated = getField('DWSTOREDATETIME') || getField('DWSTOREDATE') || '';
          let created = '';
          if (typeof rawCreated === 'string') {
            const ms = rawCreated.match(/\/Date\((\d+)\)\//);
            if (ms) {
              const d = new Date(parseInt(ms[1]!, 10));
              if (!isNaN(d.getTime())) created = d.toISOString().slice(0, 10);
            } else {
              created = rawCreated;
            }
          }

          output += `### ${title}\n`;
          output += `- **Document ID**: ${doc.Id || getField('DWDOCID')}\n`;
          if (created) output += `- **Created**: ${created}\n`;
          output += `- **File Size**: ${doc.FileSize || doc.ContentSize || 'Unknown'}\n`;
          output += `- **Cabinet**: ${cabinet_id}\n`;
          if (indexFields.length > 0) {
            output += `- **Fields**: ${indexFields.join(' | ')}\n`;
          }
          output += `\n`;
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
