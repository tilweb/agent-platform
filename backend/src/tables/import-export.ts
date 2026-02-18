/**
 * Import/Export Module
 *
 * Handles CSV, JSON, and YAML import/export for tables.
 */

import * as yaml from 'yaml';
import type {
  TableSchema,
  TableData,
  RowData,
  ColumnDefinition,
  ExportFormat,
  ExportOptions,
  ImportOptions,
  ImportResult,
} from './types';
import * as storage from './storage';
import { normalizeRowData, validateRow } from './service';

// ============================================
// CSV Helpers
// ============================================

/**
 * Parse a CSV string into rows
 */
function parseCSV(csvContent: string): string[][] {
  const rows: string[][] = [];
  const lines = csvContent.split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;

    const row: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++;
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    row.push(current.trim());
    rows.push(row);
  }

  return rows;
}

/**
 * Convert a value to CSV-safe string
 */
function toCSVValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }

  const str = String(value);

  // Quote if contains comma, newline, or quote
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Convert rows to CSV string
 */
function toCSV(headers: string[], rows: Record<string, any>[]): string {
  const lines: string[] = [];

  // Header row
  lines.push(headers.map(h => toCSVValue(h)).join(','));

  // Data rows
  for (const row of rows) {
    const values = headers.map(h => toCSVValue(row[h]));
    lines.push(values.join(','));
  }

  return lines.join('\n');
}

// ============================================
// Export Functions
// ============================================

/**
 * Export table data to the specified format
 */
export async function exportTable(
  tableId: string,
  options: ExportOptions
): Promise<string> {
  const schema = await storage.loadSchema(tableId);
  const data = await storage.loadData(tableId);

  if (!schema || !data) {
    throw new Error(`Table "${tableId}" not found`);
  }

  // Determine columns to export
  const columns = options.columns && options.columns.length > 0
    ? schema.columns.filter(c => options.columns!.includes(c.id))
    : schema.columns;

  // Get rows (apply filter if specified)
  let rows = data.rows;
  if (options.filter && options.filter.length > 0) {
    // Simple filter implementation
    rows = rows.filter(row => {
      return options.filter!.every(f => {
        const value = row[f.column];
        switch (f.operator) {
          case 'eq': return value === f.value;
          case 'neq': return value !== f.value;
          case 'contains': return String(value).includes(String(f.value));
          default: return true;
        }
      });
    });
  }

  switch (options.format) {
    case 'csv':
      return exportToCSV(columns, rows);

    case 'json':
      return exportToJSON(schema, columns, rows, options.include_schema);

    case 'yaml':
      return exportToYAML(schema, columns, rows, options.include_schema);

    default:
      throw new Error(`Unsupported export format: ${options.format}`);
  }
}

/**
 * Export to CSV format
 */
function exportToCSV(columns: ColumnDefinition[], rows: RowData[]): string {
  const headers = ['_id', ...columns.map(c => c.id)];
  const exportRows = rows.map(row => {
    const exportRow: Record<string, any> = { _id: row._id };
    for (const col of columns) {
      exportRow[col.id] = row[col.id];
    }
    return exportRow;
  });

  return toCSV(headers, exportRows);
}

/**
 * Export to JSON format
 */
function exportToJSON(
  schema: TableSchema,
  columns: ColumnDefinition[],
  rows: RowData[],
  includeSchema?: boolean
): string {
  const exportRows = rows.map(row => {
    const exportRow: Record<string, any> = { _id: row._id };
    for (const col of columns) {
      exportRow[col.id] = row[col.id];
    }
    return exportRow;
  });

  if (includeSchema) {
    return JSON.stringify({
      schema: {
        id: schema.id,
        name: schema.name,
        description: schema.description,
        columns: columns,
      },
      rows: exportRows,
    }, null, 2);
  }

  return JSON.stringify(exportRows, null, 2);
}

/**
 * Export to YAML format
 */
function exportToYAML(
  schema: TableSchema,
  columns: ColumnDefinition[],
  rows: RowData[],
  includeSchema?: boolean
): string {
  const exportRows = rows.map(row => {
    const exportRow: Record<string, any> = { _id: row._id };
    for (const col of columns) {
      exportRow[col.id] = row[col.id];
    }
    return exportRow;
  });

  if (includeSchema) {
    return yaml.stringify({
      schema: {
        id: schema.id,
        name: schema.name,
        description: schema.description,
        columns: columns,
      },
      rows: exportRows,
    });
  }

  return yaml.stringify(exportRows);
}

