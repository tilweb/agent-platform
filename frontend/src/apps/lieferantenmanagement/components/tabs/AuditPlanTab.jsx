import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../../../config/theme';
import { useSuppliers } from '../../../../hooks/useSuppliers';
import { apiFetch } from '../../../../utils/apiFetch';
import AuditForm from '../shared/AuditForm';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xl,
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  yearLabel: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    minWidth: '160px',
    textAlign: 'center',
  },
  yearNavBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    backgroundColor: 'transparent',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    cursor: 'pointer',
    color: theme.colors.text,
  },
  btnPrimary: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  btnSecondary: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  table: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
  },
  headerRow: {
    display: 'flex',
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.background,
  },
  headerCell: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  dataRow: {
    display: 'flex',
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    borderBottom: `1px solid ${theme.colors.borderLight}`,
    alignItems: 'center',
  },
  cell: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
  },
  cellMuted: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  statusBadge: {
    fontSize: theme.typography.sizes.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
  },
  loading: {
    textAlign: 'center',
    padding: theme.spacing['2xl'],
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
  emptyText: {
    textAlign: 'center',
    padding: theme.spacing['2xl'],
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
  error: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.error,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.errorLight,
    borderRadius: theme.borderRadius.lg,
  },
  infoCard: {
    backgroundColor: theme.colors.infoLight,
    border: `1px solid ${theme.colors.info}30`,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
  },
};

const PLAN_STATUS_STYLES = {
  offen: { backgroundColor: theme.colors.surfaceHover, color: theme.colors.textMuted },
  teilweise: { backgroundColor: theme.colors.warningLight, color: theme.colors.warning },
  erledigt: { backgroundColor: theme.colors.successLight, color: theme.colors.success },
};

const PLAN_STATUS_LABELS = {
  offen: 'Offen',
  teilweise: 'Teilweise',
  erledigt: 'Erledigt',
};

const BIA_LABELS = {
  very_high: 'Sehr hoch',
  high: 'Hoch',
  medium: 'Mittel',
  low: 'Niedrig',
};

const SCOPE_CONFIG = {
  fachpruefung: { label: 'Fachpruefung', color: theme.colors.info, bgColor: theme.colors.infoLight },
  compliance_pruefung: { label: 'Compliance-Pruefung', color: theme.colors.warning, bgColor: theme.colors.warningLight },
};

function FachIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  );
}

function ComplianceIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

const SCOPE_ICONS = {
  fachpruefung: FachIcon,
  compliance_pruefung: ComplianceIcon,
};

