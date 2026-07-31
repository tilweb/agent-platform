import { theme } from '../../../config/theme';

/**
 * Die drei (bzw. vier) Reifegrad-Kennzahlen als Kacheln: Gesamt-RG, RG*, RGQ, SE.
 * Immer gemeinsam anzeigen (Methodik-Invariante).
 */
const PURPLE = '#452C71';

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: theme.spacing.md,
  },
  tile: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    textAlign: 'center',
  },
  value: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: PURPLE,
    lineHeight: 1.1,
  },
  label: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  hint: {
    fontSize: '0.65rem',
    color: theme.colors.textMuted,
    marginTop: 2,
  },
};

export default function KennzahlBadges({ kennzahlen }) {
  const k = kennzahlen || { gesamtRg: 0, rgStar: 0, rgq: 0, seQuotient: 0, limiter: [] };
  const tiles = [
    { value: `RG${k.gesamtRg}`, label: 'Gesamt-Reifegrad', hint: 'weakest link' },
    { value: k.rgStar, label: 'RG* (relevanz-gefiltert)', hint: 'min relevante Dim' },
    { value: `${k.rgq}%`, label: 'RGQ', hint: 'Σ Ist / 50' },
    { value: `${k.seQuotient}%`, label: 'SE-Quotient', hint: 'Σ min(Ist,Soll)/Σ Soll' },
  ];
  return (
    <div>
      <div style={styles.grid}>
        {tiles.map((t) => (
          <div key={t.label} style={styles.tile}>
            <div style={styles.value}>{t.value}</div>
            <div style={styles.label}>{t.label}</div>
            <div style={styles.hint}>{t.hint}</div>
          </div>
        ))}
      </div>
      {k.limiter?.length > 0 && (
        <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary, marginTop: theme.spacing.sm }}>
          <strong>Limiter (blockieren nächste Stufe):</strong> {k.limiter.join(' · ')}
        </div>
      )}
    </div>
  );
}
