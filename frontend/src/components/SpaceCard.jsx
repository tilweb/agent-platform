/**
 * SpaceCard Component
 *
 * Card for displaying a space in the overview grid.
 */

import { theme } from '../config/theme';
import { BriefcaseIcon, UserIcon, ArchiveIcon } from './Icons';
import { formatDateRelative as formatDate } from '../utils/dateFormat';

const styles = {
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.xl,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  cardHover: {
    borderColor: '#9333ea40',
    boxShadow: '0 4px 12px rgba(147, 51, 234, 0.1)',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  iconWrapper: {
    width: '44px',
    height: '44px',
    borderRadius: theme.borderRadius.lg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  description: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.lineHeight.relaxed,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    borderTop: `1px solid ${theme.colors.borderLight}`,
  },
  memberCount: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
  },
  memberIcon: {
    color: theme.colors.textMuted,
  },
  updatedAt: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  archivedBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    backgroundColor: theme.colors.surfaceHover,
    padding: `2px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.sm,
  },
};

function getSpaceColor(space) {
  return space.color || '#9333ea';
}

// formatDate (formatDateRelative) is imported from utils/dateFormat

export default function SpaceCard({ space, onClick }) {
  const color = getSpaceColor(space);
  const memberCount = space.members?.length || 1;

  return (
    <div
      style={styles.card}
      onClick={onClick}
      onMouseOver={(e) => {
        e.currentTarget.style.borderColor = `${color}40`;
        e.currentTarget.style.boxShadow = `0 4px 12px ${color}15`;
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.borderColor = theme.colors.border;
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={styles.header}>
        <div
          style={{
            ...styles.iconWrapper,
            backgroundColor: `${color}15`,
          }}
        >
          <BriefcaseIcon size={22} color={color} />
        </div>
        <div style={styles.content}>
          <div style={styles.name}>{space.name}</div>
          {space.description && (
            <div style={styles.description}>{space.description}</div>
          )}
        </div>
      </div>

      <div style={styles.footer}>
        <div style={styles.memberCount}>
          <UserIcon size={14} style={styles.memberIcon} />
          <span>{memberCount} {memberCount === 1 ? 'Mitglied' : 'Mitglieder'}</span>
        </div>

        {space.archived ? (
          <span style={styles.archivedBadge}>
            <ArchiveIcon size={12} />
            Archiviert
          </span>
        ) : (
          <span style={styles.updatedAt}>
            {formatDate(space.updatedAt)}
          </span>
        )}
      </div>
    </div>
  );
}
