/**
 * Step4Aufgaben - Projektaufgaben
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
  tasksList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  },
  taskCard: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
  },
  taskHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  taskNumber: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.primary,
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
  taskGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing.md,
  },
  taskGridFull: {
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
  select: {
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    cursor: 'pointer',
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
};

function Step4Aufgaben({ data, onChange }) {
  const tasks = data.tasks || [];

  const generateId = () => Math.random().toString(36).substring(2, 10);

  const addTask = () => {
    const newTask = {
      id: generateId(),
      name: '',
      responsible: '',
      start_date: '',
      end_date: '',
      effort: 0,
      status: 'open',
    };
    onChange({ tasks: [...tasks, newTask] });
  };

  const updateTask = (index, field, value) => {
    const newTasks = [...tasks];
    newTasks[index] = { ...newTasks[index], [field]: value };
    onChange({ tasks: newTasks });
  };

  const removeTask = (index) => {
    const newTasks = tasks.filter((_, i) => i !== index);
    onChange({ tasks: newTasks });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>4. Aufgaben</h2>
        <p style={styles.subtitle}>
          Definieren Sie die Hauptaufgaben und Arbeitspakete des Projekts.
        </p>
      </div>

      {tasks.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>
            <TaskIcon size={48} color={theme.colors.textMuted} />
          </div>
          <p>Noch keine Aufgaben definiert.</p>
          <p>Fügen Sie die erste Aufgabe hinzu.</p>
        </div>
      ) : (
        <div style={styles.tasksList}>
          {tasks.map((task, index) => (
            <div key={task.id || index} style={styles.taskCard}>
              <div style={styles.taskHeader}>
                <span style={styles.taskNumber}>Aufgabe {index + 1}</span>
                <button
                  style={styles.removeButton}
                  onClick={() => removeTask(index)}
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

              <div style={styles.taskGrid}>
                <div style={{ ...styles.formGroup, ...styles.taskGridFull }}>
                  <label style={styles.label}>Aufgabenname</label>
                  <input
                    type="text"
                    value={task.name || ''}
                    onChange={(e) => updateTask(index, 'name', e.target.value)}
                    placeholder="z.B. Anforderungsanalyse durchführen"
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
                  <label style={styles.label}>Verantwortlich</label>
                  <input
                    type="text"
                    value={task.responsible || ''}
                    onChange={(e) => updateTask(index, 'responsible', e.target.value)}
                    placeholder="Name"
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
                  <label style={styles.label}>Status</label>
                  <select
                    value={task.status || 'open'}
                    onChange={(e) => updateTask(index, 'status', e.target.value)}
                    style={styles.select}
                  >
                    <option value="open">Offen</option>
                    <option value="in_progress">In Bearbeitung</option>
                    <option value="completed">Abgeschlossen</option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Startdatum</label>
                  <input
                    type="date"
                    value={task.start_date || ''}
                    onChange={(e) => updateTask(index, 'start_date', e.target.value)}
                    style={styles.input}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Enddatum</label>
                  <input
                    type="date"
                    value={task.end_date || ''}
                    onChange={(e) => updateTask(index, 'end_date', e.target.value)}
                    style={styles.input}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Aufwand (PT)</label>
                  <input
                    type="number"
                    value={task.effort || ''}
                    onChange={(e) => updateTask(index, 'effort', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    min="0"
                    step="0.5"
                    style={styles.input}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        style={styles.addButton}
        onClick={addTask}
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
        Aufgabe hinzufügen
      </button>
    </div>
  );
}

// Icons
function TaskIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
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

export default Step4Aufgaben;
