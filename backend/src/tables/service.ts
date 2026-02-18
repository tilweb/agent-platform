/**
 * Table Service
 *
 * Business logic for table operations including CRUD, querying,
 * filtering, sorting, and validation.
 */

import type {
  TableSchema,
  TableData,
  RowData,
  Table,
  ColumnDefinition,
  ColumnType,
  CreateTableParams,
  UpdateTableParams,
  AddRowParams,
  UpdateRowParams,
  QueryOptions,
  QueryResult,
  FilterCondition,
  FilterOperator,
  ViewDefinition,
  ValidationResult,
  ValidationError,
} from './types';
import * as storage from './storage';

// ============================================
// Validation
// ============================================

/**
 * Validate a value against a column type
 */
function validateColumnValue(
  column: ColumnDefinition,
  value: any
): ValidationError | null {
  // Check required
  if (column.required && (value === undefined || value === null || value === '')) {
    return {
      column: column.id,
      message: `${column.name} is required`,
      value,
    };
  }

  // Skip validation for null/undefined/empty optional values
  if (value === undefined || value === null || value === '') {
    return null;
  }

  // Type-specific validation
  switch (column.type) {
    case 'text':
    case 'text_long':
      if (typeof value !== 'string') {
        return {
          column: column.id,
          message: `${column.name} must be a string`,
          value,
        };
      }
      if (column.max_length && value.length > column.max_length) {
        return {
          column: column.id,
          message: `${column.name} exceeds maximum length of ${column.max_length}`,
          value,
        };
      }
      break;

    case 'number':
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      if (typeof numValue !== 'number' || isNaN(numValue)) {
        return {
          column: column.id,
          message: `${column.name} must be a number`,
          value,
        };
      }
      if (column.min !== undefined && numValue < column.min) {
        return {
          column: column.id,
          message: `${column.name} must be at least ${column.min}`,
          value,
        };
      }
      if (column.max !== undefined && numValue > column.max) {
        return {
          column: column.id,
          message: `${column.name} must be at most ${column.max}`,
          value,
        };
      }
      break;

    case 'date':
      const dateValue = new Date(value);
      if (isNaN(dateValue.getTime())) {
        return {
          column: column.id,
          message: `${column.name} must be a valid date`,
          value,
        };
      }
      break;

    case 'datetime':
      const datetimeValue = new Date(value);
      if (isNaN(datetimeValue.getTime())) {
        return {
          column: column.id,
          message: `${column.name} must be a valid datetime`,
          value,
        };
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
        return {
          column: column.id,
          message: `${column.name} must be a boolean`,
          value,
        };
      }
      break;

    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (typeof value !== 'string' || !emailRegex.test(value)) {
        return {
          column: column.id,
          message: `${column.name} must be a valid email address`,
          value,
        };
      }
      break;

    case 'url':
      try {
        new URL(value);
      } catch {
        return {
          column: column.id,
          message: `${column.name} must be a valid URL`,
          value,
        };
      }
      break;

    case 'tags':
      if (!Array.isArray(value)) {
        return {
          column: column.id,
          message: `${column.name} must be an array of tags`,
          value,
        };
      }
      break;

    case 'select':
      if (column.options && !column.options.includes(value)) {
        return {
          column: column.id,
          message: `${column.name} must be one of: ${column.options.join(', ')}`,
          value,
        };
      }
      break;

    case 'relation':
      // Relations are just string IDs, no special validation
      if (typeof value !== 'string') {
        return {
          column: column.id,
          message: `${column.name} must be a string (row ID)`,
          value,
        };
      }
      break;
  }

  return null;
}

/**
 * Validate row data against schema
 */
