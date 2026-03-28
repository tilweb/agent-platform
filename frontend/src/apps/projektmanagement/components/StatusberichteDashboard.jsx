/**
 * StatusberichteDashboard
 * Shows active projects with their latest Ampel status
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { theme } from '../../../config/theme';
import { useProjektmanagement } from '../../../hooks/useProjektmanagement';

const AMPEL_COLORS = {
  gruen: theme.colors.success,
  gelb: theme.colors.warning,
  rot: theme.colors.error,
};

const AMPEL_LABELS = {
  gruen: 'Grün',
  gelb: 'Gelb',
  rot: 'Rot',
};

const PROJECT_TYPE_LABELS = {
  internal: 'Intern',
  external: 'Extern',
  research: 'Forschung',
  infrastructure: 'Infrastruktur',
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xl,
  },
  grid: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.xl,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    textDecoration: 'none',
  },
  cardLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.lg,
    flex: 1,
  },
  ampelDot: {
    width: '14px',
    height: '14px',
    borderRadius: theme.borderRadius.full,
    flexShrink: 0,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  cardMeta: {
    display: 'flex',
    gap: theme.spacing.lg,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
  },
  cardRight: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  berichtCount: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    backgroundColor: theme.colors.surfaceHover,
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.md,
  },
  ampelBadge: {
    fontSize: theme.typography.sizes.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing['3xl'],
    color: theme.colors.textMuted,
  },
  emptyTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    fontSize: theme.typography.sizes.sm,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing['3xl'],
    color: theme.colors.textMuted,
  },
};

function StatusberichteDashboard() {
  const { getStatusberichteDashboard } = useProjektmanagement();
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setIsLoading(true);
      const data = await getStatusberichteDashboard();
      setEntries(data);
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('de-DE');
  };

  if (isLoading) {
    return <div style={styles.loading}>Lade Dashboard...</div>;
  }

  if (entries.length === 0) {
    return (
      <div style={styles.emptyState}>
        <div style={styles.emptyTitle}>Keine Statusberichte vorhanden</div>
        <p style={styles.emptyText}>
          Erstellen Sie Statusberichte in aktiven Projekten, um hier eine Übersicht zu sehen.
        </p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.grid}>
        {entries.map((entry) => {
          const color = AMPEL_COLORS[entry.latest_ampel] || theme.colors.textMuted;
          return (
            <Link
              key={entry.projekt_id}
              to={`/apps/projektmanagement/${entry.projekt_id}`}
              style={styles.card}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                e.currentTarget.style.borderColor = theme.colors.primary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.surface;
                e.currentTarget.style.borderColor = theme.colors.border;
              }}
            >
              <div style={styles.cardLeft}>
                <div style={{ ...styles.ampelDot, backgroundColor: color }} />
                <div style={styles.cardInfo}>
                  <div style={styles.cardTitle}>{entry.projekt_name || 'Unbenannt'}</div>
                  <div style={styles.cardMeta}>
                    <span>PL: {entry.projektleiter || '-'}</span>
                    <span>|</span>
                    <span>{PROJECT_TYPE_LABELS[entry.project_type] || entry.project_type}</span>
                    <span>|</span>
                    <span>Letzter Bericht: {formatDate(entry.latest_datum)}</span>
                  </div>
                </div>
              </div>
              <div style={styles.cardRight}>
                <span style={styles.berichtCount}>
                  {entry.bericht_count} {entry.bericht_count === 1 ? 'Bericht' : 'Berichte'}
                </span>
                <span style={{
                  ...styles.ampelBadge,
                  backgroundColor: `${color}20`,
                  color: color,
                }}>
                  {AMPEL_LABELS[entry.latest_ampel] || entry.latest_ampel}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default StatusberichteDashboard;
