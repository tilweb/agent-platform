/**
 * Docuware Structured Search Tool
 *
 * Im Gegensatz zu `docuware_search_documents` (Volltext-Suche ueber
 * `?searchTerm=...`) erlaubt dieses Tool gezielte Filter auf Index-Felder
 * via DocuWare's DialogExpression-API.
 *
 * Beispiele:
 *   {
 *     cabinet_id: "1271fc1d-...",
 *     filters: [
 *       { field: "ART_DES_DOKUMENTES", values: ["Vertrag"] },
 *       { field: "FIRMA", values: ["WIANCO*"] },
 *       { field: "DATUM", values: ["2024-01-01", "2026-12-31"] }
 *     ]
 *   }
 */

import type { ToolDefinition, ToolContext } from '../../../../tools/types';
import type { ConnectionTool } from '../../../types';
import { connectionRegistry } from '../../../registry';
import { executeStructuredSearch } from '../search';

export function createSearchDocumentsStructuredTool(providerId: string): ConnectionTool {
  return {
    name: 'docuware_search_documents_structured',
    type: 'connection',
    providerId,

    getDefinition(): ToolDefinition {
      return {
        type: 'function',
        function: {
          name: 'docuware_search_documents_structured',
          description:
            'Search Docuware documents with index-field filters (e.g. document type, customer, date range). Use docuware_list_cabinet_fields first to find valid DBFieldNames. Values support exact match, wildcards (*), and ranges (for Date/Numeric types pass two values [start, end]).',
          parameters: {
            type: 'object',
            properties: {
              cabinet_id: {
                type: 'string',
                description: 'The file cabinet ID',
              },
              filters: {
                type: 'array',
                description: 'List of field filters. Each filter applies to one DBFieldName. Multiple filters are AND-combined by default.',
                items: {
                  type: 'object',
                  properties: {
                    field: {
                      type: 'string',
                      description: 'DBFieldName, e.g. "ART_DES_DOKUMENTES"',
                    },
                    values: {
                      type: 'array',
                      description: 'Filter values. One value = exact match (or wildcard if string contains "*"); two values for Date/Numeric = range [start, end]; multiple text values = OR within this filter.',
                      items: { type: 'string' },
                    },
                  },
                  required: ['field', 'values'],
                },
              },
              operation: {
                type: 'string',
                enum: ['And', 'Or'],
                description: 'How to combine multiple filters. Default: And',
              },
              count: {
                type: 'number',
                description: 'Max number of hits (default 20, max 100)',
              },
              dialog_hint: {
                type: 'string',
                description: 'Optional search-dialog ID or display-name fragment',
              },
            },
            required: ['cabinet_id', 'filters'],
          },
        },
      };
    },

    async execute(args: Record<string, any>, context?: ToolContext): Promise<string> {
      const { cabinet_id, filters, operation, count, dialog_hint } = args;
      if (!cabinet_id) return 'Error: cabinet_id is required';
      if (!Array.isArray(filters) || filters.length === 0) {
        return 'Error: at least one filter is required';
      }
      if (!context?.userId) return 'Error: User authentication required to use Docuware';

      const tokens = await connectionRegistry.getTokens(context.userId, providerId);
      if (!tokens) {
        return 'Error: Not connected to Docuware. Please connect first in the Connections page.';
      }

      try {
        const result = await executeStructuredSearch(tokens.apiDomain, tokens.accessToken, {
          cabinetId: cabinet_id,
          filters,
          operation,
          count,
          dialogHint: dialog_hint,
        });

        if (result.items.length === 0) {
          return `No documents matched the filters in dialog "${result.dialogName}".`;
        }

        let output = `Found ${result.items.length} document(s) via dialog "${result.dialogName}"`;
        if (result.total !== null && result.total > result.items.length) {
          output += ` (${result.total} total available — increase count for more)`;
        }
        output += `:\n\n`;

        for (const doc of result.items) {
          output += `### ${doc.title}\n`;
          output += `- **Document ID**: ${doc.id}\n`;
          output += `- **Cabinet**: ${cabinet_id}\n`;
          if (doc.fileSize) output += `- **File Size**: ${doc.fileSize}\n`;
          // Top-Felder rausziehen (keine DW-System-Felder)
          const userFields = Object.entries(doc.fields).filter(
            ([k]) => !k.startsWith('DW'),
          );
          if (userFields.length > 0) {
            const compact = userFields
              .slice(0, 10)
              .map(([k, v]) => `${k}: ${v}`)
              .join(' | ');
            output += `- **Fields**: ${compact}\n`;
          }
          output += `\n`;
        }
        return output;
      } catch (err: any) {
        console.error('Docuware structured search error:', err);
        if (err.message?.includes('401') || err.message?.includes('403')) {
          return 'Error: Docuware access denied. Your token may have expired. Please reconnect.';
        }
        return `Error in Docuware structured search: ${err.message}`;
      }
    },

    async isAvailable(): Promise<boolean> {
      return connectionRegistry.has(providerId);
    },
  };
}
