/**
 * TableDetailPage
 *
 * Detailed view of a single table with spreadsheet-like data display.
 */

import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { theme } from '../config/theme';
import { useTable, useTableViews } from '../hooks/useTables';
import { ArrowLeftIcon, TableIcon } from '../components/Icons';

const styles = {
  container: {
    padding: theme.spacing['2xl'],
    maxWidth: '100%',
    margin: '0 auto',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    marginBottom: theme.spacing.xl,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleSection: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.primary,
    cursor: 'pointer',
    marginBottom: theme.spacing.lg,
    border: 'none',
    background: 'none',
    padding: 0,
    fontWeight: theme.typography.weights.medium,
  },
  icon: {
    color: theme.colors.primary,
    display: 'flex',
    alignItems: 'center',
  },
  title: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  toolbar: {
    display: 'flex',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  searchInput: {
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.md,
    border: `1px solid ${theme.colors.border}`,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    width: '300px',
  },
  button: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    borderRadius: theme.borderRadius.md,
    border: 'none',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    transition: `all ${theme.transitions.fast}`,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    color: 'white',
  },
  secondaryButton: {
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
  },
  viewSelector: {
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.md,
    border: `1px solid ${theme.colors.border}`,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
  },
  tableContainer: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    overflow: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: theme.typography.sizes.sm,
  },
  th: {
    padding: theme.spacing.md,
    textAlign: 'left',
    fontWeight: theme.typography.weights.semibold,
    backgroundColor: theme.colors.surfaceHover,
    borderBottom: `2px solid ${theme.colors.border}`,
    position: 'sticky',
    top: 0,
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    userSelect: 'none',
  },
  thSortable: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  td: {
    padding: theme.spacing.md,
    borderBottom: `1px solid ${theme.colors.border}`,
    maxWidth: '300px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  tdEditing: {
    padding: 0,
  },
  cellInput: {
    width: '100%',
    padding: theme.spacing.md,
    border: `2px solid ${theme.colors.primary}`,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
  },
  row: {
    transition: `background-color ${theme.transitions.fast}`,
  },
  rowHover: {
    backgroundColor: theme.colors.surfaceHover,
  },
  rowSelected: {
    backgroundColor: theme.colors.primaryLight,
  },
  checkbox: {
    width: '16px',
    height: '16px',
    cursor: 'pointer',
  },
  actionCell: {
    display: 'flex',
    gap: theme.spacing.xs,
  },
  iconButton: {
    padding: theme.spacing.xs,
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    borderRadius: theme.borderRadius.sm,
  },
  pagination: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderTop: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.surface,
  },
  pageInfo: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  pageButtons: {
    display: 'flex',
    gap: theme.spacing.sm,
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing['3xl'],
    color: theme.colors.textSecondary,
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing['2xl'],
    maxWidth: '600px',
    width: '90%',
    maxHeight: '80vh',
    overflow: 'auto',
  },
  modalTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    marginBottom: theme.spacing.xl,
  },
  formGroup: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    display: 'block',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    marginBottom: theme.spacing.sm,
    color: theme.colors.text,
  },
  input: {
    width: '100%',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    border: `1px solid ${theme.colors.border}`,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
  },
  textarea: {
    width: '100%',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    border: `1px solid ${theme.colors.border}`,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    minHeight: '80px',
    resize: 'vertical',
  },
  select: {
    width: '100%',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    border: `1px solid ${theme.colors.border}`,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
  },
  modalButtons: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
  },
  tagBadge: {
    display: 'inline-block',
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primaryDark,
    borderRadius: theme.borderRadius.full,
    fontSize: theme.typography.sizes.xs,
    marginRight: theme.spacing.xs,
  },
};

const COLUMN_TYPE_LABELS = {
  text: 'Text',
  text_long: 'Langer Text',
  number: 'Zahl',
  date: 'Datum',
  datetime: 'Datum + Uhrzeit',
  boolean: 'Ja/Nein',
  email: 'E-Mail',
  url: 'URL',
  tags: 'Tags',
  select: 'Auswahl',
  relation: 'Beziehung',
};

