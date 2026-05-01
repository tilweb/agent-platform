/**
 * ProjectCard Component
 *
 * Card for displaying a project in the overview grid.
 */

import { theme } from '../config/theme';
import { BriefcaseIcon, UserIcon, ArchiveIcon, LockIcon } from './Icons';

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

function getProjectColor(project) {
  return project.color || '#9333ea';
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Heute';
  if (diffDays === 1) return 'Gestern';
  if (diffDays < 7) return `vor ${diffDays} Tagen`;
  return date.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
}

export default function ProjectCard({ project, onClick }) {
  const locked = project.accessible === false;
  const color = getProjectColor(project);
  const memberCount = project.members?.length || 1;
  const groupCount = project.groupCount || 0;
  const ownerLabel = project.owner
    ? (project.owner.principalType === 'group' ? `Gruppe ${project.owner.name}` : project.owner.name)
    : 'Admin';

  return (
    <div
      style={{
        ...styles.card,
        ...(locked ? {
          opacity: 0.65,
          cursor: 'default',
          backgroundColor: theme.colors.background,
        } : {}),
        position: 'relative',
      }}
      onClick={locked ? undefined : onClick}
      onMouseOver={locked ? undefined : (e) => {
        e.currentTarget.style.borderColor = `${color}40`;
        e.currentTarget.style.boxShadow = `0 4px 12px ${color}15`;
      }}
      onMouseOut={locked ? undefined : (e) => {
        e.currentTarget.style.borderColor = theme.colors.border;
        e.currentTarget.style.boxShadow = 'none';
      }}
      title={locked ? `Kein Zugriff — anfragen bei ${ownerLabel}` : undefined}
    >
      {locked && (
        <div style={{ position: 'absolute', top: theme.spacing.md, right: theme.spacing.md, color: theme.colors.textMuted }}>
          <LockIcon size={16} />
        </div>
      )}
      <div style={styles.header}>
        <div
          style={{
            ...styles.iconWrapper,
            backgroundColor: `${color}15`,
          }}
        >
          <BriefcaseIcon size={22} color={locked ? theme.colors.textMuted : color} />
        </div>
        <div style={styles.content}>
          <div style={styles.name}>{project.name}</div>
          {project.description && !locked && (
            <div style={styles.description}>{project.description}</div>
          )}
        </div>
      </div>

      <div style={styles.footer}>
        {locked ? (
          <span style={{
            fontStyle: 'italic',
            color: theme.colors.textMuted,
            fontSize: theme.typography.sizes.sm,
          }}>
            Zugriff anfragen bei {ownerLabel}
          </span>
        ) : (
          <>
            <div style={styles.memberCount}>
              <UserIcon size={14} style={styles.memberIcon} />
              <span>{memberCount} {memberCount === 1 ? 'Mitglied' : 'Mitglieder'}</span>
              {groupCount > 0 && (
                <span style={{ marginLeft: theme.spacing.sm }}>· {groupCount} {groupCount === 1 ? 'Gruppe' : 'Gruppen'}</span>
              )}
            </div>

            {project.archived ? (
              <span style={styles.archivedBadge}>
                <ArchiveIcon size={12} />
                Archiviert
              </span>
            ) : (
              <span style={styles.updatedAt}>
                {formatDate(project.updatedAt)}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
