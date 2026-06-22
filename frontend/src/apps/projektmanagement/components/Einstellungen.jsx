/**
 * Einstellungen - Konfigurierbare Select-Optionen + Masterclass-Wissen
 */

import { useState, useEffect } from 'react';
import { theme } from '../../../config/theme';
import { useProjektmanagement } from '../../../hooks/useProjektmanagement';
import MasterclassEditor from './MasterclassEditor';

// ============== Auswahloptionen Tab ==============

const FIELD_LABELS = {
  project_type: 'Projekttyp',
  project_size: 'Projektgröße',
  priority: 'Priorität',
  project_driver: 'Projekttreiber',
  project_status: 'Projektstatus',
  order_status: 'Projektauftragsstatus',
  idee_status: 'Projektidee-Status',
  role: 'Rolle',
  member_status: 'Status (intern/extern)',
  gruppe: 'Gruppe',
  interest: 'Interesse',
  influence: 'Einfluss',
  probability: 'Wahrscheinlichkeit',
  impact: 'Auswirkung',
  roadmap_status: 'Roadmap-Status',
  risk_strategie: 'Risiko-Strategie',
  risk_status: 'Risiko-Status',
  lesson_themengebiet: 'Themengebiet',
  lesson_kategorie: 'Kategorie',
};

// Wo jede Liste eingesetzt wird (Modul/Eingabemaske) — als Untertitel unter dem
// Listentitel. Hilft Konfiguratoren, die Auswirkung einer Änderung einzuschätzen.
const FIELD_USAGE = {
  project_type: 'Projekt-Wizard (Basisinfo), Projektidee (Basis), Portfolio',
  project_size: 'Projekt-Wizard (Basisinfo), Projektidee (Basis)',
  priority: 'Projekt-Wizard (Basisinfo), Projektidee (Basis)',
  project_driver: 'Projekt-Wizard (Basisinfo)',
  project_status: 'Projekt-Wizard (Basisinfo), Projektidee (Basis), Abschlussbericht, Portfolio',
  order_status: 'Projekt-Wizard (Basisinfo)',
  idee_status: 'Projektidee (Basis)',
  role: 'Projekt-Wizard (Organisation/Stakeholder), Stakeholder-Matrix',
  member_status: 'Projekt-Wizard (Organisation/Stakeholder)',
  gruppe: 'Projekt-Wizard (Personen), Projektidee (Personen)',
  interest: 'Projekt-Wizard (Organisation/Stakeholder), Stakeholder-Matrix',
  influence: 'Projekt-Wizard (Organisation/Stakeholder), Stakeholder-Matrix',
  probability: 'Projekt-Wizard (Risiken), Statusberichte, Abschlussbericht',
  impact: 'Projekt-Wizard (Risiken), Statusberichte, Abschlussbericht',
  roadmap_status: 'Statusberichte (Roadmap)',
  risk_strategie: 'Statusberichte (Risiken)',
  risk_status: 'Statusberichte (Risiken), Abschlussbericht',
  lesson_themengebiet: 'Lessons Learned',
  lesson_kategorie: 'Lessons Learned',
};

// Display order
const FIELD_ORDER = [
  'project_type',
  'project_size',
  'priority',
  'project_driver',
  'project_status',
  'order_status',
  'idee_status',
  'role',
  'member_status',
  'gruppe',
  'interest',
  'influence',
  'probability',
  'impact',
  'roadmap_status',
  'risk_strategie',
  'risk_status',
  'lesson_themengebiet',
  'lesson_kategorie',
];

// Listen, deren Schlüssel (value) im Code fest verdrahtet sind (Status-Zuordnung,
// Badges, Filter). Hier ist nur der Anzeigename editierbar — Schlüssel sind
// gesperrt und Einträge können nicht hinzugefügt/gelöscht werden, damit die
// automatische Zuordnung nicht bricht.
const LOCKED_KEY_FIELDS = new Set(['idee_status']);

