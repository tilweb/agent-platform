/**
 * Unternehmensrisiken — Tab 5 des Projektidee-Wizards.
 * Visuelles Pattern 1:1 wie components/steps/Risiken.jsx — itemCard mit surface,
 * removeButton mit Trash-Icon, dashed addButton.
 * Bewusst leichter als der Auftrag-Risiken-Tab (kein Strategie/Status-Workflow).
 */

import { theme } from '../../../../config/theme';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xl,
  },
  header: {
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  },
  itemCard: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
  },
  itemGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: theme.spacing.md,
  },
  itemGridFull: {
    gridColumn: '1 / -1',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
  },
  label: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textSecondary,
  },
  select: {
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    cursor: 'pointer',
  },
  textarea: {
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
    minHeight: '70px',
    resize: 'vertical',
    fontFamily: theme.typography.fontFamily,
  },
  removeButton: {
    padding: theme.spacing.sm,
    backgroundColor: 'transparent',
    border: 'none',
    color: theme.colors.textMuted,
    cursor: 'pointer',
    borderRadius: theme.borderRadius.md,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    fontSize: theme.typography.sizes.sm,
    marginTop: theme.spacing.md,
  },
  addButton: {
    padding: theme.spacing.md,
    backgroundColor: 'transparent',
    border: `2px dashed ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    transition: `all ${theme.transitions.fast}`,
  },
};

const TYPE_OPTIONS = [
  { value: '', label: '— Bitte auswählen —' },
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
          Identifizieren und bewerten Sie potenzielle Unternehmensrisiken und -chancen, die mit dieser Idee verbunden sind.
        </p>
      </div>

      <div style={styles.section}>
        {items.map((it) => (
          <div key={it.id} style={styles.itemCard}>
            <div style={styles.itemGrid}>
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
              <div style={{ ...styles.formGroup, ...styles.itemGridFull }}>
                <label style={styles.label}>Beschreibung</label>
                <textarea
                  style={styles.textarea}
                  placeholder="Was kann passieren?"
                  value={it.description || ''}
                  onChange={(e) => update(it.id, 'description', e.target.value)}
                  onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
                  onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
                />
              </div>
              <div style={{ ...styles.formGroup, ...styles.itemGridFull }}>
                <label style={styles.label}>Gegenmaßnahme / Nutzungsplan</label>
                <textarea
                  style={styles.textarea}
                  placeholder="Wie wird das Risiko gemindert oder die Chance genutzt?"
                  value={it.mitigation || ''}
                  onChange={(e) => update(it.id, 'mitigation', e.target.value)}
                  onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
                  onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
                />
              </div>
            </div>
            <button
              style={styles.removeButton}
              onClick={() => remove(it.id)}
              onMouseEnter={(e) => { e.currentTarget.style.color = theme.colors.error; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = theme.colors.textMuted; }}
            >
              <TrashIcon /> Entfernen
            </button>
          </div>
        ))}

        <button
          style={styles.addButton}
          onClick={add}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = theme.colors.primary;
            e.currentTarget.style.color = theme.colors.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = theme.colors.border;
            e.currentTarget.style.color = theme.colors.textMuted;
          }}
        >
          <PlusIcon />
          Risiko / Chance hinzufügen
        </button>
      </div>
    </div>
  );
}

// Icons (analog zu Risiken.jsx)
function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