// ============================================
// Import Functions
// ============================================

/**
 * Import data into a table
 */
export async function importData(
  tableId: string,
  content: string,
  options: ImportOptions
): Promise<ImportResult> {
  const schema = await storage.loadSchema(tableId);
  if (!schema) {
    throw new Error(`Table "${tableId}" not found`);
  }

  let rawRows: Record<string, any>[];

  switch (options.format) {
    case 'csv':
      rawRows = parseCSVToRows(content, options.column_mapping);
      break;

    case 'json':
      rawRows = parseJSONToRows(content, options.column_mapping);
      break;

    case 'yaml':
      rawRows = parseYAMLToRows(content, options.column_mapping);
      break;

    default:
      throw new Error(`Unsupported import format: ${options.format}`);
  }

  return processImportRows(tableId, schema, rawRows, options);
}

/**
 * Parse CSV content to rows
 */
function parseCSVToRows(
  content: string,
  columnMapping?: Record<string, string>
): Record<string, any>[] {
  const parsed = parseCSV(content);
  if (parsed.length < 2) {
    return [];
  }

  const headers = parsed[0];
  if (!headers) {
    return [];
  }
  const dataRows = parsed.slice(1);

  return dataRows.map(row => {
    const obj: Record<string, any> = {};

    for (let i = 0; i < headers.length; i++) {
      let key = headers[i];
      if (!key) continue;

      // Apply column mapping if provided
      if (columnMapping && columnMapping[key]) {
        key = columnMapping[key] || key;
      }

      let value: any = row[i] || '';

      // Try to parse JSON values (for arrays)
      if (value.startsWith('[') || value.startsWith('{')) {
        try {
          value = JSON.parse(value);
        } catch {
          // Keep as string
        }
      }

      obj[key] = value;
    }

    return obj;
  });
}

/**
 * Parse JSON content to rows
 */
function parseJSONToRows(
  content: string,
  columnMapping?: Record<string, string>
): Record<string, any>[] {
  const parsed = JSON.parse(content);

  // Handle both array and { rows: [...] } format
  const rows = Array.isArray(parsed) ? parsed : (parsed.rows || []);

  if (columnMapping) {
    return rows.map((row: Record<string, any>) => {
      const mapped: Record<string, any> = {};
      for (const [key, value] of Object.entries(row)) {
        const mappedKey = columnMapping[key] || key;
        mapped[mappedKey] = value;
      }
      return mapped;
    });
  }

  return rows;
}

/**
 * Parse YAML content to rows
 */
function parseYAMLToRows(
  content: string,
  columnMapping?: Record<string, string>
): Record<string, any>[] {
  const parsed = yaml.parse(content);

  // Handle both array and { rows: [...] } format
  const rows = Array.isArray(parsed) ? parsed : (parsed.rows || []);

  if (columnMapping) {
    return rows.map((row: Record<string, any>) => {
      const mapped: Record<string, any> = {};
      for (const [key, value] of Object.entries(row)) {
        const mappedKey = columnMapping[key] || key;
        mapped[mappedKey] = value;
      }
      return mapped;
    });
  }

  return rows;
}

/**
 * Process import rows
 */
