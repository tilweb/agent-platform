/**
 * Google Sheets: Tabelle anlegen (optional gleich mit Werten befüllen)
 */

import type { ToolContext } from '../../../../tools/types';
import type { ConnectionTool } from '../../../types';
import { connectionRegistry } from '../../../registry';
import { SHEETS_API_BASE } from '../config';

export function createCreateSpreadsheetTool(providerId: string): ConnectionTool {
  return {
    type: 'connection',
    providerId,
    name: 'gsheets_create_spreadsheet',

    getDefinition() {
      return {
        type: 'function',
        function: {
          name: 'gsheets_create_spreadsheet',
          description:
            'Erstellt ein neues Google Sheet (Tabelle) im Google-Konto des Nutzers und gibt ID, Link und den Tab-Titel der ersten Tabelle (firstSheetTitle, locale-abhängig — bei DE-Konten "Tabelle1", nicht "Sheet1") zurück. Optional direkt mit Werten befüllbar (values, ab A1). Zum späteren Schreiben gsheets_write_range nutzen: Bereich OHNE Tabellennamen (z.B. "A1:A6") trifft automatisch die erste Tabelle.',
          parameters: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Titel des neuen Google Sheets',
              },
              values: {
                type: 'array',
                description:
                  'Optionale Anfangsdaten als Liste von Zeilen, jede Zeile eine Liste von Zellen. Beispiel: [["Monat","Umsatz"],["Januar",1200]]. Wird ab Zelle A1 eingefügt.',
                items: {
                  type: 'array',
                  items: { type: ['string', 'number', 'boolean'] },
                },
              },
            },
            required: ['title'],
          },
        },
      };
    },

    async execute(args: Record<string, any>, context?: ToolContext) {
      const { title, values } = args;
      if (!title) return JSON.stringify({ error: 'title is required' });
      if (!context?.userId) {
        return JSON.stringify({ error: 'User authentication required to use Google Sheets' });
      }

      const tokens = await connectionRegistry.getTokens(context.userId, providerId);
      if (!tokens) {
        return JSON.stringify({
          error: 'Google ist nicht verbunden. Bitte zuerst unter „Meine Verbindungen" verbinden.',
        });
      }

      const headers = {
        Authorization: `${tokens.tokenType} ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      };

      try {
        const createRes = await fetch(SHEETS_API_BASE, {
          method: 'POST',
          headers,
          body: JSON.stringify({ properties: { title } }),
        });

        if (!createRes.ok) {
          const text = await createRes.text();
          if (createRes.status === 401 || createRes.status === 403) {
            return JSON.stringify({ error: 'Google-Zugriff verweigert/abgelaufen. Bitte neu verbinden.' });
          }
          throw new Error(`Failed to create spreadsheet: ${createRes.status} - ${text}`);
        }

        const sheet = (await createRes.json()) as {
          spreadsheetId: string;
          spreadsheetUrl: string;
          sheets?: Array<{ properties?: { title?: string } }>;
        };

        // Tab-Titel des ersten Blatts ist locale-abhaengig (DE: "Tabelle1", EN: "Sheet1").
        // Zurueckgeben, damit der Agent beim Schreiben NICHT "Sheet1" raet.
        const firstSheetTitle = sheet.sheets?.[0]?.properties?.title || 'Tabelle1';

        let valuesWritten = 0;
        if (Array.isArray(values) && values.length > 0) {
          const range = `${firstSheetTitle}!A1`;
          const writeRes = await fetch(
            `${SHEETS_API_BASE}/${sheet.spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
            { method: 'PUT', headers, body: JSON.stringify({ values }) }
          );
          if (writeRes.ok) {
            const w = (await writeRes.json()) as { updatedCells?: number };
            valuesWritten = w.updatedCells ?? 0;
          }
        }

        return JSON.stringify({
          spreadsheetId: sheet.spreadsheetId,
          url: sheet.spreadsheetUrl,
          title,
          firstSheetTitle,
          valuesWritten,
          hint: `Zum Schreiben gsheets_write_range nutzen: Bereich OHNE Tabellennamen (z.B. "A1:A6") trifft automatisch die erste Tabelle, ODER exakt "${firstSheetTitle}!A1" — NICHT "Sheet1" raten.`,
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
