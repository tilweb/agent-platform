import { theme } from '../../../config/theme';
import { DocumentIcon } from '../../../components/Icons';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
  },
  empty: {
    padding: theme.spacing.lg,
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
    textAlign: 'center',
  },
  item: {
    display: 'flex',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.surface,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  itemActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  iconWrap: {
    color: theme.colors.textMuted,
    paddingTop: 2,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  meta: {
    marginTop: 2,
    display: 'flex',
    gap: theme.spacing.sm,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  artBadge: {
    fontSize: theme.typography.sizes.xs,
    padding: `2px ${theme.spacing.sm}`,
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.text,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
    whiteSpace: 'nowrap',
  },
  statusBadge: {
    fontSize: theme.typography.sizes.xs,
    padding: `2px ${theme.spacing.sm}`,
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
    whiteSpace: 'nowrap',
  },
  refLine: {
    marginTop: 4,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    display: 'flex',
    gap: theme.spacing.xs,
    alignItems: 'baseline',
  },
  refLabel: {
    color: theme.colors.textMuted,
  },
  refValue: {
    color: theme.colors.text,
    fontFamily: 'monospace',
    fontWeight: theme.typography.weights.medium,
  },
  refMissing: {
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
};

function formatDocuwareDate(value) {
  if (typeof value !== 'string') return '';
  const m = value.match(/\/Date\((\d+)(?:[+-]\d{4})?\)\//);
  if (m) {
    const d = new Date(parseInt(m[1], 10));
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const iso = Date.parse(value);
  if (!isNaN(iso)) return new Date(iso).toISOString().slice(0, 10);
  return value;
}

export default function DocumentList({ documents, selectedId, onSelect, documentTypeField, statusField, referenceField, showReference }) {
  if (!documents || documents.length === 0) {
    return <div style={styles.empty}>Keine Dokumente.</div>;
  }
  return (
    <div style={styles.container}>
      {documents.map((doc) => {
        const isActive = doc.id === selectedId;
        const date = doc.fields?.DATUM || doc.fields?.DWSTOREDATETIME;
        const status = statusField ? doc.fields?.[statusField] : null;
        const refRaw = referenceField ? doc.fields?.[referenceField] : null;
        const ref = typeof refRaw === 'string' && refRaw.trim() ? refRaw.trim() : '';
        return (
          <div
            key={doc.id}
            style={{ ...styles.item, ...(isActive ? styles.itemActive : {}) }}
            onClick={() => onSelect?.(doc)}
          >
            <span style={styles.iconWrap}>
              <DocumentIcon size={16} />
            </span>
            <div style={styles.text}>
              <div style={styles.title} title={doc.title}>
                {doc.title || `Dokument ${doc.id}`}
              </div>
              <div style={styles.meta}>
                {date && <span>{formatDocuwareDate(date)}</span>}
                {status && <span style={styles.statusBadge}>{status}</span>}
              </div>
              {showReference && (
                <div style={styles.refLine}>
                  {ref
                    ? <><span style={styles.refLabel}>Referenz:</span> <span style={styles.refValue}>{ref}</span></>
                    : <span style={styles.refMissing}>Keine Referenz</span>}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