export default function AuditPlanTab({ config }) {
  const { getAuditPlan, generateAuditPlan, createAudit } = useSuppliers();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showModal, setShowModal] = useState(false);
  const [modalPrefill, setModalPrefill] = useState(null);

  const teams = config?.teams || [];
  const scopes = config?.pruefungs_scopes || [];
  const auditTypen = config?.audit_typen || [];

  const loadPlan = async () => {
    setIsLoading(true);
    try {
      const data = await getAuditPlan(selectedYear);
      setPlan(data);
    } catch (err) {
      console.error('Audit plan load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    setPlan(null);
    setIsLoading(true);
    (async () => {
      try {
        const data = await getAuditPlan(selectedYear);
        if (mounted) setPlan(data);
      } catch (err) {
        console.error('Audit plan load error:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [getAuditPlan, selectedYear]);

  const handleScopeClick = (entry, scope) => {
    const existing = entry.vorhandene_audits?.[scope];
    if (existing) {
      // Audit exists → navigate to supplier detail Pruefungen tab
      navigate(`/apps/lieferantenmanagement/${entry.supplier_id}?tab=pruefungen`);
    } else {
      // No audit → open create modal pre-filled
      setModalPrefill({
        supplier_id: entry.supplier_id,
        leistung_id: entry.leistung_id,
        scope,
        geplant_fuer: `${selectedYear}-01-01`,
      });
      setShowModal(true);
    }
  };

  const handleCreateFromPlan = async (values) => {
    try {
      await createAudit(values);
      setShowModal(false);
      setModalPrefill(null);
      loadPlan();
    } catch (err) {
      console.error('Error creating audit:', err);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const data = await generateAuditPlan(selectedYear);
      setPlan(data);
    } catch (err) {
      setError(err.message || 'Fehler beim Generieren des Auditplans.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return <div style={styles.loading}>Laden...</div>;
  }

  const entries = plan?.entries || [];
  const currentYear = new Date().getFullYear();

  return (
    <div style={styles.container}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
          <button
            style={styles.yearNavBtn}
            onClick={() => setSelectedYear((y) => y - 1)}
            title="Vorheriges Jahr"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <span style={styles.yearLabel}>Auditplan {selectedYear}</span>
          <button
            style={styles.yearNavBtn}
            onClick={() => setSelectedYear((y) => y + 1)}
            title="Naechstes Jahr"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
          </button>
          {selectedYear !== currentYear && (
            <button
              style={{ ...styles.yearNavBtn, fontSize: theme.typography.sizes.xs, width: 'auto', padding: `${theme.spacing.xs} ${theme.spacing.md}` }}
              onClick={() => setSelectedYear(currentYear)}
            >
              Heute
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: theme.spacing.md }}>
          {plan && (
            <button
              style={styles.btnSecondary}
              onClick={async () => {
                try {
                  const res = await apiFetch(`/apps/lieferantenmanagement/export/audit-plan/${selectedYear}/csv`);
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `auditplan-${selectedYear}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch (err) {
                  console.error('CSV export error:', err);
                }
              }}
            >
              CSV Export
            </button>
          )}
          <button
            style={styles.btnPrimary}
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generiere...' : plan ? 'Plan neu generieren' : 'Plan generieren'}
          </button>
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {!plan ? (
        <div style={styles.infoCard}>
          Kein Auditplan fuer {selectedYear} vorhanden. Klicken Sie auf "Plan generieren", um einen neuen Plan zu erstellen.
        </div>
      ) : (
        <div style={styles.table}>
          <div style={styles.headerRow}>
            <span style={{ ...styles.headerCell, flex: 2 }}>Lieferant</span>
            <span style={{ ...styles.headerCell, flex: 1.5 }}>Leistung</span>
            <span style={{ ...styles.headerCell, width: 90 }}>BIA-Stufe</span>
            <span style={{ ...styles.headerCell, width: 80 }}>Pruefungen</span>
            <span style={{ ...styles.headerCell, width: 100 }}>Status</span>
          </div>

          {entries.length === 0 ? (
            <div style={styles.emptyText}>Keine Eintraege im Auditplan</div>
          ) : (
            entries.map((entry, i) => {
              const requiredScopes = entry.erforderliche_scopes || [];
              const erledigteScopes = new Set(entry.erledigte_scopes || []);
              return (
                <div key={i} style={styles.dataRow}>
                  <span style={{ ...styles.cell, flex: 2, fontWeight: theme.typography.weights.medium }}>
                    {entry.supplier_name || '-'}
                  </span>
                  <span style={{ ...styles.cellMuted, flex: 1.5 }}>
                    {entry.service_name || '-'}
                  </span>
                  <span style={{ ...styles.cellMuted, width: 90 }}>
                    {BIA_LABELS[entry.bia_level] || entry.bia_level || '-'}
                  </span>
                  <span style={{ width: 80, display: 'flex', gap: theme.spacing.sm, alignItems: 'center' }}>
                    {requiredScopes.map((scope) => {
                      const done = erledigteScopes.has(scope);
                      const cfg = SCOPE_CONFIG[scope] || { label: scope, color: theme.colors.textMuted, bgColor: theme.colors.surfaceHover };
                      const IconComp = SCOPE_ICONS[scope];
                      return (
                        <span
                          key={scope}
                          title={`${cfg.label}${done ? ' (erledigt) — Zum Lieferanten' : entry.vorhandene_audits?.[scope] ? ' (angelegt) — Zum Lieferanten' : ' — Pruefung anlegen'}`}
                          onClick={() => handleScopeClick(entry, scope)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            width: 28,
                            height: 28,
                            borderRadius: theme.borderRadius.md,
                            backgroundColor: done ? theme.colors.successLight : cfg.bgColor,
                            cursor: 'pointer',
                          }}>
                          {IconComp && <IconComp size={16} color={done ? theme.colors.success : cfg.color} />}
                          {done && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={theme.colors.success} strokeWidth="3" style={{
                              position: 'absolute', bottom: -2, right: -2,
                              backgroundColor: theme.colors.successLight,
                              borderRadius: theme.borderRadius.full,
                              padding: 1,
                            }}>
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          )}
                        </span>
                      );
                    })}
                    {requiredScopes.length === 0 && (
                      <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>-</span>
                    )}
                  </span>
                  <span style={{ width: 100 }}>
                    <span style={{
                      ...styles.statusBadge,
                      ...(PLAN_STATUS_STYLES[entry.status] || PLAN_STATUS_STYLES.offen),
                    }}>
                      {PLAN_STATUS_LABELS[entry.status] || entry.status || 'Offen'}
                    </span>
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}

      {showModal && modalPrefill && (
        <div style={modalStyles.overlay} onClick={() => { setShowModal(false); setModalPrefill(null); }}>
          <div style={modalStyles.content} onClick={(e) => e.stopPropagation()}>
            <div style={modalStyles.title}>Pruefung anlegen</div>
            <AuditForm
              audit={modalPrefill}
              supplierId={modalPrefill.supplier_id}
              teams={teams}
              scopes={scopes}
              auditTypen={auditTypen}
              onSave={handleCreateFromPlan}
              onCancel={() => { setShowModal(false); setModalPrefill(null); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const modalStyles = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  content: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    maxWidth: '700px',
    width: '90%',
    maxHeight: '90vh',
    overflow: 'auto',
    padding: theme.spacing.xl,
  },
  title: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xl,
  },
};
