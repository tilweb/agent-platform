/**
 * Step6BudgetRisiken - Budget und Risiken
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
    color: theme.colors.textMuted,
  },
  tabs: {
    display: 'flex',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
  },
  tab: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  tabActive: {
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  totalBudget: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary,
  },
  itemCard: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
  },
  itemGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
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
    marginTop: theme.spacing.md,
    alignSelf: 'flex-end',
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
  riskMatrix: {
    display: 'flex',
    gap: theme.spacing.md,
  },
  riskLevel: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
    flex: 1,
  },
  riskBadge: {
    fontSize: theme.typography.sizes.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.full,
    textAlign: 'center',
    fontWeight: theme.typography.weights.medium,
  },
  riskLow: {
    backgroundColor: theme.colors.successLight,
    color: theme.colors.success,
  },
  riskMedium: {
    backgroundColor: theme.colors.warningLight,
    color: theme.colors.warning,
  },
  riskHigh: {
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
  },
};

function Step6BudgetRisiken({ data, onChange }) {
  const [activeTab, setActiveTab] = useState('budget');
  const budget = data.budget || [];
  const risks = data.risks || [];

  const generateId = () => Math.random().toString(36).substring(2, 10);

  // Budget functions
  const addBudgetItem = () => {
    const newItem = {
      id: generateId(),
      item: '',
      provider: '',
      amount: 0,
      category: '',
    };
    onChange({ budget: [...budget, newItem] });
  };

  const updateBudgetItem = (index, field, value) => {
    const newBudget = [...budget];
    newBudget[index] = { ...newBudget[index], [field]: value };
    onChange({ budget: newBudget });
  };

  const removeBudgetItem = (index) => {
    const newBudget = budget.filter((_, i) => i !== index);
    onChange({ budget: newBudget });
  };

  const totalBudget = budget.reduce((sum, item) => sum + (item.amount || 0), 0);

  // Risk functions
  const addRisk = () => {
    const newRisk = {
      id: generateId(),
      type: '',
      description: '',
      probability: 'medium',
      impact: 'medium',
      mitigation: '',
    };
    onChange({ risks: [...risks, newRisk] });
  };

  const updateRisk = (index, field, value) => {
    const newRisks = [...risks];
    newRisks[index] = { ...newRisks[index], [field]: value };
    onChange({ risks: newRisks });
  };

  const removeRisk = (index) => {
    const newRisks = risks.filter((_, i) => i !== index);
    onChange({ risks: newRisks });
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getRiskBadgeStyle = (level) => {
    switch (level) {
      case 'low':
        return styles.riskLow;
      case 'medium':
        return styles.riskMedium;
      case 'high':
        return styles.riskHigh;
      default:
        return {};
    }
  };

  const getRiskLabel = (level) => {
    switch (level) {
      case 'low':
        return 'Niedrig';
      case 'medium':
        return 'Mittel';
      case 'high':
        return 'Hoch';
      default:
        return level;
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>6. Budget & Risiken</h2>
        <p style={styles.subtitle}>
          Definieren Sie das Projektbudget und identifizieren Sie potenzielle Risiken.
        </p>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          type="button"
          style={{
            ...styles.tab,
            ...(activeTab === 'budget' ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab('budget')}
        >
          Budget ({budget.length})
        </button>
        <button
          type="button"
          style={{
            ...styles.tab,
            ...(activeTab === 'risks' ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab('risks')}
        >
          Risiken ({risks.length})
        </button>
      </div>

      {/* Budget Section */}
      {activeTab === 'budget' && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionTitle}>Budgetpositionen</span>
            <span style={styles.totalBudget}>Gesamt: {formatCurrency(totalBudget)}</span>
          </div>

          {budget.map((item, index) => (
            <div key={item.id || index} style={styles.itemCard}>
              <div style={styles.itemGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Position</label>
                  <input
                    type="text"
                    value={item.item || ''}
                    onChange={(e) => updateBudgetItem(index, 'item', e.target.value)}
                    placeholder="z.B. Entwicklungskosten"
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Anbieter (optional)</label>
                  <input
                    type="text"
                    value={item.provider || ''}
                    onChange={(e) => updateBudgetItem(index, 'provider', e.target.value)}
                    placeholder="z.B. Externe Agentur"
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Betrag (EUR)</label>
                  <input
                    type="number"
                    value={item.amount || ''}
                    onChange={(e) => updateBudgetItem(index, 'amount', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    min="0"
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Kategorie</label>
                  <select
                    value={item.category || ''}
                    onChange={(e) => updateBudgetItem(index, 'category', e.target.value)}
                    style={styles.select}
                  >
                    <option value="">Auswählen...</option>
                    <option value="personal">Personal</option>
                    <option value="material">Material</option>
                    <option value="external">Externe Leistungen</option>
                    <option value="travel">Reisekosten</option>
                    <option value="other">Sonstiges</option>
                  </select>
                </div>
              </div>
              <button
                style={styles.removeButton}
                onClick={() => removeBudgetItem(index)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = theme.colors.error;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = theme.colors.textMuted;
                }}
              >
                <TrashIcon /> Entfernen
              </button>
            </div>
          ))}

          <button
            style={styles.addButton}
            onClick={addBudgetItem}
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
            Budgetposition hinzufügen
          </button>
        </div>
      )}

      {/* Risks Section */}
      {activeTab === 'risks' && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionTitle}>Identifizierte Risiken</span>
          </div>

          {risks.map((risk, index) => (
            <div key={risk.id || index} style={styles.itemCard}>
              <div style={styles.itemGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Risikotyp</label>
                  <select
                    value={risk.type || ''}
                    onChange={(e) => updateRisk(index, 'type', e.target.value)}
                    style={styles.select}
                  >
                    <option value="">Auswählen...</option>
                    <option value="technical">Technisch</option>
                    <option value="organizational">Organisatorisch</option>
                    <option value="financial">Finanziell</option>
                    <option value="schedule">Terminlich</option>
                    <option value="resource">Ressourcen</option>
                    <option value="external">Extern</option>
                  </select>
                </div>
                <div style={styles.riskMatrix}>
                  <div style={styles.riskLevel}>
                    <label style={styles.label}>Wahrscheinlichkeit</label>
                    <select
                      value={risk.probability || 'medium'}
                      onChange={(e) => updateRisk(index, 'probability', e.target.value)}
                      style={styles.select}
                    >
                      <option value="low">Niedrig</option>
                      <option value="medium">Mittel</option>
                      <option value="high">Hoch</option>
                    </select>
                  </div>
                  <div style={styles.riskLevel}>
                    <label style={styles.label}>Auswirkung</label>
                    <select
                      value={risk.impact || 'medium'}
                      onChange={(e) => updateRisk(index, 'impact', e.target.value)}
                      style={styles.select}
                    >
                      <option value="low">Niedrig</option>
                      <option value="medium">Mittel</option>
                      <option value="high">Hoch</option>
                    </select>
                  </div>
                </div>
                <div style={{ ...styles.formGroup, ...styles.itemGridFull }}>
                  <label style={styles.label}>Beschreibung</label>
                  <textarea
                    value={risk.description || ''}
                    onChange={(e) => updateRisk(index, 'description', e.target.value)}
                    placeholder="Beschreiben Sie das Risiko..."
                    style={styles.textarea}
                  />
                </div>
                <div style={{ ...styles.formGroup, ...styles.itemGridFull }}>
                  <label style={styles.label}>Gegenmaßnahmen</label>
                  <textarea
                    value={risk.mitigation || ''}
                    onChange={(e) => updateRisk(index, 'mitigation', e.target.value)}
                    placeholder="Welche Maßnahmen können das Risiko minimieren?"
                    style={styles.textarea}
                  />
                </div>
              </div>
              <button
                style={styles.removeButton}
                onClick={() => removeRisk(index)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = theme.colors.error;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = theme.colors.textMuted;
                }}
              >
                <TrashIcon /> Entfernen
              </button>
            </div>
          ))}

          <button
            style={styles.addButton}
            onClick={addRisk}
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
            Risiko hinzufügen
          </button>
        </div>
      )}
    </div>
  );
}

// Icons
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

export default Step6BudgetRisiken;
