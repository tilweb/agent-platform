/**
 * Table Delete Row Tool
 *
 * Deletes a row from a table.
 */

import type { Tool, ToolDefinition, ToolContext } from '../types';
import { deleteRow, getTable, getRow, queryRows } from '../../tables';
import { getRowReferences, deleteRowWithCascade } from '../../tables/relations';

interface TableDeleteArgs {
  table_id: string;
  row_id?: string;
  find_by?: Record<string, any>;
  cascade?: boolean;
}

export class TableDeleteTool implements Tool {
  readonly name = 'table_delete';
  readonly type = 'local' as const;

  getDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: `Loescht eine Zeile aus einer Tabelle.

Du kannst die Zeile entweder ueber:
1. row_id - direkte ID der Zeile
2. find_by - Suche nach Spalten-Werten (z.B. {name: "Max Mueller"})

ACHTUNG: Diese Aktion kann nicht rueckgaengig gemacht werden!

Wenn andere Tabellen auf diese Zeile verweisen:
- Ohne cascade: Fehler wird zurueckgegeben
- Mit cascade=true: Verweise werden auf null gesetzt

Beispiele:
- "Loesche den Kontakt Max Mueller"
  -> find_by={name: "Max Mueller"}

- "Entferne Projekt X und alle Verweise darauf"
  -> find_by={name: "Projekt X"}, cascade=true`,
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
            cascade: {
              type: 'boolean',
              description: 'Verweise in anderen Tabellen auf null setzen (Standard: false)',
            },
          },
          required: ['table_id'],
        },
      },
    };
  }

  async execute(args: TableDeleteArgs, context?: ToolContext): Promise<string> {
    const { table_id, row_id, find_by, cascade = false } = args;

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

      // Check for references
      const references = await getRowReferences(table_id, targetRowId);

      if (references.length > 0 && !cascade) {
        return JSON.stringify({
          success: false,
          error: 'Diese Zeile wird von anderen Tabellen referenziert.',
          references: references.map(r => ({
            table: r.table,
            column: r.column,
            count: r.count,
          })),
          hint: 'Nutze cascade=true um die Verweise auf null zu setzen, oder loesche zuerst die referenzierenden Zeilen.',
        });
      }

      // Determine primary display column for message
      const primaryColumn = table.settings?.primary_column || table.columns[0]?.id || '_id';
      const displayValue = existingRow[primaryColumn] || existingRow._id;

      // Delete with or without cascade
      if (cascade && references.length > 0) {
        const result = await deleteRowWithCascade(table_id, targetRowId, {
          nullifyReferences: true,
        });

        return JSON.stringify({
          success: true,
          message: `Zeile "${displayValue}" wurde geloescht.`,
          row_id: targetRowId,
          nullified_references: result.nullified,
        });
      } else {
        await deleteRow(table_id, targetRowId);

        return JSON.stringify({
          success: true,
          message: `Zeile "${displayValue}" wurde aus "${table.name}" geloescht.`,
          row_id: targetRowId,
        });
      }
    } catch (error: any) {
      console.error('Table delete tool error:', error);
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
      description: 'Loescht eine Zeile aus einer Tabelle',
      type: this.type,
      category: 'tables',
    };
  }
}
