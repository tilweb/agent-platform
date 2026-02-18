/**
 * Table List Tool
 *
 * Lists all available tables with their schemas and row counts.
 */

import type { Tool, ToolDefinition, ToolContext } from '../types';
import { listTablesWithStats } from '../../tables';

export class TableListTool implements Tool {
  readonly name = 'table_list';
  readonly type = 'local' as const;

  getDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: `Listet alle verfuegbaren Tabellen im System auf.

Zeigt fuer jede Tabelle:
- Name und Beschreibung
- Spalten und deren Typen
- Anzahl der Zeilen
- Verfuegbare Views/Filter

Nutze dieses Tool um:
- Zu sehen welche Tabellen existieren
- Die Struktur einer Tabelle zu verstehen
- Zu pruefen ob bestimmte Daten vorhanden sind`,
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    };
  }

  async execute(args: Record<string, any>, context?: ToolContext): Promise<string> {
    try {
      const tables = await listTablesWithStats();

      if (tables.length === 0) {
        return JSON.stringify({
          success: true,
          message: 'Keine Tabellen vorhanden.',
          tables: [],
          hint: 'Erstelle eine neue Tabelle ueber die Tabellen-Seite oder nutze eine Vorlage.',
        });
      }

      const tableList = tables.map(table => ({
        id: table.id,
        name: table.name,
        description: table.description || '',
        icon: table.icon || '',
        row_count: table.row_count,
        columns: table.columns.map(col => ({
          id: col.id,
          name: col.name,
          type: col.type,
          required: col.required || false,
        })),
        views: table.views?.map(v => ({
          id: v.id,
          name: v.name,
        })) || [],
      }));

      return JSON.stringify({
        success: true,
        count: tables.length,
        tables: tableList,
      });
    } catch (error: any) {
      console.error('Table list tool error:', error);
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
      description: 'Listet alle verfuegbaren Tabellen auf',
      type: this.type,
      category: 'tables',
    };
  }
}
