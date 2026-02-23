/**
 * UsagePage
 *
 * Admin page for viewing LLM usage statistics per user and model.
 * Part of Fair-Use Policy monitoring.
 */

import { useState, useEffect, useCallback } from 'react';
import { theme } from '../config/theme';
import { apiGet, API_URL } from '../utils/apiFetch';
import { DownloadIcon } from '../components/Icons';

const styles = {
  container: {
    padding: theme.spacing['2xl'],
    maxWidth: '1400px',
  },
  header: {
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
  },
  // Stats Grid
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  statCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.lg,
  },
  statValue: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  statLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
  },
  statIcon: {
    width: '24px',
    height: '24px',
    marginBottom: theme.spacing.sm,
  },
  // Filters
  filtersContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  filtersRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    alignItems: 'flex-end',
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
  },
  filterLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
  },
  filterInput: {
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.md,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    fontSize: theme.typography.sizes.sm,
    minWidth: '150px',
  },
  filterButton: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  resetButton: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.textMuted,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    cursor: 'pointer',
  },
  exportButton: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.primary,
    border: `1px solid ${theme.colors.primary}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    marginLeft: 'auto',
  },
  // Table
  tableContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    overflow: 'hidden',
  },
  tableHeader: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr 120px 80px',
    gap: theme.spacing.md,
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.background,
    borderBottom: `1px solid ${theme.colors.border}`,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  tableHeaderSortable: {
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr 120px 80px',
    gap: theme.spacing.md,
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    borderBottom: `1px solid ${theme.colors.borderLight}`,
    fontSize: theme.typography.sizes.sm,
    alignItems: 'center',
  },
  tableRowHover: {
    backgroundColor: theme.colors.surfaceHover,
  },
  tableCell: {
    color: theme.colors.text,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  tableCellMuted: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.xs,
  },
  // Tabs
  tabs: {
    display: 'flex',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  tab: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  tabActive: {
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
  },
  // Progress bar for percentage
  progressContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: '6px',
    backgroundColor: theme.colors.borderLight,
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.full,
  },
  progressLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    minWidth: '36px',
    textAlign: 'right',
  },
  // Empty/Loading states
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing['3xl'],
    color: theme.colors.textMuted,
  },
  loading: {
    textAlign: 'center',
    padding: theme.spacing['3xl'],
    color: theme.colors.textMuted,
  },
};

// Quick time range options
const TIME_RANGES = {
  today: { label: 'Heute', getDates: () => {
    const today = new Date();
    return {
      startDate: formatDateForInput(today),
      endDate: formatDateForInput(today),
    };
  }},
  week: { label: '7 Tage', getDates: () => {
    const end = new Date();
    const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return {
      startDate: formatDateForInput(start),
      endDate: formatDateForInput(end),
    };
  }},
  thirtyDays: { label: '30 Tage', getDates: () => {
    const end = new Date();
    const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return {
      startDate: formatDateForInput(start),
      endDate: formatDateForInput(end),
    };
  }},
  month: { label: 'Aktueller Monat', getDates: () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      startDate: formatDateForInput(start),
      endDate: formatDateForInput(end),
    };
  }},
  custom: { label: 'Benutzerdefiniert', getDates: null },
};

// Source labels (German)
const SOURCE_LABELS = {
  chat: 'Chat',
  delegation: 'Delegation',
  image_analysis: 'Bildanalyse',
  indexer: 'KB Indexierung',
  search: 'Suche',
  contract: 'Vertragsanalyse',
};

function formatDateForInput(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function UsagePage({ embedded = false }) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [activeTab, setActiveTab] = useState('users'); // 'users', 'models', 'sources'
  const [selectedRange, setSelectedRange] = useState('month');
  const [hoveredRow, setHoveredRow] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'prompts', direction: 'desc' });

  // Date filters
  const [filters, setFilters] = useState(() => TIME_RANGES.month.getDates());

  // Load usage data
  const loadUsage = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const response = await apiGet(`/admin/usage?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      }
    } catch (error) {
      console.error('Error loading usage:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  const handleRangeChange = (rangeKey) => {
    setSelectedRange(rangeKey);
    if (rangeKey !== 'custom' && TIME_RANGES[rangeKey].getDates) {
      setFilters(TIME_RANGES[rangeKey].getDates());
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setSelectedRange('custom');
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const response = await fetch(`${API_URL}/admin/usage/export?${params.toString()}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `usage_export_${filters.startDate || 'all'}_${filters.endDate || 'all'}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error exporting usage:', error);
    }
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  const getSortedData = (data, key) => {
    if (!data) return [];
    const sorted = [...data];
    sorted.sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'desc' ? bVal - aVal : aVal - bVal;
      }
      return sortConfig.direction === 'desc'
        ? String(bVal).localeCompare(String(aVal))
        : String(aVal).localeCompare(String(bVal));
    });
    return sorted;
  };

  const renderTable = () => {
    if (!summary) return null;

    switch (activeTab) {
      case 'users':
        return renderUsersTable();
      case 'models':
        return renderModelsTable();
      case 'sources':
        return renderSourcesTable();
      default:
        return null;
    }
  };

  const renderUsersTable = () => {
    const sortedData = getSortedData(summary.byUser, sortConfig.key);

    return (
      <div style={styles.tableContainer}>
        <div style={styles.tableHeader}>
          <div
            style={styles.tableHeaderSortable}
            onClick={() => handleSort('userId')}
          >
            Benutzer {sortConfig.key === 'userId' && (sortConfig.direction === 'desc' ? ' ↓' : ' ↑')}
          </div>
          <div>Model-Verteilung</div>
          <div>Quelle-Verteilung</div>
          <div
            style={styles.tableHeaderSortable}
            onClick={() => handleSort('prompts')}
          >
            Prompts {sortConfig.key === 'prompts' && (sortConfig.direction === 'desc' ? ' ↓' : ' ↑')}
          </div>
          <div
            style={styles.tableHeaderSortable}
            onClick={() => handleSort('percentage')}
          >
            Anteil {sortConfig.key === 'percentage' && (sortConfig.direction === 'desc' ? ' ↓' : ' ↑')}
          </div>
        </div>
        {sortedData.length === 0 ? (
          <div style={styles.emptyState}>Keine Daten vorhanden</div>
        ) : (
          sortedData.map((user) => (
            <div
              key={user.userId}
              style={{
                ...styles.tableRow,
                ...(hoveredRow === user.userId ? styles.tableRowHover : {}),
              }}
              onMouseEnter={() => setHoveredRow(user.userId)}
              onMouseLeave={() => setHoveredRow(null)}
            >
              <div style={styles.tableCell}>
                {user.userId === 'system' ? (
                  <span style={{ color: theme.colors.textMuted, fontStyle: 'italic' }}>System</span>
                ) : (
                  user.username || user.userId
                )}
              </div>
              <div style={styles.tableCellMuted}>-</div>
              <div style={styles.tableCellMuted}>-</div>
              <div style={styles.tableCell}>{user.prompts.toLocaleString('de-DE')}</div>
              <div style={styles.progressContainer}>
                <div style={styles.progressBar}>
                  <div style={{ ...styles.progressFill, width: `${user.percentage}%` }} />
                </div>
                <span style={styles.progressLabel}>{user.percentage}%</span>
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  const renderModelsTable = () => {
    const sortedData = getSortedData(summary.byModel, sortConfig.key === 'userId' ? 'model' : sortConfig.key);

    return (
      <div style={styles.tableContainer}>
        <div style={{ ...styles.tableHeader, gridTemplateColumns: '2fr 1fr 120px 80px' }}>
          <div
            style={styles.tableHeaderSortable}
            onClick={() => handleSort('model')}
          >
            Model {sortConfig.key === 'model' && (sortConfig.direction === 'desc' ? ' ↓' : ' ↑')}
          </div>
          <div>Provider</div>
          <div
            style={styles.tableHeaderSortable}
            onClick={() => handleSort('prompts')}
          >
            Prompts {sortConfig.key === 'prompts' && (sortConfig.direction === 'desc' ? ' ↓' : ' ↑')}
          </div>
          <div
            style={styles.tableHeaderSortable}
            onClick={() => handleSort('percentage')}
          >
            Anteil {sortConfig.key === 'percentage' && (sortConfig.direction === 'desc' ? ' ↓' : ' ↑')}
          </div>
        </div>
        {sortedData.length === 0 ? (
          <div style={styles.emptyState}>Keine Daten vorhanden</div>
        ) : (
          sortedData.map((model) => (
            <div
              key={model.model}
              style={{
                ...styles.tableRow,
                gridTemplateColumns: '2fr 1fr 120px 80px',
                ...(hoveredRow === model.model ? styles.tableRowHover : {}),
              }}
              onMouseEnter={() => setHoveredRow(model.model)}
              onMouseLeave={() => setHoveredRow(null)}
            >
              <div style={styles.tableCell}>{model.model}</div>
              <div style={styles.tableCellMuted}>-</div>
              <div style={styles.tableCell}>{model.prompts.toLocaleString('de-DE')}</div>
              <div style={styles.progressContainer}>
                <div style={styles.progressBar}>
                  <div style={{ ...styles.progressFill, width: `${model.percentage}%` }} />
                </div>
                <span style={styles.progressLabel}>{model.percentage}%</span>
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  const renderSourcesTable = () => {
    const sortedData = getSortedData(summary.bySource, sortConfig.key === 'userId' ? 'source' : sortConfig.key);

    return (
      <div style={styles.tableContainer}>
        <div style={{ ...styles.tableHeader, gridTemplateColumns: '2fr 120px 80px' }}>
          <div
            style={styles.tableHeaderSortable}
            onClick={() => handleSort('source')}
          >
            Quelle {sortConfig.key === 'source' && (sortConfig.direction === 'desc' ? ' ↓' : ' ↑')}
          </div>
          <div
            style={styles.tableHeaderSortable}
            onClick={() => handleSort('prompts')}
          >
            Prompts {sortConfig.key === 'prompts' && (sortConfig.direction === 'desc' ? ' ↓' : ' ↑')}
          </div>
          <div
            style={styles.tableHeaderSortable}
            onClick={() => handleSort('percentage')}
          >
            Anteil {sortConfig.key === 'percentage' && (sortConfig.direction === 'desc' ? ' ↓' : ' ↑')}
          </div>
        </div>
        {sortedData.length === 0 ? (
          <div style={styles.emptyState}>Keine Daten vorhanden</div>
        ) : (
          sortedData.map((source) => (
            <div
              key={source.source}
              style={{
                ...styles.tableRow,
                gridTemplateColumns: '2fr 120px 80px',
                ...(hoveredRow === source.source ? styles.tableRowHover : {}),
              }}
              onMouseEnter={() => setHoveredRow(source.source)}
              onMouseLeave={() => setHoveredRow(null)}
            >
              <div style={styles.tableCell}>{SOURCE_LABELS[source.source] || source.source}</div>
              <div style={styles.tableCell}>{source.prompts.toLocaleString('de-DE')}</div>
              <div style={styles.progressContainer}>
                <div style={styles.progressBar}>
                  <div style={{ ...styles.progressFill, width: `${source.percentage}%` }} />
                </div>
                <span style={styles.progressLabel}>{source.percentage}%</span>
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  return (
    <div style={embedded ? {} : styles.container}>
      {/* Header */}
      {!embedded && (
        <div style={styles.header}>
          <h1 style={styles.title}>
            <BarChartIcon style={styles.statIcon} />
            Nutzung
          </h1>
          <p style={styles.subtitle}>
            LLM-Nutzung pro Benutzer und Modell (Fair-Use Monitoring)
          </p>
        </div>
      )}

      {embedded && (
        <div style={{ marginBottom: theme.spacing.xl }}>
          <h2 style={{
            fontSize: theme.typography.sizes.lg,
            fontWeight: theme.typography.weights.semibold,
            color: theme.colors.text,
            marginBottom: theme.spacing.xs,
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing.sm,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={theme.colors.primary} strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            Nutzung
          </h2>
          <p style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>
            LLM-Nutzung pro Benutzer und Modell (Fair-Use Monitoring)
          </p>
        </div>
      )}

      {/* Stats Dashboard */}
      {!loading && summary && (
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <PromptsIcon style={{ ...styles.statIcon, color: theme.colors.primary }} />
            <div style={styles.statValue}>{summary.totalPrompts.toLocaleString('de-DE')}</div>
            <div style={styles.statLabel}>Prompts gesamt</div>
          </div>
          <div style={styles.statCard}>
            <UsersIcon style={{ ...styles.statIcon, color: theme.colors.success }} />
            <div style={styles.statValue}>{summary.activeUsers}</div>
            <div style={styles.statLabel}>Aktive Benutzer</div>
          </div>
          <div style={styles.statCard}>
            <ModelIcon style={{ ...styles.statIcon, color: theme.colors.warning }} />
            <div style={styles.statValue}>{summary.topModel?.model || '-'}</div>
            <div style={styles.statLabel}>
              Meistgenutztes Model
              {summary.topModel && (
                <span style={{ marginLeft: theme.spacing.xs }}>
                  ({summary.topModel.count.toLocaleString('de-DE')})
                </span>
              )}
            </div>
          </div>
          <div style={styles.statCard}>
            <SourcesIcon style={{ ...styles.statIcon, color: theme.colors.info || theme.colors.primary }} />
            <div style={styles.statValue}>{summary.bySource?.length || 0}</div>
            <div style={styles.statLabel}>Aktive Quellen</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={styles.filtersContainer}>
        <div style={styles.filtersRow}>
          {/* Quick Range Buttons */}
          {Object.entries(TIME_RANGES).filter(([key]) => key !== 'custom').map(([key, range]) => (
            <button
              key={key}
              style={{
                ...styles.tab,
                ...(selectedRange === key ? styles.tabActive : {}),
              }}
              onClick={() => handleRangeChange(key)}
            >
              {range.label}
            </button>
          ))}

          {/* Date Range Inputs */}
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Von</label>
            <input
              type="date"
              style={styles.filterInput}
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Bis</label>
            <input
              type="date"
              style={styles.filterInput}
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
          </div>

          {/* Export Button */}
          <button style={styles.exportButton} onClick={handleExport}>
            <DownloadIcon style={{ width: '14px', height: '14px', marginRight: theme.spacing.xs }} />
            CSV Export
          </button>
        </div>
      </div>

      {/* View Tabs */}
      <div style={styles.tabs}>
        {[
          { id: 'users', label: 'Nach Benutzer' },
          { id: 'models', label: 'Nach Model' },
          { id: 'sources', label: 'Nach Quelle' },
        ].map((tab) => (
          <button
            key={tab.id}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.tabActive : {}),
            }}
            onClick={() => setActiveTab(tab.id)}
            onMouseEnter={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div style={styles.loading}>Lade Nutzungsdaten...</div>
      ) : (
        renderTable()
      )}
    </div>
  );
}

// Icons
function BarChartIcon({ style }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function PromptsIcon({ style }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function UsersIcon({ style }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ModelIcon({ style }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="7.5 4.21 12 6.81 16.5 4.21" />
      <polyline points="7.5 19.79 7.5 14.6 3 12" />
      <polyline points="21 12 16.5 14.6 16.5 19.79" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

function SourcesIcon({ style }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export default UsagePage;
