/**
 * IdeenPage — Liste aller Projektideen.
 * Aufbau analog zur Projekte-Liste (ProjektePage): Aktionsleiste → Stats-Grid →
 * Such-/Filterzeile → Zeilen-Liste. Wird standalone (/ideen) und embedded (Tab
 * in ProjektePage) genutzt.
 */

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { theme } from '../../config/theme';
import { ArrowLeftIcon, LightningIcon } from '../../components/Icons';
import { useProjektideen } from '../../hooks/useProjektideen';
import { useAppPermission } from '../../components/RequireAppPermission';
import RoleBadge from '../../components/RoleBadge';

const styles = {
  container: { height: '100%', display: 'flex', flexDirection: 'column' },
  containerEmbedded: { display: 'flex', flexDirection: 'column' },
  header: {
    padding: `${theme.spacing.xl} ${theme.spacing['2xl']}`,
    borderBottom: `1px solid ${theme.colors.border}`,
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
    textDecoration: 'none',
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
  contentEmbedded: {
    padding: 0,
    overflow: 'visible',
  },
  // Action bar
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
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
  statValueSuccess: { color: theme.colors.success },
  statValueWarning: { color: theme.colors.warning },
  statValueInfo: { color: theme.colors.info },
  // Filters
  filtersRow: {
    display: 'flex',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
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
  filterSelect: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.base,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    cursor: 'pointer',
  },
  // List
  list: {
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
  cardInfo: { flex: 1 },
  cardTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  cardMeta: {
    display: 'flex',
    gap: theme.spacing.lg,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
  },
  statusBadge: {
    fontSize: theme.typography.sizes.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
    flexShrink: 0,
  },
  badgeDraft: { backgroundColor: theme.colors.surfaceHover, color: theme.colors.textMuted },
  badgeReview: { backgroundColor: theme.colors.warningLight, color: theme.colors.warning },
  badgeApproved: { backgroundColor: theme.colors.successLight, color: theme.colors.success },
  badgeRejected: { backgroundColor: theme.colors.errorLight, color: theme.colors.error },
  badgeArchived: { backgroundColor: theme.colors.surfaceHover, color: theme.colors.textMuted },
  // Empty state
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing['3xl'],
    color: theme.colors.textMuted,
  },
  emptyIcon: { marginBottom: theme.spacing.lg, opacity: 0.5 },
  emptyTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  emptyText: { fontSize: theme.typography.sizes.sm, marginBottom: theme.spacing.xl },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing['3xl'],
    color: theme.colors.textMuted,
  },
};

const STATUS_LABELS = {
  draft: 'Entwurf',
  review: 'In Prüfung',
  approved: 'Genehmigt',
  rejected: 'Abgelehnt',
  archived: 'Archiviert',
};

const STATUS_BADGE_STYLE = {
  draft: 'badgeDraft',
  review: 'badgeReview',
  approved: 'badgeApproved',
  rejected: 'badgeRejected',
  archived: 'badgeArchived',
};