export function validateRow(
  schema: TableSchema,
  data: Record<string, any>
): ValidationResult {
  const errors: ValidationError[] = [];

  for (const column of schema.columns) {
    const value = data[column.id];
    const error = validateColumnValue(column, value);
    if (error) {
      errors.push(error);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Normalize row data (coerce types, apply defaults)
 */
export function normalizeRowData(
  schema: TableSchema,
  data: Record<string, any>
): Record<string, any> {
  const normalized: Record<string, any> = {};

  for (const column of schema.columns) {
    let value = data[column.id];

    // Apply default if value is undefined
    if (value === undefined && column.default !== undefined) {
      value = column.default;
    }

    // Skip undefined/null values
    if (value === undefined || value === null) {
      continue;
    }

    // Type coercion
    switch (column.type) {
      case 'number':
        if (typeof value === 'string') {
          const parsed = parseFloat(value);
          if (!isNaN(parsed)) {
            value = parsed;
          }
        }
        break;

      case 'boolean':
        if (value === 'true') value = true;
        if (value === 'false') value = false;
        break;

      case 'tags':
        if (typeof value === 'string') {
          value = value.split(',').map(t => t.trim()).filter(Boolean);
        }
        break;

      case 'date':
        // Normalize date format to YYYY-MM-DD
        if (value) {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            value = date.toISOString().split('T')[0];
          }
        }
        break;

      case 'datetime':
        // Normalize to ISO format
        if (value) {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            value = date.toISOString();
          }
        }
        break;
    }

    normalized[column.id] = value;
  }

  return normalized;
}

// ============================================
// Filtering & Sorting
// ============================================

/**
 * Apply a single filter condition to a row
 */
function matchesCondition(row: RowData, condition: FilterCondition): boolean {
  const value = row[condition.column];
  const target = condition.value;

  switch (condition.operator) {
    case 'eq':
      return value === target;

    case 'neq':
      return value !== target;

    case 'gt':
      return value > target;

    case 'gte':
      return value >= target;

    case 'lt':
      return value < target;

    case 'lte':
      return value <= target;

    case 'contains':
      return String(value).toLowerCase().includes(String(target).toLowerCase());

    case 'starts':
      return String(value).toLowerCase().startsWith(String(target).toLowerCase());

    case 'ends':
      return String(value).toLowerCase().endsWith(String(target).toLowerCase());

    case 'in':
      return Array.isArray(target) && target.includes(value);

    case 'nin':
      return Array.isArray(target) && !target.includes(value);

    case 'empty':
      return value === null || value === undefined || value === '' ||
        (Array.isArray(value) && value.length === 0);

    case 'nempty':
      return value !== null && value !== undefined && value !== '' &&
        (!Array.isArray(value) || value.length > 0);

    default:
      return true;
  }
}

/**
 * Parse a simple filter string into conditions
 * Examples:
 * - "name = 'Max'"
 * - "status = 'aktiv'"
 * - "firma contains 'Microsoft'"
 * - "letzte_interaktion < '2024-01-01'"
 */
export function parseFilterText(filterText: string): FilterCondition[] {
  const conditions: FilterCondition[] = [];

  // Simple regex-based parser for common patterns
  const patterns = [
    // column = 'value' or column = "value"
    /(\w+)\s*=\s*['"]([^'"]*)['"]/g,
    // column contains 'value'
    /(\w+)\s+contains\s+['"]([^'"]*)['"]/gi,
    // column > value, column < value, etc.
    /(\w+)\s*([><=!]+)\s*['"]?([^'"]+)['"]?/g,
  ];

  // Pattern: column = 'value'
  const eqMatches = filterText.matchAll(/(\w+)\s*=\s*['"]([^'"]*)['"]/g);
  for (const match of eqMatches) {
    if (match[1] && match[2] !== undefined) {
      conditions.push({
        column: match[1],
        operator: 'eq',
        value: match[2],
      });
    }
  }

  // Pattern: column contains 'value'
  const containsMatches = filterText.matchAll(/(\w+)\s+contains\s+['"]([^'"]*)['"]/gi);
  for (const match of containsMatches) {
    if (match[1] && match[2] !== undefined) {
      conditions.push({
        column: match[1],
        operator: 'contains',
        value: match[2],
      });
    }
  }

  // Pattern: column > value
  const gtMatches = filterText.matchAll(/(\w+)\s*>\s*['"]?([^'">\s]+)['"]?/g);
  for (const match of gtMatches) {
    if (match[1] && match[2] !== undefined && !conditions.some(c => c.column === match[1])) {
      conditions.push({
        column: match[1],
        operator: 'gt',
        value: match[2],
      });
    }
  }

  // Pattern: column < value
  const ltMatches = filterText.matchAll(/(\w+)\s*<\s*['"]?([^'"<\s]+)['"]?/g);
  for (const match of ltMatches) {
    if (match[1] && match[2] !== undefined && !conditions.some(c => c.column === match[1])) {
      conditions.push({
        column: match[1],
        operator: 'lt',
        value: match[2],
      });
    }
  }

  return conditions;
}

/**
 * Filter rows based on conditions
 */
function filterRows(rows: RowData[], filters: FilterCondition[]): RowData[] {
  if (filters.length === 0) {
    return rows;
  }

  return rows.filter(row =>
    filters.every(condition => matchesCondition(row, condition))
  );
}

/**
 * Sort rows by column
 */
function sortRows(
  rows: RowData[],
  sortBy: string,
  direction: 'ASC' | 'DESC' = 'ASC'
): RowData[] {
  return [...rows].sort((a, b) => {
    const aValue = a[sortBy];
    const bValue = b[sortBy];

    // Handle null/undefined
    if (aValue === null || aValue === undefined) return direction === 'ASC' ? 1 : -1;
    if (bValue === null || bValue === undefined) return direction === 'ASC' ? -1 : 1;

    // Compare based on type
    let comparison = 0;
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      comparison = aValue.localeCompare(bValue);
    } else if (typeof aValue === 'number' && typeof bValue === 'number') {
      comparison = aValue - bValue;
    } else if (aValue instanceof Date && bValue instanceof Date) {
      comparison = aValue.getTime() - bValue.getTime();
    } else {
      comparison = String(aValue).localeCompare(String(bValue));
    }

    return direction === 'DESC' ? -comparison : comparison;
  });
}

