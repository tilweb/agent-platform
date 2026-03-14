import { useState } from 'react';
import { theme } from '../../../../config/theme';
import { useSuppliers } from '../../../../hooks/useSuppliers';
import BiaForm from '../shared/BiaForm';
import RiskBadge from '../shared/RiskBadge';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  card: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    transition: `all ${theme.transitions.fast}`,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.xl,
    cursor: 'pointer',
  },
  cardLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.lg,
    flex: 1,
  },
  cardName: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  cardMeta: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  statusBadge: {
    display: 'inline-block',
    fontSize: theme.typography.sizes.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
  },
  statusActive: {
    backgroundColor: theme.colors.successLight,
    color: theme.colors.success,
  },
  statusInactive: {
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.textMuted,
  },
  cardBody: {
    padding: `0 ${theme.spacing.xl} ${theme.spacing.xl}`,
    borderTop: `1px solid ${theme.colors.border}`,
    paddingTop: theme.spacing.lg,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: theme.spacing.sm,
  },
  description: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.lineHeight.relaxed,
  },
  biaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: theme.spacing.md,
  },
  biaItem: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceHover,
    borderRadius: theme.borderRadius.lg,
  },
  biaLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xs,
  },
  biaValue: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    fontWeight: theme.typography.weights.medium,
  },
  cardActions: {
    display: 'flex',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    borderTop: `1px solid ${theme.colors.borderLight}`,
  },
  btnPrimary: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  btnSecondary: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  btnDanger: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.error,
    border: `1px solid ${theme.colors.error}30`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  formCard: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
  },
  formTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  input: {
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
    fontFamily: theme.typography.fontFamily,
  },
  select: {
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
    cursor: 'pointer',
  },
  textarea: {
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
    minHeight: 80,
    resize: 'vertical',
    fontFamily: theme.typography.fontFamily,
  },
  actions: {
    display: 'flex',
    gap: theme.spacing.md,
    justifyContent: 'flex-end',
  },
  empty: {
    textAlign: 'center',
    padding: theme.spacing['2xl'],
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
  doraTag: {
    display: 'inline-block',
    fontSize: theme.typography.sizes.xs,
    padding: `2px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
    backgroundColor: theme.colors.infoLight,
    color: theme.colors.info,
  },
};

const BIA_LABELS = {
  sla_relevanz: 'SLA-Relevanz',
  datenschutz_niveau: 'Datenschutz',
  vertraulichkeit: 'Vertraulichkeit',
  kundenbezug: 'Kundenbezug',
  ausschreibungsvolumen: 'Volumen',
};

const REVIEW_CYCLE_LABELS = {
  very_high: '12 Monate',
  high: '36 Monate',
};

export default function LeistungenPanel({ supplier, onUpdate, config }) {
  const { addLeistung, updateLeistung, deleteLeistung, updateBia } = useSuppliers();
  const teams = config?.teams || [];
  const [expandedId, setExpandedId] = useState(null);
  const [editingBiaId, setEditingBiaId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ bezeichnung: '', abteilung: '', beschreibung: '', team_id: '' });

  if (!supplier) {
    return <div style={{ textAlign: 'center', padding: theme.spacing.xl, color: theme.colors.textMuted }}>Laden...</div>;
  }

  const leistungen = supplier.leistungen || [];
  const abteilungen = config?.abteilungen || [];

  const handleAdd = async () => {
    try {
      const updated = await addLeistung(supplier.id, addForm);
      onUpdate(updated);
      setShowAddForm(false);
      setAddForm({ bezeichnung: '', abteilung: '', beschreibung: '', team_id: '' });
    } catch (err) {
      console.error('Error adding Leistung:', err);
    }
  };

  const handleDelete = async (leistId) => {
    try {
      const updated = await deleteLeistung(supplier.id, leistId);
      onUpdate(updated);
      if (expandedId === leistId) setExpandedId(null);
    } catch (err) {
      console.error('Error deleting Leistung:', err);
    }
  };

  const handleBiaSave = async (leistId, biaValues) => {
    try {
      const updated = await updateBia(supplier.id, leistId, biaValues);
      onUpdate(updated);
      setEditingBiaId(null);
    } catch (err) {
      console.error('Error updating BIA:', err);
    }
  };

  const handleTeamChange = async (leistId, teamId) => {
    try {
      const updated = await updateLeistung(supplier.id, leistId, { team_id: teamId || null });
      onUpdate(updated);
    } catch (err) {
      console.error('Error updating team:', err);
    }
  };

  const getTeamName = (teamId) => {
    if (!teamId) return null;
    return teams.find((t) => t.id === teamId)?.name || teamId;
  };

  const getStatusStyle = (status) => {
    return status === 'active' ? styles.statusActive : styles.statusInactive;
  };

  const formatBiaValue = (val) => {
    if (!val) return '-';
    return val.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>Leistungen ({leistungen.length})</span>
        <button style={styles.btnPrimary} onClick={() => setShowAddForm(true)}>
          + Leistung hinzufuegen
        </button>
      </div>

      {showAddForm && (
        <div style={styles.formCard}>
          <div style={styles.formTitle}>Neue Leistung</div>
          <div style={styles.field}>
            <label style={styles.label}>Bezeichnung</label>
            <input
              style={styles.input}
              value={addForm.bezeichnung}
              onChange={(e) => setAddForm({ ...addForm, bezeichnung: e.target.value })}
              placeholder="Name der Leistung"
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Abteilung</label>
            <select
              style={styles.select}
              value={addForm.abteilung}
              onChange={(e) => setAddForm({ ...addForm, abteilung: e.target.value })}
            >
              <option value="">-- Waehlen --</option>
              {abteilungen.map((abt) => (
                <option key={abt} value={abt}>{abt}</option>
              ))}
            </select>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Verantwortliches Team</label>
            <select
              style={styles.select}
              value={addForm.team_id}
              onChange={(e) => setAddForm({ ...addForm, team_id: e.target.value })}
            >
              <option value="">-- Kein Team --</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Beschreibung</label>
            <textarea
              style={styles.textarea}
              value={addForm.beschreibung}
              onChange={(e) => setAddForm({ ...addForm, beschreibung: e.target.value })}
              placeholder="Beschreibung der Leistung"
            />
          </div>
          <div style={styles.actions}>
            <button style={styles.btnSecondary} onClick={() => { setShowAddForm(false); setAddForm({ bezeichnung: '', abteilung: '', beschreibung: '', team_id: '' }); }}>
              Abbrechen
            </button>
            <button style={styles.btnPrimary} onClick={handleAdd} disabled={!addForm.bezeichnung}>
              Hinzufuegen
            </button>
          </div>
        </div>
      )}

      {leistungen.length === 0 && !showAddForm && (
        <div style={styles.empty}>Keine Leistungen vorhanden.</div>
      )}

      {leistungen.map((leistung) => {
        const isExpanded = expandedId === leistung.id;
        const isEditingBia = editingBiaId === leistung.id;
        const bia = leistung.risikobewertung?.bia || {};
        const np = leistung.risikobewertung?.naechste_pruefung;
        const isOverdue = np && new Date(np) < new Date();

        return (
          <div key={leistung.id} style={styles.card}>
            <div
              style={styles.cardHeader}
              onClick={() => setExpandedId(isExpanded ? null : leistung.id)}
            >
              <div style={styles.cardLeft}>
                <div style={{ minWidth: 0 }}>
                  <div style={styles.cardName}>{leistung.bezeichnung}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md, flexWrap: 'wrap', marginTop: 2 }}>
                    <span style={styles.cardMeta}>{leistung.abteilung || '-'}</span>
                    {getTeamName(leistung.team_id) && (
                      <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.primary }}>
                        {getTeamName(leistung.team_id)}
                      </span>
                    )}
                    {np && (
                      <span style={{ fontSize: theme.typography.sizes.xs, color: isOverdue ? theme.colors.error : theme.colors.textMuted }}>
                        {isOverdue ? 'Review ueberfaellig: ' : 'Review: '}
                        {new Date(np).toLocaleDateString('de-DE')}
                      </span>
                    )}
                  </div>
                </div>
                <span style={{ ...styles.statusBadge, ...getStatusStyle(leistung.status) }}>
                  {leistung.status === 'active' ? 'Aktiv' : 'Inaktiv'}
                </span>
                {bia.ergebnis && <RiskBadge level={bia.ergebnis} size="small" />}
                {leistung.risikobewertung?.dora_relevant && <span style={styles.doraTag}>DORA</span>}
              </div>
              <span style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm }}>
                {isExpanded ? '\u25B2' : '\u25BC'}
              </span>
            </div>

            {isExpanded && (
              <div style={styles.cardBody}>
                {leistung.beschreibung && (
                  <div style={styles.section}>
                    <div style={styles.sectionTitle}>Beschreibung</div>
                    <div style={styles.description}>{leistung.beschreibung}</div>
                  </div>
                )}

                <div style={styles.section}>
                  <div style={styles.sectionTitle}>Verantwortliches Team</div>
                  <select
                    style={styles.select}
                    value={leistung.team_id || ''}
                    onChange={(e) => handleTeamChange(leistung.id, e.target.value)}
                  >
                    <option value="">-- Kein Team --</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div style={styles.section}>
                  <div style={styles.sectionTitle}>Business Impact Analyse (BIA)</div>
                  {isEditingBia ? (
                    <BiaForm
                      bia={bia}
                      config={config}
                      onSave={(values) => handleBiaSave(leistung.id, values)}
                      onCancel={() => setEditingBiaId(null)}
                    />
                  ) : (
                    <>
                      <div style={styles.biaGrid}>
                        {Object.entries(BIA_LABELS).map(([key, label]) => (
                          <div key={key} style={styles.biaItem}>
                            <div style={styles.biaLabel}>{label}</div>
                            <div style={styles.biaValue}>{formatBiaValue(bia[key])}</div>
                          </div>
                        ))}
                        {bia.ergebnis && (
                          <div style={styles.biaItem}>
                            <div style={styles.biaLabel}>Ergebnis</div>
                            <RiskBadge level={bia.ergebnis} />
                          </div>
                        )}
                      </div>
                      {bia.ergebnis && (
                        <div style={{
                          display: 'flex', gap: theme.spacing.xl, marginTop: theme.spacing.md,
                          padding: theme.spacing.md, backgroundColor: theme.colors.surfaceHover,
                          borderRadius: theme.borderRadius.lg, fontSize: theme.typography.sizes.sm,
                        }}>
                          <div>
                            <span style={{ color: theme.colors.textMuted }}>Review-Zyklus: </span>
                            <span style={{ fontWeight: theme.typography.weights.medium, color: theme.colors.text }}>
                              {REVIEW_CYCLE_LABELS[bia.ergebnis] || 'Bei Bedarf'}
                            </span>
                          </div>
                          {np && (
                            <div>
                              <span style={{ color: theme.colors.textMuted }}>Naechste Pruefung: </span>
                              <span style={{
                                fontWeight: theme.typography.weights.medium,
                                color: isOverdue ? theme.colors.error : theme.colors.text,
                              }}>
                                {new Date(np).toLocaleDateString('de-DE')}
                                {isOverdue && ' (ueberfaellig)'}
                              </span>
                            </div>
                          )}
                          {bia.berechnet_am && (
                            <div>
                              <span style={{ color: theme.colors.textMuted }}>BIA berechnet: </span>
                              <span style={{ color: theme.colors.text }}>
                                {new Date(bia.berechnet_am).toLocaleDateString('de-DE')}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      <div style={{ marginTop: theme.spacing.md }}>
                        <button style={styles.btnSecondary} onClick={() => setEditingBiaId(leistung.id)}>
                          BIA bearbeiten
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {leistung.risikobewertung?.dora_relevant !== undefined && (
                  <div style={styles.section}>
                    <div style={styles.sectionTitle}>DORA-Relevanz</div>
                    <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text }}>
                      {leistung.risikobewertung.dora_relevant ? 'Ja - Diese Leistung ist DORA-relevant' : 'Nein'}
                    </div>
                  </div>
                )}

                <div style={styles.cardActions}>
                  <button style={styles.btnDanger} onClick={() => handleDelete(leistung.id)}>
                    Entfernen
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
