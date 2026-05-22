import { useState } from 'react';
import { theme } from '../../../config/theme';
import { SparklesIcon } from '../../../components/Icons';
import FilterChips from './FilterChips';

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  inputRow: {
    display: 'flex',
    gap: theme.spacing.sm,
  },
  input: {
    flex: 1,
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    fontSize: theme.typography.sizes.base,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
  },
  button: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    whiteSpace: 'nowrap',
  },
  buttonSecondary: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  hint: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  interpretation: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
};

export default function NluSearchBar({
  value,
  onChange,
  onSubmit,
  onPreview,
  filters,
  interpretation,
  loading,
  previewing,
}) {
  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit?.();
    }
  };

  return (
    <div style={styles.wrapper}>
      <label style={styles.label}>Freie Suche</label>
      <div style={styles.inputRow}>
        <input
          style={styles.input}
          placeholder='z.B. "Alle Rechnungen Mai an WIANCO"'
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKey}
          autoComplete="off"
          disabled={loading}
        />
        {onPreview && (
          <button
            type="button"
            style={styles.buttonSecondary}
            onClick={() => onPreview()}
            disabled={!value || previewing}
          >
            {previewing ? 'Verstehen …' : 'Verstehen'}
          </button>
        )}
        <button
          type="button"
          style={{
            ...styles.button,
            opacity: !value || loading ? 0.5 : 1,
            cursor: !value || loading ? 'not-allowed' : 'pointer',
          }}
          onClick={() => onSubmit?.()}
          disabled={!value || loading}
        >
          <SparklesIcon size={16} color="#fff" />
          {loading ? 'Suche …' : 'Suchen'}
        </button>
      </div>
      <span style={styles.hint}>
        LLM übersetzt deine Anfrage in DocuWare-Filter. Du kannst sie vor der Suche prüfen mit „Verstehen".
      </span>
      {filters && filters.length > 0 && <FilterChips filters={filters} />}
      {interpretation && <span style={styles.interpretation}>{interpretation}</span>}
    </div>
  );
}
