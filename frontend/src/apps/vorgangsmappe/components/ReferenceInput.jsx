import { useState } from 'react';
import { theme } from '../../../config/theme';
import { SearchIcon } from '../../../components/Icons';

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
    fontFamily: 'monospace',
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
  hint: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
};

// Vorgangsnummer: 1-4 Buchstaben + optional 0-4 Ziffern (Jahres-Suffix) +
// optionaler Bindestrich + 1-6 Ziffern. Beispiele: V-1000, ERB-000129,
// AB26-12345, ABC-00000.
const REFERENCE_REGEX = /^[A-Z]{1,4}\d{0,4}-?\d{1,6}$/i;

function looksLikeReference(value) {
  return REFERENCE_REGEX.test(value.trim().replace(/\s+/g, ''));
}

function normalize(value) {
  const compact = value.trim().replace(/\s+/g, '');
  const m = compact.match(/^([A-Z]{1,4}\d{0,4})-?(\d{1,6})$/i);
  if (!m) return compact;
  return `${m[1].toUpperCase()}-${m[2]}`;
}

export default function ReferenceInput({ onSubmit }) {
  const [value, setValue] = useState('');

  const valid = looksLikeReference(value);

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    if (!valid) return;
    onSubmit(normalize(value));
  };

  return (
    <form style={styles.wrapper} onSubmit={handleSubmit}>
      <label style={styles.label}>Referenz / Vorgangsnummer</label>
      <div style={styles.inputRow}>
        <input
          style={styles.input}
          placeholder="z.B. AB26-12345, V-1000, ERB-000129"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
        />
        <button
          type="submit"
          style={{
            ...styles.button,
            opacity: valid ? 1 : 0.5,
            cursor: valid ? 'pointer' : 'not-allowed',
          }}
          disabled={!valid}
        >
          <SearchIcon size={16} color="#fff" />
          Öffnen
        </button>
      </div>
      <span style={styles.hint}>
        Format: 1–4 Buchstaben (optional + Jahres-Ziffern), Bindestrich, 1–6 Ziffern.
      </span>
    </form>
  );
}
