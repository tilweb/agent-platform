import { theme } from '../../../config/theme';
import { SCHWERE_META } from '../api';

/**
 * Deterministische Checker-Befunde (PM-01..10), nach Schweregrad sortiert.
 */
const SCHWERE_COLOR = {
  kritisch: theme.colors.error,
  hoch: theme.colors.warning,
  mittel: theme.colors.warning,
  frage: theme.colors.info,
  niedrig: theme.colors.textMuted,
};
const SCHWERE_BG = {
  kritisch: theme.colors.errorLight,
  hoch: theme.colors.warningLight,
  mittel: theme.colors.warningLight,
  frage: theme.colors.infoLight,
  niedrig: theme.colors.surfaceHover,
};

const styles = {
  item: {
    display: 'flex', gap: theme.spacing.md, padding: theme.spacing.md,
    borderBottom: `1px solid ${theme.colors.borderLight}`,
  },
  badge: {
    flex: 'none', alignSelf: 'flex-start', fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.semibold,
    padding: `2px ${theme.spacing.sm}`, borderRadius: theme.borderRadius.full, whiteSpace: 'nowrap',
  },
  pm: { fontWeight: theme.typography.weights.semibold, color: theme.colors.text, fontSize: theme.typography.sizes.sm },
  befund: { fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary, lineHeight: 1.45, marginTop: 2 },
  meta: { fontSize: '0.7rem', color: theme.colors.textMuted, marginTop: 4 },
  empty: { padding: theme.spacing.xl, textAlign: 'center', color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm },
};

export default function BefundeListe({ befunde = [] }) {
  if (!befunde.length) return <div style={styles.empty}>Keine Checker-Befunde.</div>;
  return (
    <div>
      {befunde.map((f, i) => {
        const m = SCHWERE_META[f.schwere] || SCHWERE_META.niedrig;
        return (
          <div key={i} style={styles.item}>
            <span style={{ ...styles.badge, color: SCHWERE_COLOR[f.schwere], backgroundColor: SCHWERE_BG[f.schwere] }}>
              {m.icon} {m.label}
            </span>
            <div style={{ flex: 1 }}>
              <div style={styles.pm}>
                {f.pm} · {f.aspekt} — Prozess {f.prozessNr}{f.schrittId != null ? ` · Schritt ${f.schrittId}` : ''}
              </div>
              <div style={styles.befund}>{f.befund}</div>
              <div style={styles.meta}>
                {f.provenienz} · Beleg: {f.beleg}
                {f.dimensionen?.length ? ` · ${f.dimensionen.join('/')}` : ''}
                {f.empfehlung ? ` · Fix: ${f.empfehlung}` : ''}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
