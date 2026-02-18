/**
 * Tables Module
 *
 * File-based table system for structured data management.
 */

// Export types
export * from './types';

// Import and re-export modules as namespaces
import * as storageModule from './storage';
import * as serviceModule from './service';
import * as viewsModule from './views';
import * as relationsModule from './relations';
import * as importExportModule from './import-export';

export const storage = storageModule;
export const tableService = serviceModule;
export const views = viewsModule;
export const relations = relationsModule;
export const importExport = importExportModule;

// Convenience re-exports for common operations
export {
  createTable,
  getTable,
  getTableWithData,
  updateTable,
  deleteTable,
  listTables,
  listTablesWithStats,
  addColumn,
  updateColumn,
  deleteColumn,
  reorderColumns,
  addRow,
  updateRow,
  deleteRow,
  deleteRows,
  getRow,
  queryRows,
  validateRow,
  normalizeRowData,
  parseFilterText,
  addView,
  updateView,
  deleteView,
  queryView,
  listTemplates,
  applyTemplate,
} from './service';
