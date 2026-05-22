import { theme } from '../../../config/theme';
import { BriefcaseIcon } from '../../../components/Icons';

const styles = {
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surface,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  text: { flex: 1, minWidth: 0 },
  reference: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    fontFamily: 'monospace',
  },
  meta: {
    marginTop: 2,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    display: 'flex',
    gap: theme.spacing.sm,
  },
};

export default function VorgangCard({ vorgang, onClick }) {
  return (
    <div
      style={styles.card}
      onClick={() => onClick?.(vorgang)}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = theme.colors.primary;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = theme.colors.border;
      }}
    >
      <div style={styles.iconWrap}>
        <BriefcaseIcon size={18} />
      </div>
      <div style={styles.text}>
        <div style={styles.reference}>{vorgang.reference}</div>
        <div style={styles.meta}>
          <span>{vorgang.documentCount} Dokument{vorgang.documentCount === 1 ? '' : 'e'}</span>
          {vorgang.dateRange && (
            <>
              <span>·</span>
              <span>{vorgang.dateRange.from} bis {vorgang.dateRange.to}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
