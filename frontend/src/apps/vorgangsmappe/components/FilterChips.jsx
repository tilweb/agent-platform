import { theme } from '../../../config/theme';

const styles = {
  container: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    padding: `2px ${theme.spacing.sm}`,
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
    borderRadius: theme.borderRadius.full,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    fontFamily: 'monospace',
  },
  field: { fontWeight: theme.typography.weights.semibold },
  sep: { opacity: 0.6, padding: `0 ${theme.spacing.xs}` },
  remove: {
    cursor: 'pointer',
    background: 'transparent',
    border: 'none',
    color: theme.colors.primary,
    padding: 0,
    marginLeft: theme.spacing.xs,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
  },
};

function valueLabel(values) {
  if (!Array.isArray(values) || values.length === 0) return '?';
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} … ${values[1]}`;
  return values.join(' / ');
}

export default function FilterChips({ filters, onRemove }) {
  if (!filters || filters.length === 0) return null;
  return (
    <div style={styles.container}>
      {filters.map((f, idx) => (
        <span key={`${f.field}-${idx}`} style={styles.chip}>
          <span style={styles.field}>{f.field}</span>
          <span style={styles.sep}>=</span>
          <span>{valueLabel(f.values)}</span>
          {onRemove && (
            <button
              type="button"
              style={styles.remove}
              onClick={() => onRemove(idx)}
              aria-label="Filter entfernen"
            >
              ×
            </button>
          )}
        </span>
      ))}
    </div>
  );
}
