import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../../../config/theme';
import RiskBadge from '../shared/RiskBadge';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  },
  toolbar: {
    display: 'flex',
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    fontSize: theme.typography.sizes.base,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
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
  table: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
  },
  headerRow: {
    display: 'flex',
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
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
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    borderBottom: `1px solid ${theme.colors.borderLight}`,
    alignItems: 'center',
    cursor: 'pointer',
    transition: `background-color ${theme.transitions.fast}`,
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
};

const STATUS_STYLES = {
  active: { backgroundColor: theme.colors.successLight, color: theme.colors.success },
  inactive: { backgroundColor: theme.colors.warningLight, color: theme.colors.warning },
  beendet: { backgroundColor: theme.colors.errorLight, color: theme.colors.error },
};

const STATUS_LABELS = {
  active: 'Aktiv',
  inactive: 'Inaktiv',
  beendet: 'Beendet',
};

const COL_WIDTHS = {
  name: { flex: 2 },
  status: { width: 120 },
  risk: { width: 120 },
  services: { width: 100, textAlign: 'center' },
  updated: { width: 120 },
};

export default function SuppliersListTab({ suppliers, isLoading, onRefresh, config, initialFilters = {} }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialFilters.status || '');
  const [riskFilter, setRiskFilter] = useState(initialFilters.risk || '');
  const [doraFilter, setDoraFilter] = useState(initialFilters.dora || '');

  // Sync filters when navigating from dashboard with new params
  useEffect(() => {
    setStatusFilter(initialFilters.status || '');
    setRiskFilter(initialFilters.risk || '');
    setDoraFilter(initialFilters.dora || '');
  }, [initialFilters.status, initialFilters.risk, initialFilters.dora]);

  const filtered = (suppliers || []).filter((s) => {
    if (search && !s.firmenname?.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && s.status !== statusFilter) return false;
    if (riskFilter && s.gesamtrisiko !== riskFilter) return false;
    if (doraFilter === 'true') {
      const hasDora = s.leistungen?.some((l) => l.risikobewertung?.dora_relevant || l.regulatorik?.dora_relevant || l.dora_relevant);
      if (!hasDora) return false;
    }
    return true;
  });

  if (isLoading) {
    return <div style={styles.loading}>Laden...</div>;
  }

  return (
    <div style={styles.container}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <input
          style={styles.searchInput}
          type="text"
          placeholder="Lieferant suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          style={styles.filterSelect}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Alle Status</option>
          <option value="active">Aktiv</option>
          <option value="inactive">Inaktiv</option>
          <option value="beendet">Beendet</option>
        </select>
        <select
          style={styles.filterSelect}
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
        >
          <option value="">Alle Risikostufen</option>
          <option value="very_high">Sehr hoch</option>
          <option value="high">Hoch</option>
          <option value="medium">Mittel</option>
          <option value="low">Niedrig</option>
        </select>
        <select
          style={styles.filterSelect}
          value={doraFilter}
          onChange={(e) => setDoraFilter(e.target.value)}
        >
          <option value="">DORA: Alle</option>
          <option value="true">DORA-relevant</option>
        </select>
      </div>

      {/* Table */}
      <div style={styles.table}>
        <div style={styles.headerRow}>
          <span style={{ ...styles.headerCell, ...COL_WIDTHS.name }}>Firmenname</span>
          <span style={{ ...styles.headerCell, ...COL_WIDTHS.status }}>Status</span>
          <span style={{ ...styles.headerCell, ...COL_WIDTHS.risk }}>Gesamtrisiko</span>
          <span style={{ ...styles.headerCell, ...COL_WIDTHS.services }}>Leistungen</span>
          <span style={{ ...styles.headerCell, ...COL_WIDTHS.updated }}>Aktualisiert</span>
        </div>

        {filtered.length === 0 ? (
          <div style={styles.emptyText}>Keine Lieferanten gefunden</div>
        ) : (
          filtered.map((supplier) => (
            <div
              key={supplier.id}
              style={styles.dataRow}
              onClick={() => navigate(`/apps/lieferantenmanagement/${supplier.id}`)}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surfaceHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <span style={{ ...styles.cell, ...COL_WIDTHS.name, fontWeight: theme.typography.weights.medium }}>
                {supplier.firmenname}
              </span>
              <span style={COL_WIDTHS.status}>
                <span style={{
                  ...styles.statusBadge,
                  ...(STATUS_STYLES[supplier.status] || STATUS_STYLES.inactive),
                }}>
                  {STATUS_LABELS[supplier.status] || supplier.status}
                </span>
              </span>
              <span style={COL_WIDTHS.risk}>
                {supplier.gesamtrisiko ? (
                  <RiskBadge level={supplier.gesamtrisiko} size="small" />
                ) : (
                  <span style={styles.cellMuted}>-</span>
                )}
              </span>
              <span style={{ ...styles.cellMuted, ...COL_WIDTHS.services }}>
                {supplier.leistungen?.length || 0}
              </span>
              <span style={{ ...styles.cellMuted, ...COL_WIDTHS.updated }}>
                {supplier.updated_at
                  ? new Date(supplier.updated_at).toLocaleDateString('de-DE')
                  : '-'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