function TableDetailPage() {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const {
    table,
    rows,
    totalRows,
    loading,
    error,
    queryOptions,
    refresh,
    addRow,
    updateRow,
    deleteRow,
    deleteRows,
    setFilter,
    setSort,
    setPage,
  } = useTable(tableId);

  const { views } = useTableViews(tableId);

  const [selectedRows, setSelectedRows] = useState(new Set());
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [hoveredRow, setHoveredRow] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSchemaModal, setShowSchemaModal] = useState(false);
  const [filterText, setFilterText] = useState('');

  const handleSort = (columnId) => {
    if (queryOptions.sort_by === columnId) {
      setSort(columnId, queryOptions.sort_direction === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSort(columnId, 'ASC');
    }
  };

  const handleFilter = useCallback((e) => {
    e.preventDefault();
    setFilter(filterText);
  }, [filterText, setFilter]);

  const handleCellClick = (rowId, columnId, value) => {
    setEditingCell({ rowId, columnId });
    setEditValue(value ?? '');
  };

  const handleCellBlur = async () => {
    if (!editingCell) return;

    const { rowId, columnId } = editingCell;
    const row = rows.find(r => r._id === rowId);

    if (row && row[columnId] !== editValue) {
      try {
        await updateRow(rowId, { [columnId]: editValue });
      } catch (err) {
        alert(err.message);
      }
    }

    setEditingCell(null);
    setEditValue('');
  };

  const handleCellKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleCellBlur();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
    }
  };

  const handleRowSelect = (rowId) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedRows.size === rows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(rows.map(r => r._id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedRows.size === 0) return;

    if (confirm(`${selectedRows.size} Zeile(n) wirklich loschen?`)) {
      try {
        await deleteRows(Array.from(selectedRows));
        setSelectedRows(new Set());
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const handleDeleteRow = async (rowId) => {
    if (confirm('Zeile wirklich loschen?')) {
      try {
        await deleteRow(rowId);
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const currentPage = Math.floor(queryOptions.offset / queryOptions.limit);
  const totalPages = Math.ceil(totalRows / queryOptions.limit);

  const renderCellValue = (column, value) => {
    if (value === null || value === undefined) {
      return <span style={{ color: theme.colors.textMuted }}>-</span>;
    }

    switch (column.type) {
      case 'boolean':
        return value ? '\u2705' : '\u274C';

      case 'date':
        try {
          return new Date(value).toLocaleDateString('de-DE');
        } catch {
          return value;
        }

      case 'datetime':
        try {
          return new Date(value).toLocaleString('de-DE');
        } catch {
          return value;
        }

      case 'email':
        return <a href={`mailto:${value}`} style={{ color: theme.colors.primary }}>{value}</a>;

      case 'url':
        return (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: theme.colors.primary }}
          >
            {value}
          </a>
        );

      case 'tags':
        if (Array.isArray(value)) {
          return value.map((tag, i) => (
            <span key={i} style={styles.tagBadge}>{tag}</span>
          ));
        }
        return value;

      case 'relation':
        // Show display value if resolved
        const displayKey = `${column.id}_display`;
        const row = rows.find(r => r[column.id] === value);
        return row?.[displayKey] || value;

      default:
        return String(value);
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>Lade Tabelle...</div>
      </div>
    );
  }

  if (error || !table) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <p>Tabelle nicht gefunden</p>
          <button
            style={{ ...styles.button, ...styles.primaryButton, marginTop: theme.spacing.lg }}
            onClick={() => navigate('/tables')}
          >
            Zuruck zu Tabellen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Back Link */}
      <button style={styles.backLink} onClick={() => navigate('/tables')}>
        <ArrowLeftIcon /> Tabellen
      </button>

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.titleSection}>
          <div style={styles.icon}>
            {table.icon ? table.icon : <TableIcon size={32} />}
          </div>
          <div>
            <h1 style={styles.title}>{table.name}</h1>
            <p style={styles.subtitle}>
              {table.description || `${totalRows} Zeile${totalRows !== 1 ? 'n' : ''}`}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: theme.spacing.md }}>
          <button
            style={{ ...styles.button, ...styles.secondaryButton }}
            onClick={() => setShowSchemaModal(true)}
          >
            Schema bearbeiten
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div style={styles.toolbar}>
        <form onSubmit={handleFilter} style={{ display: 'flex', gap: theme.spacing.sm }}>
          <input
            style={styles.searchInput}
            type="text"
            placeholder="Filter... (z.B. name contains 'Max')"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
          <button type="submit" style={{ ...styles.button, ...styles.secondaryButton }}>
            Filtern
          </button>
          {queryOptions.filter && (
            <button
              type="button"
              style={{ ...styles.button, ...styles.secondaryButton }}
              onClick={() => { setFilterText(''); setFilter(''); }}
            >
              Zuruecksetzen
            </button>
          )}
        </form>

        {views.length > 0 && (
          <select
            style={styles.viewSelector}
            onChange={(e) => {
              if (e.target.value) {
                const view = views.find(v => v.id === e.target.value);
                if (view) {
                  setFilterText(view.filter || '');
                  setFilter(view.filter || '');
                }
              }
            }}
          >
            <option value="">Views...</option>
            {views.map(view => (
              <option key={view.id} value={view.id}>{view.name}</option>
            ))}
          </select>
        )}

        <div style={{ flex: 1 }} />

        {selectedRows.size > 0 && (
          <button
            style={{ ...styles.button, backgroundColor: theme.colors.error, color: 'white' }}
            onClick={handleDeleteSelected}
          >
            {selectedRows.size} loschen
          </button>
        )}

        <button
          style={{ ...styles.button, ...styles.primaryButton }}
          onClick={() => setShowAddModal(true)}
        >
          + Zeile hinzufugen
        </button>

        <button
          style={{ ...styles.button, ...styles.secondaryButton }}
          onClick={refresh}
        >
          Aktualisieren
        </button>
      </div>

      {/* Table */}
      <div style={styles.tableContainer}>
        {rows.length === 0 ? (
          <div style={styles.emptyState}>
            <p>Keine Daten vorhanden</p>
            <p style={{ marginTop: theme.spacing.sm, fontSize: theme.typography.sizes.sm }}>
              {queryOptions.filter
                ? 'Versuche einen anderen Filter'
                : 'Fuge eine neue Zeile hinzu um zu beginnen'}
            </p>
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, width: '40px' }}>
                  <input
                    type="checkbox"
                    style={styles.checkbox}
                    checked={selectedRows.size === rows.length}
                    onChange={handleSelectAll}
                  />
                </th>
                {table.columns.map(column => (
                  <th
                    key={column.id}
                    style={styles.th}
                    onClick={() => handleSort(column.id)}
                  >
                    <div style={styles.thSortable}>
                      {column.name}
                      {queryOptions.sort_by === column.id && (
                        <span>{queryOptions.sort_direction === 'ASC' ? '\u2191' : '\u2193'}</span>
                      )}
                    </div>
                  </th>
                ))}
                <th style={{ ...styles.th, width: '80px' }}>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr
                  key={row._id}
                  style={{
                    ...styles.row,
                    ...(hoveredRow === row._id ? styles.rowHover : {}),
                    ...(selectedRows.has(row._id) ? styles.rowSelected : {}),
                  }}
                  onMouseEnter={() => setHoveredRow(row._id)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  <td style={styles.td}>
                    <input
                      type="checkbox"
                      style={styles.checkbox}
                      checked={selectedRows.has(row._id)}
                      onChange={() => handleRowSelect(row._id)}
                    />
                  </td>
                  {table.columns.map(column => {
                    const isEditing = editingCell?.rowId === row._id && editingCell?.columnId === column.id;

                    return (
                      <td
                        key={column.id}
                        style={isEditing ? styles.tdEditing : styles.td}
                        onClick={() => !isEditing && handleCellClick(row._id, column.id, row[column.id])}
                      >
                        {isEditing ? (
                          column.type === 'text_long' ? (
                            <textarea
                              style={styles.cellInput}
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={handleCellBlur}
                              onKeyDown={handleCellKeyDown}
                              autoFocus
                            />
                          ) : column.type === 'select' ? (
                            <select
                              style={styles.cellInput}
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={handleCellBlur}
                              autoFocus
                            >
                              <option value="">-</option>
                              {column.options?.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : column.type === 'boolean' ? (
                            <select
                              style={styles.cellInput}
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value === 'true')}
                              onBlur={handleCellBlur}
                              autoFocus
                            >
                              <option value="false">Nein</option>
                              <option value="true">Ja</option>
                            </select>
                          ) : (
                            <input
                              type={column.type === 'number' ? 'number' : column.type === 'date' ? 'date' : 'text'}
                              style={styles.cellInput}
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={handleCellBlur}
                              onKeyDown={handleCellKeyDown}
                              autoFocus
                            />
                          )
                        ) : (
                          renderCellValue(column, row[column.id])
                        )}
                      </td>
                    );
                  })}
                  <td style={styles.td}>
                    <div style={styles.actionCell}>
                      <button
                        style={styles.iconButton}
                        onClick={() => handleDeleteRow(row._id)}
                        title="Loschen"
                      >
                        x
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalRows > queryOptions.limit && (
        <div style={styles.pagination}>
          <div style={styles.pageInfo}>
            Zeige {queryOptions.offset + 1} - {Math.min(queryOptions.offset + rows.length, totalRows)} von {totalRows}
          </div>
          <div style={styles.pageButtons}>
            <button
              style={{ ...styles.button, ...styles.secondaryButton }}
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              Zuruck
            </button>
            <span style={{ padding: `${theme.spacing.sm} ${theme.spacing.md}` }}>
              Seite {currentPage + 1} von {totalPages}
            </span>
            <button
              style={{ ...styles.button, ...styles.secondaryButton }}
              disabled={currentPage >= totalPages - 1}
              onClick={() => setPage(currentPage + 1)}
            >
              Weiter
            </button>
          </div>
        </div>
      )}

      {/* Add Row Modal */}
      {showAddModal && (
        <AddRowModal
          table={table}
          onClose={() => setShowAddModal(false)}
          onAdd={async (data) => {
            await addRow(data);
            setShowAddModal(false);
          }}
        />
      )}

      {/* Schema Modal */}
      {showSchemaModal && (
        <SchemaModal
          table={table}
          onClose={() => setShowSchemaModal(false)}
        />
      )}
    </div>
  );
}

