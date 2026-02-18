/**
 * useTables Hook
 *
 * Custom hook for managing tables with full CRUD support.
 */

import { useState, useEffect, useCallback } from 'react';
import { apiFetch, apiGet, apiPost, apiPut, apiDelete } from '../utils/apiFetch';

/**
 * Hook for managing tables
 */
export function useTables() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load all tables with stats
  const loadTables = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiGet('/tables?stats=true');
      if (!response.ok) {
        throw new Error('Failed to load tables');
      }
      const data = await response.json();
      setTables(data.tables || []);
    } catch (err) {
      setError(err.message);
      console.error('Error loading tables:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    loadTables();
  }, [loadTables]);

  // Create a new table
  const createTable = useCallback(async (tableData) => {
    try {
      const response = await apiPost('/tables', tableData);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create table');
      }

      const table = await response.json();
      setTables(prev => [...prev, { ...table, row_count: 0 }]);
      return table;
    } catch (err) {
      console.error('Error creating table:', err);
      throw err;
    }
  }, []);

  // Update a table
  const updateTable = useCallback(async (tableId, updates) => {
    try {
      const response = await apiPut(`/tables/${tableId}`, updates);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update table');
      }

      const table = await response.json();
      setTables(prev => prev.map(t => t.id === tableId ? { ...t, ...table } : t));
      return table;
    } catch (err) {
      console.error('Error updating table:', err);
      throw err;
    }
  }, []);

  // Delete a table
  const deleteTable = useCallback(async (tableId, force = false) => {
    try {
      const endpoint = force ? `/tables/${tableId}?force=true` : `/tables/${tableId}`;
      const response = await apiDelete(endpoint);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete table');
      }

      setTables(prev => prev.filter(t => t.id !== tableId));
      return true;
    } catch (err) {
      console.error('Error deleting table:', err);
      throw err;
    }
  }, []);

  // List templates
  const getTemplates = useCallback(async () => {
    try {
      const response = await apiGet('/tables/templates');
      if (!response.ok) {
        throw new Error('Failed to load templates');
      }
      const data = await response.json();
      return data.templates || [];
    } catch (err) {
      console.error('Error loading templates:', err);
      throw err;
    }
  }, []);

  // Apply a template
  const applyTemplate = useCallback(async (templateId) => {
    try {
      const response = await apiPost(`/tables/templates/${templateId}/apply`, {});

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to apply template');
      }

      const data = await response.json();
      await loadTables(); // Reload tables
      return data.tables || [];
    } catch (err) {
      console.error('Error applying template:', err);
      throw err;
    }
  }, [loadTables]);

  return {
    tables,
    loading,
    error,
    refresh: loadTables,
    createTable,
    updateTable,
    deleteTable,
    getTemplates,
    applyTemplate,
  };
}

/**
 * Hook for a single table with data
 */
