/**
 * IdeenPage — Liste aller Projektideen.
 * Karten-Layout mit Status-Badges und Anzeige der Anzahl abgeleiteter Auftraege.
 */

import { Link, useNavigate } from 'react-router-dom';
import { theme } from '../../config/theme';
import { ArrowLeftIcon } from '../../components/Icons';
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
  embeddedActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
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
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    transition: `all ${theme.transitions.fast}`,
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
  headerContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
  newButton: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
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
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    textDecoration: 'none',
    color: 'inherit',
  },
  cardName: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  cardMeta: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    display: 'flex',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  cardDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },
  badge: {
    fontSize: theme.typography.sizes.xs,
    padding: `2px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
  },
  badgeDraft: { backgroundColor: theme.colors.surfaceHover, color: theme.colors.textMuted },
  badgeReview: { backgroundColor: theme.colors.warningLight, color: theme.colors.warning },
  badgeApproved: { backgroundColor: theme.colors.successLight, color: theme.colors.success },
  badgeRejected: { backgroundColor: theme.colors.errorLight, color: theme.colors.error },
  badgeArchived: { backgroundColor: theme.colors.surfaceHover, color: theme.colors.textMuted },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing['3xl'],
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
};

const STATUS_LABELS = {
  draft: 'Entwurf',
  review: 'In Pruefung',
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
  const navigate = useNavigate();
  const { projektideen, isLoading, error } = useProjektideen();
  const { role: appRole } = useAppPermission();
  const canCreate = appRole === 'owner' || appRole === 'editor';

  return (
    <div style={embedded ? styles.containerEmbedded : styles.container}>
      {!embedded && (
        <div style={styles.header}>
          <Link to="/apps/projektmanagement" style={styles.backLink}>
            <ArrowLeftIcon /> Projektmanagement
          </Link>
          <div style={styles.headerContent}>
            <div>
              <h1 style={styles.title}>Projektideen</h1>
              <p style={styles.subtitle}>
                Erfassen Sie neue Ideen und entwickeln Sie sie ueber Zeit zu konkreten Projektauftraegen weiter.
              </p>
            </div>
            {canCreate && (
              <Link to="/apps/projektmanagement/ideen/neu" style={styles.newButton}>
                + Neue Projektidee
              </Link>
            )}
          </div>
        </div>
      )}

      <div style={embedded ? styles.contentEmbedded : styles.content}>
        {embedded && canCreate && (
          <div style={styles.embeddedActions}>
            <Link to="/apps/projektmanagement/ideen/import" style={styles.importButton}>
              <ImportIcon />
              Dokumente importieren
            </Link>
            <Link to="/apps/projektmanagement/ideen/neu" style={styles.newButton}>
              + Neue Projektidee
            </Link>
          </div>
        )}
        {isLoading && <div style={styles.emptyState}>Lade Projektideen…</div>}
        {error && <div style={styles.emptyState}>Fehler: {error}</div>}
        {!isLoading && !error && projektideen.length === 0 && (
          <div style={styles.emptyState}>
            Noch keine Projektideen erfasst. Klicken Sie auf <strong>„+ Neue Projektidee"</strong>.
          </div>
        )}
        <div style={styles.cardGrid}>
          {projektideen.map((idee) => {
            const badgeStyle = styles[STATUS_BADGE_STYLE[idee.status] ?? 'badgeDraft'];
            const auftraegeCount = (idee.abgeleitete_auftraege ?? []).length;
            return (
              <div
                key={idee.id}
                style={styles.card}
                onClick={() => navigate(`/apps/projektmanagement/ideen/${idee.id}`)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.surface;
                }}
              >
                <div style={{ ...styles.cardName, display: 'flex', alignItems: 'center', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
                  <span>{idee.name || 'Unbenannte Idee'}</span>
                  {idee.role && <RoleBadge role={idee.role} size="sm" />}
                </div>
                <div style={styles.cardMeta}>
                  <span style={{ ...styles.badge, ...badgeStyle }}>
                    {STATUS_LABELS[idee.status] ?? idee.status}
                  </span>
                  {idee.projektleiter && <span>· {idee.projektleiter}</span>}
                  {auftraegeCount > 0 && (
                    <span>· {auftraegeCount} Auftrag{auftraegeCount !== 1 ? 'e' : ''}</span>
                  )}
                </div>
                {idee.description && (
                  <div style={styles.cardDescription}>{idee.description}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
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
