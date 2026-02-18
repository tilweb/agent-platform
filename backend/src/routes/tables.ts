/**
 * Tables API Routes
 *
 * REST endpoints for managing tables, rows, views, and import/export.
 */

import { Hono } from 'hono';
import {
  tableService,
  views,
  relations,
  importExport,
  storage,
} from '../tables';
import type {
  CreateTableParams,
  UpdateTableParams,
  ColumnDefinition,
  ViewDefinition,
  QueryOptions,
  ExportOptions,
  ImportOptions,
} from '../tables/types';

export const tablesRoutes = new Hono();

// ============================================
// Table CRUD
// ============================================

// GET /api/tables - List all tables
tablesRoutes.get('/', async (c) => {
  try {
    const withStats = c.req.query('stats') === 'true';

    if (withStats) {
      const tables = await tableService.listTablesWithStats();
      return c.json({ tables, count: tables.length });
    }

    const tables = await tableService.listTables();
    return c.json({ tables, count: tables.length });
  } catch (error: any) {
    console.error('Error listing tables:', error);
    return c.json({ error: error.message }, 500);
  }
});

// POST /api/tables - Create a new table
tablesRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json();

    const { id, name, description, icon, columns, settings, views: tableViews } = body;

    if (!id || !name) {
      return c.json({ error: 'id and name are required' }, 400);
    }

    if (!columns || !Array.isArray(columns) || columns.length === 0) {
      return c.json({ error: 'At least one column is required' }, 400);
    }

    const params: CreateTableParams = {
      id,
      name,
      description,
      icon,
      columns,
      settings,
      views: tableViews,
    };

    const table = await tableService.createTable(params);
    return c.json(table, 201);
  } catch (error: any) {
    console.error('Error creating table:', error);
    if (error.message.includes('already exists')) {
      return c.json({ error: error.message }, 409);
    }
    return c.json({ error: error.message }, 500);
  }
});

// GET /api/tables/templates - List available templates
tablesRoutes.get('/templates', async (c) => {
  try {
    const templates = await tableService.listTemplates();
    return c.json({ templates });
  } catch (error: any) {
    console.error('Error listing templates:', error);
    return c.json({ error: error.message }, 500);
  }
});

// POST /api/tables/templates/:id/apply - Apply a template
tablesRoutes.post('/templates/:id/apply', async (c) => {
  try {
    const templateId = c.req.param('id');
    const tables = await tableService.applyTemplate(templateId);
    return c.json({ tables, count: tables.length });
  } catch (error: any) {
    console.error('Error applying template:', error);
    return c.json({ error: error.message }, 500);
  }
});

// GET /api/tables/:id - Get table schema
tablesRoutes.get('/:id', async (c) => {
  try {
    const tableId = c.req.param('id');
    const withData = c.req.query('data') === 'true';

    if (withData) {
      const table = await tableService.getTableWithData(tableId);
      if (!table) {
        return c.json({ error: 'Table not found' }, 404);
      }
      return c.json(table);
    }

    const table = await tableService.getTable(tableId);
    if (!table) {
      return c.json({ error: 'Table not found' }, 404);
    }
    return c.json(table);
  } catch (error: any) {
    console.error('Error getting table:', error);
    return c.json({ error: error.message }, 500);
  }
});

// PUT /api/tables/:id - Update table schema
tablesRoutes.put('/:id', async (c) => {
  try {
    const tableId = c.req.param('id');
    const body = await c.req.json();

    const updates: UpdateTableParams = {
      name: body.name,
      description: body.description,
      icon: body.icon,
      settings: body.settings,
    };

    const table = await tableService.updateTable(tableId, updates);
    if (!table) {
      return c.json({ error: 'Table not found' }, 404);
    }
    return c.json(table);
  } catch (error: any) {
    console.error('Error updating table:', error);
    return c.json({ error: error.message }, 500);
  }
});

