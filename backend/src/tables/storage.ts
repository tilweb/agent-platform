/**
 * Table Storage Service
 *
 * Handles file-based persistence for tables using YAML files.
 * Each table is stored in its own directory with schema.yaml and data.yaml files.
 */

import { readFile, writeFile, readdir, mkdir, rm, access, rename } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, join } from 'path';
import * as yaml from 'yaml';
import type {
  TableSchema,
  TableData,
  RowData,
  CreateTableParams,
  TableTemplate,
} from './types';
import { generateId } from '../utils/id';

// ============================================
// Constants
// ============================================

const TABLES_DIR = resolve(process.cwd(), '../data/tables');
const TEMPLATES_DIR = resolve(TABLES_DIR, '_templates');
const SCHEMA_FILE = 'schema.yaml';
const DATA_FILE = 'data.yaml';

// ============================================
// Helper Functions
// ============================================

/**
 * Ensure the tables directory exists
 */
async function ensureTablesDir(): Promise<void> {
  if (!existsSync(TABLES_DIR)) {
    await mkdir(TABLES_DIR, { recursive: true });
  }
}

/**
 * Ensure the templates directory exists
 */
async function ensureTemplatesDir(): Promise<void> {
  if (!existsSync(TEMPLATES_DIR)) {
    await mkdir(TEMPLATES_DIR, { recursive: true });
  }
}

/**
 * Get the directory path for a table
 */
function getTableDir(tableId: string): string {
  return resolve(TABLES_DIR, tableId);
}

/**
 * Get the schema file path for a table
 */
function getSchemaPath(tableId: string): string {
  return resolve(getTableDir(tableId), SCHEMA_FILE);
}

/**
 * Get the data file path for a table
 */
function getDataPath(tableId: string): string {
  return resolve(getTableDir(tableId), DATA_FILE);
}

/**
 * Sanitize a table ID to be filesystem-safe
 */
