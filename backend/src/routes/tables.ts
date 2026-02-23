/**
 * Tables API Routes
 *
 * REST endpoints for managing tables, rows, views, and import/export.
 */

import { Hono } from 'hono';
import { parseIntSafe } from '../utils/parseIntSafe';
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
  TableSettings,
} from '../tables/types';
import type { CreateViewParams } from '../tables/views';
import { authMiddleware } from '../auth';
import { internalError, validationError, notFoundError, conflictError } from '../utils/errorHandler';

export const tablesRoutes = new Hono();

// Require authentication for all table operations
tablesRoutes.use('/*', authMiddleware);

// Runtime validation: ensure parsed JSON is a plain object (not array, null, string etc.)
function requireObject(body: unknown): body is Record<string, unknown> {
  return body !== null && typeof body === 'object' && !Array.isArray(body);
}


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
    return internalError(c, error);
  }
});

// POST /api/tables - Create a new table
tablesRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json();
    if (!requireObject(body)) {
      return validationError(c, 'Ungültiger Request-Body');
    }

    const id = body.id as string | undefined;
    const name = body.name as string | undefined;
    const description = body.description as string | undefined;
    const icon = body.icon as string | undefined;
    const columns = body.columns as ColumnDefinition[] | undefined;
    const settings = body.settings as TableSettings | undefined;
    const tableViews = body.views as ViewDefinition[] | undefined;

    if (!id || !name) {
      return validationError(c, 'id and name are required');
    }

    if (!columns || !Array.isArray(columns) || columns.length === 0) {
      return validationError(c, 'At least one column is required');
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
    if (error instanceof Error && error.message.includes('already exists')) {
      return conflictError(c, 'Eintrag existiert bereits');
    }
    return internalError(c, error);
  }
});

// GET /api/tables/templates - List available templates
tablesRoutes.get('/templates', async (c) => {
  try {
    const templates = await tableService.listTemplates();
    return c.json({ templates });
  } catch (error: any) {
    console.error('Error listing templates:', error);
    return internalError(c, error);
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
    return internalError(c, error);
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
        return notFoundError(c, 'Table');
      }
      return c.json(table);
    }

    const table = await tableService.getTable(tableId);
    if (!table) {
      return notFoundError(c, 'Table');
    }
    return c.json(table);
  } catch (error: any) {
    console.error('Error getting table:', error);
    return internalError(c, error);
  }
});

// PUT /api/tables/:id - Update table schema
tablesRoutes.put('/:id', async (c) => {
  try {
    const tableId = c.req.param('id');
    const body = await c.req.json();
    if (!requireObject(body)) {
      return validationError(c, 'Ungültiger Request-Body');
    }

    const updates: UpdateTableParams = {
      name: body.name as string | undefined,
      description: body.description as string | undefined,
      icon: body.icon as string | undefined,
      settings: body.settings as TableSettings | undefined,
    };

    const table = await tableService.updateTable(tableId, updates);
    if (!table) {
      return notFoundError(c, 'Table');
    }
    return c.json(table);
  } catch (error: any) {
    console.error('Error updating table:', error);
    return internalError(c, error);
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
        return conflictError(c, 'Table has incoming references from other tables. Use ?force=true to delete anyway');
      }
    }

    const deleted = await tableService.deleteTable(tableId);
    if (!deleted) {
      return notFoundError(c, 'Table');
    }
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting table:', error);
    return internalError(c, error);
  }
});

// ============================================
// Column Operations
// ============================================

// POST /api/tables/:id/columns - Add a column
tablesRoutes.post('/:id/columns', async (c) => {
  try {
    const tableId = c.req.param('id');
    const column = await c.req.json();
    if (!requireObject(column)) {
      return validationError(c, 'Ungültiger Request-Body');
    }

    if (!column.id || !column.name || !column.type) {
      return validationError(c, 'id, name, and type are required');
    }

    const table = await tableService.addColumn(tableId, column as unknown as ColumnDefinition);
    if (!table) {
      return notFoundError(c, 'Table');
    }
    return c.json(table);
  } catch (error: any) {
    console.error('Error adding column:', error);
    if (error instanceof Error && error.message.includes('already exists')) {
      return conflictError(c, 'Eintrag existiert bereits');
    }
    return internalError(c, error);
  }
});

