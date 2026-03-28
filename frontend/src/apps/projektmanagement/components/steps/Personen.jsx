/**
 * Personen - Projektorganisation (Team & Stakeholder)
 */

import { useState, useMemo } from 'react';
import { theme } from '../../../../config/theme';
import StakeholderMatrix from './StakeholderMatrix';

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
  itemCard: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing.lg,
  },
  avatar: {
    width: '48px',
    height: '48px',
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    flexShrink: 0,
  },
  itemContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
  },
  itemGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing.md,
  },
  itemGrid3: {
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
};

function Personen({ data, onChange, config }) {
  const [activeTab, setActiveTab] = useState('team');
  const organization = data.organization || [];
  const stakeholders = data.stakeholders || [];

  const opts = (key) => config?.[key] || [];

  const generateId = () => Math.random().toString(36).substring(2, 10);

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // All people combined for matrix view
  const allPeople = useMemo(() => [
    ...organization.filter((m) => m.name && m.interest && m.influence).map((m) => ({ ...m, _type: 'team' })),
    ...stakeholders.filter((s) => s.name && s.interest && s.influence).map((s) => ({ ...s, _type: 'stakeholder' })),
  ], [organization, stakeholders]);

  // Team functions
  const addTeamMember = () => {
    const newMember = {
      id: generateId(),
      name: '',
      role: '',
      company: '',
      status: '',
      interest: '',
      influence: '',
    };
    onChange({ organization: [...organization, newMember] });
  };

  const updateTeamMember = (index, field, value) => {
    const newOrg = [...organization];
    newOrg[index] = { ...newOrg[index], [field]: value };
    onChange({ organization: newOrg });
  };

  const removeTeamMember = (index) => {
    const newOrg = organization.filter((_, i) => i !== index);
    onChange({ organization: newOrg });
  };

  // Stakeholder functions
  const addStakeholder = () => {
    const newStakeholder = {
      id: generateId(),
      name: '',
      role: '',
      status: '',
      interest: '',
      influence: '',
      expectations: '',
    };
    onChange({ stakeholders: [...stakeholders, newStakeholder] });
  };

  const updateStakeholder = (index, field, value) => {
    const newStakeholders = [...stakeholders];
    newStakeholders[index] = { ...newStakeholders[index], [field]: value };
    onChange({ stakeholders: newStakeholders });
  };

  const removeStakeholder = (index) => {
    const newStakeholders = stakeholders.filter((_, i) => i !== index);
    onChange({ stakeholders: newStakeholders });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>2. Personen</h2>
        <p style={styles.subtitle}>
          Definieren Sie das Projektteam und die wichtigsten Stakeholder.
        </p>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          type="button"
          style={{
            ...styles.tab,
            ...(activeTab === 'team' ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab('team')}
        >
          Projektteam ({organization.length})
        </button>
        <button
          type="button"
          style={{
            ...styles.tab,
            ...(activeTab === 'stakeholders' ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab('stakeholders')}
        >
          Stakeholder ({stakeholders.length})
        </button>
        <button
          type="button"
          style={{
            ...styles.tab,
            ...(activeTab === 'matrix' ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab('matrix')}
        >
          Klassifizierung
        </button>
      </div>

      {/* Team Section */}
      {activeTab === 'team' && (
        <div style={styles.section}>
          {organization.map((member, index) => (
            <div key={member.id || index} style={styles.itemCard}>
              <div style={styles.avatar}>{getInitials(member.name)}</div>

              <div style={styles.itemContent}>
                <div style={styles.itemGrid}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Name</label>
                    <input
                      type="text"
                      value={member.name || ''}
                      onChange={(e) => updateTeamMember(index, 'name', e.target.value)}
                      placeholder="Max Mustermann"
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
                    <label style={styles.label}>Rolle</label>
                    <select
                      value={member.role || ''}
                      onChange={(e) => updateTeamMember(index, 'role', e.target.value)}
                      style={styles.select}
                    >
                      <option value="">— Bitte wählen —</option>
                      {opts('role').map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Unternehmen</label>
                    <input
                      type="text"
                      value={member.company || ''}
                      onChange={(e) => updateTeamMember(index, 'company', e.target.value)}
                      placeholder="z.B. Firmenname, Dienstleister"
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
                      value={member.status || ''}
                      onChange={(e) => updateTeamMember(index, 'status', e.target.value)}
                      style={styles.select}
                    >
                      <option value="">— Bitte auswählen —</option>
                      {opts('member_status').map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={styles.itemGrid3}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Interesse</label>
                    <select
                      value={member.interest || ''}
                      onChange={(e) => updateTeamMember(index, 'interest', e.target.value)}
                      style={styles.select}
                    >
                      <option value="">— Bitte auswählen —</option>
                      {opts('interest').map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Einfluss</label>
                    <select
                      value={member.influence || ''}
                      onChange={(e) => updateTeamMember(index, 'influence', e.target.value)}
                      style={styles.select}
                    >
                      <option value="">— Bitte auswählen —</option>
                      {opts('influence').map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <button
                style={styles.removeButton}
                onClick={() => removeTeamMember(index)}
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

          <button
            style={styles.addButton}
            onClick={addTeamMember}
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
            Teammitglied hinzufügen
          </button>
        </div>
      )}

      {/* Stakeholders Section */}
      {activeTab === 'stakeholders' && (
        <div style={styles.section}>
          {stakeholders.map((stakeholder, index) => (
            <div key={stakeholder.id || index} style={styles.itemCard}>
              <div style={styles.avatar}>{getInitials(stakeholder.name)}</div>

              <div style={styles.itemContent}>
                <div style={styles.itemGrid}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Name</label>
                    <input
                      type="text"
                      value={stakeholder.name || ''}
                      onChange={(e) => updateStakeholder(index, 'name', e.target.value)}
                      placeholder="Name des Stakeholders"
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
                    <label style={styles.label}>Rolle / Position</label>
                    <select
                      value={stakeholder.role || ''}
                      onChange={(e) => updateStakeholder(index, 'role', e.target.value)}
                      style={styles.select}
                    >
                      <option value="">— Bitte wählen —</option>
                      {opts('role').map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={styles.itemGrid3}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Status</label>
                    <select
                      value={stakeholder.status || ''}
                      onChange={(e) => updateStakeholder(index, 'status', e.target.value)}
                      style={styles.select}
                    >
                      <option value="">— Bitte auswählen —</option>
                      {opts('member_status').map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Interesse</label>
                    <select
                      value={stakeholder.interest || ''}
                      onChange={(e) => updateStakeholder(index, 'interest', e.target.value)}
                      style={styles.select}
                    >
                      <option value="">— Bitte auswählen —</option>
                      {opts('interest').map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Einfluss</label>
                    <select
                      value={stakeholder.influence || ''}
                      onChange={(e) => updateStakeholder(index, 'influence', e.target.value)}
                      style={styles.select}
                    >
                      <option value="">— Bitte auswählen —</option>
                      {opts('influence').map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Erwartungen (optional)</label>
                  <textarea
                    value={stakeholder.expectations || ''}
                    onChange={(e) => updateStakeholder(index, 'expectations', e.target.value)}
                    placeholder="Welche Erwartungen hat dieser Stakeholder an das Projekt?"
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
                onClick={() => removeStakeholder(index)}
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

          <button
            style={styles.addButton}
            onClick={addStakeholder}
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
            Stakeholder hinzufügen
          </button>
        </div>
      )}

      {/* Matrix Section */}
      {activeTab === 'matrix' && (
        <div style={{ position: 'relative' }}>
          <p style={{
            fontSize: theme.typography.sizes.sm,
            color: theme.colors.textSecondary,
            marginBottom: theme.spacing.lg,
          }}>
            Alle Personen aus Projektteam und Stakeholdern nach Interesse und Einfluss klassifiziert.
          </p>
          <StakeholderMatrix
            people={allPeople}
            interestOptions={opts('interest')}
            influenceOptions={opts('influence')}
            roleOptions={opts('role')}
          />
          {/* Legend */}
          <div style={{
            display: 'flex',
            gap: theme.spacing.xl,
            marginTop: theme.spacing.lg,
            fontSize: theme.typography.sizes.xs,
            color: theme.colors.textSecondary,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
              <div style={{
                width: 12,
                height: 12,
                borderRadius: theme.borderRadius.full,
                backgroundColor: theme.colors.primaryLight,
                border: `2px solid ${theme.colors.primary}`,
              }} />
              Projektteam ({organization.length})
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
              <div style={{
                width: 12,
                height: 12,
                borderRadius: theme.borderRadius.full,
                backgroundColor: theme.colors.primaryLight,
                border: `2px solid ${theme.colors.primary}`,
              }} />
              Stakeholder ({stakeholders.length})
            </div>
          </div>
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
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export default Personen;
