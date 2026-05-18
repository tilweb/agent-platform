/**
 * ProjektePage
 * Main overview page for Projektmanagement
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { theme } from '../../config/theme';
import { useProjektmanagement } from '../../hooks/useProjektmanagement';
import { LightningIcon, ClipboardIcon, AppsIcon } from '../../components/Icons';
import { useAppPermission } from '../../components/RequireAppPermission';
import RoleBadge from '../../components/RoleBadge';
import Einstellungen from './components/Einstellungen';
import IdeenPage from './IdeenPage';
import PortfolioList from './components/portfolio/PortfolioList';

// Phase C: Top-Level-Tabs entsprechen den Top-Level-Entities:
// Projekte | Ideen | Portfolios | Einstellungen.
// Statusberichte/Abschluss waren bisher fehlplaziert — gehoeren als
// Sub-Tabs in die Projekt-Detail-View (siehe Phase B/E).
const TABS = [
  {
    id: 'projekte',
    label: 'Projekte',
    icon: ClipboardIcon,
  },
  {
    id: 'ideen',
    label: 'Projektideen',
    icon: LightningIcon,
  },
  {
    id: 'portfolios',
    label: 'Portfolios',
    icon: AppsIcon,
  },
  {
    id: 'einstellungen',
    label: 'Einstellungen',
    icon: SettingsIcon,
  },
];

// Alte Tab-IDs (Bookmarks der User) → neue IDs. Unbekannte fallen auf Default zurueck.
const TAB_ALIASES = {
  auftraege: 'projekte',
  statusberichte: 'projekte', // Cross-Project-SB-Dashboard ist heute ueber den jeweiligen Projekt-Tab erreichbar
  abschluss: 'projekte', // Abschluss ist Sub-Tab im Projekt (Phase E)
  portfolio: 'portfolios',
};

const styles = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: `${theme.spacing.xl} ${theme.spacing['2xl']}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
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
  createButton: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    textDecoration: 'none',
  },
  importButton: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    textDecoration: 'none',
  },
  content: {
    flex: 1,
    padding: theme.spacing['2xl'],
    overflow: 'auto',
  },
  // Stats cards
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: theme.spacing.lg,
    marginBottom: theme.spacing['2xl'],
  },
  statCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.xl,
  },
  statLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
  },
  statValue: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  statValueSuccess: {
    color: theme.colors.success,
  },
  statValueWarning: {
    color: theme.colors.warning,
  },
  statValueInfo: {
    color: theme.colors.info,
  },
  // Filters
  filtersRow: {
    display: 'flex',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  filterSelect: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.base,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    cursor: 'pointer',
  },
  searchInput: {
    flex: 1,
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.base,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
  },
  // Project list
  projectsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
  },
  projectCard: {
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
  projectInfo: {
    flex: 1,
  },
  projectTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  projectMeta: {
    display: 'flex',
    gap: theme.spacing.lg,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
  },
  projectRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
  },
  progressBar: {
    width: '120px',
    height: '6px',
    backgroundColor: theme.colors.border,
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.full,
    transition: 'width 0.3s ease',
  },
  progressText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  statusBadge: {
    fontSize: theme.typography.sizes.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
  },
  statusDraft: {
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.textMuted,
  },
  statusActive: {
    backgroundColor: theme.colors.successLight,
    color: theme.colors.success,
  },
  statusCompleted: {
    backgroundColor: theme.colors.infoLight,
    color: theme.colors.info,
  },
  statusCancelled: {
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
  },
  // Empty state
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing['3xl'],
    color: theme.colors.textMuted,
  },
  emptyIcon: {
    marginBottom: theme.spacing.lg,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    fontSize: theme.typography.sizes.sm,
    marginBottom: theme.spacing.xl,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing['3xl'],
    color: theme.colors.textMuted,
  },
  // Tabs
  tabs: {
    display: 'flex',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
    borderBottom: `1px solid ${theme.colors.border}`,
    paddingBottom: theme.spacing.md,
    flexWrap: 'wrap',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    position: 'relative',
  },
  tabActive: {
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
  },
};

function ProjektePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const aliased = rawTab ? (TAB_ALIASES[rawTab] || rawTab) : null;
  const knownIds = new Set(TABS.map((t) => t.id));
  const activeTab = aliased && knownIds.has(aliased) ? aliased : 'projekte';
  const { projektauftraege, stats, isLoading, refresh } = useProjektmanagement();
  const { role: appRole } = useAppPermission();
  const canCreate = appRole === 'owner' || appRole === 'editor';
  const canSeeSettings = appRole === 'owner';
  // Tabs gefiltert: Einstellungen nur fuer App-Owner.
  const visibleTabs = TABS.filter((t) => t.id !== 'einstellungen' || canSeeSettings);
  const [filters, setFilters] = useState({
    status: '',
    project_type: '',
    search: '',
  });
  const [filteredProjekte, setFilteredProjekte] = useState([]);

  const handleTabChange = (tabId) => {
    if (tabId === 'projekte') {
      setSearchParams({});
    } else {
      setSearchParams({ tab: tabId });
    }
  };

  // Apply filters
  useEffect(() => {
    let result = [...projektauftraege];

    if (filters.status) {
      result = result.filter((p) => p.status === filters.status);
    }

    if (filters.project_type) {
      result = result.filter((p) => p.project_type === filters.project_type);
    }

    if (filters.search) {
      const search = filters.search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          p.projektleiter?.toLowerCase().includes(search) ||
          p.auftraggeber?.toLowerCase().includes(search)
      );
    }

    setFilteredProjekte(result);
  }, [projektauftraege, filters]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('de-DE');
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'draft':
        return { style: styles.statusDraft, label: 'Entwurf' };
      case 'active':
        return { style: styles.statusActive, label: 'Aktiv' };
      case 'completed':
        return { style: styles.statusCompleted, label: 'Abgeschlossen' };
      case 'cancelled':
        return { style: styles.statusCancelled, label: 'Abgebrochen' };
      default:
        return { style: {}, label: status };
    }
  };

  const getProjectTypeName = (type) => {
    const types = {
      internal: 'Intern',
      external: 'Extern',
      research: 'Forschung',
      infrastructure: 'Infrastruktur',
    };
    return types[type] || type;
  };

  const calculateCompleteness = (projekt) => {
    const checks = [
      !!projekt.name,
      !!projekt.projektleiter,
      !!projekt.auftraggeber,
      !!projekt.start_date,
      !!projekt.goals,
      projekt.criteria?.length > 0,
      !!projekt.scope,
      projekt.tasks?.length > 0,
      projekt.milestones?.length > 0,
      projekt.budget?.length > 0,
      projekt.risks?.length > 0,
      projekt.organization?.length > 0,
    ];
    const completed = checks.filter(Boolean).length;
    return Math.round((completed / checks.length) * 100);
  };

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <h1 style={styles.title}>Projektmanagement</h1>
            <p style={styles.subtitle}>Projekte, Ideen und Portfolios verwalten</p>
          </div>
        </div>
        <div style={styles.loading}>Lade Projekte...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.title}>Projektmanagement</h1>
          <p style={styles.subtitle}>Projekte, Ideen und Portfolios verwalten</p>
        </div>
      </div>

      <div style={styles.content}>
        {/* Tabs */}
        <div style={styles.tabs}>
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                style={{
                  ...styles.tab,
                  ...(isActive ? styles.tabActive : {}),
                }}
                onClick={() => handleTabChange(tab.id)}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <TabIcon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'einstellungen' ? (
          <Einstellungen />
        ) : activeTab === 'ideen' ? (
          <IdeenPage embedded />
        ) : activeTab === 'portfolios' ? (
          <PortfolioList />
        ) : activeTab === 'projekte' ? (
          <>
            {/* Action Bar (analog Ideen-Tab) — nur fuer App-Editor/Owner */}
            {canCreate && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing.md, marginBottom: theme.spacing.xl }}>
                <Link
                  to="/apps/projektmanagement/import"
                  style={styles.importButton}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <ImportIcon />
                  Dokumente importieren
                </Link>
                <Link
                  to="/apps/projektmanagement/neu"
                  style={styles.createButton}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.primaryHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.primary;
                  }}
                >
                  <PlusIcon />
                  Neues Projekt
                </Link>
              </div>
            )}

            {/* Stats Cards */}
            {stats && (
              <div style={styles.statsGrid}>
                <div style={styles.statCard}>
                  <div style={styles.statLabel}>Gesamt</div>
                  <div style={styles.statValue}>{stats.total}</div>
                </div>
                <div style={styles.statCard}>
                  <div style={styles.statLabel}>Aktiv</div>
                  <div style={{ ...styles.statValue, ...styles.statValueSuccess }}>
                    {stats.active}
                  </div>
                </div>
                <div style={styles.statCard}>
                  <div style={styles.statLabel}>Entwürfe</div>
                  <div style={{ ...styles.statValue, ...styles.statValueWarning }}>
                    {stats.draft}
                  </div>
                </div>
                <div style={styles.statCard}>
                  <div style={styles.statLabel}>Gesamtbudget</div>
                  <div style={styles.statValue}>{formatCurrency(stats.total_budget)}</div>
                </div>
              </div>
            )}

            {/* Filters */}
            <div style={styles.filtersRow}>
              <input
                type="text"
                placeholder="Projekte durchsuchen..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                style={styles.searchInput}
              />
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                style={styles.filterSelect}
              >
                <option value="">Alle Status</option>
                <option value="draft">Entwurf</option>
                <option value="active">Aktiv</option>
                <option value="completed">Abgeschlossen</option>
                <option value="cancelled">Abgebrochen</option>
              </select>
              <select
                value={filters.project_type}
                onChange={(e) => setFilters({ ...filters, project_type: e.target.value })}
                style={styles.filterSelect}
              >
                <option value="">Alle Typen</option>
                <option value="internal">Intern</option>
                <option value="external">Extern</option>
                <option value="research">Forschung</option>
                <option value="infrastructure">Infrastruktur</option>
              </select>
            </div>

            {/* Project List */}
            {filteredProjekte.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}>
                  <BriefcaseIcon size={48} color={theme.colors.textMuted} />
                </div>
                <div style={styles.emptyTitle}>
                  {projektauftraege.length === 0
                    ? 'Noch keine Projekte'
                    : 'Keine Projekte gefunden'}
                </div>
                <p style={styles.emptyText}>
                  {projektauftraege.length === 0
                    ? 'Erstellen Sie Ihr erstes Projekt, um zu beginnen.'
                    : 'Versuchen Sie, Ihre Filter anzupassen.'}
                </p>
                {projektauftraege.length === 0 && canCreate && (
                  <Link
                    to="/apps/projektmanagement/neu"
                    style={styles.createButton}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = theme.colors.primaryHover;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = theme.colors.primary;
                    }}
                  >
                    <PlusIcon />
                    Neues Projekt
                  </Link>
                )}
              </div>
            ) : (
              <div style={styles.projectsList}>
                {filteredProjekte.map((projekt) => {
                  const statusBadge = getStatusBadge(projekt.status);
                  const completeness = calculateCompleteness(projekt);
                  return (
                    <Link
                      key={projekt.id}
                      to={`/apps/projektmanagement/${projekt.id}`}
                      style={styles.projectCard}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                        e.currentTarget.style.borderColor = theme.colors.primary;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = theme.colors.surface;
                        e.currentTarget.style.borderColor = theme.colors.border;
                      }}
                    >
                      <div style={styles.projectInfo}>
                        <div style={{ ...styles.projectTitle, display: 'flex', alignItems: 'center', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
                          <span>{projekt.name || 'Unbenanntes Projekt'}</span>
                          {projekt.role && <RoleBadge role={projekt.role} size="sm" />}
                        </div>
                        <div style={styles.projectMeta}>
                          <span>{getProjectTypeName(projekt.project_type)}</span>
                          <span>|</span>
                          <span>PL: {projekt.projektleiter || '-'}</span>
                          <span>|</span>
                          <span>
                            {formatDate(projekt.start_date)} - {formatDate(projekt.end_date)}
                          </span>
                        </div>
                      </div>
                      <div style={styles.projectRight}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
                          <div>
                            <div style={styles.progressBar}>
                              <div
                                style={{
                                  ...styles.progressFill,
                                  width: `${completeness}%`,
                                }}
                              />
                            </div>
                            <div style={styles.progressText}>{completeness}% vollständig</div>
                          </div>
                          <span style={{ ...styles.statusBadge, ...statusBadge.style }}>
                            {statusBadge.label}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

// Icons
function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function SettingsIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function ImportIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function BriefcaseIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

export default ProjektePage;
