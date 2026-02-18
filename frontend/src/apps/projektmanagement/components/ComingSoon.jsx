/**
 * ComingSoon
 * Placeholder component for upcoming features
 */

import { theme } from '../../../config/theme';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing['3xl'],
    textAlign: 'center',
    minHeight: '400px',
  },
  iconWrapper: {
    marginBottom: theme.spacing.xl,
    opacity: 0.5,
  },
  title: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    margin: 0,
  },
  description: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textMuted,
    maxWidth: '400px',
    lineHeight: theme.typography.lineHeight.relaxed,
    marginBottom: theme.spacing.xl,
  },
  badge: {
    display: 'inline-block',
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
    borderRadius: theme.borderRadius.full,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
  },
};

function ComingSoon({ title, description, icon: Icon }) {
  return (
    <div style={styles.container}>
      {Icon && (
        <div style={styles.iconWrapper}>
          <Icon size={64} color={theme.colors.textMuted} />
        </div>
      )}
      <h2 style={styles.title}>{title}</h2>
      <p style={styles.description}>{description}</p>
      <div style={styles.badge}>Coming Soon</div>
    </div>
  );
}

export default ComingSoon;
