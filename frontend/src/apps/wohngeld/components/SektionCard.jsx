import { theme } from '../../../config/theme';
import { ACCENT } from '../api';

const styles = {
  card: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
  },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.md, marginBottom: theme.spacing.md },
  title: { fontSize: theme.typography.sizes.md, fontWeight: theme.typography.weights.semibold, color: theme.colors.text },
  right: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm },
  ampel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    padding: `2px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.full,
  },
};

/**
 * Sektion mit Titel + optionaler Ampel „n offen" (abgeleitet aus offenen Prüfschritten).
 * offenCount = Anzahl offener zugehöriger Prüfschritte (0 = grün/ok).
 */
export default function SektionCard({ title, offenCount, action, children }) {
  const hasOpen = offenCount > 0;
  const ampelStyle = hasOpen
    ? { backgroundColor: theme.colors.warningLight, color: theme.colors.warning }
    : { backgroundColor: theme.colors.successLight, color: theme.colors.success };
  return (
    <div style={styles.card}>
      <div style={styles.head}>
        <div style={styles.title}>{title}</div>
        <div style={styles.right}>
          {typeof offenCount === 'number' && (
            <span style={{ ...styles.ampel, ...ampelStyle }}>
              {hasOpen ? `${offenCount} offen` : 'vollständig'}
            </span>
          )}
          {action}
        </div>
      </div>
      {children}
    </div>
  );
}

/** Kleines Feld-Grid (Label/Wert) für Detailsektionen. */
export function FeldGrid({ felder }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 220px) 1fr', rowGap: theme.spacing.sm, columnGap: theme.spacing.lg }}>
      {felder.map((f) => (
        <FeldZeile key={f.label} label={f.label} value={f.value} />
      ))}
    </div>
  );
}

export function FeldZeile({ label, value }) {
  return (
    <>
      <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>{label}</div>
      <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text }}>{value ?? '—'}</div>
    </>
  );
}

export { ACCENT };