// ============== Styles ==============

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xl,
    maxWidth: '900px',
  },
  header: {
    marginBottom: theme.spacing.md,
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
  // Subtabs
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
  // Save bar
  saveBar: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.borderRadius.lg,
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  saveButton: {
    padding: `${theme.spacing.sm} ${theme.spacing.xl}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  saveHint: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.primary,
  },
  // Options grid
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing.xl,
  },
  fieldCard: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
  },
  fieldTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  fieldUsage: {
    fontSize: '11px',
    color: theme.colors.textMuted,
    marginTop: '2px',
  },
  fieldUsageLabel: {
    fontWeight: theme.typography.weights.medium,
  },
  lockedHint: {
    fontSize: '11px',
    color: theme.colors.textMuted,
    marginTop: '2px',
    fontStyle: 'italic',
  },
  valueInputLocked: {
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.textMuted,
    cursor: 'not-allowed',
  },
  optionRow: {
    display: 'flex',
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  optionInput: {
    flex: 1,
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.xs,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
  },
  valueInput: {
    width: '100px',
    flexShrink: 0,
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.xs,
    backgroundColor: theme.colors.background,
    color: theme.colors.textSecondary,
    outline: 'none',
    fontFamily: theme.typography.fontMono,
  },
  removeBtn: {
    padding: theme.spacing.xs,
    backgroundColor: 'transparent',
    border: 'none',
    color: theme.colors.textMuted,
    cursor: 'pointer',
    borderRadius: theme.borderRadius.sm,
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  addBtn: {
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    backgroundColor: 'transparent',
    border: `1px dashed ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  columnLabels: {
    display: 'flex',
    gap: theme.spacing.sm,
    alignItems: 'center',
    paddingBottom: theme.spacing.xs,
    borderBottom: `1px solid ${theme.colors.borderLight}`,
    marginBottom: theme.spacing.xs,
  },
  columnLabel: {
    fontSize: '10px',
    color: theme.colors.textMuted,
    fontWeight: theme.typography.weights.medium,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
};

// ============== Auswahloptionen Sub-Component ==============

function AuswahloptionenTab({ config, setConfig, hasChanges, setHasChanges, saving, onSave }) {
  const updateField = (fieldKey, options) => {
    setConfig((prev) => ({ ...prev, [fieldKey]: options }));
    setHasChanges(true);
  };

  const addOption = (fieldKey) => {
    const current = config[fieldKey] || [];
    updateField(fieldKey, [...current, { value: '', label: '' }]);
  };

  const updateOption = (fieldKey, index, key, value) => {
    const current = [...(config[fieldKey] || [])];
    current[index] = { ...current[index], [key]: value };
    updateField(fieldKey, current);
  };

  const removeOption = (fieldKey, index) => {
    const current = (config[fieldKey] || []).filter((_, i) => i !== index);
    updateField(fieldKey, current);
  };

  return (
    <>
      {hasChanges && (
        <div style={styles.saveBar}>
          <button
            style={styles.saveButton}
            onClick={onSave}
            disabled={saving}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.primaryHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.primary;
            }}
          >
            {saving ? 'Speichere...' : 'Änderungen speichern'}
          </button>
          <span style={styles.saveHint}>Ungespeicherte Änderungen</span>
        </div>
      )}

      <div style={styles.grid}>
        {FIELD_ORDER.map((fieldKey) => {
          const keysLocked = LOCKED_KEY_FIELDS.has(fieldKey);
          return (
          <div key={fieldKey} style={styles.fieldCard}>
            <div>
              <div style={styles.fieldTitle}>{FIELD_LABELS[fieldKey]}</div>
              {FIELD_USAGE[fieldKey] && (
                <div style={styles.fieldUsage}>
                  <span style={styles.fieldUsageLabel}>Verwendet in:</span> {FIELD_USAGE[fieldKey]}
                </div>
              )}
              {keysLocked && (
                <div style={styles.lockedHint}>
                  🔒 Schlüssel fixiert (Status-Zuordnung) — nur Anzeigename änderbar.
                </div>
              )}
            </div>

            <div style={styles.columnLabels}>
              <span style={{ ...styles.columnLabel, flex: 1 }}>Anzeigename</span>
              <span style={{ ...styles.columnLabel, width: '100px', flexShrink: 0 }}>Schlüssel</span>
              <span style={{ width: '24px', flexShrink: 0 }} />
            </div>

            {(config[fieldKey] || []).map((option, index) => (
              <div key={index} style={styles.optionRow}>
                <input
                  style={styles.optionInput}
                  value={option.label}
                  onChange={(e) => updateOption(fieldKey, index, 'label', e.target.value)}
                  placeholder="Anzeigename"
                  onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
                  onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
                />
                <input
                  style={keysLocked ? { ...styles.valueInput, ...styles.valueInputLocked } : styles.valueInput}
                  value={option.value}
                  onChange={(e) => updateOption(fieldKey, index, 'value', e.target.value)}
                  placeholder="key"
                  readOnly={keysLocked}
                  title={keysLocked ? 'Schlüssel ist fixiert (Status-Zuordnung)' : undefined}
                  onFocus={(e) => { if (!keysLocked) e.target.style.borderColor = theme.colors.primary; }}
                  onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
                />
                {keysLocked ? (
                  <span style={{ width: '24px', flexShrink: 0 }} />
                ) : (
                  <button
                    style={styles.removeBtn}
                    onClick={() => removeOption(fieldKey, index)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = theme.colors.error;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = theme.colors.textMuted;
                    }}
                  >
                    <TrashIcon />
                  </button>
                )}
              </div>
            ))}

            {!keysLocked && (
              <button
                style={styles.addBtn}
                onClick={() => addOption(fieldKey)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = theme.colors.primary;
                  e.currentTarget.style.color = theme.colors.primary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = theme.colors.border;
                  e.currentTarget.style.color = theme.colors.textMuted;
                }}
              >
                <PlusIcon /> Hinzufügen
              </button>
            )}
          </div>
          );
        })}
      </div>
    </>
  );
}

