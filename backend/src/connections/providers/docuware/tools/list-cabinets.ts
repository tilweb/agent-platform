/**
 * Docuware List Cabinets Tool
 */

import type { ToolDefinition, ToolContext } from '../../../../tools/types';
import type { ConnectionTool } from '../../../types';
import { connectionRegistry } from '../../../registry';
import { getFileCabinetsUrl } from '../config';

export function createListCabinetsTool(providerId: string): ConnectionTool {
  return {
    name: 'docuware_list_cabinets',
    type: 'connection',
    providerId,

    getDefinition(): ToolDefinition {
      return {
        type: 'function',
        function: {
          name: 'docuware_list_cabinets',
          description: 'List all available file cabinets in Docuware. Use this to discover cabinet IDs for searching documents.',
          parameters: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      };
    },

    async execute(_args: Record<string, any>, context?: ToolContext): Promise<string> {
      if (!context?.userId) {
        return 'Error: User authentication required to use Docuware';
      }

      const tokens = await connectionRegistry.getTokens(context.userId, providerId);
      if (!tokens) {
        return 'Error: Not connected to Docuware. Please connect first in the Connections page.';
      }

      try {
        const response = await fetch(getFileCabinetsUrl(tokens.apiDomain), {
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
        const cabinets = data.FileCabinet || data.fileCabinet || data.Items || [];

        if (cabinets.length === 0) {
          return 'No file cabinets found.';
        }

        let output = `Found ${cabinets.length} file cabinet(s):\n\n`;

        for (const cabinet of cabinets) {
          output += `### ${cabinet.Name || cabinet.name || 'Unknown'}\n`;
          output += `- **ID**: ${cabinet.Id || cabinet.id}\n`;
          output += `- **Type**: ${cabinet.IsBasket ? 'Document Tray' : 'File Cabinet'}\n`;
          if (cabinet.Documents !== undefined) {
            output += `- **Documents**: ${cabinet.Documents}\n`;
          }
          output += `\n`;
        }

        return output;
      } catch (error: any) {
        console.error('Docuware list cabinets error:', error);
        return `Error listing Docuware cabinets: ${error.message}`;
      }
    },

    async isAvailable(): Promise<boolean> {
      return connectionRegistry.has(providerId);
    },
  };
}