export function sanitizeTableId(id: string): string {
  return id
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generate a unique row ID
 */
export function generateRowId(): string {
  return generateId('row');
}

/**
 * Parse YAML content safely
 */
function parseYaml<T>(content: string): T {
  return yaml.parse(content) as T;
}

/**
 * Stringify data to YAML
 */
function toYaml(data: any): string {
  return yaml.stringify(data, {
    indent: 2,
    lineWidth: 0,
    defaultStringType: 'QUOTE_DOUBLE',
    defaultKeyType: 'PLAIN',
  });
}

// ============================================
// Schema Operations
// ============================================

/**
 * Check if a table exists
 */
export async function tableExists(tableId: string): Promise<boolean> {
  const schemaPath = getSchemaPath(tableId);
  try {
    await access(schemaPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load a table schema
 */
export async function loadSchema(tableId: string): Promise<TableSchema | null> {
  const schemaPath = getSchemaPath(tableId);

  try {
    const content = await readFile(schemaPath, 'utf-8');
    return parseYaml<TableSchema>(content);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Save a table schema
 */
export async function saveSchema(schema: TableSchema): Promise<void> {
  await ensureTablesDir();

  const tableDir = getTableDir(schema.id);
  if (!existsSync(tableDir)) {
    await mkdir(tableDir, { recursive: true });
  }

  schema.updated_at = new Date().toISOString();
  const content = toYaml(schema);
  await writeFile(getSchemaPath(schema.id), content, 'utf-8');
}

/**
 * Create a new table
 */
export async function createTable(params: CreateTableParams): Promise<TableSchema> {
  const tableId = sanitizeTableId(params.id);

  if (await tableExists(tableId)) {
    throw new Error(`Table "${tableId}" already exists`);
  }

  const now = new Date().toISOString();
  const schema: TableSchema = {
    id: tableId,
    name: params.name,
    description: params.description,
    icon: params.icon,
    columns: params.columns,
    settings: params.settings || {
      primary_column: params.columns[0]?.id,
      default_sort: params.columns[0]?.id,
      default_sort_direction: 'ASC',
    },
    views: params.views || [],
    created_at: now,
    updated_at: now,
  };

  await saveSchema(schema);

  // Initialize empty data file
  const data: TableData = {
    updated_at: now,
    row_count: 0,
    rows: [],
  };
  await saveData(tableId, data);

  return schema;
}

/**
 * Delete a table and all its data
 */
export async function deleteTable(tableId: string): Promise<boolean> {
  const tableDir = getTableDir(tableId);

  if (!existsSync(tableDir)) {
    return false;
  }

  await rm(tableDir, { recursive: true, force: true });
  return true;
}

/**
 * Rename a table
 */
export async function renameTable(oldId: string, newId: string): Promise<TableSchema | null> {
  const sanitizedNewId = sanitizeTableId(newId);

  if (await tableExists(sanitizedNewId)) {
    throw new Error(`Table "${sanitizedNewId}" already exists`);
  }

  const schema = await loadSchema(oldId);
  if (!schema) {
    return null;
  }

  const oldDir = getTableDir(oldId);
  const newDir = getTableDir(sanitizedNewId);

  await rename(oldDir, newDir);

  // Update schema with new ID
  schema.id = sanitizedNewId;
  await saveSchema(schema);

  return schema;
}

/**
 * List all tables
 */
export async function listTables(): Promise<TableSchema[]> {
  await ensureTablesDir();

  const entries = await readdir(TABLES_DIR, { withFileTypes: true });
  const tables: TableSchema[] = [];

  for (const entry of entries) {
    // Skip hidden directories, templates, and non-directories
    if (!entry.isDirectory() || entry.name.startsWith('_') || entry.name.startsWith('.')) {
      continue;
    }

    const schema = await loadSchema(entry.name);
    if (schema) {
      tables.push(schema);
    }
  }

  // Sort by name
  tables.sort((a, b) => a.name.localeCompare(b.name));

  return tables;
}

// ============================================
// Data Operations
// ============================================

/**
 * Load table data
 */
export async function loadData(tableId: string): Promise<TableData | null> {
  const dataPath = getDataPath(tableId);

  try {
    const content = await readFile(dataPath, 'utf-8');
    return parseYaml<TableData>(content);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Save table data
 */
export async function saveData(tableId: string, data: TableData): Promise<void> {
  data.updated_at = new Date().toISOString();
  data.row_count = data.rows.length;

  const content = toYaml(data);
  await writeFile(getDataPath(tableId), content, 'utf-8');
}

/**
 * Add a row to a table
 */
export async function addRow(tableId: string, rowData: Record<string, any>): Promise<RowData> {
  const data = await loadData(tableId);
  if (!data) {
    throw new Error(`Table "${tableId}" not found or has no data file`);
  }

  const now = new Date().toISOString();
  const row: RowData = {
    _id: generateRowId(),
    _created_at: now,
    _updated_at: now,
    ...rowData,
  };

  data.rows.push(row);
  await saveData(tableId, data);

  return row;
}

/**
 * Update a row in a table
 */
export async function updateRow(
  tableId: string,
  rowId: string,
  updates: Record<string, any>
): Promise<RowData | null> {
  const data = await loadData(tableId);
  if (!data) {
    throw new Error(`Table "${tableId}" not found or has no data file`);
  }

  const rowIndex = data.rows.findIndex(r => r._id === rowId);
  if (rowIndex === -1) {
    return null;
  }

  const now = new Date().toISOString();
  data.rows[rowIndex] = {
    ...data.rows[rowIndex],
    ...updates,
    _id: rowId, // Preserve original ID
    _updated_at: now,
  };

  await saveData(tableId, data);

  return data.rows[rowIndex];
}

/**
 * Delete a row from a table
 */
export async function deleteRow(tableId: string, rowId: string): Promise<boolean> {
  const data = await loadData(tableId);
  if (!data) {
    throw new Error(`Table "${tableId}" not found or has no data file`);
  }

  const initialLength = data.rows.length;
  data.rows = data.rows.filter(r => r._id !== rowId);

  if (data.rows.length === initialLength) {
    return false;
  }

  await saveData(tableId, data);
  return true;
}

/**
 * Delete multiple rows from a table
 */
export async function deleteRows(tableId: string, rowIds: string[]): Promise<number> {
  const data = await loadData(tableId);
  if (!data) {
    throw new Error(`Table "${tableId}" not found or has no data file`);
  }

  const rowIdSet = new Set(rowIds);
  const initialLength = data.rows.length;
  data.rows = data.rows.filter(r => !rowIdSet.has(r._id));

  const deletedCount = initialLength - data.rows.length;
  if (deletedCount > 0) {
    await saveData(tableId, data);
  }

  return deletedCount;
}

/**
 * Get a single row by ID
 */
export async function getRow(tableId: string, rowId: string): Promise<RowData | null> {
  const data = await loadData(tableId);
  if (!data) {
    return null;
  }

  return data.rows.find(r => r._id === rowId) || null;
}

/**
 * Replace all rows in a table (for bulk import)
 */
export async function replaceAllRows(tableId: string, rows: RowData[]): Promise<void> {
  const now = new Date().toISOString();

  // Ensure all rows have IDs and timestamps
  const processedRows = rows.map(row => ({
    ...row,
    _id: row._id || generateRowId(),
    _created_at: row._created_at || now,
    _updated_at: now,
  }));

  const data: TableData = {
    updated_at: now,
    row_count: processedRows.length,
    rows: processedRows,
  };

  await saveData(tableId, data);
}

// ============================================
// Template Operations
// ============================================

/**
 * Load a template
 */
export async function loadTemplate(templateId: string): Promise<TableTemplate | null> {
  const templatePath = resolve(TEMPLATES_DIR, `${templateId}.yaml`);

  try {
    const content = await readFile(templatePath, 'utf-8');
    return parseYaml<TableTemplate>(content);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Save a template
 */
export async function saveTemplate(template: TableTemplate): Promise<void> {
  await ensureTemplatesDir();

  const templatePath = resolve(TEMPLATES_DIR, `${template.id}.yaml`);
  const content = toYaml(template);
  await writeFile(templatePath, content, 'utf-8');
}

/**
 * List all templates
 */
export async function listTemplates(): Promise<TableTemplate[]> {
  await ensureTemplatesDir();

  const entries = await readdir(TEMPLATES_DIR);
  const templates: TableTemplate[] = [];

  for (const entry of entries) {
    if (!entry.endsWith('.yaml')) continue;

    const templateId = entry.replace('.yaml', '');
    const template = await loadTemplate(templateId);
    if (template) {
      templates.push(template);
    }
  }

  return templates;
}

/**
 * Apply a template to create tables
 */
export async function applyTemplate(templateId: string): Promise<TableSchema[]> {
  const template = await loadTemplate(templateId);
  if (!template) {
    throw new Error(`Template "${templateId}" not found`);
  }

  const createdTables: TableSchema[] = [];

  for (const tableParams of template.tables) {
    // Skip if table already exists
    if (await tableExists(tableParams.id)) {
      console.log(`Skipping existing table: ${tableParams.id}`);
      continue;
    }

    const table = await createTable(tableParams);
    createdTables.push(table);
  }

  return createdTables;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get table statistics
 */
export async function getTableStats(tableId: string): Promise<{
  row_count: number;
  last_updated: string;
  size_bytes: number;
} | null> {
  const schema = await loadSchema(tableId);
  const data = await loadData(tableId);

  if (!schema || !data) {
    return null;
  }

  const schemaPath = getSchemaPath(tableId);
  const dataPath = getDataPath(tableId);

  let sizeBytes = 0;
  try {
    const schemaContent = await readFile(schemaPath, 'utf-8');
    const dataContent = await readFile(dataPath, 'utf-8');
    sizeBytes = Buffer.byteLength(schemaContent, 'utf-8') + Buffer.byteLength(dataContent, 'utf-8');
  } catch {
    // Ignore size calculation errors
  }

  return {
    row_count: data.row_count,
    last_updated: data.updated_at,
    size_bytes: sizeBytes,
  };
}

/**
 * Export table data and schema to a single object
 */
export async function exportTable(tableId: string): Promise<{
  schema: TableSchema;
  data: TableData;
} | null> {
  const schema = await loadSchema(tableId);
  const data = await loadData(tableId);

  if (!schema || !data) {
    return null;
  }

  return { schema, data };
}

/**
 * Import table data and schema from an export object
 */
export async function importTable(
  tableExport: { schema: TableSchema; data: TableData },
  overwrite: boolean = false
): Promise<TableSchema> {
  const { schema, data } = tableExport;
  const tableId = sanitizeTableId(schema.id);

  if (await tableExists(tableId)) {
    if (!overwrite) {
      throw new Error(`Table "${tableId}" already exists`);
    }
    await deleteTable(tableId);
  }

  // Create the table
  schema.id = tableId;
  await saveSchema(schema);
  await saveData(tableId, data);

  return schema;
}