// ============== Abschluss-Checkliste Sub-Component ==============

function ChecklisteTab({ config, setConfig, hasChanges, setHasChanges, saving, onSave }) {
  const items = config.abschluss_checkliste || [];

  const update = (next) => {
    setConfig((prev) => ({ ...prev, abschluss_checkliste: next }));
    setHasChanges(true);
  };

  const addItem = () =>
    update([...items, { id: `chk_${Math.random().toString(36).slice(2, 9)}`, label: '' }]);
  const updateItem = (index, label) => {
    const next = [...items];
    next[index] = { ...next[index], label };
    update(next);
  };
  const removeItem = (index) => update(items.filter((_, i) => i !== index));

  return (
    <>
      {hasChanges && (
        <div style={styles.saveBar}>
          <button
            style={styles.saveButton}
            onClick={onSave}
            disabled={saving}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.primaryHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = theme.colors.primary; }}
          >
            {saving ? 'Speichere...' : 'Änderungen speichern'}
          </button>
          <span style={styles.saveHint}>Ungespeicherte Änderungen</span>
        </div>
      )}

      <div style={styles.fieldCard}>
        <div style={styles.fieldTitle}>Abschluss-Checkliste</div>
        <p style={styles.subtitle}>
          Aufgaben/Rahmenbedingungen, die beim Projektabschluss unternehmensspezifisch immer
          betrachtet werden müssen. Sie erscheinen im Abschlussbericht als Selectbox
          (Erledigt / Offen / Nicht anwendbar) und in den Exporten.
        </p>

        {items.map((item, index) => (
          <div key={item.id || index} style={styles.optionRow}>
            <input
              style={styles.optionInput}
              value={item.label}
              onChange={(e) => updateItem(index, e.target.value)}
              placeholder="Aufgabe / Rahmenbedingung"
              onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
              onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
            />
            <button
              style={styles.removeBtn}
              onClick={() => removeItem(index)}
              onMouseEnter={(e) => { e.currentTarget.style.color = theme.colors.error; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = theme.colors.textMuted; }}
            >
              <TrashIcon />
            </button>
          </div>
        ))}

        <button
          style={styles.addBtn}
          onClick={addItem}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = theme.colors.primary;
            e.currentTarget.style.color = theme.colors.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = theme.colors.border;
            e.currentTarget.style.color = theme.colors.textMuted;
          }}
        >
          <PlusIcon /> Eintrag hinzufügen
        </button>
      </div>
    </>
  );
}

// ============== Main Component ==============

function Einstellungen() {
  const { getConfig, updateConfig } = useProjektmanagement();
  const [activeTab, setActiveTab] = useState('optionen');
  const [config, setConfig] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getConfig().then(setConfig).catch(console.error);
  }, [getConfig]);

  if (!config) {
    return <div style={{ padding: theme.spacing.xl, color: theme.colors.textMuted }}>Lade Einstellungen...</div>;
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateConfig(config);
      setHasChanges(false);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Einstellungen</h2>
        <p style={styles.subtitle}>
          Konfigurieren Sie Auswahloptionen und Masterclass-Wissen für das Projektmanagement.
        </p>
      </div>

      {/* Subtabs */}
      <div style={styles.tabs}>
        {[
          { id: 'optionen', label: 'Auswahloptionen' },
          { id: 'checkliste', label: 'Abschluss-Checkliste' },
          { id: 'masterclass', label: 'Masterclass' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              style={{
                ...styles.tab,
                ...(isActive ? styles.tabActive : {}),
              }}
              onClick={() => setActiveTab(tab.id)}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'optionen' && (
        <AuswahloptionenTab
          config={config}
          setConfig={setConfig}
          hasChanges={hasChanges}
          setHasChanges={setHasChanges}
          saving={saving}
          onSave={handleSave}
        />
      )}

      {activeTab === 'checkliste' && (
        <ChecklisteTab
          config={config}
          setConfig={setConfig}
          hasChanges={hasChanges}
          setHasChanges={setHasChanges}
          saving={saving}
          onSave={handleSave}
        />
      )}

      {activeTab === 'masterclass' && (
        <MasterclassEditor />
      )}
    </div>
  );
}

// ============== Icons ==============

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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


export default Einstellungen;