export default function IdeenPage({ embedded = false }) {
  const { projektideen, isLoading, error } = useProjektideen();
  const { role: appRole } = useAppPermission();
  const canCreate = appRole === 'owner' || appRole === 'editor';

  const [filters, setFilters] = useState({ search: '', status: '' });

  const filteredIdeen = useMemo(() => {
    let result = [...projektideen];
    if (filters.status) {
      result = result.filter((i) => i.status === filters.status);
    }
    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter(
        (i) =>
          (i.name || '').toLowerCase().includes(s) ||
          (i.projektleiter || '').toLowerCase().includes(s)
      );
    }
    return result;
  }, [projektideen, filters]);

  // Kennzahlen über alle Ideen (nicht gefiltert).
  const stats = {
    total: projektideen.length,
    review: projektideen.filter((i) => i.status === 'review').length,
    approved: projektideen.filter((i) => i.status === 'approved').length,
    abgeleitet: projektideen.reduce((sum, i) => sum + (i.abgeleitete_auftraege?.length ?? 0), 0),
  };

  const actionBar = canCreate && (
    <div style={styles.actions}>
      <Link
        to="/apps/projektmanagement/ideen/import"
        style={styles.importButton}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surfaceHover; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        <ImportIcon />
        Dokumente importieren
      </Link>
      <Link
        to="/apps/projektmanagement/ideen/neu"
        style={styles.createButton}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.primaryHover; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = theme.colors.primary; }}
      >
        <PlusIcon />
        Neue Projektidee
      </Link>
    </div>
  );

  return (
    <div style={embedded ? styles.containerEmbedded : styles.container}>
      {!embedded && (
        <div style={styles.header}>
          <Link to="/apps/projektmanagement" style={styles.backLink}>
            <ArrowLeftIcon /> Projektmanagement
          </Link>
          <h1 style={styles.title}>Projektideen</h1>
          <p style={styles.subtitle}>
            Erfassen Sie neue Ideen und entwickeln Sie sie über Zeit zu konkreten Projektaufträgen weiter.
          </p>
        </div>
      )}

      <div style={embedded ? styles.contentEmbedded : styles.content}>
        {actionBar}

        {/* Stats */}
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Gesamt</div>
            <div style={styles.statValue}>{stats.total}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>In Prüfung</div>
            <div style={{ ...styles.statValue, ...styles.statValueWarning }}>{stats.review}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Genehmigt</div>
            <div style={{ ...styles.statValue, ...styles.statValueSuccess }}>{stats.approved}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Abgeleitete Aufträge</div>
            <div style={{ ...styles.statValue, ...styles.statValueInfo }}>{stats.abgeleitet}</div>
          </div>
        </div>

        {/* Filters */}
        <div style={styles.filtersRow}>
          <input
            type="text"
            placeholder="Projektideen durchsuchen..."
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
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* List */}
        {isLoading ? (
          <div style={styles.loading}>Lade Projektideen…</div>
        ) : error ? (
          <div style={{ ...styles.emptyState, color: theme.colors.error }}>Fehler: {error}</div>
        ) : filteredIdeen.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              <LightningIcon size={48} color={theme.colors.textMuted} />
            </div>
            <div style={styles.emptyTitle}>
              {projektideen.length === 0 ? 'Noch keine Projektideen' : 'Keine Projektideen gefunden'}
            </div>
            <p style={styles.emptyText}>
              {projektideen.length === 0
                ? 'Erfassen Sie Ihre erste Projektidee, um zu beginnen.'
                : 'Versuchen Sie, Ihre Filter anzupassen.'}
            </p>
            {projektideen.length === 0 && canCreate && (
              <Link
                to="/apps/projektmanagement/ideen/neu"
                style={styles.createButton}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.primaryHover; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = theme.colors.primary; }}
              >
                <PlusIcon />
                Neue Projektidee
              </Link>
            )}
          </div>
        ) : (
          <div style={styles.list}>
            {filteredIdeen.map((idee) => {
              const badgeStyle = styles[STATUS_BADGE_STYLE[idee.status] ?? 'badgeDraft'];
              const auftraegeCount = (idee.abgeleitete_auftraege ?? []).length;
              return (
                <Link
                  key={idee.id}
                  to={`/apps/projektmanagement/ideen/${idee.id}`}
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
                  <div style={styles.cardInfo}>
                    <div style={styles.cardTitle}>
                      <span>{idee.name || 'Unbenannte Idee'}</span>
                      {idee.role && <RoleBadge role={idee.role} size="sm" />}
                    </div>
                    <div style={styles.cardMeta}>
                      <span>PL: {idee.projektleiter || '-'}</span>
                      <span>|</span>
                      <span>{auftraegeCount} Auftrag{auftraegeCount !== 1 ? 'e' : ''}</span>
                    </div>
                  </div>
                  <span style={{ ...styles.statusBadge, ...badgeStyle }}>
                    {STATUS_LABELS[idee.status] ?? idee.status}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
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
