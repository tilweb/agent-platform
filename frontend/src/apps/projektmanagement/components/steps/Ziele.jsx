/**
 * Ziele - Projektziele und Erfolgskriterien
 */

import { useState } from 'react';
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
    minHeight: '150px',
    resize: 'vertical',
    fontFamily: theme.typography.fontFamily,
  },
  hint: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  criteriaList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },
  criteriaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  criteriaInput: {
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
    color: theme.colors.error,
    cursor: 'pointer',
    borderRadius: theme.borderRadius.md,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
    border: 'none',
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    alignSelf: 'flex-start',
    marginTop: theme.spacing.sm,
  },
  tipBox: {
    backgroundColor: theme.colors.infoLight,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginTop: theme.spacing.lg,
  },
  tipTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.info,
    marginBottom: theme.spacing.sm,
  },
  tipText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    lineHeight: theme.typography.lineHeight.relaxed,
  },
};

function Ziele({ data, onChange }) {
  const handleGoalsChange = (value) => {
    onChange({ goals: value });
  };

  const handleCriteriaChange = (index, value) => {
    const newCriteria = [...(data.criteria || [])];
    newCriteria[index] = value;
    onChange({ criteria: newCriteria });
  };

  const addCriterion = () => {
    onChange({ criteria: [...(data.criteria || []), ''] });
  };

  const removeCriterion = (index) => {
    const newCriteria = (data.criteria || []).filter((_, i) => i !== index);
    onChange({ criteria: newCriteria });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>3. Ziele</h2>
        <p style={styles.subtitle}>
          Definieren Sie die Projektziele und messbaren Erfolgskriterien.
        </p>
      </div>

      {/* Projektziele */}
      <div style={styles.formGroup}>
        <label style={styles.label}>
          Projektziele<span style={styles.required}>*</span>
        </label>
        <textarea
          value={data.goals || ''}
          onChange={(e) => handleGoalsChange(e.target.value)}
          placeholder="Beschreiben Sie die Ziele des Projekts...

Beispiel:
- Steigerung der Kundenzufriedenheit um 20%
- Reduzierung der Bearbeitungszeit um 30%
- Einführung eines neuen digitalen Service-Portals"
          style={styles.textarea}
          onFocus={(e) => {
            e.target.style.borderColor = theme.colors.primary;
          }}
          onBlur={(e) => {
            e.target.style.borderColor = theme.colors.border;
          }}
        />
        <p style={styles.hint}>
          Formulieren Sie SMART-Ziele: Spezifisch, Messbar, Attraktiv, Realistisch, Terminiert
        </p>
      </div>

      {/* Erfolgskriterien */}
      <div style={styles.formGroup}>
        <label style={styles.label}>
          Erfolgskriterien<span style={styles.required}>*</span>
        </label>
        <p style={styles.hint}>
          Definieren Sie messbare Kriterien, an denen der Projekterfolg gemessen wird.
        </p>
        <div style={styles.criteriaList}>
          {(data.criteria || []).map((criterion, index) => (
            <div key={index} style={styles.criteriaItem}>
              <input
                type="text"
                value={criterion}
                onChange={(e) => handleCriteriaChange(index, e.target.value)}
                placeholder={`Kriterium ${index + 1}, z.B. "System ist live und stabil"`}
                style={styles.criteriaInput}
                onFocus={(e) => {
                  e.target.style.borderColor = theme.colors.primary;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = theme.colors.border;
                }}
              />
              <button
                style={styles.removeButton}
                onClick={() => removeCriterion(index)}
                title="Entfernen"
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.errorLight;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
        <button
          style={styles.addButton}
          onClick={addCriterion}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.primary;
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.primaryLight;
            e.currentTarget.style.color = theme.colors.primary;
          }}
        >
          <PlusIcon />
          Kriterium hinzufügen
        </button>
      </div>

      {/* Tipp-Box */}
      <div style={styles.tipBox}>
        <div style={styles.tipTitle}>Tipp: RUHR PM Masterclass</div>
        <p style={styles.tipText}>
          Gute Projektziele sind der Schlüssel zum Erfolg. Stellen Sie sicher, dass Ihre Ziele:
          <br />- Klar und eindeutig formuliert sind
          <br />- Messbare Ergebnisse definieren
          <br />- Realistisch erreichbar sind
          <br />- Einen klaren Zeitrahmen haben
        </p>
      </div>
    </div>
  );
}

// Icons
function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export default Ziele;
