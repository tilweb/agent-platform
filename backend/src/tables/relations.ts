/**
 * Relations Module
 *
 * Handles relationships between tables.
 */

import type {
  TableSchema,
  ColumnDefinition,
  RowData,
  RelationInfo,
} from './types';
import * as storage from './storage';

// ============================================
// Relation Discovery
// ============================================

/**
 * Get all relations for a table
 */
export async function getTableRelations(tableId: string): Promise<RelationInfo[]> {
  const schema = await storage.loadSchema(tableId);
  if (!schema) {
    return [];
  }

  const relations: RelationInfo[] = [];

  for (const column of schema.columns) {
    if (column.type === 'relation' && column.relation_table) {
      relations.push({
        source_table: tableId,
        source_column: column.id,
        target_table: column.relation_table,
        display_column: column.relation_display_column,
      });
    }
  }

  return relations;
}

/**
 * Get all relations pointing to a table (reverse relations)
 */
export async function getReverseRelations(tableId: string): Promise<RelationInfo[]> {
  const tables = await storage.listTables();
  const relations: RelationInfo[] = [];

  for (const table of tables) {
    for (const column of table.columns) {
      if (column.type === 'relation' && column.relation_table === tableId) {
        relations.push({
          source_table: table.id,
          source_column: column.id,
          target_table: tableId,
          display_column: column.relation_display_column,
        });
      }
    }
  }

  return relations;
}

/**
 * Get all relations in the system
 */
export async function getAllRelations(): Promise<RelationInfo[]> {
  const tables = await storage.listTables();
  const relations: RelationInfo[] = [];

  for (const table of tables) {
    for (const column of table.columns) {
      if (column.type === 'relation' && column.relation_table) {
        relations.push({
          source_table: table.id,
          source_column: column.id,
          target_table: column.relation_table,
          display_column: column.relation_display_column,
        });
      }
    }
  }

  return relations;
}

// ============================================
// Relation Resolution
// ============================================

/**
 * Resolve a single relation value to its display value
 */
export async function resolveRelation(
  targetTable: string,
  rowId: string,
  displayColumn?: string
): Promise<string | null> {
  const data = await storage.loadData(targetTable);
  if (!data) {
    return null;
  }

  const row = data.rows.find(r => r._id === rowId);
  if (!row) {
    return null;
  }

  if (displayColumn) {
    return String(row[displayColumn] ?? row._id);
  }

  // Find first non-system column
  const schema = await storage.loadSchema(targetTable);
  const firstColumn = schema?.columns[0]?.id;

  return String(row[firstColumn || '_id'] ?? row._id);
}

/**
 * Resolve all relations in a row
 */
export async function resolveRowRelations(
  schema: TableSchema,
  row: RowData
): Promise<RowData> {
  const resolved = { ...row };

  const relationColumns = schema.columns.filter(c => c.type === 'relation');

  for (const column of relationColumns) {
    if (!column.relation_table || !row[column.id]) {
      continue;
    }

    const displayValue = await resolveRelation(
      column.relation_table,
      row[column.id],
      column.relation_display_column
    );

    if (displayValue) {
      resolved[`${column.id}_display`] = displayValue;
    }
  }

  return resolved;
}

/**
 * Resolve relations for multiple rows (more efficient)
 */
export async function resolveRowsRelations(
  schema: TableSchema,
  rows: RowData[]
): Promise<RowData[]> {
  const relationColumns = schema.columns.filter(c => c.type === 'relation');
  if (relationColumns.length === 0) {
    return rows;
  }

  // Load all related table data at once
  const relatedData = new Map<string, { data: Map<string, RowData>; schema: TableSchema }>();

  for (const column of relationColumns) {
    if (!column.relation_table || relatedData.has(column.relation_table)) {
      continue;
    }

    const data = await storage.loadData(column.relation_table);
    const tableSchema = await storage.loadSchema(column.relation_table);

    if (data && tableSchema) {
      const rowMap = new Map(data.rows.map(r => [r._id, r]));
      relatedData.set(column.relation_table, { data: rowMap, schema: tableSchema });
    }
  }

  // Resolve all rows
  return rows.map(row => {
    const resolved = { ...row };

    for (const column of relationColumns) {
      if (!column.relation_table || !row[column.id]) {
        continue;
      }

      const related = relatedData.get(column.relation_table);
      if (!related) {
        continue;
      }

      const relatedRow = related.data.get(row[column.id]);
      if (!relatedRow) {
        continue;
      }

      const displayColumn = column.relation_display_column ||
        related.schema.settings?.primary_column ||
        related.schema.columns[0]?.id;

      resolved[`${column.id}_display`] = String(
        relatedRow[displayColumn || '_id'] ?? relatedRow._id
      );
    }

    return resolved;
  });
}

// ============================================
// Relation Options
// ============================================

/**
 * Get available options for a relation column
 * Returns list of {id, label} for dropdown selection
 */
