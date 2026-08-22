/**
 * GroupTabs — Pill-Tabs mit Zähler-Badge für die Gruppierung der Übersichtsseiten
 * (z. B. Alle · Eigene · Geteilt · Gesperrt · System). Styles + Hover-Verhalten wie
 * die Haupt-Tabs in ProjektePage.
 *
 * Props:
 *   tabs: [{ id, label, count }]
 *   active: string
 *   onChange: (id) => void
 *   hideEmpty: bool — Tabs mit count === 0 ausblenden (Standard true; `active` bleibt sichtbar)
 */

import { theme } from '../../config/theme';

const styles = {
  tabs: { display: 'flex', gap: theme.spacing.sm, flexWrap: 'wrap', borderBottom: `1px solid ${theme.colors.border}`, paddingBottom: theme.spacing.md, marginBottom: theme.spacing.xl },
  tab: {
    display: 'inline-flex', alignItems: 'center', gap: theme.spacing.sm,
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent', border: 'none', borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted, cursor: 'pointer', transition: `all ${theme.transitions.fast}`,
  },
  tabActive: { backgroundColor: theme.colors.primaryLight, color: theme.colors.primary },
  count: {
    fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.semibold,
    padding: `0 ${theme.spacing.sm}`, borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surfaceHover, color: theme.colors.textMuted, minWidth: 18, textAlign: 'center',
  },
  countActive: { backgroundColor: theme.colors.primary, color: '#fff' },
};

export default function GroupTabs({ tabs, active, onChange, hideEmpty = true }) {
  const visible = (tabs || []).filter((t) => !hideEmpty || t.count > 0 || t.id === active || t.always);
  if (visible.length <= 1) return null;
  return (
    <div style={styles.tabs}>
      {visible.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            style={{ ...styles.tab, ...(isActive ? styles.tabActive : {}) }}
            onClick={() => onChange(t.id)}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = theme.colors.surfaceHover; }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            {t.label}
            {typeof t.count === 'number' && (
              <span style={{ ...styles.count, ...(isActive ? styles.countActive : {}) }}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
