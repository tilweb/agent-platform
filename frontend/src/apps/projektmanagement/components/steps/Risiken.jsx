/**
 * Risiken - Projektrisiken (Split aus Step6BudgetRisiken)
 */

import { useState } from 'react';
import { theme } from '../../../../config/theme';
import RiskMatrix from './RiskMatrix';

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

function Risiken({
  data,
  onChange,
  config,
  title = 'Risiken',
  subtitle = 'Identifizieren und bewerten Sie potenzielle Projektrisiken und -chancen.',
}) {
  const [activeTab, setActiveTab] = useState('eingabe');
  const opts = (key) => config?.[key] || [];
  const risks = data.risks || [];

  const generateId = () => Math.random().toString(36).substring(2, 10);

  const addRisk = () => {
    const newRisk = {
      id: generateId(),
      nature: '',
      type: '',
      description: '',
      probability: '',
      impact: '',
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

  const threatCount = risks.filter((r) => r.nature !== 'chance').length;
  const chanceCount = risks.filter((r) => r.nature === 'chance').length;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>{title}</h2>
        <p style={styles.subtitle}>{subtitle}</p>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          type="button"
          style={{
            ...styles.tab,
            ...(activeTab === 'eingabe' ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab('eingabe')}
        >
          Eingabe ({risks.length})
        </button>
        <button
          type="button"
          style={{
            ...styles.tab,
            ...(activeTab === 'matrix' ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab('matrix')}
        >
          Risikomatrix
        </button>
      </div>

      {/* Eingabe Tab */}
      {activeTab === 'eingabe' && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionTitle}>
              Identifizierte Risiken & Chancen
            </span>
          </div>

          {risks.map((risk, index) => (
            <div key={risk.id || index} style={styles.itemCard}>
              <div style={styles.itemGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Art</label>
                  <select
                    value={risk.nature || ''}
                    onChange={(e) => updateRisk(index, 'nature', e.target.value)}
                    style={styles.select}
                  >
                    <option value="">— Bitte auswählen —</option>
                    <option value="threat">Bedrohung</option>
                    <option value="chance">Chance</option>
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Risikotyp</label>
                  <select
                    value={risk.type || ''}
                    onChange={(e) => updateRisk(index, 'type', e.target.value)}
                    style={styles.select}
                  >
                    <option value="">— Bitte auswählen —</option>
                    <option value="technical">Technisch</option>
                    <option value="organizational">Organisatorisch</option>
                    <option value="financial">Finanziell</option>
                    <option value="schedule">Terminlich</option>
                    <option value="resource">Ressourcen</option>
                    <option value="external">Extern</option>
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Wahrscheinlichkeit</label>
                  <select
                    value={risk.probability || ''}
                    onChange={(e) => updateRisk(index, 'probability', e.target.value)}
                    style={styles.select}
                  >
                    <option value="">— Bitte auswählen —</option>
                    {opts('probability').map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Auswirkung</label>
                  <select
                    value={risk.impact || ''}
                    onChange={(e) => updateRisk(index, 'impact', e.target.value)}
                    style={styles.select}
                  >
                    <option value="">— Bitte auswählen —</option>
                    {opts('impact').map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
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
            Risiko / Chance hinzufügen
          </button>
        </div>
      )}

      {/* Matrix Tab */}
      {activeTab === 'matrix' && (
        <div>
          <p style={{
            fontSize: theme.typography.sizes.sm,
            color: theme.colors.textSecondary,
            marginBottom: theme.spacing.lg,
          }}>
            Bedrohungen ({threatCount}) und Chancen ({chanceCount}) nach Wahrscheinlichkeit und Auswirkung.
            Die Kreisgröße entspricht der Auswirkung.
          </p>
          <RiskMatrix
            risks={risks}
            probabilityOptions={opts('probability')}
            impactOptions={opts('impact')}
          />
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

export default Risiken;
