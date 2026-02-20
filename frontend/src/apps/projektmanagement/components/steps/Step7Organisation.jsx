/**
 * Step7Organisation - Projektorganisation (Team & Stakeholder)
 */

import { useState } from 'react';
import { theme } from '../../../../config/theme';
import Select from '../../../../components/Select';

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
  levelBadge: {
    fontSize: theme.typography.sizes.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
  },
  levelLow: {
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.textMuted,
  },
  levelMedium: {
    backgroundColor: theme.colors.warningLight,
    color: theme.colors.warning,
  },
  levelHigh: {
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
  },
};

function Step7Organisation({ data, onChange }) {
  const [activeTab, setActiveTab] = useState('team');
  const organization = data.organization || [];
  const stakeholders = data.stakeholders || [];

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

  // Team functions
  const addTeamMember = () => {
    const newMember = {
      id: generateId(),
      name: '',
      role: '',
      email: '',
      availability: 100,
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
      interest: 'medium',
      influence: 'medium',
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
        <h2 style={styles.title}>7. Organisation</h2>
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
                    <input
                      type="text"
                      value={member.role || ''}
                      onChange={(e) => updateTeamMember(index, 'role', e.target.value)}
                      placeholder="z.B. Entwickler, Designer, Analyst"
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
                    <label style={styles.label}>E-Mail (optional)</label>
                    <input
                      type="email"
                      value={member.email || ''}
                      onChange={(e) => updateTeamMember(index, 'email', e.target.value)}
                      placeholder="max@example.com"
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
                    <label style={styles.label}>Verfügbarkeit (%)</label>
                    <input
                      type="number"
                      value={member.availability || ''}
                      onChange={(e) =>
                        updateTeamMember(index, 'availability', parseInt(e.target.value) || 0)
                      }
                      placeholder="100"
                      min="0"
                      max="100"
                      style={styles.input}
                    />
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
                    <input
                      type="text"
                      value={stakeholder.role || ''}
                      onChange={(e) => updateStakeholder(index, 'role', e.target.value)}
                      placeholder="z.B. Geschäftsführer, Abteilungsleiter"
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
                    <label style={styles.label}>Interesse</label>
                    <Select
                      value={stakeholder.interest || 'medium'}
                      onChange={(e) => updateStakeholder(index, 'interest', e.target.value)}
                      options={[
                        { value: 'low', label: 'Niedrig' },
                        { value: 'medium', label: 'Mittel' },
                        { value: 'high', label: 'Hoch' },
                      ]}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Einfluss</label>
                    <Select
                      value={stakeholder.influence || 'medium'}
                      onChange={(e) => updateStakeholder(index, 'influence', e.target.value)}
                      options={[
                        { value: 'low', label: 'Niedrig' },
                        { value: 'medium', label: 'Mittel' },
                        { value: 'high', label: 'Hoch' },
                      ]}
                    />
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

export default Step7Organisation;
