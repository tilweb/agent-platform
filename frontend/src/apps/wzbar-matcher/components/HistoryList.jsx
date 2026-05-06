import { theme } from '../../../config/theme';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },
  empty: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
    padding: theme.spacing.lg,
  },
  item: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    textAlign: 'left',
  },
  itemActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  text: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  meta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  code: {
    fontFamily: theme.typography.fontMono,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.primary,
  },
};

function formatWhen(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function summarizeCodes(record) {
  const activities = record?.result?.activities;
  if (Array.isArray(activities) && activities.length > 0) {
    const codes = activities
      .map(a => a?.result?.primary?.code)
      .filter(Boolean);
    if (codes.length > 0) return codes.join(' · ');
  }
  // Legacy single-match fallback
  const legacy = record?.result?.primary?.code;
  return legacy || '—';
}

export default function HistoryList({ records, activeId, onSelect }) {
  if (!records || records.length === 0) {
    return <div style={styles.empty}>Noch keine Anfragen.</div>;
  }
  return (
    <div style={styles.container}>
      {records.map(r => {
        const isActive = r.id === activeId;
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onSelect?.(r)}
            style={{ ...styles.item, ...(isActive ? styles.itemActive : {}) }}
          >
            <div style={styles.text}>{r.inputText}</div>
            <div style={styles.meta}>
              <span style={styles.code}>{summarizeCodes(r)}</span>
              <span>{formatWhen(r.createdAt)}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
