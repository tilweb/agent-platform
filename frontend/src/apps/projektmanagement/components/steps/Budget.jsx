/**
 * Budget - Projektbudget (Split aus Step6BudgetRisiken)
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
    gridTemplateColumns: '1fr 1fr 1fr',
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
};

function Budget({ data, onChange }) {
  const budget = data.budget || [];

  const generateId = () => Math.random().toString(36).substring(2, 10);

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

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>6. Kosten</h2>
        <p style={styles.subtitle}>
          Definieren Sie die Projektkosten und die einzelnen Kostenpositionen.
        </p>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTitle}>Kostenpositionen</span>
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
                  <option value="">— Bitte auswählen —</option>
                  <option value="personal">Personal</option>
                  <option value="material">Material</option>
                  <option value="external">Externe Leistungen</option>
                  <option value="travel">Reisekosten</option>
                  <option value="other">Sonstiges</option>
                </select>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Aktivierbarkeit</label>
                <select
                  value={item.activatable || ''}
                  onChange={(e) => updateBudgetItem(index, 'activatable', e.target.value)}
                  style={styles.select}
                >
                  <option value="">— Bitte auswählen —</option>
                  <option value="yes">Ja</option>
                  <option value="no">Nein</option>
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
          Kostenposition hinzufügen
        </button>
      </div>
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

export default Budget;
