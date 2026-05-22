import { useEffect, useState } from 'react';
import { theme } from '../../../config/theme';

const BEREICHE = [
  { value: 'einkauf', label: 'Einkauf' },
  { value: 'verkauf', label: 'Verkauf' },
  { value: 'produktion', label: 'Produktion' },
  { value: 'sonstiges', label: 'Sonstiges' },
];

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
    maxWidth: '640px', width: '90%',
    maxHeight: '90vh', overflow: 'auto',
    padding: theme.spacing['2xl'],
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  field: {
    display: 'flex', flexDirection: 'column',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  hint: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
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
  },
  textarea: {
    minHeight: '60px',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: theme.spacing.md,
  },
  actions: {
    display: 'flex', justifyContent: 'flex-end',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
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

/**
 * Modal fuer Anlegen + Bearbeiten eines Dokumententyps.
 *
 * Props:
 *   open: boolean
 *   mode: 'create' | 'edit'
 *   initial: { id, label, bereich, matchAny: string[], description, sortOrder }  (bei edit)
 *   onClose: () => void
 *   onSave: (payload) => Promise<void>  — Parent macht den API-Call
 */
export default function DocumentTypeModal({ open, mode, initial, onClose, onSave }) {
  const [id, setId] = useState('');
  const [label, setLabel] = useState('');
  const [bereich, setBereich] = useState('einkauf');
  const [matchAny, setMatchAny] = useState('');
  const [description, setDescription] = useState('');
  const [statusgebend, setStatusgebend] = useState(false);
  const [sortOrder, setSortOrder] = useState(9999);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setId(initial?.id || '');
    setLabel(initial?.label || '');
    setBereich(initial?.bereich || 'einkauf');
    setMatchAny((initial?.matchAny || []).join(', '));
    setDescription(initial?.description || '');
    setStatusgebend(!!initial?.statusgebend);
    setSortOrder(initial?.sortOrder ?? 9999);
    setError(null);
    setBusy(false);
  }, [open, initial]);

  if (!open) return null;

  const isCreate = mode === 'create';

  const validate = () => {
    if (isCreate && !/^[a-z0-9_-]{2,64}$/i.test(id)) {
      return 'ID muss 2–64 Zeichen lang sein (a-z, 0-9, _, -).';
    }
    if (!label.trim()) return 'Label ist Pflicht.';
    if (!bereich) return 'Bereich ist Pflicht.';
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setBusy(true);
    setError(null);
    try {
      await onSave({
        id: id.trim(),
        label: label.trim(),
        bereich,
        matchAny: matchAny.split(',').map((s) => s.trim()).filter(Boolean),
        description: description.trim() || null,
        statusgebend,
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
        <h2 style={styles.title}>
          {isCreate ? 'Neuer Dokumententyp' : 'Dokumententyp bearbeiten'}
        </h2>

        {error && <div style={styles.errorBox}>{error}</div>}

        <div style={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>ID</label>
            <input
              style={{ ...styles.input, ...(!isCreate ? styles.inputDisabled : {}) }}
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="ek_neuer_typ"
              disabled={!isCreate || busy}
              autoFocus={isCreate}
            />
            <span style={styles.hint}>
              {isCreate ? 'Slug, einmalig vergeben. Beispiel: ek_eingangsrechnung' : 'Nicht aenderbar nach Anlage.'}
            </span>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Bereich</label>
            <select style={styles.input} value={bereich} onChange={(e) => setBereich(e.target.value)} disabled={busy}>
              {BEREICHE.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </div>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Label</label>
          <input style={styles.input} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="z.B. Eingangsrechnung" disabled={busy} autoFocus={!isCreate} />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Match-Werte (Komma-getrennt)</label>
          <input
            style={styles.input}
            value={matchAny}
            onChange={(e) => setMatchAny(e.target.value)}
            placeholder='z.B. "Eingangsrechnung, *Rechnung*, Invoice"'
            disabled={busy}
          />
          <span style={styles.hint}>
            Strings, gegen die der DocuWare-Wert (z.B. DOCUMENT_TYPE) gematcht wird. „*" als Wildcard, case-insensitiv.
          </span>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Beschreibung (optional)</label>
          <textarea
            style={{ ...styles.input, ...styles.textarea }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Kurze Notiz fuer Pfleger:innen."
            disabled={busy}
          />
        </div>

        <div style={styles.field}>
          <label style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, cursor: 'pointer', fontSize: theme.typography.sizes.sm, color: theme.colors.text }}>
            <input
              type="checkbox"
              checked={statusgebend}
              onChange={(e) => setStatusgebend(e.target.checked)}
              disabled={busy}
              style={{ cursor: 'pointer' }}
            />
            Statusgebend
          </label>
          <span style={styles.hint}>
            Wenn aktiv: ein Dokument dieses Typs bestimmt den Vorgangs-Status (Feld BC_STATUS aus DocuWare). Das erste statusgebende Doc mit gesetztem Status wird verwendet (Sortierung: Datum desc).
          </span>
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
          <span style={styles.hint}>Niedriger = weiter oben. Bereich-Gruppen typischerweise in 100er-Schritten.</span>
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
