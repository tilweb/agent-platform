import { theme } from '../../../config/theme';

const styles = {
  container: { display: 'flex', flexDirection: 'column', gap: theme.spacing.xs },
  empty: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
    padding: theme.spacing.md,
    textAlign: 'center',
  },
  item: {
    display: 'flex',
    gap: theme.spacing.sm,
    alignItems: 'center',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    cursor: 'pointer',
  },
  itemHover: { backgroundColor: theme.colors.surfaceHover },
  iconBox: {
    width: 22,
    height: 22,
    borderRadius: theme.borderRadius.full,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: theme.typography.weights.bold,
    fontSize: theme.typography.sizes.xs,
    flexShrink: 0,
  },
  labelWrap: { flex: 1, minWidth: 0 },
  label: { color: theme.colors.text },
  subtext: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  overall: {
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    textAlign: 'center',
  },
};

const iconStyleByStatus = {
  ok: { backgroundColor: theme.colors.successLight, color: theme.colors.success },
  missing: { backgroundColor: theme.colors.errorLight, color: theme.colors.error },
  optional_missing: { backgroundColor: theme.colors.surfaceHover, color: theme.colors.textMuted },
};

const iconCharByStatus = { ok: '✓', missing: '⚠', optional_missing: '–' };

const overallStyleByValue = {
  complete: { backgroundColor: theme.colors.successLight, color: theme.colors.success },
  partial: { backgroundColor: theme.colors.warningLight, color: theme.colors.warning },
  incomplete: { backgroundColor: theme.colors.errorLight, color: theme.colors.error },
};

const overallLabelByValue = {
  complete: 'Alle Pflicht-Dokumente vorhanden',
  partial: 'Teilweise vollständig — Pflicht-Doku fehlt',
  incomplete: 'Pflicht-Dokumente fehlen',
};

export default function ComplianceChecklist({ compliance, onItemClick }) {
  if (!compliance || !compliance.items || compliance.items.length === 0) {
    return <div style={styles.empty}>Keine Pflicht-Doku-Regel definiert.</div>;
  }
  return (
    <div style={styles.container}>
      <div style={{ ...styles.overall, ...(overallStyleByValue[compliance.overall] || {}) }}>
        {overallLabelByValue[compliance.overall] || compliance.overall}
      </div>
      {compliance.items.map((item) => {
        const iconStyle = iconStyleByStatus[item.status] || {};
        const char = iconCharByStatus[item.status] || '?';
        return (
          <div
            key={item.id}
            style={styles.item}
            onClick={() => onItemClick?.(item)}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = theme.colors.surfaceHover)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <span style={{ ...styles.iconBox, ...iconStyle }}>{char}</span>
            <div style={styles.labelWrap}>
              <div style={styles.label}>{item.label}</div>
              <div style={styles.subtext}>
                {item.status === 'ok'
                  ? `${item.matchedDocIds.length} Dokument${item.matchedDocIds.length === 1 ? '' : 'e'}`
                  : item.required
                    ? 'Pflicht — fehlt'
                    : 'Optional — nicht vorhanden'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
