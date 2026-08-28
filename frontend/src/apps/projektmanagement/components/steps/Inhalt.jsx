/**
 * Inhalt - Projektumfang (In-Scope / Out-of-Scope)
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
  required: {
    color: theme.colors.error,
    marginLeft: '2px',
  },
  textarea: {
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
    minHeight: '120px',
    resize: 'vertical',
    fontFamily: theme.typography.fontFamily,
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
  hint: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
};

function Inhalt({ data, onChange }) {
  const handleScopeChange = (value) => {
    onChange({ scope: value });
  };

  const handleInScopeChange = (index, value) => {
    const newInScope = [...(data.in_scope || [])];
    newInScope[index] = value;
    onChange({ in_scope: newInScope });
  };

  const addInScope = () => {
    onChange({ in_scope: [...(data.in_scope || []), ''] });
  };

  const removeInScope = (index) => {
    const newInScope = (data.in_scope || []).filter((_, i) => i !== index);
    onChange({ in_scope: newInScope });
  };

  const handleOutScopeChange = (index, value) => {
    const newOutScope = [...(data.out_scope || [])];
    newOutScope[index] = value;
    onChange({ out_scope: newOutScope });
  };

  const addOutScope = () => {
    onChange({ out_scope: [...(data.out_scope || []), ''] });
  };

  const removeOutScope = (index) => {
    const newOutScope = (data.out_scope || []).filter((_, i) => i !== index);
    onChange({ out_scope: newOutScope });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Inhalt</h2>
        <p style={styles.subtitle}>
          Definieren Sie klar, was zum Projektumfang gehört und was nicht.
        </p>
      </div>

      {/* Projektumfang Beschreibung */}
      <div style={styles.formGroup}>
        <label style={styles.label}>
          Projektumfang (Scope Statement)<span style={styles.required}>*</span>
        </label>
        <textarea
          value={data.scope || ''}
          onChange={(e) => handleScopeChange(e.target.value)}
          placeholder="Beschreiben Sie den Gesamtumfang des Projekts...

Beispiel:
Das Projekt umfasst die Konzeption, Entwicklung und Einführung eines neuen Kundenportals für den Bereich Service. Die Lösung wird als Web-Anwendung realisiert und an bestehende Backend-Systeme angebunden."
          style={styles.textarea}
          onFocus={(e) => {
            e.target.style.borderColor = theme.colors.primary;
          }}
          onBlur={(e) => {
            e.target.style.borderColor = theme.colors.border;
          }}
        />
      </div>

      {/* In-Scope / Out-of-Scope */}
      <div style={styles.scopeGrid}>
        {/* In-Scope */}
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
            {(data.in_scope || []).map((item, index) => (
              <div key={index} style={styles.scopeItem}>
                <input
                  type="text"
                  value={item}
                  onChange={(e) => handleInScopeChange(index, e.target.value)}
                  placeholder="z.B. Konzeption und Design"
                  style={styles.scopeInput}
                  onFocus={(e) => {
                    e.target.style.borderColor = theme.colors.success;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = theme.colors.border;
                  }}
                />
                <button
                  style={styles.removeButton}
                  onClick={() => removeInScope(index)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = theme.colors.error;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = theme.colors.textMuted;
                  }}
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

        {/* Out-of-Scope */}
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
            {(data.out_scope || []).map((item, index) => (
              <div key={index} style={styles.scopeItem}>
                <input
                  type="text"
                  value={item}
                  onChange={(e) => handleOutScopeChange(index, e.target.value)}
                  placeholder="z.B. Hardware-Beschaffung"
                  style={styles.scopeInput}
                  onFocus={(e) => {
                    e.target.style.borderColor = theme.colors.error;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = theme.colors.border;
                  }}
                />
                <button
                  style={styles.removeButton}
                  onClick={() => removeOutScope(index)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = theme.colors.error;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = theme.colors.textMuted;
                  }}
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

// Icons
function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <polyline points="20 6 9 17 4 12" />
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

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export default Inhalt;