function AddRowModal({ table, onClose, onAdd }) {
  const [formData, setFormData] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setSubmitting(true);
    try {
      await onAdd(formData);
    } catch (err) {
      console.error('Error adding row:', err);
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFieldChange = (columnId, value) => {
    setFormData(prev => ({ ...prev, [columnId]: value }));
  };

  return (
    <div style={styles.modal} onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.modalTitle}>Neue Zeile hinzufugen</h2>

        <form onSubmit={handleSubmit}>
          {table.columns.map(column => (
            <div key={column.id} style={styles.formGroup}>
              <label style={styles.label}>
                {column.name}
                {column.required && <span style={{ color: theme.colors.error }}> *</span>}
              </label>

              {column.type === 'text_long' ? (
                <textarea
                  style={styles.textarea}
                  value={formData[column.id] || ''}
                  onChange={(e) => handleFieldChange(column.id, e.target.value)}
                  required={column.required}
                />
              ) : column.type === 'select' ? (
                <select
                  style={styles.select}
                  value={formData[column.id] || ''}
                  onChange={(e) => handleFieldChange(column.id, e.target.value)}
                  required={column.required}
                >
                  <option value="">Bitte wahlen...</option>
                  {column.options?.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : column.type === 'boolean' ? (
                <select
                  style={styles.select}
                  value={formData[column.id] === true ? 'true' : formData[column.id] === false ? 'false' : ''}
                  onChange={(e) => handleFieldChange(column.id, e.target.value === 'true')}
                >
                  <option value="">Bitte wahlen...</option>
                  <option value="true">Ja</option>
                  <option value="false">Nein</option>
                </select>
              ) : column.type === 'tags' ? (
                <input
                  style={styles.input}
                  type="text"
                  placeholder="Tag1, Tag2, Tag3"
                  value={Array.isArray(formData[column.id]) ? formData[column.id].join(', ') : formData[column.id] || ''}
                  onChange={(e) => handleFieldChange(column.id, e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                />
              ) : (
                <input
                  style={styles.input}
                  type={
                    column.type === 'number' ? 'number' :
                    column.type === 'date' ? 'date' :
                    column.type === 'datetime' ? 'datetime-local' :
                    column.type === 'email' ? 'email' :
                    column.type === 'url' ? 'url' :
                    'text'
                  }
                  value={formData[column.id] || ''}
                  onChange={(e) => handleFieldChange(column.id, e.target.value)}
                  required={column.required}
                />
              )}

              {column.description && (
                <p style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginTop: theme.spacing.xs }}>
                  {column.description}
                </p>
              )}
            </div>
          ))}

          <div style={styles.modalButtons}>
            <button
              type="button"
              style={{ ...styles.button, ...styles.secondaryButton }}
              onClick={onClose}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              style={{ ...styles.button, ...styles.primaryButton }}
              disabled={submitting}
            >
              {submitting ? 'Speichere...' : 'Zeile hinzufugen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SchemaModal({ table, onClose }) {
  return (
    <div style={styles.modal} onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.modalTitle}>Schema: {table.name}</h2>

        <div style={{ marginBottom: theme.spacing.xl }}>
          <h3 style={{ marginBottom: theme.spacing.md, fontWeight: theme.typography.weights.semibold }}>
            Spalten ({table.columns.length})
          </h3>
          <table style={{ width: '100%', fontSize: theme.typography.sizes.sm }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: theme.spacing.sm }}>Name</th>
                <th style={{ textAlign: 'left', padding: theme.spacing.sm }}>Typ</th>
                <th style={{ textAlign: 'left', padding: theme.spacing.sm }}>Pflichtfeld</th>
              </tr>
            </thead>
            <tbody>
              {table.columns.map(column => (
                <tr key={column.id}>
                  <td style={{ padding: theme.spacing.sm }}>{column.name}</td>
                  <td style={{ padding: theme.spacing.sm }}>{COLUMN_TYPE_LABELS[column.type] || column.type}</td>
                  <td style={{ padding: theme.spacing.sm }}>{column.required ? 'Ja' : 'Nein'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {table.views && table.views.length > 0 && (
          <div>
            <h3 style={{ marginBottom: theme.spacing.md, fontWeight: theme.typography.weights.semibold }}>
              Views ({table.views.length})
            </h3>
            <ul style={{ paddingLeft: theme.spacing.lg }}>
              {table.views.map(view => (
                <li key={view.id} style={{ marginBottom: theme.spacing.sm }}>
                  <strong>{view.name}</strong>
                  {view.filter && (
                    <span style={{ color: theme.colors.textMuted, marginLeft: theme.spacing.sm }}>
                      Filter: {view.filter}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div style={styles.modalButtons}>
          <button
            style={{ ...styles.button, ...styles.primaryButton }}
            onClick={onClose}
          >
            Schliessen
          </button>
        </div>
      </div>
    </div>
  );
}

export default TableDetailPage;
