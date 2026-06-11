/**
 * Google Sheets: Werte aus einem Bereich lesen
 */

import type { ToolContext } from '../../../../tools/types';
import type { ConnectionTool } from '../../../types';
import { connectionRegistry } from '../../../registry';
import { SHEETS_API_BASE } from '../config';

export function createSheetsReadRangeTool(providerId: string): ConnectionTool {
  return {
    type: 'connection',
    providerId,
    name: 'gsheets_read_range',

    getDefinition() {
      return {
        type: 'function',
        function: {
          name: 'gsheets_read_range',
          description:
            'Liest Werte aus einem Bereich eines Google Sheets. Funktioniert nur für Sheets, die der Agent angelegt hat oder die der Nutzer freigegeben hat.',
          parameters: {
            type: 'object',
            properties: {
              spreadsheet_id: { type: 'string', description: 'Die ID des Google Sheets' },
              range: {
                type: 'string',
                description: 'Bereich in A1-Notation. OHNE Tabellennamen (z.B. "A1:D20") wird automatisch die erste Tabelle verwendet — EMPFOHLEN. Mit Tabellennamen: GENAU der "firstSheetTitle" aus gsheets_create_spreadsheet — NICHT "Sheet1" raten (DE-Konten: "Tabelle1").',
              },
            },
            required: ['spreadsheet_id', 'range'],
          },
        },
      };
    },

    async execute(args: Record<string, any>, context?: ToolContext) {
      const { spreadsheet_id, range } = args;
      if (!spreadsheet_id || !range) {
        return JSON.stringify({ error: 'spreadsheet_id und range sind erforderlich' });
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
          `${SHEETS_API_BASE}/${spreadsheet_id}/values/${encodeURIComponent(range)}`,
          { headers: { Authorization: `${tokens.tokenType} ${tokens.accessToken}` } }
        );

        if (!res.ok) {
          const text = await res.text();
          if (res.status === 401 || res.status === 403) {
            return JSON.stringify({
              error:
                'Zugriff verweigert. Token abgelaufen (neu verbinden) oder Sheet nicht vom Agenten angelegt/freigegeben (drive.file-Scope).',
            });
          }
          throw new Error(`Failed to read range: ${res.status} - ${text}`);
        }

        const result = (await res.json()) as { range?: string; values?: any[][] };
        return JSON.stringify({
          range: result.range,
          values: result.values ?? [],
          rowCount: result.values?.length ?? 0,
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
