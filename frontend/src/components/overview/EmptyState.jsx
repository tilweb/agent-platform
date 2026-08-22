/**
 * EmptyState — einheitlicher Leerzustand (Icon + Titel + Text + optionale Aktion).
 * Muster aus ContractsPage. `boxed` rahmt den Zustand als gestrichelte Karte.
 */

import { theme } from '../../config/theme';

const styles = {
  plain: { textAlign: 'center', padding: theme.spacing['3xl'], color: theme.colors.textMuted },
  boxed: {
    textAlign: 'center', padding: theme.spacing['2xl'], color: theme.colors.textMuted,
    backgroundColor: theme.colors.surfaceHover, border: `1px dashed ${theme.colors.border}`, borderRadius: theme.borderRadius.xl,
  },
  icon: { marginBottom: theme.spacing.lg, opacity: 0.5, display: 'flex', justifyContent: 'center' },
  title: { fontSize: theme.typography.sizes.lg, fontWeight: theme.typography.weights.medium, color: theme.colors.text, marginBottom: theme.spacing.sm },
  text: { fontSize: theme.typography.sizes.sm, marginBottom: theme.spacing.xl },
  action: { display: 'inline-flex', justifyContent: 'center' },
};

export default function EmptyState({ icon, title, subtitle, action, boxed = false }) {
  return (
    <div style={boxed ? styles.boxed : styles.plain}>
      {icon && <div style={styles.icon}>{icon}</div>}
      {title && <div style={styles.title}>{title}</div>}
      {subtitle && <p style={styles.text}>{subtitle}</p>}
      {action && <div style={styles.action}>{action}</div>}
    </div>
  );
}