async function processImportRows(
  tableId: string,
  schema: TableSchema,
  rawRows: Record<string, any>[],
  options: ImportOptions
): Promise<ImportResult> {
  const result: ImportResult = {
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (let i = 0; i < rawRows.length; i++) {
    const rawRow = rawRows[i];
    if (!rawRow) continue;

    try {
      // Normalize the row data
      const normalized = normalizeRowData(schema, rawRow);

      // Validate
      const validation = validateRow(schema, normalized);
      if (!validation.valid) {
        if (options.skip_invalid) {
          result.skipped++;
          result.errors.push({
            row: i + 1,
            message: validation.errors.map(e => e.message).join(', '),
            data: rawRow,
          });
          continue;
        } else {
          throw new Error(validation.errors.map(e => e.message).join(', '));
        }
      }

      // Check if row exists (by _id)
      if (rawRow._id && options.update_existing) {
        const existing = await storage.getRow(tableId, rawRow._id);
        if (existing) {
          await storage.updateRow(tableId, rawRow._id, normalized);
          result.updated++;
          continue;
        }
      }

      // Create new row
      await storage.addRow(tableId, normalized);
      result.imported++;

    } catch (error: any) {
      result.errors.push({
        row: i + 1,
        message: error.message,
        data: rawRow,
      });

      if (!options.skip_invalid) {
        throw error;
      }

      result.skipped++;
    }
  }

  return result;
}

// ============================================
// Bulk Operations
// ============================================

/**
 * Replace all table data with imported data
 */
export async function replaceTableData(
  tableId: string,
  content: string,
  format: ExportFormat
): Promise<{ count: number }> {
  const schema = await storage.loadSchema(tableId);
  if (!schema) {
    throw new Error(`Table "${tableId}" not found`);
  }

  let rawRows: Record<string, any>[];

  switch (format) {
    case 'csv':
      rawRows = parseCSVToRows(content);
      break;
    case 'json':
      rawRows = parseJSONToRows(content);
      break;
    case 'yaml':
      rawRows = parseYAMLToRows(content);
      break;
    default:
      throw new Error(`Unsupported format: ${format}`);
  }

  // Normalize all rows
  const normalizedRows: RowData[] = rawRows.map(row => {
    const normalized = normalizeRowData(schema, row);
    return {
      _id: row._id || storage.generateRowId(),
      ...normalized,
    };
  });

  // Replace all data
  await storage.replaceAllRows(tableId, normalizedRows);

  return { count: normalizedRows.length };
}

/**
 * Export full table backup (schema + data)
 */
export async function exportTableBackup(tableId: string): Promise<string> {
  const tableExport = await storage.exportTable(tableId);
  if (!tableExport) {
    throw new Error(`Table "${tableId}" not found`);
  }

  return yaml.stringify({
    version: '1.0',
    exported_at: new Date().toISOString(),
    table: tableExport.schema,
    data: tableExport.data,
  });
}

/**
 * Import table from backup
 */
export async function importTableBackup(
  content: string,
  overwrite: boolean = false
): Promise<TableSchema> {
  const parsed = yaml.parse(content);

  if (!parsed.table || !parsed.data) {
    throw new Error('Invalid backup format: missing table or data');
  }

  return storage.importTable(
    { schema: parsed.table, data: parsed.data },
    overwrite
  );
}

// ============================================
// Preview Functions
// ============================================

/**
 * Preview import without actually importing
 */
export async function previewImport(
  tableId: string,
  content: string,
  format: ExportFormat,
  limit: number = 10
): Promise<{
  columns: string[];
  rows: Record<string, any>[];
  total: number;
  warnings: string[];
}> {
  const schema = await storage.loadSchema(tableId);
  if (!schema) {
    throw new Error(`Table "${tableId}" not found`);
  }

  let rawRows: Record<string, any>[];

  switch (format) {
    case 'csv':
      rawRows = parseCSVToRows(content);
      break;
    case 'json':
      rawRows = parseJSONToRows(content);
      break;
    case 'yaml':
      rawRows = parseYAMLToRows(content);
      break;
    default:
      throw new Error(`Unsupported format: ${format}`);
  }

  const warnings: string[] = [];

  // Check for unknown columns
  const firstRow = rawRows[0];
  if (rawRows.length > 0 && firstRow) {
    const schemaColumnIds = new Set(schema.columns.map(c => c.id));
    const importColumns = new Set(Object.keys(firstRow).filter(k => !k.startsWith('_')));

    for (const col of importColumns) {
      if (!schemaColumnIds.has(col)) {
        warnings.push(`Column "${col}" not found in table schema and will be ignored`);
      }
    }

    // Check for missing required columns
    for (const col of schema.columns) {
      if (col.required && !importColumns.has(col.id)) {
        warnings.push(`Required column "${col.name}" is missing from import data`);
      }
    }
  }

  // Return preview
  const previewRows = rawRows.slice(0, limit).map(row => {
    const normalized: Record<string, any> = {};
    for (const col of schema.columns) {
      normalized[col.id] = row[col.id] ?? null;
    }
    return normalized;
  });

  return {
    columns: schema.columns.map(c => c.id),
    rows: previewRows,
    total: rawRows.length,
    warnings,
  };
}
