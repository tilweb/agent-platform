/**
 * Unternehmensrisiken — Tab 5.
 * Identifizieren und Bewerten von Risiken & Chancen aus Unternehmens-Sicht.
 * Bewusst leichter als der Projektrisiken-Tab im Auftrag (kein Strategie/Status-Workflow).
 */

import { theme } from '../../../../config/theme';

const styles = {
  container: { display: 'flex', flexDirection: 'column', gap: theme.spacing.xl },
  header: { marginBottom: theme.spacing.lg },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: { fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary },
  itemCard: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  removeButton: {
    background: 'none',
    border: 'none',
    color: theme.colors.error,
    cursor: 'pointer',
    fontSize: theme.typography.sizes.lg,
    padding: 0,
  },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: theme.spacing.md },
  formGroup: { display: 'flex', flexDirection: 'column', gap: theme.spacing.xs },
  fullSpan: { gridColumn: '1 / -1' },
  label: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
  },
  input: {
    padding: theme.spacing.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
  },
  select: {
    padding: theme.spacing.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    cursor: 'pointer',
    outline: 'none',
  },
  textarea: {
    padding: theme.spacing.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
    minHeight: '60px',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  addButton: {
    width: '100%',
    padding: theme.spacing.md,
    border: `1px dashed ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: 'transparent',
    color: theme.colors.primary,
    cursor: 'pointer',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
  },
};

const TYPE_OPTIONS = [
  { value: '', label: '— Typ —' },
  { value: 'strategisch', label: 'Strategisch' },
  { value: 'operativ', label: 'Operativ' },
  { value: 'finanziell', label: 'Finanziell' },
  { value: 'rechtlich', label: 'Rechtlich' },
  { value: 'technisch', label: 'Technisch' },
  { value: 'markt', label: 'Markt' },
  { value: 'chance', label: 'Chance' },
];

const LEVEL_OPTIONS = [
  { value: 'low', label: 'Niedrig' },
  { value: 'medium', label: 'Mittel' },
  { value: 'high', label: 'Hoch' },
];

function generateId() {
  const ts = Date.now().toString(36);
  const r = Math.random().toString(36).substring(2, 7);
  return `risk-${ts}-${r}`;
}

export default function Unternehmensrisiken({ projektidee, onChange }) {
  const items = projektidee.unternehmensrisiken ?? [];

  const update = (id, field, value) => {
    onChange({
      ...projektidee,
      unternehmensrisiken: items.map((it) => (it.id === id ? { ...it, [field]: value } : it)),
    });
  };
  const add = () => {
    onChange({
      ...projektidee,
      unternehmensrisiken: [
        ...items,
        { id: generateId(), type: '', description: '', probability: 'medium', impact: 'medium', mitigation: '' },
      ],
    });
  };
  const remove = (id) => {
    onChange({ ...projektidee, unternehmensrisiken: items.filter((it) => it.id !== id) });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>5. Unternehmensrisiken</h2>
        <p style={styles.subtitle}>
          Identifizieren und bewerten Sie potenzielle Unternehmensrisiken und -chancen.
        </p>
      </div>

      {items.map((it, idx) => (
        <div key={it.id} style={styles.itemCard}>
          <div style={styles.cardHeader}>
            <div style={styles.cardTitle}>Risiko / Chance #{idx + 1}</div>
            <button style={styles.removeButton} onClick={() => remove(it.id)} title="Entfernen">×</button>
          </div>
          <div style={styles.grid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Typ</label>
              <select
                style={styles.select}
                value={it.type || ''}
                onChange={(e) => update(it.id, 'type', e.target.value)}
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Eintrittswahrscheinlichkeit</label>
              <select
                style={styles.select}
                value={it.probability || 'medium'}
                onChange={(e) => update(it.id, 'probability', e.target.value)}
              >
                {LEVEL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Auswirkung</label>
              <select
                style={styles.select}
                value={it.impact || 'medium'}
                onChange={(e) => update(it.id, 'impact', e.target.value)}
              >
                {LEVEL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div style={{ ...styles.formGroup, ...styles.fullSpan }}>
              <label style={styles.label}>Beschreibung</label>
              <textarea
                style={styles.textarea}
                placeholder="Was kann passieren?"
                value={it.description || ''}
                onChange={(e) => update(it.id, 'description', e.target.value)}
              />
            </div>
            <div style={{ ...styles.formGroup, ...styles.fullSpan }}>
              <label style={styles.label}>Gegenmaßnahme / Nutzungsplan</label>
              <textarea
                style={styles.textarea}
                placeholder="Wie wird das Risiko gemindert oder die Chance genutzt?"
                value={it.mitigation || ''}
                onChange={(e) => update(it.id, 'mitigation', e.target.value)}
              />
            </div>
          </div>
        </div>
      ))}

      <button style={styles.addButton} onClick={add}>
        + Risiko / Chance hinzufügen
      </button>
    </div>
  );
}