// ============================================
// Table CRUD Operations
// ============================================

/**
 * Create a new table
 */
export async function createTable(params: CreateTableParams): Promise<TableSchema> {
  return storage.createTable(params);
}

/**
 * Get a table by ID (schema only)
 */
export async function getTable(tableId: string): Promise<TableSchema | null> {
  return storage.loadSchema(tableId);
}

/**
 * Get a table with data
 */
export async function getTableWithData(tableId: string): Promise<Table | null> {
  const schema = await storage.loadSchema(tableId);
  if (!schema) {
    return null;
  }

  const data = await storage.loadData(tableId);
  return {
    ...schema,
    data: data || { updated_at: '', row_count: 0, rows: [] },
  };
}

/**
 * Update a table schema
 */
export async function updateTable(
  tableId: string,
  updates: UpdateTableParams
): Promise<TableSchema | null> {
  const schema = await storage.loadSchema(tableId);
  if (!schema) {
    return null;
  }

  if (updates.name) schema.name = updates.name;
  if (updates.description !== undefined) schema.description = updates.description;
  if (updates.icon !== undefined) schema.icon = updates.icon;
  if (updates.settings) schema.settings = { ...schema.settings, ...updates.settings };

  await storage.saveSchema(schema);
  return schema;
}

/**
 * Delete a table
 */
export async function deleteTable(tableId: string): Promise<boolean> {
  return storage.deleteTable(tableId);
}

/**
 * List all tables
 */
export async function listTables(): Promise<TableSchema[]> {
  return storage.listTables();
}

/**
 * List tables with row counts
 */
export async function listTablesWithStats(): Promise<Array<TableSchema & { row_count: number }>> {
  const tables = await storage.listTables();
  const result = [];

  for (const table of tables) {
    const stats = await storage.getTableStats(table.id);
    result.push({
      ...table,
      row_count: stats?.row_count || 0,
    });
  }

  return result;
}

// ============================================
// Column Operations
// ============================================

/**
 * Add a column to a table
 */
export async function addColumn(
  tableId: string,
  column: ColumnDefinition
): Promise<TableSchema | null> {
  const schema = await storage.loadSchema(tableId);
  if (!schema) {
    return null;
  }

  // Check if column already exists
  if (schema.columns.some(c => c.id === column.id)) {
    throw new Error(`Column "${column.id}" already exists`);
  }

  schema.columns.push(column);
  await storage.saveSchema(schema);
  return schema;
}

/**
 * Update a column in a table
 */
export async function updateColumn(
  tableId: string,
  columnId: string,
  updates: Partial<ColumnDefinition>
): Promise<TableSchema | null> {
  const schema = await storage.loadSchema(tableId);
  if (!schema) {
    return null;
  }

  const columnIndex = schema.columns.findIndex(c => c.id === columnId);
  if (columnIndex === -1) {
    throw new Error(`Column "${columnId}" not found`);
  }

  const existingColumn = schema.columns[columnIndex];
  if (!existingColumn) {
    throw new Error(`Column "${columnId}" not found`);
  }

  schema.columns[columnIndex] = {
    ...existingColumn,
    ...updates,
    id: columnId, // Preserve ID
  };

  await storage.saveSchema(schema);
  return schema;
}

/**
 * Delete a column from a table
 */
export async function deleteColumn(
  tableId: string,
  columnId: string
): Promise<TableSchema | null> {
  const schema = await storage.loadSchema(tableId);
  if (!schema) {
    return null;
  }

  const initialLength = schema.columns.length;
  schema.columns = schema.columns.filter(c => c.id !== columnId);

  if (schema.columns.length === initialLength) {
    throw new Error(`Column "${columnId}" not found`);
  }

  // Update settings if they reference this column
  if (schema.settings) {
    if (schema.settings.primary_column === columnId) {
      schema.settings.primary_column = schema.columns[0]?.id;
    }
    if (schema.settings.default_sort === columnId) {
      schema.settings.default_sort = schema.columns[0]?.id;
    }
    if (schema.settings.row_color_by === columnId) {
      schema.settings.row_color_by = undefined;
    }
  }

  await storage.saveSchema(schema);

  // Also remove column data from rows
  const data = await storage.loadData(tableId);
  if (data) {
    data.rows = data.rows.map(row => {
      const { [columnId]: _, ...rest } = row;
      return rest as RowData;
    });
    await storage.saveData(tableId, data);
  }

  return schema;
}

