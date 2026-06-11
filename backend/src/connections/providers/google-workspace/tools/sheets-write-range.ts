/**
 * Google Sheets: Werte in einen Bereich schreiben (read+write)
 */

import type { ToolContext } from '../../../../tools/types';
import type { ConnectionTool } from '../../../types';
import { connectionRegistry } from '../../../registry';
import { SHEETS_API_BASE } from '../config';

export function createSheetsWriteRangeTool(providerId: string): ConnectionTool {
  return {
    type: 'connection',
    providerId,
    name: 'gsheets_write_range',

    getDefinition() {
      return {
        type: 'function',
        function: {
          name: 'gsheets_write_range',
          description:
            'Schreibt Werte in einen Bereich eines Google Sheets (überschreibt die Zellen). Funktioniert nur für Sheets, die der Agent angelegt hat oder die der Nutzer freigegeben hat.',
          parameters: {
            type: 'object',
            properties: {
              spreadsheet_id: { type: 'string', description: 'Die ID des Google Sheets' },
              range: {
                type: 'string',
                description: 'Bereich in A1-Notation, z.B. "Sheet1!A1" oder "Tabelle1!B2:D10"',
              },
              values: {
                type: 'array',
                description: 'Zeilen mit Zellen, z.B. [["Januar",1200],["Februar",1500]]',
                items: { type: 'array', items: { type: ['string', 'number', 'boolean'] } },
              },
            },
            required: ['spreadsheet_id', 'range', 'values'],
          },
        },
      };
    },

    async execute(args: Record<string, any>, context?: ToolContext) {
      const { spreadsheet_id, range, values } = args;
      if (!spreadsheet_id || !range || !Array.isArray(values)) {
        return JSON.stringify({ error: 'spreadsheet_id, range und values (2D-Array) sind erforderlich' });
      }
      if (!context?.userId) {
        return JSON.stringify({ error: 'User authentication required to use Google Sheets' });
      }

      const tokens = await connectionRegistry.getTokens(context.userId, providerId);
      if (!tokens) {
        return JSON.stringify({ error: 'Google ist nicht verbunden. Bitte zuerst unter „Meine Verbindungen" verbinden.' });
      }

      try {
        const res = await fetch(
          `${SHEETS_API_BASE}/${spreadsheet_id}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
          {
            method: 'PUT',
            headers: {
              Authorization: `${tokens.tokenType} ${tokens.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ values }),
          }
        );

        if (!res.ok) {
          const text = await res.text();
          if (res.status === 401 || res.status === 403) {
            return JSON.stringify({
              error:
                'Zugriff verweigert. Entweder Token abgelaufen (neu verbinden) oder dieses Sheet wurde nicht vom Agenten angelegt/freigegeben (drive.file-Scope).',
            });
          }
          throw new Error(`Failed to write range: ${res.status} - ${text}`);
        }

        const result = (await res.json()) as { updatedCells?: number; updatedRange?: string };
        return JSON.stringify({
          ok: true,
          updatedRange: result.updatedRange,
          updatedCells: result.updatedCells ?? 0,
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
