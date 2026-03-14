/**
 * AppsPage
 * Overview of all available apps with enable/disable functionality
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { theme } from '../config/theme';
import { useApps } from '../hooks/useApps';
import { useAuth } from '../context/AuthContext';

const styles = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: `${theme.spacing.xl} ${theme.spacing['2xl']}`,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  title: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
  },
  content: {
    flex: 1,
    padding: theme.spacing['2xl'],
    overflow: 'auto',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.xl,
    transition: `all ${theme.transitions.fast}`,
    display: 'flex',
    flexDirection: 'column',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  iconWrapper: {
    width: '48px',
    height: '48px',
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.primaryLight,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  cardVersion: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  cardDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
    flex: 1,
  },
  cardFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.lg,
    borderTop: `1px solid ${theme.colors.border}`,
  },
  statusBadge: {
    fontSize: theme.typography.sizes.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
  },
  statusEnabled: {
    backgroundColor: theme.colors.successLight,
    color: theme.colors.success,
  },
  statusDisabled: {
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.textMuted,
  },
  openButton: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  toggleButton: {
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    backgroundColor: 'transparent',
    color: theme.colors.textSecondary,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing['3xl'],
    color: theme.colors.textMuted,
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing['3xl'],
    color: theme.colors.textMuted,
  },
};

function AppsPage() {
  const { apps, isLoading, toggleApp } = useApps();
  const { user } = useAuth();
  const [toggling, setToggling] = useState(null);

  const isAdmin = user?.role === 'admin';

  const handleToggle = async (appId) => {
    setToggling(appId);
    try {
      await toggleApp(appId);
    } catch (error) {
      console.error('Error toggling app:', error);
    } finally {
      setToggling(null);
    }
  };

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Apps</h1>
          <p style={styles.subtitle}>Verfügbare Apps und Erweiterungen</p>
        </div>
        <div style={styles.loading}>Lade Apps...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Apps</h1>
        <p style={styles.subtitle}>Verfügbare Apps und Erweiterungen</p>
      </div>

      <div style={styles.content}>
        {apps.length === 0 ? (
          <div style={styles.emptyState}>
            Keine Apps verfügbar.
          </div>
        ) : (
          <div style={styles.grid}>
            {apps.map((app) => (
              <div key={app.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <div style={styles.iconWrapper}>
                    <AppIcon iconId={app.icon} />
                  </div>
                  <div style={styles.cardInfo}>
                    <div style={styles.cardTitle}>{app.name}</div>
                    <div style={styles.cardVersion}>v{app.version}</div>
                  </div>
                </div>

                <p style={styles.cardDescription}>{app.description}</p>

                <div style={styles.cardFooter}>
                  <span
                    style={{
                      ...styles.statusBadge,
                      ...(app.enabled ? styles.statusEnabled : styles.statusDisabled),
                    }}
                  >
                    {app.enabled ? 'Aktiviert' : 'Deaktiviert'}
                  </span>

                  <div style={{ display: 'flex', gap: theme.spacing.sm }}>
                    {isAdmin && (
                      <button
                        onClick={() => handleToggle(app.id)}
                        disabled={toggling === app.id}
                        style={styles.toggleButton}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        {toggling === app.id
                          ? '...'
                          : app.enabled
                          ? 'Deaktivieren'
                          : 'Aktivieren'}
                      </button>
                    )}

                    {app.enabled && (
                      <Link
                        to={`/apps/${app.id}`}
                        style={styles.openButton}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = theme.colors.primaryHover;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = theme.colors.primary;
                        }}
                      >
                        Öffnen
                        <ArrowRightIcon />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Icons
function AppIcon({ iconId }) {
  switch (iconId) {
    case 'contract':
      return <ContractIcon size={24} color={theme.colors.primary} />;
    case 'supplier':
      return <SupplierIcon size={24} color={theme.colors.primary} />;
    default:
      return <BoxIcon size={24} color={theme.colors.primary} />;
  }
}

function SupplierIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ContractIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

function BoxIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export default AppsPage;
