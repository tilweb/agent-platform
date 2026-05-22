/**
 * Docuware Get Field Select-List Tool
 *
 * Liefert die erlaubten Werte fuer ein Index-Feld (z.B. ART_DES_DOKUMENTES,
 * MANDANT). DocuWare nennt das „Schluesselworte-Liste" oder „Keyword List";
 * im UI sieht der User die als Dropdown.
 */

import type { ToolDefinition, ToolContext } from '../../../../tools/types';
import type { ConnectionTool } from '../../../types';
import { connectionRegistry } from '../../../registry';
import { getFieldSelectListUrl } from '../config';
import { resolveSearchDialog } from '../dialogs';

export function createGetFieldSelectListTool(providerId: string): ConnectionTool {
  return {
    name: 'docuware_get_field_select_list',
    type: 'connection',
    providerId,

    getDefinition(): ToolDefinition {
      return {
        type: 'function',
        function: {
          name: 'docuware_get_field_select_list',
          description:
            'Get the allowed values of a Docuware index field (keyword list). Use docuware_list_cabinet_fields first to find fields with hasSelectList=true.',
          parameters: {
            type: 'object',
            properties: {
              cabinet_id: {
                type: 'string',
                description: 'The file cabinet ID',
              },
              field_name: {
                type: 'string',
                description: 'The DBFieldName, e.g. "ART_DES_DOKUMENTES" or "MANDANT"',
              },
              dialog_hint: {
                type: 'string',
                description: 'Optional dialog hint (id or display-name fragment). Defaults to the cabinet\'s default search dialog.',
              },
            },
            required: ['cabinet_id', 'field_name'],
          },
        },
      };
    },

    async execute(args: Record<string, any>, context?: ToolContext): Promise<string> {
      const { cabinet_id, field_name, dialog_hint } = args;
      if (!cabinet_id || !field_name) return 'Error: cabinet_id and field_name are required';
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

        const fieldDef = dialog.fields.find((f) => f.dbFieldName === field_name);
        if (!fieldDef) {
          return `Error: Field "${field_name}" not found in dialog "${dialog.displayName}". Use docuware_list_cabinet_fields to see available fields.`;
        }
        if (!fieldDef.hasSelectList) {
          return `Field "${field_name}" (${fieldDef.label}) has no select list configured.`;
        }

        const res = await fetch(
          getFieldSelectListUrl(tokens.apiDomain, cabinet_id, dialog.id, field_name),
          { headers: { Authorization: `Bearer ${tokens.accessToken}`, Accept: 'application/json' } },
        );
        if (!res.ok) {
          const text = await res.text();
          if (res.status === 401 || res.status === 403) {
            return 'Error: Docuware access denied. Your token may have expired. Please reconnect.';
          }
          return `Error: Docuware select-list request failed: ${res.status} - ${text}`;
        }
        const data = (await res.json()) as any;
        const values = (data.Value || data.values || []) as string[];

        let output = `# Select-List for "${field_name}" (${fieldDef.label})\n`;
        output += `Cabinet: ${cabinet_id}, Dialog: ${dialog.displayName}\n`;
        output += `Total: ${values.length} value(s)\n\n`;
        for (const v of values) output += `- ${v}\n`;
        return output;
      } catch (err: any) {
        console.error('Docuware select-list error:', err);
        return `Error fetching select list: ${err.message}`;
      }
    },

    async isAvailable(): Promise<boolean> {
      return connectionRegistry.has(providerId);
    },
  };
}