export function useTable(tableId) {
  const [table, setTable] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [queryOptions, setQueryOptions] = useState({
    filter: '',
    sort_by: null,
    sort_direction: 'ASC',
    offset: 0,
    limit: 50,
  });
  const [totalRows, setTotalRows] = useState(0);

  // Load table schema
  const loadTable = useCallback(async () => {
    if (!tableId) return;

    try {
      setLoading(true);
      setError(null);
      const response = await apiGet(`/tables/${tableId}`);
      if (!response.ok) {
        throw new Error('Table not found');
      }
      const data = await response.json();
      setTable(data);
    } catch (err) {
      setError(err.message);
      console.error('Error loading table:', err);
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  // Load rows with query options
  const loadRows = useCallback(async () => {
    if (!tableId) return;

    try {
      const params = new URLSearchParams();
      if (queryOptions.filter) params.set('filter', queryOptions.filter);
      if (queryOptions.sort_by) params.set('sort_by', queryOptions.sort_by);
      if (queryOptions.sort_direction) params.set('sort_direction', queryOptions.sort_direction);
      params.set('offset', queryOptions.offset.toString());
      params.set('limit', queryOptions.limit.toString());
      params.set('resolve_relations', 'true');

      const response = await apiGet(`/tables/${tableId}/rows?${params}`);
      if (!response.ok) {
        throw new Error('Failed to load rows');
      }
      const data = await response.json();
      setRows(data.rows || []);
      setTotalRows(data.total || 0);
    } catch (err) {
      console.error('Error loading rows:', err);
    }
  }, [tableId, queryOptions]);

  // Load on mount and when query changes
  useEffect(() => {
    loadTable();
  }, [loadTable]);

  useEffect(() => {
    if (table) {
      loadRows();
    }
  }, [table, loadRows]);

  // Add a row
  const addRow = useCallback(async (data) => {
    try {
      const response = await apiPost(`/tables/${tableId}/rows`, data);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add row');
      }

      const row = await response.json();
      setRows(prev => [...prev, row]);
      setTotalRows(prev => prev + 1);
      return row;
    } catch (err) {
      console.error('Error adding row:', err);
      throw err;
    }
  }, [tableId]);

  // Update a row
  const updateRow = useCallback(async (rowId, data) => {
    try {
      const response = await apiPut(`/tables/${tableId}/rows/${rowId}`, data);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update row');
      }

      const row = await response.json();
      setRows(prev => prev.map(r => r._id === rowId ? row : r));
      return row;
    } catch (err) {
      console.error('Error updating row:', err);
      throw err;
    }
  }, [tableId]);

  // Delete a row
  const deleteRow = useCallback(async (rowId) => {
    try {
      const response = await apiDelete(`/tables/${tableId}/rows/${rowId}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete row');
      }

      setRows(prev => prev.filter(r => r._id !== rowId));
      setTotalRows(prev => prev - 1);
      return true;
    } catch (err) {
      console.error('Error deleting row:', err);
      throw err;
    }
  }, [tableId]);

  // Delete multiple rows
  const deleteRows = useCallback(async (rowIds) => {
    try {
      const response = await apiFetch(`/tables/${tableId}/rows`, {
        method: 'DELETE',
        body: JSON.stringify({ rowIds }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete rows');
      }

      const data = await response.json();
      setRows(prev => prev.filter(r => !rowIds.includes(r._id)));
      setTotalRows(prev => prev - data.deleted);
      return data.deleted;
    } catch (err) {
      console.error('Error deleting rows:', err);
      throw err;
    }
  }, [tableId]);

  // Add column
  const addColumn = useCallback(async (column) => {
    try {
      const response = await apiPost(`/tables/${tableId}/columns`, column);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add column');
      }

      const updatedTable = await response.json();
      setTable(updatedTable);
      return updatedTable;
    } catch (err) {
      console.error('Error adding column:', err);
      throw err;
    }
  }, [tableId]);

  // Update column
  const updateColumn = useCallback(async (columnId, updates) => {
    try {
      const response = await apiPut(`/tables/${tableId}/columns/${columnId}`, updates);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update column');
      }

      const updatedTable = await response.json();
      setTable(updatedTable);
      return updatedTable;
    } catch (err) {
      console.error('Error updating column:', err);
      throw err;
    }
  }, [tableId]);

  // Delete column
  const deleteColumn = useCallback(async (columnId) => {
    try {
      const response = await apiDelete(`/tables/${tableId}/columns/${columnId}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete column');
      }

      const updatedTable = await response.json();
      setTable(updatedTable);
      await loadRows(); // Reload rows to reflect column removal
      return updatedTable;
    } catch (err) {
      console.error('Error deleting column:', err);
      throw err;
    }
  }, [tableId, loadRows]);

  // Set filter
  const setFilter = useCallback((filter) => {
    setQueryOptions(prev => ({ ...prev, filter, offset: 0 }));
  }, []);

  // Set sort
  const setSort = useCallback((sort_by, sort_direction = 'ASC') => {
    setQueryOptions(prev => ({ ...prev, sort_by, sort_direction }));
  }, []);

  // Set pagination
  const setPage = useCallback((page, limit = 50) => {
    setQueryOptions(prev => ({ ...prev, offset: page * limit, limit }));
  }, []);

  return {
    table,
    rows,
    totalRows,
    loading,
    error,
    queryOptions,
    refresh: loadRows,
    refreshTable: loadTable,
    addRow,
    updateRow,
    deleteRow,
    deleteRows,
    addColumn,
    updateColumn,
    deleteColumn,
    setFilter,
    setSort,
    setPage,
  };
}

/**
 * Hook for relation options
 */
export function useRelationOptions(tableId, columnId) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadOptions = useCallback(async (searchTerm = '') => {
    if (!tableId || !columnId) return;

    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.set('search', searchTerm);
      params.set('limit', '50');

      const response = await apiGet(
        `/tables/${tableId}/columns/${columnId}/options?${params}`
      );

      if (!response.ok) {
        throw new Error('Failed to load options');
      }

      const data = await response.json();
      setOptions(data.options || []);
    } catch (err) {
      console.error('Error loading relation options:', err);
    } finally {
      setLoading(false);
    }
  }, [tableId, columnId]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  return { options, loading, search: loadOptions };
}

