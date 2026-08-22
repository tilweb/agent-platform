/**
 * PageHeader — einheitlicher Kopf der Übersichtsseiten: Titel + Subtitle links,
 * Aktionen rechts, optionaler „?"-Hilfe-Umschalter.
 *
 * Props:
 *   title, subtitle
 *   actions: ReactNode      — rechtsbündige Aktionen (z. B. Primär-Button, Katalog-Link)
 *   onToggleHelp: () => void — wenn gesetzt, wird ein „?"-Button gezeigt
 *   helpOpen: bool
 */

import { theme } from '../../config/theme';
import { HelpCircleIcon } from '../Icons';

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: theme.spacing.lg, marginBottom: theme.spacing.xl, flexWrap: 'wrap' },
  left: { minWidth: 0 },
  title: { fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.semibold, color: theme.colors.text, marginBottom: theme.spacing.sm },
  subtitle: { fontSize: theme.typography.sizes.base, color: theme.colors.textMuted, margin: 0 },
  actions: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm, flexShrink: 0 },
  helpBtn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 38, height: 38, borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`, backgroundColor: theme.colors.surface,
    color: theme.colors.textMuted, cursor: 'pointer', transition: `all ${theme.transitions.fast}`,
  },
  helpBtnActive: { backgroundColor: theme.colors.primaryLight, color: theme.colors.primary, borderColor: theme.colors.primaryLight },
};

export default function PageHeader({ title, subtitle, actions, onToggleHelp, helpOpen }) {
  return (
    <div style={styles.header}>
      <div style={styles.left}>
        <h1 style={styles.title}>{title}</h1>
        {subtitle && <p style={styles.subtitle}>{subtitle}</p>}
      </div>
      <div style={styles.actions}>
        {onToggleHelp && (
          <button
            type="button"
            style={{ ...styles.helpBtn, ...(helpOpen ? styles.helpBtnActive : {}) }}
            onClick={onToggleHelp}
            aria-label="Hilfe anzeigen"
            title="Was ist das hier?"
          >
            <HelpCircleIcon size={18} />
          </button>
        )}
        {actions}
      </div>
    </div>
  );
}
