import { useState } from 'react';
import { theme } from '../config/theme';
import Select from './Select';

const styles = {
  container: {},
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  hint: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.lg,
  },
  addButton: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  stepList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
  },
  step: {
    display: 'flex',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    position: 'relative',
  },
  stepNumber: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: '#3b82f6',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    flexShrink: 0,
  },
  stepContent: {
    flex: 1,
  },
  stepActions: {
    display: 'flex',
    gap: theme.spacing.xs,
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
  },
  stepAction: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: theme.spacing.xs,
    color: theme.colors.textMuted,
    fontSize: '16px',
    borderRadius: theme.borderRadius.sm,
    transition: `all ${theme.transitions.fast}`,
  },
  field: {
    marginBottom: theme.spacing.md,
  },
  fieldRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  label: {
    display: 'block',
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xs,
  },
  input: {
    width: '100%',
    padding: theme.spacing.sm,
    fontSize: theme.typography.sizes.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
  },
  emptyState: {
    padding: theme.spacing['2xl'],
    textAlign: 'center',
    backgroundColor: theme.colors.surfaceHover,
    borderRadius: theme.borderRadius.xl,
    border: `2px dashed ${theme.colors.border}`,
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: theme.spacing.md,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  emptyHint: {
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.lg,
  },
  connector: {
    display: 'flex',
    justifyContent: 'center',
    padding: `${theme.spacing.xs} 0`,
  },
  connectorLine: {
    width: '2px',
    height: '20px',
    backgroundColor: '#3b82f640',
  },
  actionBadge: {
    display: 'inline-block',
    padding: `2px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.sm,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    marginBottom: theme.spacing.sm,
  },
  badgeTool: {
    backgroundColor: '#10b98120',
    color: '#10b981',
  },
  badgeThink: {
    backgroundColor: '#8b5cf620',
    color: '#8b5cf6',
  },
  badgeRespond: {
    backgroundColor: '#3b82f620',
    color: '#3b82f6',
  },
  badgeDelegate: {
    backgroundColor: '#f59e0b20',
    color: '#f59e0b',
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  checkboxInput: {
    width: '16px',
    height: '16px',
    cursor: 'pointer',
  },
  clearButton: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.text,
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    cursor: 'pointer',
  },
};

const ACTIONS = [
  { id: 'tool', label: 'Tool ausführen', color: '#10b981' },
  { id: 'think', label: 'Analysieren', color: '#8b5cf6' },
  { id: 'respond', label: 'Antworten', color: '#3b82f6' },
  { id: 'delegate', label: 'Delegieren', color: '#f59e0b' },
];

function WorkflowDesigner({ workflow, onChange, availableTools = [] }) {
  const steps = workflow?.steps || [];

  const handleAddStep = () => {
    const newStep = {
      id: `step-${Date.now()}`,
      action: 'tool',
      tool: availableTools[0] || '',
      description: '',
      condition: '',
    };

    onChange({
      ...workflow,
      steps: [...steps, newStep],
    });
  };

  const handleUpdateStep = (index, updates) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], ...updates };
    onChange({ ...workflow, steps: newSteps });
  };

  const handleRemoveStep = (index) => {
    const newSteps = steps.filter((_, i) => i !== index);
    onChange({ ...workflow, steps: newSteps });
  };

  const handleMoveStep = (index, direction) => {
    const newSteps = [...steps];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= steps.length) return;

    [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]];
    onChange({ ...workflow, steps: newSteps });
  };

  const handleClearWorkflow = () => {
    if (confirm('Workflow wirklich löschen?')) {
      onChange(null);
    }
  };

  const getActionBadgeStyle = (action) => {
    switch (action) {
      case 'tool': return styles.badgeTool;
      case 'think': return styles.badgeThink;
      case 'respond': return styles.badgeRespond;
      case 'delegate': return styles.badgeDelegate;
      default: return {};
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>Workflow Steps</div>
        <div style={{ display: 'flex', gap: theme.spacing.sm }}>
          {steps.length > 0 && (
            <button style={styles.clearButton} onClick={handleClearWorkflow}>
              Workflow löschen
            </button>
          )}
          <button style={styles.addButton} onClick={handleAddStep}>
            <span>+</span> Step hinzufügen
          </button>
        </div>
      </div>

      <div style={styles.hint}>
        Definiere die Schritte, die der Agent bei diesem Skill durchführen soll.
        Der Workflow gibt dem Agent strukturierte Anleitungen.
      </div>

      {steps.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>
            <WorkflowIcon />
          </div>
          <div style={styles.emptyTitle}>Kein Workflow definiert</div>
          <div style={styles.emptyHint}>
            Füge Steps hinzu um einen strukturierten Ablauf zu erstellen.
          </div>
          <button style={styles.addButton} onClick={handleAddStep}>
            <span>+</span> Ersten Step hinzufügen
          </button>
        </div>
      ) : (
        <div style={styles.stepList}>
          {steps.map((step, index) => (
            <div key={step.id || index}>
              <div style={styles.step}>
                <div style={styles.stepNumber}>{index + 1}</div>
                <div style={styles.stepContent}>
                  <span style={{ ...styles.actionBadge, ...getActionBadgeStyle(step.action) }}>
                    {ACTIONS.find(a => a.id === step.action)?.label || step.action}
                  </span>

                  <div style={styles.fieldRow}>
                    <div>
                      <label style={styles.label}>Aktion</label>
                      <Select
                        value={step.action}
                        onChange={(e) => handleUpdateStep(index, { action: e.target.value })}
                        options={ACTIONS.map((action) => ({
                          value: action.id,
                          label: action.label,
                        }))}
                      />
                    </div>

                    {step.action === 'tool' && (
                      <div>
                        <label style={styles.label}>Tool</label>
                        <Select
                          value={step.tool || ''}
                          onChange={(e) => handleUpdateStep(index, { tool: e.target.value })}
                          placeholder="-- Tool wählen --"
                          options={availableTools.map((tool) => ({
                            value: tool,
                            label: tool,
                          }))}
                        />
                      </div>
                    )}
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>Beschreibung</label>
                    <input
                      type="text"
                      style={styles.input}
                      value={step.description || ''}
                      onChange={(e) => handleUpdateStep(index, { description: e.target.value })}
                      placeholder="Was soll in diesem Step passieren?"
                    />
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>Bedingung (optional)</label>
                    <input
                      type="text"
                      style={styles.input}
                      value={step.condition || ''}
                      onChange={(e) => handleUpdateStep(index, { condition: e.target.value })}
                      placeholder="z.B. 'wenn zusätzliche Infos benötigt'"
                    />
                  </div>
                </div>

                <div style={styles.stepActions}>
                  <button
                    style={styles.stepAction}
                    onClick={() => handleMoveStep(index, 'up')}
                    disabled={index === 0}
                    title="Nach oben"
                  >
                    ↑
                  </button>
                  <button
                    style={styles.stepAction}
                    onClick={() => handleMoveStep(index, 'down')}
                    disabled={index === steps.length - 1}
                    title="Nach unten"
                  >
                    ↓
                  </button>
                  <button
                    style={{ ...styles.stepAction, color: theme.colors.error }}
                    onClick={() => handleRemoveStep(index)}
                    title="Entfernen"
                  >
                    &times;
                  </button>
                </div>
              </div>

              {index < steps.length - 1 && (
                <div style={styles.connector}>
                  <div style={styles.connectorLine} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WorkflowIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

export default WorkflowDesigner;
