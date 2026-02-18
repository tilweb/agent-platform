/**
 * Table Add Row Tool
 *
 * Adds a new row to a table.
 */

import type { Tool, ToolDefinition, ToolContext } from '../types';
import { addRow, getTable } from '../../tables';

interface TableAddArgs {
  table_id: string;
  data: Record<string, any>;
}

export class TableAddTool implements Tool {
  readonly name = 'table_add';
  readonly type = 'local' as const;

  getDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: `Fuegt eine neue Zeile zu einer Tabelle hinzu.

Beispiele:
- "Fuege einen neuen Kontakt hinzu: Max Mueller, Acme GmbH"
  -> table_id="kontakte", data={name: "Max Mueller", firma: "Acme GmbH"}

- "Erstelle ein neues Projekt 'Website Relaunch'"
  -> table_id="projekte", data={name: "Website Relaunch"}

Die Daten werden automatisch validiert. Pflichtfelder muessen angegeben werden.
Beziehungen (Relationen) werden als IDs der referenzierten Zeilen angegeben.`,
        parameters: {
          type: 'object',
          properties: {
            table_id: {
              type: 'string',
              description: 'ID der Tabelle',
            },
            data: {
              type: 'object',
              description: 'Spaltenwerte als Key-Value Paare (z.B. {name: "Max", email: "max@example.com"})',
              additionalProperties: true,
            },
          },
          required: ['table_id', 'data'],
        },
      },
    };
  }

  async execute(args: TableAddArgs, context?: ToolContext): Promise<string> {
    const { table_id, data } = args;

    try {
      // Validate table exists
      const table = await getTable(table_id);
      if (!table) {
        return JSON.stringify({
          success: false,
          error: `Tabelle "${table_id}" nicht gefunden.`,
          hint: 'Nutze table_list um verfuegbare Tabellen zu sehen.',
        });
      }

      // Validate required fields
      const missingRequired = table.columns
        .filter(col => col.required && !data[col.id])
        .map(col => col.name);

      if (missingRequired.length > 0) {
        return JSON.stringify({
          success: false,
          error: `Pflichtfelder fehlen: ${missingRequired.join(', ')}`,
          required_fields: table.columns
            .filter(col => col.required)
            .map(col => ({ id: col.id, name: col.name, type: col.type })),
        });
      }

      // Add the row
      const row = await addRow(table_id, { data });

      // Determine primary display column
      const primaryColumn = table.settings?.primary_column || table.columns[0]?.id || '_id';
      const displayValue = row[primaryColumn] || row._id;

      return JSON.stringify({
        success: true,
        message: `Zeile "${displayValue}" wurde zur Tabelle "${table.name}" hinzugefuegt.`,
        row_id: row._id,
        data: row,
      });
    } catch (error: any) {
      console.error('Table add tool error:', error);

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
      description: 'Fuegt eine neue Zeile zu einer Tabelle hinzu',
      type: this.type,
      category: 'tables',
    };
  }
}