export async function getRelationOptions(
  relationTable: string,
  displayColumn?: string,
  searchTerm?: string,
  limit: number = 50
): Promise<Array<{ id: string; label: string }>> {
  const data = await storage.loadData(relationTable);
  const schema = await storage.loadSchema(relationTable);

  if (!data || !schema) {
    return [];
  }

  const displayCol = displayColumn ||
    schema.settings?.primary_column ||
    schema.columns[0]?.id;

  let rows = data.rows;

  // Filter by search term if provided
  if (searchTerm && displayCol) {
    const term = searchTerm.toLowerCase();
    rows = rows.filter(row => {
      const value = String(row[displayCol] || '').toLowerCase();
      return value.includes(term);
    });
  }

  // Limit results
  rows = rows.slice(0, limit);

  return rows.map(row => ({
    id: row._id,
    label: String(row[displayCol || '_id'] ?? row._id),
  }));
}

// ============================================
// Relation Integrity
// ============================================

/**
 * Check if a row is referenced by other tables
 */
export async function getRowReferences(
  tableId: string,
  rowId: string
): Promise<Array<{ table: string; column: string; count: number }>> {
  const reverseRelations = await getReverseRelations(tableId);
  const references: Array<{ table: string; column: string; count: number }> = [];

  for (const relation of reverseRelations) {
    const data = await storage.loadData(relation.source_table);
    if (!data) continue;

    const count = data.rows.filter(
      row => row[relation.source_column] === rowId
    ).length;

    if (count > 0) {
      references.push({
        table: relation.source_table,
        column: relation.source_column,
        count,
      });
    }
  }

  return references;
}

/**
 * Check if a table has incoming references (can't be deleted)
 */
export async function hasIncomingReferences(tableId: string): Promise<boolean> {
  const reverseRelations = await getReverseRelations(tableId);
  return reverseRelations.length > 0;
}

/**
 * Validate relation integrity for a row
 * Returns missing relation targets
 */
export async function validateRelationIntegrity(
  schema: TableSchema,
  row: RowData
): Promise<Array<{ column: string; targetTable: string; missingId: string }>> {
  const issues: Array<{ column: string; targetTable: string; missingId: string }> = [];

  const relationColumns = schema.columns.filter(c => c.type === 'relation');

  for (const column of relationColumns) {
    if (!column.relation_table || !row[column.id]) {
      continue;
    }

    const targetRow = await storage.getRow(column.relation_table, row[column.id]);
    if (!targetRow) {
      issues.push({
        column: column.id,
        targetTable: column.relation_table,
        missingId: row[column.id],
      });
    }
  }

  return issues;
}

/**
 * Fix broken relations by setting them to null
 */
export async function fixBrokenRelations(
  tableId: string
): Promise<{ fixed: number; errors: string[] }> {
  const schema = await storage.loadSchema(tableId);
  const data = await storage.loadData(tableId);

  if (!schema || !data) {
    return { fixed: 0, errors: [`Table "${tableId}" not found`] };
  }

  let fixed = 0;
  const errors: string[] = [];

  for (const row of data.rows) {
    const issues = await validateRelationIntegrity(schema, row);

    for (const issue of issues) {
      try {
        await storage.updateRow(tableId, row._id, {
          [issue.column]: null,
        });
        fixed++;
      } catch (error: any) {
        errors.push(`Failed to fix row ${row._id}: ${error.message}`);
      }
    }
  }

  return { fixed, errors };
}

// ============================================
// Cascading Operations
// ============================================

/**
 * Delete a row and optionally cascade to related rows
 */
export async function deleteRowWithCascade(
  tableId: string,
  rowId: string,
  options: {
    cascade?: boolean;
    nullifyReferences?: boolean;
  } = {}
): Promise<{ deleted: number; nullified: number }> {
  const references = await getRowReferences(tableId, rowId);
  let deleted = 0;
  let nullified = 0;

  if (references.length > 0) {
    if (options.cascade) {
      // Delete referencing rows
      for (const ref of references) {
        const data = await storage.loadData(ref.table);
        if (!data) continue;

        const rowsToDelete = data.rows
          .filter(row => row[ref.column] === rowId)
          .map(row => row._id);

        for (const refRowId of rowsToDelete) {
          await storage.deleteRow(ref.table, refRowId);
          deleted++;
        }
      }
    } else if (options.nullifyReferences) {
      // Set references to null
      for (const ref of references) {
        const data = await storage.loadData(ref.table);
        if (!data) continue;

        for (const row of data.rows) {
          if (row[ref.column] === rowId) {
            await storage.updateRow(ref.table, row._id, {
              [ref.column]: null,
            });
            nullified++;
          }
        }
      }
    } else {
      throw new Error(
        `Cannot delete row: ${references.length} references exist. ` +
        `Use cascade or nullifyReferences option.`
      );
    }
  }

  // Delete the row itself
  await storage.deleteRow(tableId, rowId);
  deleted++;

  return { deleted, nullified };
}