/**
 * Hook for table views
 */
export function useTableViews(tableId) {
  const [views, setViews] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadViews = useCallback(async () => {
    if (!tableId) return;

    try {
      setLoading(true);
      const response = await apiGet(`/tables/${tableId}/views`);
      if (!response.ok) {
        throw new Error('Failed to load views');
      }
      const data = await response.json();
      setViews(data.views || []);
    } catch (err) {
      console.error('Error loading views:', err);
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  useEffect(() => {
    loadViews();
  }, [loadViews]);

  const createView = useCallback(async (viewData) => {
    try {
      const response = await apiPost(`/tables/${tableId}/views`, viewData);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create view');
      }

      const view = await response.json();
      setViews(prev => [...prev, view]);
      return view;
    } catch (err) {
      console.error('Error creating view:', err);
      throw err;
    }
  }, [tableId]);

  const deleteView = useCallback(async (viewId) => {
    try {
      const response = await apiDelete(`/tables/${tableId}/views/${viewId}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete view');
      }

      setViews(prev => prev.filter(v => v.id !== viewId));
      return true;
    } catch (err) {
      console.error('Error deleting view:', err);
      throw err;
    }
  }, [tableId]);

  const executeView = useCallback(async (viewId, options = {}) => {
    try {
      const params = new URLSearchParams();
      if (options.offset) params.set('offset', options.offset.toString());
      if (options.limit) params.set('limit', options.limit.toString());

      const response = await apiGet(
        `/tables/${tableId}/views/${viewId}/rows?${params}`
      );

      if (!response.ok) {
        throw new Error('Failed to execute view');
      }

      return await response.json();
    } catch (err) {
      console.error('Error executing view:', err);
      throw err;
    }
  }, [tableId]);

  return {
    views,
    loading,
    refresh: loadViews,
    createView,
    deleteView,
    executeView,
  };
}

/**
 * Hook for import/export operations
 */
export function useTableImportExport(tableId) {
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const exportData = useCallback(async (format = 'csv', options = {}) => {
    try {
      setExporting(true);
      const response = await apiPost(`/tables/${tableId}/export`, { format, ...options });

      if (!response.ok) {
        throw new Error('Failed to export data');
      }

      const content = await response.text();
      return content;
    } catch (err) {
      console.error('Error exporting data:', err);
      throw err;
    } finally {
      setExporting(false);
    }
  }, [tableId]);

  const importData = useCallback(async (content, format = 'csv', options = {}) => {
    try {
      setImporting(true);
      const response = await apiPost(`/tables/${tableId}/import`, { content, format, ...options });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to import data');
      }

      return await response.json();
    } catch (err) {
      console.error('Error importing data:', err);
      throw err;
    } finally {
      setImporting(false);
    }
  }, [tableId]);

  const previewImport = useCallback(async (content, format = 'csv') => {
    try {
      const response = await apiPost(`/tables/${tableId}/import/preview`, { content, format });

      if (!response.ok) {
        throw new Error('Failed to preview import');
      }

      return await response.json();
    } catch (err) {
      console.error('Error previewing import:', err);
      throw err;
    }
  }, [tableId]);

  return {
    importing,
    exporting,
    exportData,
    importData,
    previewImport,
  };
}
