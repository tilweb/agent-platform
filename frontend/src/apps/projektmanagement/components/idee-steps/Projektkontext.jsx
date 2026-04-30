/**
 * Projektkontext — Tab 3 des Projektidee-Wizards.
 * Ausgangslage + Rahmenbedingungen plus In-Scope / Out-of-Scope (analog Auftrag-Inhalt).
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
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },
  label: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  textarea: {
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
    minHeight: '140px',
    resize: 'vertical',
    fontFamily: theme.typography.fontFamily,
  },
  hint: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  scopeGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing.xl,
  },
  scopeSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },
  scopeHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  scopeIcon: {
    width: '24px',
    height: '24px',
    borderRadius: theme.borderRadius.full,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeIconIn: {
    backgroundColor: theme.colors.successLight,
    color: theme.colors.success,
  },
  scopeIconOut: {
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
  },
  scopeTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
  },
  scopeTitleIn: {
    color: theme.colors.success,
  },
  scopeTitleOut: {
    color: theme.colors.error,
  },
  scopeList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },
  scopeItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  scopeInput: {
    flex: 1,
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
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
    justifyContent: 'center',
  },
  addButton: {
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    backgroundColor: 'transparent',
    border: `1px dashed ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
};

export default function Projektkontext({ projektidee, onChange }) {
  const ctx = projektidee.context ?? { ausgangslage: '', rahmenbedingungen: '' };
  const inScope = projektidee.in_scope ?? [];
  const outScope = projektidee.out_scope ?? [];

  const updateContext = (field, value) =>
    onChange({ ...projektidee, context: { ...ctx, [field]: value } });

  const updateInScope = (index, value) => {
    const next = [...inScope];
    next[index] = value;
    onChange({ ...projektidee, in_scope: next });
  };
  const addInScope = () => onChange({ ...projektidee, in_scope: [...inScope, ''] });
  const removeInScope = (index) =>
    onChange({ ...projektidee, in_scope: inScope.filter((_, i) => i !== index) });

  const updateOutScope = (index, value) => {
    const next = [...outScope];
    next[index] = value;
    onChange({ ...projektidee, out_scope: next });
  };
  const addOutScope = () => onChange({ ...projektidee, out_scope: [...outScope, ''] });
  const removeOutScope = (index) =>
    onChange({ ...projektidee, out_scope: outScope.filter((_, i) => i !== index) });

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>3. Projektkontext</h2>
        <p style={styles.subtitle}>
          Beschreiben Sie das Umfeld, in dem die Idee entstanden ist und realisiert werden soll.
        </p>
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Ausgangslage</label>
        <textarea
          value={ctx.ausgangslage || ''}
          onChange={(e) => updateContext('ausgangslage', e.target.value)}
          placeholder="Warum und in welchem Rahmen ist die Projektidee entstanden? Welches Problem wird adressiert?"
          style={styles.textarea}
          onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
          onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
        />
        <p style={styles.hint}>Auslöser, Motivation, strategischer Bezug, betroffene Bereiche.</p>
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Rahmenbedingungen</label>
        <textarea
          value={ctx.rahmenbedingungen || ''}
          onChange={(e) => updateContext('rahmenbedingungen', e.target.value)}
          placeholder="Von welchen Faktoren ist die Projektidee abhaengig? Welche Constraints gibt es?"
          style={styles.textarea}
          onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
          onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
        />
        <p style={styles.hint}>
          Budget-Rahmen, Termine, regulatorische Vorgaben, technische Voraussetzungen, Abhängigkeiten zu anderen Projekten.
        </p>
      </div>

      {/* In-Scope / Out-of-Scope */}
      <div style={styles.scopeGrid}>
        <div style={styles.scopeSection}>
          <div style={styles.scopeHeader}>
            <div style={{ ...styles.scopeIcon, ...styles.scopeIconIn }}>
              <CheckIcon />
            </div>
            <span style={{ ...styles.scopeTitle, ...styles.scopeTitleIn }}>
              Im Projektumfang (In-Scope)
            </span>
          </div>
          <p style={styles.hint}>Was gehört zum Projekt?</p>
          <div style={styles.scopeList}>
            {inScope.map((item, index) => (
              <div key={index} style={styles.scopeItem}>
                <input
                  type="text"
                  value={item}
                  onChange={(e) => updateInScope(index, e.target.value)}
                  placeholder="z.B. Konzeption und Design"
                  style={styles.scopeInput}
                  onFocus={(e) => { e.target.style.borderColor = theme.colors.success; }}
                  onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
                />
                <button
                  style={styles.removeButton}
                  onClick={() => removeInScope(index)}
                  onMouseEnter={(e) => { e.currentTarget.style.color = theme.colors.error; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = theme.colors.textMuted; }}
                >
                  <XIcon />
                </button>
              </div>
            ))}
          </div>
          <button
            style={styles.addButton}
            onClick={addInScope}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = theme.colors.success;
              e.currentTarget.style.color = theme.colors.success;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = theme.colors.border;
              e.currentTarget.style.color = theme.colors.textMuted;
            }}
          >
            <PlusIcon />
            Hinzufügen
          </button>
        </div>

        <div style={styles.scopeSection}>
          <div style={styles.scopeHeader}>
            <div style={{ ...styles.scopeIcon, ...styles.scopeIconOut }}>
              <XIcon />
            </div>
            <span style={{ ...styles.scopeTitle, ...styles.scopeTitleOut }}>
              Außerhalb des Projekts (Out-of-Scope)
            </span>
          </div>
          <p style={styles.hint}>Was gehört NICHT zum Projekt?</p>
          <div style={styles.scopeList}>
            {outScope.map((item, index) => (
              <div key={index} style={styles.scopeItem}>
                <input
                  type="text"
                  value={item}
                  onChange={(e) => updateOutScope(index, e.target.value)}
                  placeholder="z.B. Hardware-Beschaffung"
                  style={styles.scopeInput}
                  onFocus={(e) => { e.target.style.borderColor = theme.colors.error; }}
                  onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
                />
                <button
                  style={styles.removeButton}
                  onClick={() => removeOutScope(index)}
                  onMouseEnter={(e) => { e.currentTarget.style.color = theme.colors.error; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = theme.colors.textMuted; }}
                >
                  <XIcon />
                </button>
              </div>
            ))}
          </div>
          <button
            style={styles.addButton}
            onClick={addOutScope}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = theme.colors.error;
              e.currentTarget.style.color = theme.colors.error;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = theme.colors.border;
              e.currentTarget.style.color = theme.colors.textMuted;
            }}
          >
            <PlusIcon />
            Hinzufügen
          </button>
        </div>
      </div>
    </div>
  );
}

// Icons (analog Inhalt.jsx)
function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
