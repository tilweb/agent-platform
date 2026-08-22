/**
 * SearchInput — prominentes Suchfeld mit Lupen-Icon und Clear-Button.
 * Muster aus ContractsPage; Hintergrund `surface` (Feedback: Form-Felder brauchen surface).
 */

import { theme } from '../../config/theme';
import { SearchIcon } from '../Icons';

const styles = {
  wrapper: { position: 'relative', flex: 1, minWidth: 220, maxWidth: 520 },
  icon: { position: 'absolute', left: theme.spacing.md, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', color: theme.colors.textMuted },
  input: {
    width: '100%',
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    paddingLeft: '40px',
    paddingRight: '40px',
    fontSize: theme.typography.sizes.base,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
    boxSizing: 'border-box',
  },
  clear: {
    position: 'absolute', right: theme.spacing.sm, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', cursor: 'pointer', color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.md, lineHeight: 1, padding: theme.spacing.xs, borderRadius: theme.borderRadius.md,
  },
};

export default function SearchInput({ value, onChange, placeholder = 'Suchen…' }) {
  return (
    <div style={styles.wrapper}>
      <span style={styles.icon}><SearchIcon size={16} /></span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={styles.input}
        onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
        onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
      />
      {value && (
        <button type="button" style={styles.clear} onClick={() => onChange('')} aria-label="Suche zurücksetzen">✕</button>
      )}
    </div>
  );
}
