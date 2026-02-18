/**
 * Table Update Row Tool
 *
 * Updates an existing row in a table.
 */

import type { Tool, ToolDefinition, ToolContext } from '../types';
import { updateRow, getTable, getRow, queryRows } from '../../tables';

interface TableUpdateArgs {
  table_id: string;
  row_id?: string;
  find_by?: Record<string, any>;
  data: Record<string, any>;
}

export class TableUpdateTool implements Tool {
  readonly name = 'table_update';
  readonly type = 'local' as const;

  getDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: `Aktualisiert eine bestehende Zeile in einer Tabelle.

Du kannst die Zeile entweder ueber:
1. row_id - direkte ID der Zeile
2. find_by - Suche nach Spalten-Werten (z.B. {name: "Max Mueller"})

Nur angegebene Felder werden aktualisiert, andere bleiben unveraendert.

Beispiele:
- "Aendere den Status von Max Mueller auf 'kunde'"
  -> find_by={name: "Max Mueller"}, data={status: "kunde"}

- "Aktualisiere die Notizen fuer Projekt X"
  -> find_by={name: "Projekt X"}, data={notizen: "Neue Notizen"}`,
        parameters: {
          type: 'object',
          properties: {
            table_id: {
              type: 'string',
              description: 'ID der Tabelle',
            },
            row_id: {
              type: 'string',
              description: 'ID der Zeile (wenn bekannt)',
            },
            find_by: {
              type: 'object',
              description: 'Suche nach Zeile mit diesen Werten (z.B. {name: "Max"})',
              additionalProperties: true,
            },
            data: {
              type: 'object',
              description: 'Zu aktualisierende Felder (z.B. {status: "aktiv", notizen: "..."})',
              additionalProperties: true,
            },
          },
          required: ['table_id', 'data'],
        },
      },
    };
  }

  async execute(args: TableUpdateArgs, context?: ToolContext): Promise<string> {
    const { table_id, row_id, find_by, data } = args;

    try {
      // Validate table exists
      const table = await getTable(table_id);
      if (!table) {
        return JSON.stringify({
          success: false,
          error: `Tabelle "${table_id}" nicht gefunden.`,
        });
      }

      let targetRowId = row_id;

      // Find row by values if no row_id provided
      if (!targetRowId && find_by) {
        // Build filter from find_by
        const filterParts = Object.entries(find_by).map(
          ([key, value]) => `${key} = '${value}'`
        );
        const filter = filterParts.join(' AND ');

        const result = await queryRows(table_id, {
          filter_text: filter,
          limit: 2,
        });

        if (result.rows.length === 0) {
          return JSON.stringify({
            success: false,
            error: 'Keine Zeile mit diesen Kriterien gefunden.',
            search_criteria: find_by,
          });
        }

        if (result.rows.length > 1) {
          return JSON.stringify({
            success: false,
            error: 'Mehrere Zeilen gefunden. Bitte praezisiere die Suche oder nutze row_id.',
            found: result.rows.length,
            matches: result.rows.map(r => ({
              _id: r._id,
              ...Object.fromEntries(
                Object.entries(r).filter(([k]) => !k.startsWith('_'))
              ),
            })),
          });
        }

        const firstRow = result.rows[0];
        if (firstRow) {
          targetRowId = firstRow._id;
        }
      }

      if (!targetRowId) {
        return JSON.stringify({
          success: false,
          error: 'Entweder row_id oder find_by muss angegeben werden.',
        });
      }

      // Verify row exists
      const existingRow = await getRow(table_id, targetRowId);
      if (!existingRow) {
        return JSON.stringify({
          success: false,
          error: `Zeile "${targetRowId}" nicht gefunden.`,
        });
      }

      // Update the row
      const updatedRow = await updateRow(table_id, {
        row_id: targetRowId,
        data,
      });

      if (!updatedRow) {
        return JSON.stringify({
          success: false,
          error: 'Update fehlgeschlagen.',
        });
      }

      // Determine primary display column
      const primaryColumn = table.settings?.primary_column || table.columns[0]?.id || '_id';
      const displayValue = updatedRow[primaryColumn] || updatedRow._id;

      return JSON.stringify({
        success: true,
        message: `Zeile "${displayValue}" wurde aktualisiert.`,
        row_id: updatedRow._id,
        updated_fields: Object.keys(data),
        data: updatedRow,
      });
    } catch (error: any) {
      console.error('Table update tool error:', error);

      if (error.message.includes('Validation failed')) {
        return JSON.stringify({
          success: false,
          error: error.message,
          hint: 'Pruefe die Datentypen und Formate der Felder.',
        });
      }

      return JSON.stringify({
        success: false,
        error: error.message,
      });
    }
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  getMetadata() {
    return {
      name: this.name,
      description: 'Aktualisiert eine Zeile in einer Tabelle',
      type: this.type,
      category: 'tables',
    };
  }
}
