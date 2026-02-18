/**
 * Views Module
 *
 * Handles saved views (filtered queries) for tables.
 */

import type {
  TableSchema,
  ViewDefinition,
  QueryOptions,
  QueryResult,
  FilterCondition,
} from './types';
import * as storage from './storage';
import { queryRows, parseFilterText } from './service';

// ============================================
// View Types
// ============================================

export interface CreateViewParams {
  id: string;
  name: string;
  filter?: string;
  sort?: string;
  columns?: string[];
  description?: string;
}

export interface UpdateViewParams {
  name?: string;
  filter?: string;
  sort?: string;
  columns?: string[];
  description?: string;
}

// ============================================
// View Operations
// ============================================

/**
 * Get all views for a table
 */
export async function getViews(tableId: string): Promise<ViewDefinition[]> {
  const schema = await storage.loadSchema(tableId);
  return schema?.views || [];
}

/**
 * Get a specific view
 */
export async function getView(
  tableId: string,
  viewId: string
): Promise<ViewDefinition | null> {
  const schema = await storage.loadSchema(tableId);
  if (!schema?.views) {
    return null;
  }
  return schema.views.find(v => v.id === viewId) || null;
}

/**
 * Create a new view
 */
export async function createView(
  tableId: string,
  params: CreateViewParams
): Promise<ViewDefinition> {
  const schema = await storage.loadSchema(tableId);
  if (!schema) {
    throw new Error(`Table "${tableId}" not found`);
  }

  if (!schema.views) {
    schema.views = [];
  }

  // Sanitize view ID
  const viewId = params.id
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  // Check for duplicates
  if (schema.views.some(v => v.id === viewId)) {
    throw new Error(`View "${viewId}" already exists`);
  }

  // Validate filter syntax
  if (params.filter) {
    try {
      parseFilterText(params.filter);
    } catch (error) {
      throw new Error(`Invalid filter syntax: ${params.filter}`);
    }
  }

  // Validate columns exist
  if (params.columns) {
    const columnIds = new Set(schema.columns.map(c => c.id));
    for (const colId of params.columns) {
      if (!columnIds.has(colId)) {
        throw new Error(`Column "${colId}" not found`);
      }
    }
  }

  const view: ViewDefinition = {
    id: viewId,
    name: params.name,
    filter: params.filter,
    sort: params.sort,
    columns: params.columns,
    description: params.description,
  };

  schema.views.push(view);
  await storage.saveSchema(schema);

  return view;
}

/**
 * Update an existing view
 */
export async function updateView(
  tableId: string,
  viewId: string,
  params: UpdateViewParams
): Promise<ViewDefinition> {
  const schema = await storage.loadSchema(tableId);
  if (!schema?.views) {
    throw new Error(`Table "${tableId}" not found or has no views`);
  }

  const viewIndex = schema.views.findIndex(v => v.id === viewId);
  if (viewIndex === -1) {
    throw new Error(`View "${viewId}" not found`);
  }

  // Validate filter syntax
  if (params.filter !== undefined) {
    try {
      parseFilterText(params.filter);
    } catch (error) {
      throw new Error(`Invalid filter syntax: ${params.filter}`);
    }
  }

  // Validate columns exist
  if (params.columns) {
    const columnIds = new Set(schema.columns.map(c => c.id));
    for (const colId of params.columns) {
      if (!columnIds.has(colId)) {
        throw new Error(`Column "${colId}" not found`);
      }
    }
  }

  const existingView = schema.views[viewIndex];
  if (!existingView) {
    throw new Error(`View "${viewId}" not found`);
  }

  const updated: ViewDefinition = {
    ...existingView,
    ...params,
    id: viewId, // Preserve ID
  };

  schema.views[viewIndex] = updated;
  await storage.saveSchema(schema);

  return updated;
}

/**
 * Delete a view
 */
export async function deleteView(tableId: string, viewId: string): Promise<boolean> {
  const schema = await storage.loadSchema(tableId);
  if (!schema?.views) {
    return false;
  }

  const initialLength = schema.views.length;
  schema.views = schema.views.filter(v => v.id !== viewId);

  if (schema.views.length === initialLength) {
    return false;
  }

  await storage.saveSchema(schema);
  return true;
}

/**
 * Execute a view query
 */
export async function executeView(
  tableId: string,
  viewId: string,
  additionalOptions?: Partial<QueryOptions>
): Promise<QueryResult> {
  const schema = await storage.loadSchema(tableId);
  if (!schema?.views) {
    throw new Error(`Table "${tableId}" not found or has no views`);
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
  if (view.sort && !additionalOptions?.sort_by) {
    const sortMatch = view.sort.match(/^(\w+)\s*(ASC|DESC)?$/i);
    if (sortMatch) {
      options.sort_by = sortMatch[1];
      options.sort_direction = (sortMatch[2]?.toUpperCase() as 'ASC' | 'DESC') || 'ASC';
    }
  }

  return queryRows(tableId, options);
}

/**
 * Clone a view
 */
export async function cloneView(
  tableId: string,
  viewId: string,
  newId: string,
  newName: string
): Promise<ViewDefinition> {
  const view = await getView(tableId, viewId);
  if (!view) {
    throw new Error(`View "${viewId}" not found`);
  }

  return createView(tableId, {
    id: newId,
    name: newName,
    filter: view.filter,
    sort: view.sort,
    columns: view.columns,
    description: view.description,
  });
}

// ============================================
// View Helpers
// ============================================

/**
 * Build a filter string from conditions
 */
export function buildFilterString(conditions: FilterCondition[]): string {
  return conditions.map(c => {
    switch (c.operator) {
      case 'eq':
        return `${c.column} = '${c.value}'`;
      case 'neq':
        return `${c.column} != '${c.value}'`;
      case 'gt':
        return `${c.column} > '${c.value}'`;
      case 'gte':
        return `${c.column} >= '${c.value}'`;
      case 'lt':
        return `${c.column} < '${c.value}'`;
      case 'lte':
        return `${c.column} <= '${c.value}'`;
      case 'contains':
        return `${c.column} contains '${c.value}'`;
      case 'starts':
        return `${c.column} starts '${c.value}'`;
      case 'ends':
        return `${c.column} ends '${c.value}'`;
      case 'empty':
        return `${c.column} is empty`;
      case 'nempty':
        return `${c.column} is not empty`;
      default:
        return '';
    }
  }).filter(Boolean).join(' AND ');
}

/**
 * Get row count for a view (without fetching all data)
 */
export async function getViewRowCount(
  tableId: string,
  viewId: string
): Promise<number> {
  const result = await executeView(tableId, viewId, { limit: 0 });
  return result.total;
}

/**
 * Export view configuration
 */
export async function exportView(
  tableId: string,
  viewId: string
): Promise<{ tableId: string; view: ViewDefinition } | null> {
  const view = await getView(tableId, viewId);
  if (!view) {
    return null;
  }
  return { tableId, view };
}

/**
 * Import a view configuration
 */
export async function importView(
  tableId: string,
  viewConfig: ViewDefinition
): Promise<ViewDefinition> {
  return createView(tableId, {
    id: viewConfig.id,
    name: viewConfig.name,
    filter: viewConfig.filter,
    sort: viewConfig.sort,
    columns: viewConfig.columns,
    description: viewConfig.description,
  });
}