// DELETE /api/tables/:id - Delete a table
tablesRoutes.delete('/:id', async (c) => {
  try {
    const tableId = c.req.param('id');

    // Check for incoming references
    const hasRefs = await relations.hasIncomingReferences(tableId);
    if (hasRefs) {
      const force = c.req.query('force') === 'true';
      if (!force) {
        return c.json({
          error: 'Table has incoming references from other tables',
          hint: 'Use ?force=true to delete anyway',
        }, 409);
      }
    }

    const deleted = await tableService.deleteTable(tableId);
    if (!deleted) {
      return c.json({ error: 'Table not found' }, 404);
    }
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting table:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// Column Operations
// ============================================

// POST /api/tables/:id/columns - Add a column
tablesRoutes.post('/:id/columns', async (c) => {
  try {
    const tableId = c.req.param('id');
    const column = await c.req.json() as ColumnDefinition;

    if (!column.id || !column.name || !column.type) {
      return c.json({ error: 'id, name, and type are required' }, 400);
    }

    const table = await tableService.addColumn(tableId, column);
    if (!table) {
      return c.json({ error: 'Table not found' }, 404);
    }
    return c.json(table);
  } catch (error: any) {
    console.error('Error adding column:', error);
    if (error.message.includes('already exists')) {
      return c.json({ error: error.message }, 409);
    }
    return c.json({ error: error.message }, 500);
  }
});

// PUT /api/tables/:id/columns/:columnId - Update a column
tablesRoutes.put('/:id/columns/:columnId', async (c) => {
  try {
    const tableId = c.req.param('id');
    const columnId = c.req.param('columnId');
    const updates = await c.req.json() as Partial<ColumnDefinition>;

    const table = await tableService.updateColumn(tableId, columnId, updates);
    if (!table) {
      return c.json({ error: 'Table not found' }, 404);
    }
    return c.json(table);
  } catch (error: any) {
    console.error('Error updating column:', error);
    return c.json({ error: error.message }, 500);
  }
});

// DELETE /api/tables/:id/columns/:columnId - Delete a column
tablesRoutes.delete('/:id/columns/:columnId', async (c) => {
  try {
    const tableId = c.req.param('id');
    const columnId = c.req.param('columnId');

    const table = await tableService.deleteColumn(tableId, columnId);
    if (!table) {
      return c.json({ error: 'Table not found' }, 404);
    }
    return c.json(table);
  } catch (error: any) {
    console.error('Error deleting column:', error);
    return c.json({ error: error.message }, 500);
  }
});

// PUT /api/tables/:id/columns/order - Reorder columns
tablesRoutes.put('/:id/columns/order', async (c) => {
  try {
    const tableId = c.req.param('id');
    const { columnIds } = await c.req.json();

    if (!Array.isArray(columnIds)) {
      return c.json({ error: 'columnIds array is required' }, 400);
    }

    const table = await tableService.reorderColumns(tableId, columnIds);
    if (!table) {
      return c.json({ error: 'Table not found' }, 404);
    }
    return c.json(table);
  } catch (error: any) {
    console.error('Error reordering columns:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// Row Operations
// ============================================

// GET /api/tables/:id/rows - Query rows
tablesRoutes.get('/:id/rows', async (c) => {
  try {
    const tableId = c.req.param('id');

    const options: QueryOptions = {
      filter_text: c.req.query('filter') || undefined,
      sort_by: c.req.query('sort_by') || undefined,
      sort_direction: (c.req.query('sort_direction') as 'ASC' | 'DESC') || undefined,
      offset: c.req.query('offset') ? parseInt(c.req.query('offset')!, 10) : undefined,
      limit: c.req.query('limit') ? parseInt(c.req.query('limit')!, 10) : undefined,
      resolve_relations: c.req.query('resolve_relations') === 'true',
    };

    const result = await tableService.queryRows(tableId, options);
    return c.json(result);
  } catch (error: any) {
    console.error('Error querying rows:', error);
    if (error.message.includes('not found')) {
      return c.json({ error: error.message }, 404);
    }
    return c.json({ error: error.message }, 500);
  }
});

// POST /api/tables/:id/rows - Add a row
tablesRoutes.post('/:id/rows', async (c) => {
  try {
    const tableId = c.req.param('id');
    const data = await c.req.json();

    const row = await tableService.addRow(tableId, { data });
    return c.json(row, 201);
  } catch (error: any) {
    console.error('Error adding row:', error);
    if (error.message.includes('not found')) {
      return c.json({ error: error.message }, 404);
    }
    if (error.message.includes('Validation failed')) {
      return c.json({ error: error.message }, 400);
    }
    return c.json({ error: error.message }, 500);
  }
});

// POST /api/tables/:id/rows/query - Advanced query (POST with body)
tablesRoutes.post('/:id/rows/query', async (c) => {
  try {
    const tableId = c.req.param('id');
    const options = await c.req.json() as QueryOptions;

    const result = await tableService.queryRows(tableId, options);
    return c.json(result);
  } catch (error: any) {
    console.error('Error querying rows:', error);
    return c.json({ error: error.message }, 500);
  }
});

// GET /api/tables/:id/rows/:rowId - Get a single row
tablesRoutes.get('/:id/rows/:rowId', async (c) => {
  try {
    const tableId = c.req.param('id');
    const rowId = c.req.param('rowId');

    const row = await tableService.getRow(tableId, rowId);
    if (!row) {
      return c.json({ error: 'Row not found' }, 404);
    }
    return c.json(row);
  } catch (error: any) {
    console.error('Error getting row:', error);
    return c.json({ error: error.message }, 500);
  }
});

// PUT /api/tables/:id/rows/:rowId - Update a row
tablesRoutes.put('/:id/rows/:rowId', async (c) => {
  try {
    const tableId = c.req.param('id');
    const rowId = c.req.param('rowId');
    const data = await c.req.json();

    const row = await tableService.updateRow(tableId, { row_id: rowId, data });
    if (!row) {
      return c.json({ error: 'Row not found' }, 404);
    }
    return c.json(row);
  } catch (error: any) {
    console.error('Error updating row:', error);
    if (error.message.includes('Validation failed')) {
      return c.json({ error: error.message }, 400);
    }
    return c.json({ error: error.message }, 500);
  }
});

// DELETE /api/tables/:id/rows/:rowId - Delete a row
tablesRoutes.delete('/:id/rows/:rowId', async (c) => {
  try {
    const tableId = c.req.param('id');
    const rowId = c.req.param('rowId');
    const cascade = c.req.query('cascade') === 'true';
    const nullify = c.req.query('nullify') === 'true';

    if (cascade || nullify) {
      const result = await relations.deleteRowWithCascade(tableId, rowId, {
        cascade,
        nullifyReferences: nullify,
      });
      return c.json({ success: true, ...result });
    }

    const deleted = await tableService.deleteRow(tableId, rowId);
    if (!deleted) {
      return c.json({ error: 'Row not found' }, 404);
    }
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting row:', error);
    return c.json({ error: error.message }, 500);
  }
});

// DELETE /api/tables/:id/rows - Delete multiple rows
tablesRoutes.delete('/:id/rows', async (c) => {
  try {
    const tableId = c.req.param('id');
    const { rowIds } = await c.req.json();

    if (!Array.isArray(rowIds)) {
      return c.json({ error: 'rowIds array is required' }, 400);
    }

    const count = await tableService.deleteRows(tableId, rowIds);
    return c.json({ success: true, deleted: count });
  } catch (error: any) {
    console.error('Error deleting rows:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// View Operations
// ============================================

// GET /api/tables/:id/views - List views
tablesRoutes.get('/:id/views', async (c) => {
  try {
    const tableId = c.req.param('id');
    const tableViews = await views.getViews(tableId);
    return c.json({ views: tableViews });
  } catch (error: any) {
    console.error('Error listing views:', error);
    return c.json({ error: error.message }, 500);
  }
});

// POST /api/tables/:id/views - Create a view
tablesRoutes.post('/:id/views', async (c) => {
  try {
    const tableId = c.req.param('id');
    const params = await c.req.json();

    if (!params.id || !params.name) {
      return c.json({ error: 'id and name are required' }, 400);
    }

    const view = await views.createView(tableId, params);
    return c.json(view, 201);
  } catch (error: any) {
    console.error('Error creating view:', error);
    if (error.message.includes('already exists')) {
      return c.json({ error: error.message }, 409);
    }
    return c.json({ error: error.message }, 500);
  }
});

// GET /api/tables/:id/views/:viewId - Get a view
tablesRoutes.get('/:id/views/:viewId', async (c) => {
  try {
    const tableId = c.req.param('id');
    const viewId = c.req.param('viewId');

    const view = await views.getView(tableId, viewId);
    if (!view) {
      return c.json({ error: 'View not found' }, 404);
    }
    return c.json(view);
  } catch (error: any) {
    console.error('Error getting view:', error);
    return c.json({ error: error.message }, 500);
  }
});

// PUT /api/tables/:id/views/:viewId - Update a view
tablesRoutes.put('/:id/views/:viewId', async (c) => {
  try {
    const tableId = c.req.param('id');
    const viewId = c.req.param('viewId');
    const params = await c.req.json();

    const view = await views.updateView(tableId, viewId, params);
    return c.json(view);
  } catch (error: any) {
    console.error('Error updating view:', error);
    return c.json({ error: error.message }, 500);
  }
});

// DELETE /api/tables/:id/views/:viewId - Delete a view
tablesRoutes.delete('/:id/views/:viewId', async (c) => {
  try {
    const tableId = c.req.param('id');
    const viewId = c.req.param('viewId');

    const deleted = await views.deleteView(tableId, viewId);
    if (!deleted) {
      return c.json({ error: 'View not found' }, 404);
    }
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting view:', error);
    return c.json({ error: error.message }, 500);
  }
});

// GET /api/tables/:id/views/:viewId/rows - Execute a view
tablesRoutes.get('/:id/views/:viewId/rows', async (c) => {
  try {
    const tableId = c.req.param('id');
    const viewId = c.req.param('viewId');

    const options: Partial<QueryOptions> = {
      offset: c.req.query('offset') ? parseInt(c.req.query('offset')!, 10) : undefined,
      limit: c.req.query('limit') ? parseInt(c.req.query('limit')!, 10) : undefined,
    };

    const result = await views.executeView(tableId, viewId, options);
    return c.json(result);
  } catch (error: any) {
    console.error('Error executing view:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// Relation Operations
// ============================================

// GET /api/tables/:id/relations - Get table relations
tablesRoutes.get('/:id/relations', async (c) => {
  try {
    const tableId = c.req.param('id');

    const outgoing = await relations.getTableRelations(tableId);
    const incoming = await relations.getReverseRelations(tableId);

    return c.json({ outgoing, incoming });
  } catch (error: any) {
    console.error('Error getting relations:', error);
    return c.json({ error: error.message }, 500);
  }
});

// GET /api/tables/:id/columns/:columnId/options - Get relation options
tablesRoutes.get('/:id/columns/:columnId/options', async (c) => {
  try {
    const tableId = c.req.param('id');
    const columnId = c.req.param('columnId');
    const search = c.req.query('search') || undefined;
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!, 10) : 50;

    // Get the column definition
    const table = await tableService.getTable(tableId);
    if (!table) {
      return c.json({ error: 'Table not found' }, 404);
    }

    const column = table.columns.find(c => c.id === columnId);
    if (!column) {
      return c.json({ error: 'Column not found' }, 404);
    }

    if (column.type !== 'relation' || !column.relation_table) {
      return c.json({ error: 'Column is not a relation' }, 400);
    }

    const options = await relations.getRelationOptions(
      column.relation_table,
      column.relation_display_column,
      search,
      limit
    );

    return c.json({ options });
  } catch (error: any) {
    console.error('Error getting relation options:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// Import/Export Operations
// ============================================

// POST /api/tables/:id/export - Export table data
tablesRoutes.post('/:id/export', async (c) => {
  try {
    const tableId = c.req.param('id');
    const options = await c.req.json() as ExportOptions;

    if (!options.format) {
      return c.json({ error: 'format is required (csv, json, yaml)' }, 400);
    }

    const content = await importExport.exportTable(tableId, options);

    // Set appropriate content type
    const contentTypes: Record<string, string> = {
      csv: 'text/csv',
      json: 'application/json',
      yaml: 'text/yaml',
    };

    return new Response(content, {
      headers: {
        'Content-Type': contentTypes[options.format] || 'text/plain',
        'Content-Disposition': `attachment; filename="${tableId}.${options.format}"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting table:', error);
    return c.json({ error: error.message }, 500);
  }
});

// POST /api/tables/:id/import - Import data into table
tablesRoutes.post('/:id/import', async (c) => {
  try {
    const tableId = c.req.param('id');
    const body = await c.req.json();

    const { content, format, column_mapping, update_existing, skip_invalid } = body;

    if (!content || !format) {
      return c.json({ error: 'content and format are required' }, 400);
    }

    const options: ImportOptions = {
      format,
      column_mapping,
      update_existing,
      skip_invalid,
    };

    const result = await importExport.importData(tableId, content, options);
    return c.json(result);
  } catch (error: any) {
    console.error('Error importing data:', error);
    return c.json({ error: error.message }, 500);
  }
});

// POST /api/tables/:id/import/preview - Preview import
tablesRoutes.post('/:id/import/preview', async (c) => {
  try {
    const tableId = c.req.param('id');
    const { content, format, limit = 10 } = await c.req.json();

    if (!content || !format) {
      return c.json({ error: 'content and format are required' }, 400);
    }

    const preview = await importExport.previewImport(tableId, content, format, limit);
    return c.json(preview);
  } catch (error: any) {
    console.error('Error previewing import:', error);
    return c.json({ error: error.message }, 500);
  }
});

// POST /api/tables/:id/backup - Create full backup
tablesRoutes.post('/:id/backup', async (c) => {
  try {
    const tableId = c.req.param('id');
    const content = await importExport.exportTableBackup(tableId);

    return new Response(content, {
      headers: {
        'Content-Type': 'text/yaml',
        'Content-Disposition': `attachment; filename="${tableId}-backup.yaml"`,
      },
    });
  } catch (error: any) {
    console.error('Error creating backup:', error);
    return c.json({ error: error.message }, 500);
  }
});

// POST /api/tables/import/backup - Import from backup
tablesRoutes.post('/import/backup', async (c) => {
  try {
    const { content, overwrite = false } = await c.req.json();

    if (!content) {
      return c.json({ error: 'content is required' }, 400);
    }

    const table = await importExport.importTableBackup(content, overwrite);
    return c.json(table, 201);
  } catch (error: any) {
    console.error('Error importing backup:', error);
    if (error.message.includes('already exists')) {
      return c.json({ error: error.message }, 409);
    }
    return c.json({ error: error.message }, 500);
  }
});