/**
 * Reorder columns
 */
export async function reorderColumns(
  tableId: string,
  columnIds: string[]
): Promise<TableSchema | null> {
  const schema = await storage.loadSchema(tableId);
  if (!schema) {
    return null;
  }

  // Create a map of existing columns
  const columnMap = new Map(schema.columns.map(c => [c.id, c]));

  // Reorder based on provided IDs
  const reordered: ColumnDefinition[] = [];
  for (const id of columnIds) {
    const column = columnMap.get(id);
    if (column) {
      reordered.push(column);
      columnMap.delete(id);
    }
  }

  // Add any remaining columns that weren't in the list
  for (const column of columnMap.values()) {
    reordered.push(column);
  }

  schema.columns = reordered;
  await storage.saveSchema(schema);
  return schema;
}

// ============================================
// Row Operations
// ============================================

/**
 * Add a row to a table
 */
export async function addRow(
  tableId: string,
  params: AddRowParams
): Promise<RowData> {
  const schema = await storage.loadSchema(tableId);
  if (!schema) {
    throw new Error(`Table "${tableId}" not found`);
  }

  // Normalize and validate
  const normalized = normalizeRowData(schema, params.data);
  const validation = validateRow(schema, normalized);

  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
  }

  return storage.addRow(tableId, normalized);
}

/**
 * Update a row in a table
 */
export async function updateRow(
  tableId: string,
  params: UpdateRowParams
): Promise<RowData | null> {
  const schema = await storage.loadSchema(tableId);
  if (!schema) {
    throw new Error(`Table "${tableId}" not found`);
  }

  // Get existing row
  const existingRow = await storage.getRow(tableId, params.row_id);
  if (!existingRow) {
    return null;
  }

  // Merge with updates
  const merged = { ...existingRow, ...params.data };

  // Normalize and validate
  const normalized = normalizeRowData(schema, merged);
  const validation = validateRow(schema, normalized);

  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
  }

  return storage.updateRow(tableId, params.row_id, normalized);
}

/**
 * Delete a row from a table
 */
export async function deleteRow(tableId: string, rowId: string): Promise<boolean> {
  return storage.deleteRow(tableId, rowId);
}

/**
 * Delete multiple rows
 */
export async function deleteRows(tableId: string, rowIds: string[]): Promise<number> {
  return storage.deleteRows(tableId, rowIds);
}

/**
 * Get a single row
 */
export async function getRow(tableId: string, rowId: string): Promise<RowData | null> {
  return storage.getRow(tableId, rowId);
}

// ============================================
// Query Operations
// ============================================

/**
 * Query rows with filtering, sorting, and pagination
 */
export async function queryRows(
  tableId: string,
  options: QueryOptions = {}
): Promise<QueryResult> {
  const data = await storage.loadData(tableId);
  if (!data) {
    throw new Error(`Table "${tableId}" not found`);
  }

  let rows = data.rows;

  // Parse filter text if provided
  let filters = options.filters || [];
  if (options.filter_text) {
    filters = [...filters, ...parseFilterText(options.filter_text)];
  }

  // Apply filters
  rows = filterRows(rows, filters);

  // Get total before pagination
  const total = rows.length;

  // Apply sorting
  const schema = await storage.loadSchema(tableId);
  const sortBy = options.sort_by || schema?.settings?.default_sort || '_created_at';
  const sortDirection = options.sort_direction || schema?.settings?.default_sort_direction || 'ASC';
  rows = sortRows(rows, sortBy, sortDirection);

  // Apply pagination
  const offset = options.offset || 0;
  const limit = options.limit || 100;
  rows = rows.slice(offset, offset + limit);

  // Filter columns if specified
  if (options.columns && options.columns.length > 0) {
    const columnSet = new Set([...options.columns, '_id', '_created_at', '_updated_at']);
    rows = rows.map(row => {
      const filtered: RowData = { _id: row._id };
      for (const key of Object.keys(row)) {
        if (columnSet.has(key)) {
          filtered[key] = row[key];
        }
      }
      return filtered;
    });
  }

  // Resolve relations if requested
  if (options.resolve_relations && schema) {
    rows = await resolveRelations(schema, rows);
  }

  return {
    rows,
    total,
    offset,
    limit,
  };
}

