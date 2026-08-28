/**
 * Roadmap - Meilensteine & Hauptaufgaben (Merge aus Step4Aufgaben + Step5Meilensteine)
 */

import { useState } from 'react';
import { theme } from '../../../../config/theme';
import GanttRoadmap from '../GanttRoadmap';
import RoadmapModal from '../RoadmapModal';
import { toGanttItems } from '../roadmap-utils';
import { MilestoneBadge, QualityGateBadge, MilestoneDiamondIcon } from '../RoadmapShapes';

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
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  sectionIcon: {
    color: theme.colors.primary,
  },
  // Meilensteine styles
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
    width: '32px',
    height: '32px',
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
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
  // Hauptaufgaben styles
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
  taskGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing.md,
  },
  taskGridFull: {
    gridColumn: '1 / -1',
  },
  // Shared styles
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
  select: {
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    cursor: 'pointer',
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
    marginTop: theme.spacing.md,
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
  cardHighlight: {
    boxShadow: `0 0 0 2px ${theme.colors.primary}`,
    transition: `box-shadow ${theme.transitions.fast}`,
  },
};

function Roadmap({ data, onChange }) {
  const milestones = data.milestones || [];
  const qualityGates = data.quality_gates || [];
  const tasks = data.tasks || [];

  const [ganttOpen, setGanttOpen] = useState(false);
  const [highlightId, setHighlightId] = useState(null);

  const ganttItems = toGanttItems({ milestones, qualityGates, tasks });
  const hasGantt = ganttItems.length > 0;

  // Klick auf ein Gantt-Element → zum Listeneintrag scrollen + kurz hervorheben.
  const jumpToItem = (it) => {
    const domId = `gantt-${it.type}-${it.refId}`;
    setGanttOpen(false);
    setHighlightId(domId);
    requestAnimationFrame(() => {
      const el = document.getElementById(domId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    setTimeout(() => setHighlightId((cur) => (cur === domId ? null : cur)), 2200);
  };

  const generateId = () => Math.random().toString(36).substring(2, 10);

  // --- Meilensteine ---
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

  // --- Quality Gates ---
  const addQualityGate = () => {
    const newGate = { id: generateId(), name: '', date: '' };
    onChange({ quality_gates: [...qualityGates, newGate] });
  };

  const updateQualityGate = (index, field, value) => {
    const newGates = [...qualityGates];
    newGates[index] = { ...newGates[index], [field]: value };
    onChange({ quality_gates: newGates });
  };

  const removeQualityGate = (index) => {
    const newGates = qualityGates.filter((_, i) => i !== index);
    onChange({ quality_gates: newGates });
  };

  // --- Hauptaufgaben ---
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
        <h2 style={styles.title}>Roadmap</h2>
        <p style={styles.subtitle}>
          Definieren Sie Meilensteine und Hauptaufgaben für Ihr Projekt.
        </p>
      </div>

      {/* === Roadmap-Gantt === */}
      {hasGantt && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: theme.spacing.sm }}>
            <button
              type="button"
              onClick={() => setGanttOpen(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs,
                padding: `${theme.spacing.xs} ${theme.spacing.md}`,
                fontSize: theme.typography.sizes.xs,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.md,
                backgroundColor: 'transparent', color: theme.colors.textSecondary, cursor: 'pointer',
              }}
            >
              ⛶ Vollbild
            </button>
          </div>
          <GanttRoadmap
            items={ganttItems}
            rangeStart={data.start_date}
            rangeEnd={data.end_date}
            onItemClick={jumpToItem}
          />
        </div>
      )}
      <RoadmapModal
        open={ganttOpen}
        onClose={() => setGanttOpen(false)}
        title="Roadmap"
        items={ganttItems}
        rangeStart={data.start_date}
        rangeEnd={data.end_date}
        onItemClick={jumpToItem}
      />

      {/* === Sektion 1: Meilensteine === */}
      <div>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionIcon}><MilestoneDiamondIcon size={18} /></span>
          <span style={styles.sectionTitle}>Meilensteine</span>
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
              <div
                key={milestone.id || index}
                id={`gantt-milestone-${milestone.id ?? index}`}
                style={{ ...styles.milestoneCard, ...(highlightId === `gantt-milestone-${milestone.id ?? index}` ? styles.cardHighlight : {}) }}
              >
                <MilestoneBadge number={index + 1} />

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

      {/* === Sektion 2: Quality Gates === */}
      <div>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionIcon}><ShieldIcon size={20} /></span>
          <span style={styles.sectionTitle}>Quality Gates</span>
        </div>

        {qualityGates.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              <ShieldIcon size={48} color={theme.colors.textMuted} />
            </div>
            <p>Noch keine Quality Gates definiert.</p>
          </div>
        ) : (
          <div style={styles.milestonesList}>
            {qualityGates.map((gate, index) => (
              <div
                key={gate.id || index}
                id={`gantt-gate-${gate.id ?? index}`}
                style={{ ...styles.milestoneCard, ...(highlightId === `gantt-gate-${gate.id ?? index}` ? styles.cardHighlight : {}) }}
              >
                <QualityGateBadge number={index + 1} />

                <div style={{ ...styles.milestoneContent, gap: 0 }}>
                  <div style={styles.milestoneRow}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Bezeichnung</label>
                      <input
                        type="text"
                        value={gate.name || ''}
                        onChange={(e) => updateQualityGate(index, 'name', e.target.value)}
                        placeholder="z.B. Code Review, Sicherheitsaudit, Abnahmetest"
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
                        value={gate.date || ''}
                        onChange={(e) => updateQualityGate(index, 'date', e.target.value)}
                        style={styles.input}
                      />
                    </div>
                  </div>
                </div>

                <button
                  style={styles.removeButton}
                  onClick={() => removeQualityGate(index)}
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
          onClick={addQualityGate}
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
          Quality Gate hinzufügen
        </button>
      </div>

      {/* === Sektion 3: Hauptaufgaben === */}
      <div>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionIcon}><TaskIcon size={20} /></span>
          <span style={styles.sectionTitle}>Hauptaufgaben</span>
        </div>

        {tasks.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              <TaskIcon size={48} color={theme.colors.textMuted} />
            </div>
            <p>Noch keine Hauptaufgaben definiert.</p>
            <p>Fügen Sie die erste Hauptaufgabe hinzu.</p>
          </div>
        ) : (
          <div style={styles.tasksList}>
            {tasks.map((task, index) => (
              <div
                key={task.id || index}
                id={`gantt-task-${task.id ?? index}`}
                style={{ ...styles.taskCard, ...(highlightId === `gantt-task-${task.id ?? index}` ? styles.cardHighlight : {}) }}
              >
                <div style={styles.taskHeader}>
                  <span style={styles.taskNumber}>Hauptaufgabe {index + 1}</span>
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
                    <label style={styles.label}>Name der Hauptaufgabe</label>
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
          Hauptaufgabe hinzufügen
        </button>
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

function ShieldIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
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

export default Roadmap;
