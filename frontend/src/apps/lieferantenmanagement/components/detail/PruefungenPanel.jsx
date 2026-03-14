import { useState, useEffect } from 'react';
import { theme } from '../../../../config/theme';
import { useSuppliers } from '../../../../hooks/useSuppliers';
import AuditForm from '../shared/AuditForm';

const BEWERTUNG_COLORS = {
  bestanden: { backgroundColor: theme.colors.successLight, color: theme.colors.success },
  bestanden_mit_auflagen: { backgroundColor: theme.colors.warningLight, color: theme.colors.warning },
  nicht_bestanden: { backgroundColor: theme.colors.errorLight, color: theme.colors.error },
};

const BEWERTUNG_LABELS = {
  bestanden: 'Bestanden',
  bestanden_mit_auflagen: 'Mit Auflagen',
  nicht_bestanden: 'Nicht bestanden',
};

const STATUS_LABELS = {
  geplant: 'Geplant',
  in_durchfuehrung: 'In Durchfuehrung',
  abgeschlossen: 'Abgeschlossen',
  uebersprungen: 'Uebersprungen',
};

const TYP_LABELS = {
  vertragspruefung: 'Vertragspruefung',
  soc_bericht: 'SOC-Bericht',
  bonitaetspruefung: 'Bonitaetspruefung',
  interview: 'Interview',
  vor_ort_pruefung: 'Vor-Ort-Pruefung',
  dokumentenpruefung: 'Dokumentenpruefung',
};

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
    padding: theme.spacing.xl,
  },
  auditRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${theme.spacing.lg} 0`,
    borderBottom: `1px solid ${theme.colors.borderLight}`,
  },
  auditLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.lg,
    flex: 1,
  },
  auditInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
  },
  auditTyp: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  auditMeta: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    display: 'flex',
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  auditNotizen: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    maxWidth: 400,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  statusBadge: {
    display: 'inline-block',
    fontSize: theme.typography.sizes.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
  },
  bewertungBadge: {
    display: 'inline-block',
    fontSize: theme.typography.sizes.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
  },
  auditActions: {
    display: 'flex',
    gap: theme.spacing.sm,
    alignItems: 'center',
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
  btnSmall: {
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    backgroundColor: 'transparent',
    color: theme.colors.primary,
    border: `1px solid ${theme.colors.primary}30`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  btnDanger: {
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    backgroundColor: 'transparent',
    color: theme.colors.error,
    border: `1px solid ${theme.colors.error}30`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  empty: {
    textAlign: 'center',
    padding: theme.spacing['2xl'],
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    maxWidth: '700px',
    width: '90%',
    maxHeight: '90vh',
    overflow: 'auto',
    padding: theme.spacing.xl,
  },
  modalTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xl,
  },
};

export default function PruefungenPanel({ supplier, config }) {
  const { getAudits, createAudit, updateAudit, deleteAudit } = useSuppliers();
  const teams = config?.teams || [];
  const scopes = config?.pruefungs_scopes || [];
  const auditTypen = config?.audit_typen || [];
  const [audits, setAudits] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAudit, setEditingAudit] = useState(null);

  const leistungen = supplier?.leistungen || [];

  const getTeamName = (teamId) => {
    if (!teamId) return null;
    return teams.find((t) => t.id === teamId)?.name || teamId;
  };

  const getScopeLabel = (scopeId) => {
    if (!scopeId) return null;
    return scopes.find((s) => s.id === scopeId)?.label || scopeId.replace(/_/g, ' ');
  };

  const getTypLabel = (typId) => {
    const fromConfig = auditTypen.find((t) => t.id === typId);
    if (fromConfig) return fromConfig.label;
    return TYP_LABELS[typId] || typId;
  };

  const loadAudits = async () => {
    if (!supplier?.id) return;
    try {
      setIsLoading(true);
      const result = await getAudits({ supplier_id: supplier.id });
      setAudits(result || []);
    } catch (err) {
      console.error('Error loading audits:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAudits();
  }, [supplier?.id]);

  const handleCreate = async (values) => {
    try {
      await createAudit({ ...values, supplier_id: supplier.id });
      setShowModal(false);
      loadAudits();
    } catch (err) {
      console.error('Error creating audit:', err);
    }
  };

  const handleUpdate = async (values) => {
    try {
      await updateAudit(editingAudit.id, values);
      setEditingAudit(null);
      loadAudits();
    } catch (err) {
      console.error('Error updating audit:', err);
    }
  };

  const handleDelete = async (auditId) => {
    try {
      await deleteAudit(auditId);
      loadAudits();
    } catch (err) {
      console.error('Error deleting audit:', err);
    }
  };

  if (!supplier) {
    return <div style={{ textAlign: 'center', padding: theme.spacing.xl, color: theme.colors.textMuted }}>Laden...</div>;
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'abgeschlossen': return { backgroundColor: theme.colors.successLight, color: theme.colors.success };
      case 'in_durchfuehrung': return { backgroundColor: theme.colors.infoLight, color: theme.colors.info };
      case 'geplant': return { backgroundColor: theme.colors.surfaceHover, color: theme.colors.textMuted };
      case 'uebersprungen': return { backgroundColor: theme.colors.warningLight, color: theme.colors.warning };
      default: return { backgroundColor: theme.colors.surfaceHover, color: theme.colors.textMuted };
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>Pruefungen ({audits.length})</span>
        <button style={styles.btnPrimary} onClick={() => { setEditingAudit(null); setShowModal(true); }}>
          + Neue Pruefung
        </button>
      </div>

      {isLoading && (
        <div style={styles.empty}>Laden...</div>
      )}

      {!isLoading && audits.length === 0 && (
        <div style={styles.empty}>Keine Pruefungen vorhanden.</div>
      )}

      {!isLoading && audits.length > 0 && (
        <div style={styles.card}>
          {audits.map((audit, idx) => (
            <div
              key={audit.id}
              style={{
                ...styles.auditRow,
                ...(idx === audits.length - 1 ? { borderBottom: 'none' } : {}),
              }}
            >
              <div style={styles.auditLeft}>
                <div style={styles.auditInfo}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                    <span style={styles.auditTyp}>{getTypLabel(audit.typ)}</span>
                    {getScopeLabel(audit.scope) && (
                      <span style={{
                        fontSize: theme.typography.sizes.xs,
                        padding: `2px ${theme.spacing.sm}`,
                        borderRadius: theme.borderRadius.full,
                        fontWeight: theme.typography.weights.medium,
                        backgroundColor: audit.scope === 'compliance_pruefung' ? theme.colors.warningLight : theme.colors.primaryLight,
                        color: audit.scope === 'compliance_pruefung' ? theme.colors.warning : theme.colors.primary,
                      }}>
                        {getScopeLabel(audit.scope)}
                      </span>
                    )}
                  </div>
                  <div style={styles.auditMeta}>
                    <span style={{ ...styles.statusBadge, ...getStatusColor(audit.status) }}>
                      {STATUS_LABELS[audit.status] || audit.status}
                    </span>
                    {getTeamName(audit.team_id) && (
                      <span style={{ color: theme.colors.primary }}>{getTeamName(audit.team_id)}</span>
                    )}
                    {audit.geplant_fuer && (
                      <span>Geplant: {new Date(audit.geplant_fuer).toLocaleDateString('de-DE')}</span>
                    )}
                    {audit.durchgefuehrt_am && (
                      <span>Durchgefuehrt: {new Date(audit.durchgefuehrt_am).toLocaleDateString('de-DE')}</span>
                    )}
                  </div>
                  {audit.bewertung && (
                    <span style={{ ...styles.bewertungBadge, ...(BEWERTUNG_COLORS[audit.bewertung] || {}) }}>
                      {BEWERTUNG_LABELS[audit.bewertung] || audit.bewertung}
                    </span>
                  )}
                  {audit.notizen && (
                    <div style={styles.auditNotizen}>{audit.notizen}</div>
                  )}
                </div>
              </div>
              <div style={styles.auditActions}>
                <button style={styles.btnSmall} onClick={() => { setEditingAudit(audit); setShowModal(true); }}>
                  Bearbeiten
                </button>
                <button style={styles.btnDanger} onClick={() => handleDelete(audit.id)}>
                  Entfernen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div style={styles.modalOverlay} onClick={() => { setShowModal(false); setEditingAudit(null); }}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>
              {editingAudit ? 'Pruefung bearbeiten' : 'Neue Pruefung erstellen'}
            </div>
            <AuditForm
              audit={editingAudit}
              supplierId={supplier.id}
              leistungen={leistungen}
              teams={teams}
              scopes={scopes}
              auditTypen={auditTypen}
              onSave={editingAudit ? handleUpdate : handleCreate}
              onCancel={() => { setShowModal(false); setEditingAudit(null); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
