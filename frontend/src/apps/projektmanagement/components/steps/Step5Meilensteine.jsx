/**
 * Step5Meilensteine - Projekt-Meilensteine
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
    color: theme.colors.textMuted,
  },
  milestonesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
  },
  milestoneCard: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing.lg,
  },
  milestoneIcon: {
    width: '40px',
    height: '40px',
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  milestoneContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
  },
  milestoneRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 150px',
    gap: theme.spacing.md,
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
  },
  label: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
  },
  input: {
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
  },
  textarea: {
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
    minHeight: '60px',
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
    justifyContent: 'center',
    flexShrink: 0,
  },
  addButton: {
    padding: theme.spacing.lg,
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
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing['2xl'],
    color: theme.colors.textMuted,
  },
  emptyIcon: {
    marginBottom: theme.spacing.md,
    opacity: 0.5,
  },
  tipBox: {
    backgroundColor: theme.colors.warningLight,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginTop: theme.spacing.lg,
  },
  tipTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.warning,
    marginBottom: theme.spacing.sm,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  tipText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
  },
};

function Step5Meilensteine({ data, onChange }) {
  const milestones = data.milestones || [];

  const generateId = () => Math.random().toString(36).substring(2, 10);

  const addMilestone = () => {
    const newMilestone = {
      id: generateId(),
      name: '',
      date: '',
      description: '',
    };
    onChange({ milestones: [...milestones, newMilestone] });
  };

  const updateMilestone = (index, field, value) => {
    const newMilestones = [...milestones];
    newMilestones[index] = { ...newMilestones[index], [field]: value };
    onChange({ milestones: newMilestones });
  };

  const removeMilestone = (index) => {
    const newMilestones = milestones.filter((_, i) => i !== index);
    onChange({ milestones: newMilestones });
  };

  // Sort milestones by date
  const sortedMilestones = [...milestones].sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>5. Meilensteine</h2>
        <p style={styles.subtitle}>
          Definieren Sie wichtige Meilensteine und Checkpoints im Projektverlauf.
        </p>
      </div>

      {milestones.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>
            <FlagIcon size={48} color={theme.colors.textMuted} />
          </div>
          <p>Noch keine Meilensteine definiert.</p>
          <p>Fügen Sie den ersten Meilenstein hinzu.</p>
        </div>
      ) : (
        <div style={styles.milestonesList}>
          {milestones.map((milestone, index) => (
            <div key={milestone.id || index} style={styles.milestoneCard}>
              <div style={styles.milestoneIcon}>
                <FlagIcon size={20} />
              </div>

              <div style={styles.milestoneContent}>
                <div style={styles.milestoneRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Meilenstein</label>
                    <input
                      type="text"
                      value={milestone.name || ''}
                      onChange={(e) => updateMilestone(index, 'name', e.target.value)}
                      placeholder="z.B. Projektstart, Go-Live, Abnahme"
                      style={styles.input}
                      onFocus={(e) => {
                        e.target.style.borderColor = theme.colors.primary;
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = theme.colors.border;
                      }}
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Datum</label>
                    <input
                      type="date"
                      value={milestone.date || ''}
                      onChange={(e) => updateMilestone(index, 'date', e.target.value)}
                      style={styles.input}
                    />
                  </div>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Beschreibung (optional)</label>
                  <textarea
                    value={milestone.description || ''}
                    onChange={(e) => updateMilestone(index, 'description', e.target.value)}
                    placeholder="Was muss erreicht sein, damit dieser Meilenstein als erreicht gilt?"
                    style={styles.textarea}
                    onFocus={(e) => {
                      e.target.style.borderColor = theme.colors.primary;
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = theme.colors.border;
                    }}
                  />
                </div>
              </div>

              <button
                style={styles.removeButton}
                onClick={() => removeMilestone(index)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = theme.colors.error;
                  e.currentTarget.style.backgroundColor = theme.colors.errorLight;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = theme.colors.textMuted;
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        style={styles.addButton}
        onClick={addMilestone}
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
        Meilenstein hinzufügen
      </button>

      <div style={styles.tipBox}>
        <div style={styles.tipTitle}>
          <InfoIcon />
          Tipp
        </div>
        <p style={styles.tipText}>
          Typische Meilensteine: Projektstart, Konzeptfreigabe, Design-Freeze,
          Entwicklungsabschluss, Testphase abgeschlossen, Go-Live, Projektabschluss.
        </p>
      </div>
    </div>
  );
}

// Icons
function FlagIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

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
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

export default Step5Meilensteine;