// PUT /api/tables/:id/columns/:columnId - Update a column
tablesRoutes.put('/:id/columns/:columnId', async (c) => {
  try {
    const tableId = c.req.param('id');
    const columnId = c.req.param('columnId');
    const updates = await c.req.json();
    if (!requireObject(updates)) {
      return validationError(c, 'Ungültiger Request-Body');
    }

    const table = await tableService.updateColumn(tableId, columnId, updates);
    if (!table) {
      return notFoundError(c, 'Table');
    }
    return c.json(table);
  } catch (error: any) {
    console.error('Error updating column:', error);
    return internalError(c, error);
  }
});

// DELETE /api/tables/:id/columns/:columnId - Delete a column
tablesRoutes.delete('/:id/columns/:columnId', async (c) => {
  try {
    const tableId = c.req.param('id');
    const columnId = c.req.param('columnId');

    const table = await tableService.deleteColumn(tableId, columnId);
    if (!table) {
      return notFoundError(c, 'Table');
    }
    return c.json(table);
  } catch (error: any) {
    console.error('Error deleting column:', error);
    return internalError(c, error);
  }
});

// PUT /api/tables/:id/columns/order - Reorder columns
tablesRoutes.put('/:id/columns/order', async (c) => {
  try {
    const tableId = c.req.param('id');
    const body = await c.req.json();
    if (!requireObject(body)) {
      return validationError(c, 'Ungültiger Request-Body');
    }
    const { columnIds } = body;

    if (!Array.isArray(columnIds)) {
      return validationError(c, 'columnIds array is required');
    }

    const table = await tableService.reorderColumns(tableId, columnIds);
    if (!table) {
      return notFoundError(c, 'Table');
    }
    return c.json(table);
  } catch (error: any) {
    console.error('Error reordering columns:', error);
    return internalError(c, error);
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
      sort_direction: (['ASC', 'DESC'].includes(c.req.query('sort_direction') || '') ? c.req.query('sort_direction') as 'ASC' | 'DESC' : undefined),
      offset: parseIntSafe(c.req.query('offset'), 0),
      limit: parseIntSafe(c.req.query('limit'), 50),
      resolve_relations: c.req.query('resolve_relations') === 'true',
    };

    const result = await tableService.queryRows(tableId, options);
    return c.json(result);
  } catch (error: any) {
    console.error('Error querying rows:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      return notFoundError(c);
    }
    return internalError(c, error);
  }
});

// POST /api/tables/:id/rows - Add a row
tablesRoutes.post('/:id/rows', async (c) => {
  try {
    const tableId = c.req.param('id');
    const data = await c.req.json();
    if (!requireObject(data)) {
      return validationError(c, 'Ungültiger Request-Body');
    }

    const row = await tableService.addRow(tableId, { data });
    return c.json(row, 201);
  } catch (error: any) {
    console.error('Error adding row:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      return notFoundError(c);
    }
    if (error instanceof Error && error.message.includes('Validation failed')) {
      return validationError(c, 'Validierungsfehler');
    }
    return internalError(c, error);
  }
});

// POST /api/tables/:id/rows/query - Advanced query (POST with body)
tablesRoutes.post('/:id/rows/query', async (c) => {
  try {
    const tableId = c.req.param('id');
    const options = await c.req.json();
    if (!requireObject(options)) {
      return validationError(c, 'Ungültiger Request-Body');
    }

    const result = await tableService.queryRows(tableId, options);
    return c.json(result);
  } catch (error: any) {
    console.error('Error querying rows:', error);
    return internalError(c, error);
  }
});

// GET /api/tables/:id/rows/:rowId - Get a single row
tablesRoutes.get('/:id/rows/:rowId', async (c) => {
  try {
    const tableId = c.req.param('id');
    const rowId = c.req.param('rowId');

    const row = await tableService.getRow(tableId, rowId);
    if (!row) {
      return notFoundError(c, 'Row');
    }
    return c.json(row);
  } catch (error: any) {
    console.error('Error getting row:', error);
    return internalError(c, error);
  }
});

