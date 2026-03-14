import { useState, useEffect } from 'react';
import { theme } from '../../../../config/theme';
import { useSuppliers } from '../../../../hooks/useSuppliers';
import AuditForm from '../shared/AuditForm';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xl,
  },
  toolbar: {
    display: 'flex',
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  filterSelect: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    fontSize: theme.typography.sizes.base,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    cursor: 'pointer',
    outline: 'none',
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
    whiteSpace: 'nowrap',
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
  sectionCount: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.weights.medium,
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
  bewertungBadge: {
    fontSize: theme.typography.sizes.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
  },
  scopeBadge: {
    fontSize: theme.typography.sizes.xs,
    padding: `2px ${theme.spacing.sm}`,
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
  toggleBtn: {
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    backgroundColor: 'transparent',
    color: theme.colors.textMuted,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
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

const STATUS_STYLES = {
  geplant: { backgroundColor: theme.colors.surfaceHover, color: theme.colors.textMuted },
  in_durchfuehrung: { backgroundColor: theme.colors.infoLight, color: theme.colors.info },
  abgeschlossen: { backgroundColor: theme.colors.successLight, color: theme.colors.success },
  uebersprungen: { backgroundColor: theme.colors.warningLight, color: theme.colors.warning },
};

const STATUS_LABELS = {
  geplant: 'Geplant',
  in_durchfuehrung: 'In Durchfuehrung',
  abgeschlossen: 'Abgeschlossen',
  uebersprungen: 'Uebersprungen',
};

const BEWERTUNG_STYLES = {
  bestanden: { backgroundColor: theme.colors.successLight, color: theme.colors.success },
  bestanden_mit_auflagen: { backgroundColor: theme.colors.warningLight, color: theme.colors.warning },
  nicht_bestanden: { backgroundColor: theme.colors.errorLight, color: theme.colors.error },
};

const BEWERTUNG_LABELS = {
  bestanden: 'Bestanden',
  bestanden_mit_auflagen: 'Mit Auflagen',
  nicht_bestanden: 'Nicht bestanden',
};

const FALLBACK_TYP_LABELS = {
  vertragspruefung: 'Vertragspruefung',
  soc_bericht: 'SOC-Bericht',
  bonitaetspruefung: 'Bonitaetspruefung',
  interview: 'Interview',
  vor_ort_pruefung: 'Vor-Ort-Pruefung',
  dokumentenpruefung: 'Dokumentenpruefung',
};

export default function AuditsListTab({ config }) {
  const { getAudits, createAudit, suppliers, isLoading: suppliersLoading } = useSuppliers();
  const teams = config?.teams || [];
  const scopes = config?.pruefungs_scopes || [];
  const auditTypen = config?.audit_typen || [];

  const [audits, setAudits] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [scopeFilter, setScopeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const loadAudits = async () => {
    try {
      setIsLoading(true);
      const data = await getAudits({});
      setAudits(data || []);
    } catch (err) {
      console.error('Audits load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAudits();
  }, []);

  const handleCreateAudit = async (values) => {
    try {
      await createAudit(values);
      setShowModal(false);
      loadAudits();
    } catch (err) {
      console.error('Create audit error:', err);
    }
  };

  // Lookups
  const supplierMap = {};
  (suppliers || []).forEach((s) => { supplierMap[s.id] = s; });

  const getSupplierName = (audit) => {
    const s = supplierMap[audit.supplier_id];
    return s ? s.firmenname : '-';
  };

  const getLeistungName = (audit) => {
    const s = supplierMap[audit.supplier_id];
    if (s) {
      const l = s.leistungen?.find((x) => x.id === audit.leistung_id);
      if (l) return l.bezeichnung;
    }
    return '-';
  };

  const getTypLabel = (typId) => {
    const fromConfig = auditTypen.find((t) => t.id === typId);
    return fromConfig?.label || FALLBACK_TYP_LABELS[typId] || typId;
  };

  const getScopeLabel = (scopeId) => {
    if (!scopeId) return null;
    return scopes.find((s) => s.id === scopeId)?.label || scopeId.replace(/_/g, ' ');
  };

  const getTeamName = (teamId) => {
    if (!teamId) return null;
    return teams.find((t) => t.id === teamId)?.name || teamId;
  };

  // All leistungen for create modal
  const allLeistungen = [];
  (suppliers || []).forEach((s) => {
    (s.leistungen || []).forEach((l) => {
      allLeistungen.push({ ...l, supplier_name: s.firmenname, supplier_id: s.id });
    });
  });

  // Split, filter, and sort
  const activeStatuses = ['geplant', 'in_durchfuehrung'];
  const sortByDateAsc = (a, b) => {
    const da = a.geplant_fuer || '';
    const db = b.geplant_fuer || '';
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return new Date(da).getTime() - new Date(db).getTime();
  };
  const sortByDateDesc = (a, b) => {
    const da = a.geplant_fuer || a.durchgefuehrt_am || '';
    const db = b.geplant_fuer || b.durchgefuehrt_am || '';
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return new Date(db).getTime() - new Date(da).getTime();
  };

  const matchesScope = (a) => !scopeFilter || a.scope === scopeFilter;
  const matchesStatus = (a) => !statusFilter || a.status === statusFilter;

  const activeAudits = audits
    .filter((a) => activeStatuses.includes(a.status) && matchesScope(a) && matchesStatus(a))
    .sort(sortByDateAsc);

  const completedAudits = audits
    .filter((a) => !activeStatuses.includes(a.status) && matchesScope(a) && matchesStatus(a))
    .sort(sortByDateDesc);

  if (isLoading && suppliersLoading) {
    return <div style={styles.loading}>Laden...</div>;
  }

  const renderTable = (items, showBewertung = false) => (
    <div style={styles.table}>
      <div style={styles.headerRow}>
        <span style={{ ...styles.headerCell, flex: 2 }}>Lieferant</span>
        <span style={{ ...styles.headerCell, flex: 1.5 }}>Leistung</span>
        <span style={{ ...styles.headerCell, width: 120 }}>Typ</span>
        <span style={{ ...styles.headerCell, width: 110 }}>Scope</span>
        <span style={{ ...styles.headerCell, width: 100 }}>Team</span>
        <span style={{ ...styles.headerCell, width: 100 }}>Status</span>
        <span style={{ ...styles.headerCell, width: 100 }}>Geplant</span>
        {showBewertung && (
          <span style={{ ...styles.headerCell, width: 110 }}>Bewertung</span>
        )}
      </div>

      {items.length === 0 ? (
        <div style={styles.emptyText}>Keine Pruefungen</div>
      ) : (
        items.map((audit) => {
          const isOverdue = audit.geplant_fuer && audit.status === 'geplant'
            && new Date(audit.geplant_fuer) < new Date();
          return (
            <div key={audit.id} style={styles.dataRow}>
              <span style={{ ...styles.cell, flex: 2, fontWeight: theme.typography.weights.medium }}>
                {getSupplierName(audit)}
              </span>
              <span style={{ ...styles.cellMuted, flex: 1.5 }}>
                {getLeistungName(audit)}
              </span>
              <span style={{ ...styles.cellMuted, width: 120 }}>
                {getTypLabel(audit.typ)}
              </span>
              <span style={{ width: 110 }}>
                {getScopeLabel(audit.scope) ? (
                  <span style={{
                    ...styles.scopeBadge,
                    backgroundColor: audit.scope === 'compliance_pruefung' ? theme.colors.warningLight : theme.colors.primaryLight,
                    color: audit.scope === 'compliance_pruefung' ? theme.colors.warning : theme.colors.primary,
                  }}>
                    {getScopeLabel(audit.scope)}
                  </span>
                ) : (
                  <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>-</span>
                )}
              </span>
              <span style={{ ...styles.cellMuted, width: 100 }}>
                {getTeamName(audit.team_id) || '-'}
              </span>
              <span style={{ width: 100 }}>
                <span style={{
                  ...styles.statusBadge,
                  ...(STATUS_STYLES[audit.status] || STATUS_STYLES.geplant),
                }}>
                  {STATUS_LABELS[audit.status] || audit.status}
                </span>
              </span>
              <span style={{
                ...styles.cellMuted,
                width: 100,
                color: isOverdue ? theme.colors.error : undefined,
                fontWeight: isOverdue ? theme.typography.weights.medium : undefined,
              }}>
                {audit.geplant_fuer
                  ? new Date(audit.geplant_fuer).toLocaleDateString('de-DE')
                  : '-'}
              </span>
              {showBewertung && (
                <span style={{ width: 110 }}>
                  {audit.bewertung ? (
                    <span style={{
                      ...styles.bewertungBadge,
                      ...(BEWERTUNG_STYLES[audit.bewertung] || {}),
                    }}>
                      {BEWERTUNG_LABELS[audit.bewertung] || audit.bewertung}
                    </span>
                  ) : (
                    <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>-</span>
                  )}
                </span>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <div style={styles.container}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <select
          style={styles.filterSelect}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Alle Status</option>
          <option value="geplant">Geplant</option>
          <option value="in_durchfuehrung">In Durchfuehrung</option>
          <option value="abgeschlossen">Abgeschlossen</option>
          <option value="uebersprungen">Uebersprungen</option>
        </select>
        <select
          style={styles.filterSelect}
          value={scopeFilter}
          onChange={(e) => setScopeFilter(e.target.value)}
        >
          <option value="">Alle Scopes</option>
          {scopes.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        <div style={{ flex: 1 }} />
        <button style={styles.btnPrimary} onClick={() => setShowModal(true)}>
          Neue Pruefung
        </button>
      </div>

      {/* Active Audits */}
      <div>
        <div style={{ ...styles.sectionHeader, marginBottom: theme.spacing.md }}>
          <span style={styles.sectionTitle}>Anstehende Pruefungen</span>
          <span style={styles.sectionCount}>{activeAudits.length}</span>
        </div>
        {renderTable(activeAudits)}
      </div>

      {/* Completed Audits */}
      <div>
        <div style={{ ...styles.sectionHeader, marginBottom: theme.spacing.md }}>
          <span style={styles.sectionTitle}>Abgeschlossene Pruefungen</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
            <span style={styles.sectionCount}>{completedAudits.length}</span>
            {completedAudits.length > 0 && (
              <button
                style={styles.toggleBtn}
                onClick={() => setShowCompleted(!showCompleted)}
              >
                {showCompleted ? 'Ausblenden' : 'Anzeigen'}
              </button>
            )}
          </div>
        </div>
        {showCompleted && renderTable(completedAudits, true)}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div style={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>Neue Pruefung erstellen</div>
            <AuditForm
              leistungen={allLeistungen}
              teams={teams}
              scopes={scopes}
              auditTypen={auditTypen}
              onSave={handleCreateAudit}
              onCancel={() => setShowModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
