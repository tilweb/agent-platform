import { useState } from 'react';
import { theme } from '../../../config/theme';
import { ChevronDownIcon } from '../../../components/Icons';
import { ACCENT } from '../api';

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
  // Pulsierender KI-Punkt neben dem Titel — auch bei eingeklapptem Block sichtbar.
  dot: {
    display: 'inline-block', width: 8, height: 8, borderRadius: theme.borderRadius.full,
    backgroundColor: ACCENT, flexShrink: 0, animation: 'wg-pulse 1.6s ease-in-out infinite',
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
 * Einklappbare Sektion für Seitenpanel & Detailkarten.
 * Kopfzeile: Chevron + Uppercase-Titel + optional Zähler (count), KI-Punkt (unbestaetigt)
 * und/oder Aktion (action, rechts). Klar abgegrenzter Container (neutraler Rahmen, abgesetzte Kopfzeile).
 *
 * Offen-Zustand: unkontrolliert über `defaultOpen` (lokaler State) ODER kontrolliert über
 * `open` + `onToggle(nextOpen)` — Letzteres erlaubt dem Aufrufer, beim Bearbeiten aufzuklappen.
 */
export default function PanelSection({ title, count, action, defaultOpen = true, open: openProp, onToggle, unbestaetigt = false, children }) {
  const [openState, setOpenState] = useState(defaultOpen);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openState;
  const toggle = () => {
    const next = !open;
    if (controlled) onToggle?.(next);
    else setOpenState(next);
  };
  return (
    <div style={styles.section}>
      <div style={styles.header}>
        <button
          style={styles.toggle}
          onClick={toggle}
          aria-expanded={open}
          title={open ? 'Einklappen' : 'Ausklappen'}
        >
          <ChevronDownIcon size={14} style={{ ...styles.chevron, transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
          <span style={styles.title}>{title}</span>
          {typeof count === 'number' && <span style={styles.count}>{count}</span>}
          {unbestaetigt && <span style={styles.dot} title="Enthält unbestätigte KI-Vorschläge" aria-label="Unbestätigte KI-Vorschläge" />}
        </button>
        {action && <div style={styles.action}>{action}</div>}
      </div>
      {open && <div style={styles.body}>{children}</div>}
    </div>
  );
}