// PUT /api/tables/:id/rows/:rowId - Update a row
tablesRoutes.put('/:id/rows/:rowId', async (c) => {
  try {
    const tableId = c.req.param('id');
    const rowId = c.req.param('rowId');
    const data = await c.req.json();
    if (!requireObject(data)) {
      return validationError(c, 'Ungültiger Request-Body');
    }

    const row = await tableService.updateRow(tableId, { row_id: rowId, data });
    if (!row) {
      return notFoundError(c, 'Row');
    }
    return c.json(row);
  } catch (error: any) {
    console.error('Error updating row:', error);
    if (error instanceof Error && error.message.includes('Validation failed')) {
      return validationError(c, 'Validierungsfehler');
    }
    return internalError(c, error);
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
      return notFoundError(c, 'Row');
    }
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting row:', error);
    return internalError(c, error);
  }
});

// DELETE /api/tables/:id/rows - Delete multiple rows
tablesRoutes.delete('/:id/rows', async (c) => {
  try {
    const tableId = c.req.param('id');
    const body = await c.req.json();
    if (!requireObject(body)) {
      return validationError(c, 'Ungültiger Request-Body');
    }
    const { rowIds } = body;

    if (!Array.isArray(rowIds)) {
      return validationError(c, 'rowIds array is required');
    }

    const count = await tableService.deleteRows(tableId, rowIds);
    return c.json({ success: true, deleted: count });
  } catch (error: any) {
    console.error('Error deleting rows:', error);
    return internalError(c, error);
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
    return internalError(c, error);
  }
});

// POST /api/tables/:id/views - Create a view
tablesRoutes.post('/:id/views', async (c) => {
  try {
    const tableId = c.req.param('id');
    const params = await c.req.json();
    if (!requireObject(params)) {
      return validationError(c, 'Ungültiger Request-Body');
    }

    if (!params.id || !params.name) {
      return validationError(c, 'id and name are required');
    }

    const view = await views.createView(tableId, params as unknown as CreateViewParams);
    return c.json(view, 201);
  } catch (error: any) {
    console.error('Error creating view:', error);
    if (error instanceof Error && error.message.includes('already exists')) {
      return conflictError(c, 'Eintrag existiert bereits');
    }
    return internalError(c, error);
  }
});

// GET /api/tables/:id/views/:viewId - Get a view
tablesRoutes.get('/:id/views/:viewId', async (c) => {
  try {
    const tableId = c.req.param('id');
    const viewId = c.req.param('viewId');

    const view = await views.getView(tableId, viewId);
    if (!view) {
      return notFoundError(c, 'View');
    }
    return c.json(view);
  } catch (error: any) {
    console.error('Error getting view:', error);
    return internalError(c, error);
  }
});

// PUT /api/tables/:id/views/:viewId - Update a view
tablesRoutes.put('/:id/views/:viewId', async (c) => {
  try {
    const tableId = c.req.param('id');
    const viewId = c.req.param('viewId');
    const params = await c.req.json();
    if (!requireObject(params)) {
      return validationError(c, 'Ungültiger Request-Body');
    }

    const view = await views.updateView(tableId, viewId, params);
    return c.json(view);
  } catch (error: any) {
    console.error('Error updating view:', error);
    return internalError(c, error);
  }
});

// DELETE /api/tables/:id/views/:viewId - Delete a view
tablesRoutes.delete('/:id/views/:viewId', async (c) => {
  try {
    const tableId = c.req.param('id');
    const viewId = c.req.param('viewId');

    const deleted = await views.deleteView(tableId, viewId);
    if (!deleted) {
      return notFoundError(c, 'View');
    }
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting view:', error);
    return internalError(c, error);
  }
});

