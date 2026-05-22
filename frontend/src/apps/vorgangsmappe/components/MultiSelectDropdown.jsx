import { useEffect, useRef, useState } from 'react';
import { theme } from '../../../config/theme';

const styles = {
  wrapper: { position: 'relative', display: 'inline-block' },
  trigger: {
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.xs,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    maxWidth: 220,
    minWidth: 140,
  },
  triggerLabel: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  caret: { marginLeft: 'auto', color: theme.colors.textMuted },
  count: {
    display: 'inline-block',
    fontSize: theme.typography.sizes.xs,
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
    padding: `1px ${theme.spacing.xs}`,
    borderRadius: theme.borderRadius.full,
    minWidth: 18,
    textAlign: 'center',
    fontWeight: theme.typography.weights.semibold,
  },
  popover: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    right: 0,
    minWidth: 220,
    maxHeight: 280,
    overflow: 'auto',
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
    zIndex: 50,
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    fontSize: theme.typography.sizes.xs,
  },
  toolbarBtn: {
    border: 'none', background: 'none',
    color: theme.colors.primary,
    cursor: 'pointer',
    padding: 0,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    cursor: 'pointer',
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
  },
  empty: {
    padding: theme.spacing.md,
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.xs,
    textAlign: 'center',
  },
};

/**
 * Schlanker Multi-Select-Dropdown mit Checkbox-Liste.
 *
 * Props:
 *   - label: string (Default, wenn nichts ausgewaehlt)
 *   - options: string[]
 *   - value: string[]  (aktuell ausgewaehlt)
 *   - onChange: (next: string[]) => void
 */
export default function MultiSelectDropdown({ label = 'Auswahl', options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = new Set(value || []);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = (opt) => {
    const next = new Set(selected);
    if (next.has(opt)) next.delete(opt); else next.add(opt);
    onChange(Array.from(next));
  };

  const triggerText = selected.size === 0
    ? label
    : selected.size === 1
      ? Array.from(selected)[0]
      : `${selected.size} ausgewählt`;

  return (
    <div ref={ref} style={styles.wrapper}>
      <button type="button" style={styles.trigger} onClick={() => setOpen((o) => !o)}>
        <span style={styles.triggerLabel}>{triggerText}</span>
        {selected.size > 0 && <span style={styles.count}>{selected.size}</span>}
        <span style={styles.caret}>▾</span>
      </button>
      {open && (
        <div style={styles.popover}>
          <div style={styles.toolbar}>
            <button type="button" style={styles.toolbarBtn} onClick={() => onChange(options)}>Alle</button>
            <button type="button" style={styles.toolbarBtn} onClick={() => onChange([])}>Keine</button>
          </div>
          {options.length === 0 && <div style={styles.empty}>Keine Werte verfügbar.</div>}
          {options.map((opt) => (
            <label key={opt} style={styles.option}>
              <input
                type="checkbox"
                checked={selected.has(opt)}
                onChange={() => toggle(opt)}
                style={{ cursor: 'pointer' }}
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
