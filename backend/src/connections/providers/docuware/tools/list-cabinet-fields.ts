/**
 * Docuware List Cabinet Fields Tool
 *
 * Listet die filterbaren Index-Felder eines Cabinets — Schema fuer
 * Filter-UIs und Vorstufe der strukturierten Suche.
 */

import type { ToolDefinition, ToolContext } from '../../../../tools/types';
import type { ConnectionTool } from '../../../types';
import { connectionRegistry } from '../../../registry';
import { resolveSearchDialog } from '../dialogs';

export function createListCabinetFieldsTool(providerId: string): ConnectionTool {
  return {
    name: 'docuware_list_cabinet_fields',
    type: 'connection',
    providerId,

    getDefinition(): ToolDefinition {
      return {
        type: 'function',
        function: {
          name: 'docuware_list_cabinet_fields',
          description:
            'List the index fields available for filtering in a Docuware cabinet. Returns DBFieldName (use this in search), display label, field type (Text/Date/DateTime/Numeric/Decimal/Memo), max length, and whether the field has a fixed select list (dropdown values).',
          parameters: {
            type: 'object',
            properties: {
              cabinet_id: {
                type: 'string',
                description: 'The file cabinet ID',
              },
              dialog_hint: {
                type: 'string',
                description: 'Optional dialog ID or display-name fragment to pick a specific search dialog. Defaults to the cabinet\'s default search dialog.',
              },
            },
            required: ['cabinet_id'],
          },
        },
      };
    },

    async execute(args: Record<string, any>, context?: ToolContext): Promise<string> {
      const { cabinet_id, dialog_hint } = args;
      if (!cabinet_id) return 'Error: cabinet_id is required';
      if (!context?.userId) return 'Error: User authentication required to use Docuware';

      const tokens = await connectionRegistry.getTokens(context.userId, providerId);
      if (!tokens) {
        return 'Error: Not connected to Docuware. Please connect first in the Connections page.';
      }

      try {
        const dialog = await resolveSearchDialog(
          tokens.apiDomain,
          cabinet_id,
          tokens.accessToken,
          dialog_hint,
        );

        const filterable = dialog.fields.filter((f) => f.allowFiltering && f.visible);
        let output = `# Cabinet ${cabinet_id} — Search Dialog "${dialog.displayName}"\n`;
        output += `Dialog ID: ${dialog.id}\n`;
        output += `Total filterable fields: ${filterable.length} (of ${dialog.fields.length})\n\n`;
        output += `| DBFieldName | Label | Type | MaxLen | SelectList |\n`;
        output += `|---|---|---|---|---|\n`;
        for (const f of filterable) {
          output += `| ${f.dbFieldName} | ${f.label} | ${f.type} | ${f.length === -1 ? '∞' : f.length} | ${f.hasSelectList ? 'yes' : 'no'} |\n`;
        }
        return output;
      } catch (err: any) {
        console.error('Docuware list cabinet fields error:', err);
        if (err.message?.includes('401') || err.message?.includes('403')) {
          return 'Error: Docuware access denied. Your token may have expired. Please reconnect.';
        }
        return `Error listing Docuware cabinet fields: ${err.message}`;
      }
    },

    async isAvailable(): Promise<boolean> {
      return connectionRegistry.has(providerId);
    },
  };
}
