/**
 * Table Query Tool
 *
 * Queries data from a table with filtering, sorting, and pagination.
 */

import type { Tool, ToolDefinition, ToolContext } from '../types';
import { queryRows, getTable, queryView } from '../../tables';
import type { QueryOptions } from '../../tables/types';

interface TableQueryArgs {
  table_id: string;
  filter?: string;
  sort_by?: string;
  sort_direction?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
  view_id?: string;
  columns?: string[];
}

export class TableQueryTool implements Tool {
  readonly name = 'table_query';
  readonly type = 'local' as const;

  getDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: `Durchsucht eine Tabelle und gibt Zeilen zurueck.

Filterung:
- Einfache Syntax: "column = 'wert'" oder "column contains 'text'"
- Mehrere Bedingungen mit AND: "status = 'aktiv' AND firma contains 'GmbH'"
- Vergleiche: >, <, >=, <=

Sortierung:
- Nach beliebiger Spalte: sort_by + sort_direction

Beispiele:
- "Zeige alle Kontakte von Microsoft" -> filter="firma contains 'Microsoft'"
- "Wer hat sich laenger als 3 Monate nicht gemeldet?" -> filter="letzte_interaktion < '2024-10-01'"
- "Alle aktiven Projekte sortiert nach Prioritaet" -> filter="status = 'aktiv'" + sort_by="prioritaet"

Du kannst auch einen gespeicherten View nutzen mit view_id.`,
        parameters: {
          type: 'object',
          properties: {
            table_id: {
              type: 'string',
              description: 'ID der Tabelle (z.B. "kontakte", "projekte")',
            },
            filter: {
              type: 'string',
              description: 'Filter-Ausdruck (z.B. "status = \'aktiv\'" oder "name contains \'Max\'")',
            },
            sort_by: {
              type: 'string',
              description: 'Spalte nach der sortiert werden soll',
            },
            sort_direction: {
              type: 'string',
              description: 'Sortierrichtung',
              enum: ['ASC', 'DESC'],
            },
            limit: {
              type: 'number',
              description: 'Maximale Anzahl Zeilen (Standard: 50)',
            },
            offset: {
              type: 'number',
              description: 'Zeilen ueberspringen (fuer Pagination)',
            },
            view_id: {
              type: 'string',
              description: 'ID eines gespeicherten Views (optional, ersetzt filter)',
            },
            columns: {
              type: 'array',
              items: { type: 'string', description: 'Spalten-ID' },
              description: 'Nur bestimmte Spalten zurueckgeben (optional)',
            },
          },
          required: ['table_id'],
        },
      },
    };
  }

  async execute(args: TableQueryArgs, context?: ToolContext): Promise<string> {
    const {
      table_id,
      filter,
      sort_by,
      sort_direction,
      limit = 50,
      offset = 0,
      view_id,
      columns,
    } = args;

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

      let result;

      if (view_id) {
        // Use saved view
        try {
          result = await queryView(table_id, view_id, {
            limit,
            offset,
            columns,
          });
        } catch (error: any) {
          return JSON.stringify({
            success: false,
            error: `View "${view_id}" nicht gefunden.`,
            available_views: table.views?.map(v => v.id) || [],
          });
        }
      } else {
        // Direct query
        const options: QueryOptions = {
          filter_text: filter,
          sort_by,
          sort_direction,
          limit,
          offset,
          columns,
          resolve_relations: true,
        };

        result = await queryRows(table_id, options);
      }

      // Format response
      return JSON.stringify({
        success: true,
        table: table_id,
        filter_applied: filter || view_id || null,
        total: result.total,
        showing: result.rows.length,
        offset: result.offset,
        rows: result.rows,
        hint: result.total > result.rows.length
          ? `Es gibt ${result.total - result.rows.length} weitere Zeilen. Nutze offset=${result.offset + result.rows.length} um mehr zu sehen.`
          : null,
      });
    } catch (error: any) {
      console.error('Table query tool error:', error);
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
      description: 'Durchsucht Tabellen mit Filtern und Sortierung',
      type: this.type,
      category: 'tables',
    };
  }
}