// GET /api/tables/:id/views/:viewId/rows - Execute a view
tablesRoutes.get('/:id/views/:viewId/rows', async (c) => {
  try {
    const tableId = c.req.param('id');
    const viewId = c.req.param('viewId');

    const options: Partial<QueryOptions> = {
      offset: parseIntSafe(c.req.query('offset'), 0),
      limit: parseIntSafe(c.req.query('limit'), 50),
    };

    const result = await views.executeView(tableId, viewId, options);
    return c.json(result);
  } catch (error: any) {
    console.error('Error executing view:', error);
    return internalError(c, error);
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
    return internalError(c, error);
  }
});

// GET /api/tables/:id/columns/:columnId/options - Get relation options
tablesRoutes.get('/:id/columns/:columnId/options', async (c) => {
  try {
    const tableId = c.req.param('id');
    const columnId = c.req.param('columnId');
    const search = c.req.query('search') || undefined;
    const limit = parseIntSafe(c.req.query('limit'), 50);

    // Get the column definition
    const table = await tableService.getTable(tableId);
    if (!table) {
      return notFoundError(c, 'Table');
    }

    const column = table.columns.find(c => c.id === columnId);
    if (!column) {
      return notFoundError(c, 'Column');
    }

    if (column.type !== 'relation' || !column.relation_table) {
      return validationError(c, 'Column is not a relation');
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
    return internalError(c, error);
  }
});

// ============================================
// Import/Export Operations
// ============================================

// POST /api/tables/:id/export - Export table data
tablesRoutes.post('/:id/export', async (c) => {
  try {
    const tableId = c.req.param('id');
    const body = await c.req.json();
    if (!requireObject(body)) {
      return validationError(c, 'Ungültiger Request-Body');
    }

    const format = typeof body.format === 'string' ? body.format : '';
    if (!format || !['csv', 'json', 'yaml'].includes(format)) {
      return validationError(c, 'format is required (csv, json, yaml)');
    }
    const options: ExportOptions = { format: format as ExportOptions['format'], ...body };

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
    return internalError(c, error);
  }
});

// POST /api/tables/:id/import - Import data into table
tablesRoutes.post('/:id/import', async (c) => {
  try {
    const tableId = c.req.param('id');
    const body = await c.req.json();
    if (!requireObject(body)) {
      return validationError(c, 'Ungültiger Request-Body');
    }

    const content = body.content as string | undefined;
    const format = body.format as ImportOptions['format'] | undefined;
    const column_mapping = body.column_mapping as Record<string, string> | undefined;
    const update_existing = body.update_existing as boolean | undefined;
    const skip_invalid = body.skip_invalid as boolean | undefined;

    if (!content || !format) {
      return validationError(c, 'content and format are required');
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
    return internalError(c, error);
  }
});

// POST /api/tables/:id/import/preview - Preview import
tablesRoutes.post('/:id/import/preview', async (c) => {
  try {
    const tableId = c.req.param('id');
    const body = await c.req.json();
    if (!requireObject(body)) {
      return validationError(c, 'Ungültiger Request-Body');
    }
    const content = body.content as string | undefined;
    const format = body.format as ExportOptions['format'] | undefined;
    const limit = (body.limit as number | undefined) ?? 10;

    if (!content || !format) {
      return validationError(c, 'content and format are required');
    }

    const preview = await importExport.previewImport(tableId, content, format, limit);
    return c.json(preview);
  } catch (error: any) {
    console.error('Error previewing import:', error);
    return internalError(c, error);
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
    return internalError(c, error);
  }
});

// POST /api/tables/import/backup - Import from backup
tablesRoutes.post('/import/backup', async (c) => {
  try {
    const body = await c.req.json();
    if (!requireObject(body)) {
      return validationError(c, 'Ungültiger Request-Body');
    }
    const content = body.content as string | undefined;
    const overwrite = (body.overwrite as boolean | undefined) ?? false;

    if (!content) {
      return validationError(c, 'content is required');
    }

    const table = await importExport.importTableBackup(content, overwrite);
    return c.json(table, 201);
  } catch (error: any) {
    console.error('Error importing backup:', error);
    if (error instanceof Error && error.message.includes('already exists')) {
      return conflictError(c, 'Eintrag existiert bereits');
    }
    return internalError(c, error);
  }
});
