/**
 * Table Storage Service — Postgres-backed (Drizzle).
 *
 * Schema-Definition pro Tabelle in `tables.tables` (jsonb-Spalte `schema`),
 * Rows in `tables.rows` (jsonb-Spalte `data`). Templates bleiben Code-Asset
 * im Image (System-Templates) — alle User-erstellten Tabellen leben in DB.
 */

import { eq, and } from 'drizzle-orm';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { readFile, readdir } from 'fs/promises';
import * as yaml from 'yaml';
import { getDb } from '../db';
import { userTables, userTableRows } from '../db/schema/tables';
import type {
  TableSchema,
  TableData,
  RowData,
  CreateTableParams,
  TableTemplate,
} from './types';

// Templates-Verzeichnis bleibt Code-Asset (gitcheckedin im Image).
const TEMPLATES_DIR = resolve(process.cwd(), '../data/tables/_templates');

export function sanitizeTableId(id: string): string {
  return id
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function generateRowId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `row_${timestamp}_${random}`;
}

function rowToSchema(row: typeof userTables.$inferSelect): TableSchema {
  const sch = (row.schema ?? {}) as Partial<TableSchema>;
  return {
    ...sch,
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  } as TableSchema;
}

// ============================================
// Schema Operations
// ============================================

export async function tableExists(tableId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db.select({ id: userTables.id }).from(userTables).where(eq(userTables.id, tableId)).limit(1);
  return rows.length > 0;
}

export async function loadSchema(tableId: string): Promise<TableSchema | null> {
  const db = getDb();
  const rows = await db.select().from(userTables).where(eq(userTables.id, tableId)).limit(1);
  return rows[0] ? rowToSchema(rows[0]) : null;
}

export async function saveSchema(schema: TableSchema): Promise<void> {
  schema.updated_at = new Date().toISOString();
  const db = getDb();
  await db.insert(userTables).values({
    id: schema.id,
    name: schema.name,
    description: (schema.description ?? null) as never,
    schema: schema as never,
    createdAt: schema.created_at ?? schema.updated_at,
    updatedAt: schema.updated_at,
  } as typeof userTables.$inferInsert).onConflictDoUpdate({
    target: userTables.id,
    set: {
      name: schema.name,
      description: schema.description ?? null,
      schema: schema as never,
      updatedAt: schema.updated_at,
    },
  });
}

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
  return schema;
}

export async function deleteTable(tableId: string): Promise<boolean> {
  const db = getDb();
  const res = await db.delete(userTables).where(eq(userTables.id, tableId)).returning({ id: userTables.id });
  return res.length > 0;
}

export async function renameTable(oldId: string, newId: string): Promise<TableSchema | null> {
  const sanitizedNewId = sanitizeTableId(newId);
  if (await tableExists(sanitizedNewId)) {
    throw new Error(`Table "${sanitizedNewId}" already exists`);
  }
  const schema = await loadSchema(oldId);
  if (!schema) return null;

  const db = getDb();
  // Rename: neue Row mit neuer ID, dann alte loeschen — Rows wandern via FK-Update.
  schema.id = sanitizedNewId;
  await saveSchema(schema);
  await db.update(userTableRows)
    .set({ tableId: sanitizedNewId })
    .where(eq(userTableRows.tableId, oldId));
  await db.delete(userTables).where(eq(userTables.id, oldId));
  return schema;
}

export async function listTables(): Promise<TableSchema[]> {
  const db = getDb();
  const rows = await db.select().from(userTables);
  const tables = rows.map(rowToSchema);
  tables.sort((a, b) => a.name.localeCompare(b.name));
  return tables;
}

// ============================================
// Data Operations
// ============================================

export async function loadData(tableId: string): Promise<TableData | null> {
  if (!(await tableExists(tableId))) return null;
  const db = getDb();
  const rows = await db.select().from(userTableRows).where(eq(userTableRows.tableId, tableId));
  const dataRows: RowData[] = rows.map(r => r.data as RowData);
  return {
    updated_at: new Date().toISOString(),
    row_count: dataRows.length,
    rows: dataRows,
  };
}

/**
 * Mass-Replace aller Rows einer Tabelle (fuer den Bulk-Import-Pfad und die alte
 * saveData-Aufruf-Stelle). Eigentlich nutzt der Code lieber addRow/updateRow/
 * deleteRow direkt — das ist nur fuer Backwards-Compat.
 */
export async function saveData(tableId: string, data: TableData): Promise<void> {
  const db = getDb();
  await db.delete(userTableRows).where(eq(userTableRows.tableId, tableId));
  if (data.rows.length > 0) {
    const now = new Date().toISOString();
    await db.insert(userTableRows).values(data.rows.map(r => ({
      id: r._id || generateRowId(),
      tableId,
      data: r as never,
      createdAt: r._created_at ?? now,
      updatedAt: now,
    })));
  }
}

