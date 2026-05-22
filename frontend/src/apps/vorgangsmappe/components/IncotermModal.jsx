import { useEffect, useState } from 'react';
import { theme } from '../../../config/theme';

const styles = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  },
  content: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    maxWidth: '560px', width: '90%',
    maxHeight: '90vh', overflow: 'auto',
    padding: theme.spacing['2xl'],
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  field: { display: 'flex', flexDirection: 'column', gap: theme.spacing.xs, marginBottom: theme.spacing.md },
  label: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  hint: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted },
  input: {
    width: '100%',
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
    boxSizing: 'border-box',
  },
  inputDisabled: {
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.textMuted,
    fontFamily: 'monospace',
    fontWeight: theme.typography.weights.bold,
  },
  textarea: { minHeight: '60px', resize: 'vertical', fontFamily: 'inherit' },
  actions: {
    display: 'flex', justifyContent: 'flex-end',
    gap: theme.spacing.md, marginTop: theme.spacing.lg,
  },
  cancelBtn: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  saveBtn: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  errorBox: {
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    marginBottom: theme.spacing.md,
  },
};

export default function IncotermModal({ open, mode, initial, onClose, onSave }) {
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [sortOrder, setSortOrder] = useState(9999);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCode(initial?.code || '');
    setLabel(initial?.label || '');
    setDescription(initial?.description || '');
    setSortOrder(initial?.sortOrder ?? 9999);
    setError(null);
    setBusy(false);
  }, [open, initial]);

  if (!open) return null;
  const isCreate = mode === 'create';

  const validate = () => {
    if (isCreate && !/^[A-Z]{2,6}$/i.test(code)) return 'Code muss 2–6 Buchstaben sein (z.B. FOB, CIF).';
    if (!label.trim()) return 'Label ist Pflicht.';
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setBusy(true);
    setError(null);
    try {
      await onSave({
        code: code.toUpperCase(),
        label: label.trim(),
        description: description.trim() || null,
        sortOrder: parseInt(sortOrder, 10) || 0,
      });
      onClose();
    } catch (e) {
      setError(e?.message || 'Speichern fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }} role="dialog" aria-modal="true">
      <div style={styles.content} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.title}>{isCreate ? 'Neuer Incoterm' : `Incoterm bearbeiten — ${initial?.code}`}</h2>

        {error && <div style={styles.errorBox}>{error}</div>}

        <div style={styles.field}>
          <label style={styles.label}>Code</label>
          <input
            style={{ ...styles.input, ...(!isCreate ? styles.inputDisabled : {}), textTransform: 'uppercase' }}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="FOB"
            disabled={!isCreate || busy}
            autoFocus={isCreate}
          />
          <span style={styles.hint}>
            {isCreate ? '2–6 Buchstaben. Beispiel: EXW, FOB, CIF.' : 'Nicht aenderbar nach Anlage.'}
          </span>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Label</label>
          <input style={styles.input} value={label} onChange={(e) => setLabel(e.target.value)} placeholder='z.B. "FOB — Free On Board"' disabled={busy} autoFocus={!isCreate} />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Beschreibung (optional)</label>
          <textarea
            style={{ ...styles.input, ...styles.textarea }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="z.B. Frei an Bord."
            disabled={busy}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Sortierung</label>
          <input
            type="number"
            style={{ ...styles.input, maxWidth: 140 }}
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            disabled={busy}
          />
        </div>

        <div style={styles.actions}>
          <button type="button" style={styles.cancelBtn} onClick={onClose} disabled={busy}>Abbrechen</button>
          <button type="button" style={styles.saveBtn} onClick={handleSave} disabled={busy}>
            {busy ? 'Speichert …' : isCreate ? 'Anlegen' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}
