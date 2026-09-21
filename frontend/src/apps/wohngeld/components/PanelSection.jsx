import { useState } from 'react';
import { theme } from '../../../config/theme';
import { ChevronDownIcon } from '../../../components/Icons';

const styles = {
  section: {
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  toggle: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
  },
  chevron: {
    flexShrink: 0,
    color: theme.colors.textMuted,
    transition: `transform ${theme.transitions.fast}`,
  },
  title: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  count: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    backgroundColor: theme.colors.surfaceHover,
    borderRadius: theme.borderRadius.full,
    padding: `1px ${theme.spacing.sm}`,
    minWidth: 20,
    textAlign: 'center',
  },
  action: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingRight: theme.spacing.md,
    flexShrink: 0,
  },
  body: {
    padding: theme.spacing.md,
    borderTop: `1px solid ${theme.colors.border}`,
  },
};

/**
 * Einklappbare Sektion für das rechte Seitenpanel.
 * Kopfzeile: Chevron + Uppercase-Titel + optional Zähler (count) und/oder Aktion (action, rechts).
 * Zustand lokal (open); klar abgegrenzter Container (neutraler Rahmen, abgesetzte Kopfzeile).
 */
export default function PanelSection({ title, count, action, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={styles.section}>
      <div style={styles.header}>
        <button
          style={styles.toggle}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          title={open ? 'Einklappen' : 'Ausklappen'}
        >
          <ChevronDownIcon size={14} style={{ ...styles.chevron, transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
          <span style={styles.title}>{title}</span>
          {typeof count === 'number' && <span style={styles.count}>{count}</span>}
        </button>
        {action && <div style={styles.action}>{action}</div>}
      </div>
      {open && <div style={styles.body}>{children}</div>}
    </div>
  );
}