/**
 * Resolve relation columns to their display values
 */
async function resolveRelations(
  schema: TableSchema,
  rows: RowData[]
): Promise<RowData[]> {
  const relationColumns = schema.columns.filter(c => c.type === 'relation');
  if (relationColumns.length === 0) {
    return rows;
  }

  // Load related table data
  const relatedData = new Map<string, Map<string, RowData>>();
  for (const column of relationColumns) {
    if (!column.relation_table) continue;

    const data = await storage.loadData(column.relation_table);
    if (data) {
      const rowMap = new Map(data.rows.map(r => [r._id, r]));
      relatedData.set(column.id, rowMap);
    }
  }

  // Resolve relations
  return rows.map(row => {
    const resolved = { ...row };
    for (const column of relationColumns) {
      const rowMap = relatedData.get(column.id);
      if (rowMap && row[column.id]) {
        const relatedRow = rowMap.get(row[column.id]);
        if (relatedRow) {
          const displayColumn = column.relation_display_column || Object.keys(relatedRow).find(k => !k.startsWith('_'));
          resolved[`${column.id}_display`] = relatedRow[displayColumn || '_id'];
        }
      }
    }
    return resolved;
  });
}

// ============================================
// View Operations
// ============================================

/**
 * Add a view to a table
 */
export async function addView(
  tableId: string,
  view: ViewDefinition
): Promise<TableSchema | null> {
  const schema = await storage.loadSchema(tableId);
  if (!schema) {
    return null;
  }

  if (!schema.views) {
    schema.views = [];
  }

  // Check if view already exists
  if (schema.views.some(v => v.id === view.id)) {
    throw new Error(`View "${view.id}" already exists`);
  }

  schema.views.push(view);
  await storage.saveSchema(schema);
  return schema;
}

/**
 * Update a view
 */
export async function updateView(
  tableId: string,
  viewId: string,
  updates: Partial<ViewDefinition>
): Promise<TableSchema | null> {
  const schema = await storage.loadSchema(tableId);
  if (!schema || !schema.views) {
    return null;
  }

  const viewIndex = schema.views.findIndex(v => v.id === viewId);
  if (viewIndex === -1) {
    throw new Error(`View "${viewId}" not found`);
  }

  const existingView = schema.views[viewIndex];
  if (!existingView) {
    throw new Error(`View "${viewId}" not found`);
  }

  schema.views[viewIndex] = {
    ...existingView,
    ...updates,
    id: viewId, // Preserve ID
  };

  await storage.saveSchema(schema);
  return schema;
}

/**
 * Delete a view
 */
export async function deleteView(
  tableId: string,
  viewId: string
): Promise<TableSchema | null> {
  const schema = await storage.loadSchema(tableId);
  if (!schema || !schema.views) {
    return null;
  }

  const initialLength = schema.views.length;
  schema.views = schema.views.filter(v => v.id !== viewId);

  if (schema.views.length === initialLength) {
    throw new Error(`View "${viewId}" not found`);
  }

  await storage.saveSchema(schema);
  return schema;
}

/**
 * Query rows using a saved view
 */
export async function queryView(
  tableId: string,
  viewId: string,
  additionalOptions?: Partial<QueryOptions>
): Promise<QueryResult> {
  const schema = await storage.loadSchema(tableId);
  if (!schema || !schema.views) {
    throw new Error(`Table "${tableId}" not found`);
  }

  const view = schema.views.find(v => v.id === viewId);
  if (!view) {
    throw new Error(`View "${viewId}" not found`);
  }

  // Build query options from view
  const options: QueryOptions = {
    filter_text: view.filter,
    columns: view.columns,
    ...additionalOptions,
  };

  // Parse sort from view
  if (view.sort) {
    const sortMatch = view.sort.match(/^(\w+)\s*(ASC|DESC)?$/i);
    if (sortMatch) {
      options.sort_by = sortMatch[1];
      options.sort_direction = (sortMatch[2]?.toUpperCase() as 'ASC' | 'DESC') || 'ASC';
    }
  }

  return queryRows(tableId, options);
}

// ============================================
// Template Operations
// ============================================

/**
 * List available templates
 */
export async function listTemplates() {
  return storage.listTemplates();
}

/**
 * Apply a template
 */
export async function applyTemplate(templateId: string) {
  return storage.applyTemplate(templateId);
}

// ============================================
// Export for Module
// ============================================

export {
  sanitizeTableId,
  generateRowId,
} from './storage';
