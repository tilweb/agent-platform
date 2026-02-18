/**
 * AuditLogPage
 *
 * Admin page for viewing and filtering audit logs with statistics dashboard.
 */

import { useState, useEffect, useCallback } from 'react';
import { theme } from '../config/theme';
import { apiGet } from '../utils/apiFetch';

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
  // Stats Dashboard
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
  // Table
  tableContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    overflow: 'hidden',
  },
  tableHeader: {
    display: 'grid',
    gridTemplateColumns: '180px 120px 180px 150px 1fr 80px',
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
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '180px 120px 180px 150px 1fr 80px',
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
  // Badges
  categoryBadge: {
    display: 'inline-block',
    padding: `2px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.full,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
  },
  successBadge: {
    backgroundColor: theme.colors.successLight,
    color: theme.colors.success,
  },
  errorBadge: {
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
  },
  // Pagination
  pagination: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderTop: `1px solid ${theme.colors.border}`,
  },
  paginationInfo: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
  },
  paginationButtons: {
    display: 'flex',
    gap: theme.spacing.sm,
  },
  paginationButton: {
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    cursor: 'pointer',
  },
  paginationButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  // Security Alerts
  alertsContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  alertsTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  alertItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: `${theme.colors.error}10`,
    marginBottom: theme.spacing.sm,
  },
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

// Category colors
const CATEGORY_COLORS = {
  auth: { bg: '#dbeafe', color: '#2563eb' },
  user_management: { bg: '#fef3c7', color: '#d97706' },
  data_access: { bg: '#e0e7ff', color: '#4f46e5' },
  data_modification: { bg: '#fce7f3', color: '#db2777' },
  admin_action: { bg: '#f3e8ff', color: '#9333ea' },
  security: { bg: '#fee2e2', color: '#dc2626' },
  system: { bg: '#f1f5f9', color: '#64748b' },
};

// Category labels
const CATEGORY_LABELS = {
  auth: 'Authentifizierung',
  user_management: 'Benutzerverwaltung',
  data_access: 'Datenzugriff',
  data_modification: 'Datenänderung',
  admin_action: 'Admin-Aktion',
  security: 'Sicherheit',
  system: 'System',
};

// Action labels (German)
const ACTION_LABELS = {
  login_success: 'Login erfolgreich',
  login_failed: 'Login fehlgeschlagen',
  logout: 'Logout',
  session_expired: 'Session abgelaufen',
  user_created: 'Benutzer erstellt',
  user_updated: 'Benutzer aktualisiert',
  user_deleted: 'Benutzer gelöscht',
  password_changed: 'Passwort geändert',
  password_reset: 'Passwort zurückgesetzt',
  chat_accessed: 'Chat aufgerufen',
  chat_shared: 'Chat geteilt',
  chat_share_revoked: 'Chat-Freigabe widerrufen',
  knowledge_accessed: 'Knowledge aufgerufen',
  connection_accessed: 'Connection aufgerufen',
  chat_created: 'Chat erstellt',
  chat_deleted: 'Chat gelöscht',
  project_created: 'Projekt erstellt',
  project_deleted: 'Projekt gelöscht',
  tool_created: 'Tool erstellt',
  tool_deleted: 'Tool gelöscht',
  provider_configured: 'Provider konfiguriert',
  settings_changed: 'Einstellungen geändert',
  group_created: 'Gruppe erstellt',
  group_deleted: 'Gruppe gelöscht',
  permission_changed: 'Berechtigung geändert',
  rate_limit_exceeded: 'Rate-Limit überschritten',
  csrf_blocked: 'CSRF blockiert',
  ssrf_blocked: 'SSRF blockiert',
  unauthorized_access: 'Unberechtigter Zugriff',
  suspicious_activity: 'Verdächtige Aktivität',
  service_started: 'Service gestartet',
  service_stopped: 'Service gestoppt',
  error_occurred: 'Fehler aufgetreten',
};

function formatTimestamp(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDateForInput(date) {
  return date.toISOString().split('T')[0];
}

function AuditLogPage({ embedded = false }) {
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hoveredRow, setHoveredRow] = useState(null);
  const limit = 50;

  // Filters
  const [filters, setFilters] = useState({
    startDate: formatDateForInput(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
    endDate: formatDateForInput(new Date()),
    category: '',
    action: '',
    success: '',
  });

  // Load statistics
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const response = await apiGet('/admin/audit-logs/stats?days=7');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error loading audit stats:', error);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Load audit logs
  const loadLogs = useCallback(async (newOffset = 0) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(newOffset),
      });

      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.category) params.append('category', filters.category);
      if (filters.action) params.append('action', filters.action);
      if (filters.success) params.append('success', filters.success);

      const response = await apiGet(`/admin/audit-logs?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setEntries(data.entries || []);
        setTotal(data.total || 0);
        setOffset(newOffset);
      }
    } catch (error) {
      console.error('Error loading audit logs:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadStats();
    loadLogs(0);
  }, []);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleSearch = () => {
    loadLogs(0);
  };

  const handleReset = () => {
    setFilters({
      startDate: formatDateForInput(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
      endDate: formatDateForInput(new Date()),
      category: '',
      action: '',
      success: '',
    });
    loadLogs(0);
  };

  const handlePrevPage = () => {
    if (offset > 0) {
      loadLogs(Math.max(0, offset - limit));
    }
  };

  const handleNextPage = () => {
    if (offset + limit < total) {
      loadLogs(offset + limit);
    }
  };

  return (
    <div style={embedded ? {} : styles.container}>
      {/* Header */}
      {!embedded && (
        <div style={styles.header}>
          <h1 style={styles.title}>
            <AuditIcon style={styles.statIcon} />
            Audit Log
          </h1>
          <p style={styles.subtitle}>
            Sicherheitsrelevante Ereignisse und Systemaktivitäten
          </p>
        </div>
      )}

      {embedded && (
        <div style={{ marginBottom: theme.spacing.xl }}>
          <h2 style={{ fontSize: theme.typography.sizes.lg, fontWeight: theme.typography.weights.semibold, color: theme.colors.text, marginBottom: theme.spacing.xs, display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={theme.colors.primary} strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            Audit Log
          </h2>
          <p style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>
            Sicherheitsrelevante Ereignisse und Systemaktivitäten
          </p>
        </div>
      )}

      {/* Stats Dashboard */}
      {!statsLoading && stats && (
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <EventIcon style={{ ...styles.statIcon, color: theme.colors.primary }} />
            <div style={styles.statValue}>{stats.totalEvents}</div>
            <div style={styles.statLabel}>Ereignisse (7 Tage)</div>
          </div>
          <div style={styles.statCard}>
            <UserIcon style={{ ...styles.statIcon, color: theme.colors.success }} />
            <div style={styles.statValue}>{stats.activeUserCount}</div>
            <div style={styles.statLabel}>Aktive Benutzer</div>
          </div>
          <div style={styles.statCard}>
            <SuccessIcon style={{ ...styles.statIcon, color: theme.colors.success }} />
            <div style={styles.statValue}>{stats.successRate}%</div>
            <div style={styles.statLabel}>Erfolgsrate</div>
          </div>
          <div style={styles.statCard}>
            <AlertIcon style={{ ...styles.statIcon, color: theme.colors.error }} />
            <div style={styles.statValue}>{stats.securityEvents}</div>
            <div style={styles.statLabel}>Security Events</div>
          </div>
        </div>
      )}

      {/* Security Alerts */}
      {stats?.recentSecurityAlerts?.length > 0 && (
        <div style={styles.alertsContainer}>
          <div style={styles.alertsTitle}>
            <AlertIcon style={{ width: '18px', height: '18px', color: theme.colors.error }} />
            Letzte Sicherheitswarnungen
          </div>
          {stats.recentSecurityAlerts.slice(0, 5).map((alert) => (
            <div key={alert.id} style={styles.alertItem}>
              <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
                {formatTimestamp(alert.timestamp)}
              </span>
              <span style={{ fontWeight: theme.typography.weights.medium, color: theme.colors.error }}>
                {ACTION_LABELS[alert.action] || alert.action}
              </span>
              {alert.ipAddress && (
                <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
                  IP: {alert.ipAddress}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={styles.filtersContainer}>
        <div style={styles.filtersRow}>
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
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Kategorie</label>
            <select
              style={styles.filterInput}
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
            >
              <option value="">Alle</option>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Status</label>
            <select
              style={styles.filterInput}
              value={filters.success}
              onChange={(e) => handleFilterChange('success', e.target.value)}
            >
              <option value="">Alle</option>
              <option value="true">Erfolgreich</option>
              <option value="false">Fehlgeschlagen</option>
            </select>
          </div>
          <button style={styles.filterButton} onClick={handleSearch}>
            Suchen
          </button>
          <button style={styles.resetButton} onClick={handleReset}>
            Zurücksetzen
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={styles.tableContainer}>
        {/* Header */}
        <div style={styles.tableHeader}>
          <div>Zeitpunkt</div>
          <div>Kategorie</div>
          <div>Aktion</div>
          <div>Benutzer</div>
          <div>Details</div>
          <div>Status</div>
        </div>

        {/* Body */}
        {loading ? (
          <div style={styles.loading}>Lade Audit Logs...</div>
        ) : entries.length === 0 ? (
          <div style={styles.emptyState}>
            Keine Einträge gefunden
          </div>
        ) : (
          entries.map((entry) => {
            const catColor = CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.system;
            return (
              <div
                key={entry.id}
                style={{
                  ...styles.tableRow,
                  ...(hoveredRow === entry.id ? styles.tableRowHover : {}),
                }}
                onMouseEnter={() => setHoveredRow(entry.id)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                <div style={styles.tableCellMuted}>
                  {formatTimestamp(entry.timestamp)}
                </div>
                <div>
                  <span
                    style={{
                      ...styles.categoryBadge,
                      backgroundColor: catColor.bg,
                      color: catColor.color,
                    }}
                  >
                    {CATEGORY_LABELS[entry.category] || entry.category}
                  </span>
                </div>
                <div style={styles.tableCell}>
                  {ACTION_LABELS[entry.action] || entry.action}
                </div>
                <div style={styles.tableCell}>
                  {entry.username || entry.userId || '-'}
                </div>
                <div style={styles.tableCellMuted} title={JSON.stringify(entry.details || {})}>
                  {entry.resourceType && `${entry.resourceType}: ${entry.resourceId || ''}`}
                  {entry.ipAddress && !entry.resourceType && `IP: ${entry.ipAddress}`}
                  {!entry.resourceType && !entry.ipAddress && '-'}
                </div>
                <div>
                  <span
                    style={{
                      ...styles.categoryBadge,
                      ...(entry.success ? styles.successBadge : styles.errorBadge),
                    }}
                  >
                    {entry.success ? 'OK' : 'Fehler'}
                  </span>
                </div>
              </div>
            );
          })
        )}

        {/* Pagination */}
        {!loading && entries.length > 0 && (
          <div style={styles.pagination}>
            <div style={styles.paginationInfo}>
              Zeige {offset + 1} - {Math.min(offset + limit, total)} von {total} Einträgen
            </div>
            <div style={styles.paginationButtons}>
              <button
                style={{
                  ...styles.paginationButton,
                  ...(offset === 0 ? styles.paginationButtonDisabled : {}),
                }}
                onClick={handlePrevPage}
                disabled={offset === 0}
              >
                Zurück
              </button>
              <button
                style={{
                  ...styles.paginationButton,
                  ...(offset + limit >= total ? styles.paginationButtonDisabled : {}),
                }}
                onClick={handleNextPage}
                disabled={offset + limit >= total}
              >
                Weiter
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Icons
function AuditIcon({ style }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function EventIcon({ style }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function UserIcon({ style }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function SuccessIcon({ style }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function AlertIcon({ style }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export default AuditLogPage;