export async function addRow(tableId: string, rowData: Record<string, any>): Promise<RowData> {
  if (!(await tableExists(tableId))) {
    throw new Error(`Table "${tableId}" not found`);
  }
  const now = new Date().toISOString();
  const row: RowData = {
    _id: generateRowId(),
    _created_at: now,
    _updated_at: now,
    ...rowData,
  };
  const db = getDb();
  await db.insert(userTableRows).values({
    id: row._id,
    tableId,
    data: row as never,
    createdAt: now,
    updatedAt: now,
  });
  return row;
}

export async function updateRow(
  tableId: string,
  rowId: string,
  updates: Record<string, any>,
): Promise<RowData | null> {
  const db = getDb();
  const rows = await db.select().from(userTableRows)
    .where(and(eq(userTableRows.tableId, tableId), eq(userTableRows.id, rowId)))
    .limit(1);
  if (!rows[0]) return null;
  const existing = rows[0].data as RowData;
  const now = new Date().toISOString();
  const merged: RowData = {
    ...existing,
    ...updates,
    _id: rowId,
    _updated_at: now,
  };
  await db.update(userTableRows)
    .set({ data: merged as never, updatedAt: now })
    .where(eq(userTableRows.id, rowId));
  return merged;
}

export async function deleteRow(tableId: string, rowId: string): Promise<boolean> {
  const db = getDb();
  const res = await db.delete(userTableRows)
    .where(and(eq(userTableRows.tableId, tableId), eq(userTableRows.id, rowId)))
    .returning({ id: userTableRows.id });
  return res.length > 0;
}

export async function deleteRows(tableId: string, rowIds: string[]): Promise<number> {
  let deleted = 0;
  for (const rowId of rowIds) {
    if (await deleteRow(tableId, rowId)) deleted++;
  }
  return deleted;
}

export async function getRow(tableId: string, rowId: string): Promise<RowData | null> {
  const db = getDb();
  const rows = await db.select().from(userTableRows)
    .where(and(eq(userTableRows.tableId, tableId), eq(userTableRows.id, rowId)))
    .limit(1);
  return rows[0] ? (rows[0].data as RowData) : null;
}

export async function replaceAllRows(tableId: string, rows: RowData[]): Promise<void> {
  const now = new Date().toISOString();
  const processed = rows.map(row => ({
    ...row,
    _id: row._id || generateRowId(),
    _created_at: row._created_at || now,
    _updated_at: now,
  }));
  await saveData(tableId, {
    updated_at: now,
    row_count: processed.length,
    rows: processed,
  });
}

// ============================================
// Templates (read-only Code-Assets)
// ============================================

export async function loadTemplate(templateId: string): Promise<TableTemplate | null> {
  const path = resolve(TEMPLATES_DIR, `${templateId}.yaml`);
  if (!existsSync(path)) return null;
  try {
    const content = await readFile(path, 'utf-8');
    return yaml.parse(content) as TableTemplate;
  } catch {
    return null;
  }
}

/**
 * Templates sind read-only Code-Assets — Save ist no-op fuer DB-Layer.
 */
export async function saveTemplate(_template: TableTemplate): Promise<void> {
  /* no-op: Templates leben im Image */
}

export async function listTemplates(): Promise<TableTemplate[]> {
  if (!existsSync(TEMPLATES_DIR)) return [];
  const entries = await readdir(TEMPLATES_DIR);
  const templates: TableTemplate[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.yaml')) continue;
    const templateId = entry.replace('.yaml', '');
    const template = await loadTemplate(templateId);
    if (template) templates.push(template);
  }
  return templates;
}

export async function applyTemplate(templateId: string): Promise<TableSchema[]> {
  const template = await loadTemplate(templateId);
  if (!template) throw new Error(`Template "${templateId}" not found`);
  const createdTables: TableSchema[] = [];
  for (const tableParams of template.tables) {
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
// Utilities
// ============================================

export async function getTableStats(tableId: string): Promise<{
  row_count: number;
  last_updated: string;
  size_bytes: number;
} | null> {
  const schema = await loadSchema(tableId);
  if (!schema) return null;
  const db = getDb();
  const rows = await db.select().from(userTableRows).where(eq(userTableRows.tableId, tableId));
  const dataStr = JSON.stringify(rows.map(r => r.data));
  return {
    row_count: rows.length,
    last_updated: schema.updated_at,
    size_bytes: Buffer.byteLength(JSON.stringify(schema), 'utf-8') + Buffer.byteLength(dataStr, 'utf-8'),
  };
}

export async function exportTable(tableId: string): Promise<{
  schema: TableSchema;
  data: TableData;
} | null> {
  const schema = await loadSchema(tableId);
  const data = await loadData(tableId);
  if (!schema || !data) return null;
  return { schema, data };
}

export async function importTable(
  tableExport: { schema: TableSchema; data: TableData },
  overwrite = false,
): Promise<TableSchema> {
  const { schema, data } = tableExport;
  const tableId = sanitizeTableId(schema.id);
  if (await tableExists(tableId)) {
    if (!overwrite) throw new Error(`Table "${tableId}" already exists`);
    await deleteTable(tableId);
  }
  schema.id = tableId;
  await saveSchema(schema);
  await saveData(tableId, data);
  return schema;
}
