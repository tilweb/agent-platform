import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../../../config/theme';
import { useSuppliers } from '../../../../hooks/useSuppliers';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
  },
  title: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xl,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: theme.spacing.lg,
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },
  statHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  statPercent: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
  },
  barContainer: {
    width: '100%',
    height: 12,
    backgroundColor: theme.colors.borderLight,
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: theme.borderRadius.full,
    transition: `width ${theme.transitions.slow}`,
  },
  statDetail: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  // Table styles
  tableCard: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
  },
  tableTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    padding: theme.spacing.xl,
    paddingBottom: 0,
    marginBottom: theme.spacing.md,
  },
  headerRow: {
    display: 'flex',
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.background,
    gap: theme.spacing.md,
    alignItems: 'center',
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
    gap: theme.spacing.md,
    alignItems: 'center',
    cursor: 'pointer',
    transition: `background-color ${theme.transitions.fast}`,
  },
  cellText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
  },
  cellMuted: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  // Column widths
  colSupplier: { flex: 2 },
  colLeistung: { flex: 2 },
  colPbd: { width: 50, textAlign: 'center' },
  colDoc: { width: 70, textAlign: 'center' },
  // Indicator styles
  indicator: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
  },
  // Filter
  filterRow: {
    display: 'flex',
    gap: theme.spacing.md,
    padding: `0 ${theme.spacing.xl}`,
    marginBottom: theme.spacing.md,
  },
  filterSelect: {
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    fontSize: theme.typography.sizes.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    cursor: 'pointer',
    outline: 'none',
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

function getBarColor(pct) {
  if (pct >= 80) return theme.colors.success;
  if (pct >= 50) return theme.colors.warning;
  return theme.colors.error;
}

function StatBar({ label, count, total }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const color = getBarColor(pct);

  return (
    <div style={styles.statItem}>
      <div style={styles.statHeader}>
        <span style={styles.statLabel}>{label}</span>
        <span style={{ ...styles.statPercent, color }}>{pct}%</span>
      </div>
      <div style={styles.barContainer}>
        <div style={{ ...styles.bar, width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span style={styles.statDetail}>{count} von {total}</span>
    </div>
  );
}

function StatusIcon({ status }) {
  if (status === 'erfuellt') {
    return (
      <span style={styles.indicator} title="Vorhanden">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.colors.success} strokeWidth="3">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </span>
    );
  }
  if (status === 'abgelaufen') {
    return (
      <span style={styles.indicator} title="Abgelaufen">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.colors.warning} strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      </span>
    );
  }
  if (status === 'fehlend') {
    return (
      <span style={styles.indicator} title="Fehlend (erforderlich)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.colors.error} strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </span>
    );
  }
  // nicht_vorhanden
  return (
    <span style={styles.indicator} title="Nicht vorhanden">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.colors.textMuted} strokeWidth="2">
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </span>
  );
}

function PbdIcon({ active }) {
  if (active) {
    return (
      <span style={styles.indicator} title="Personenbezogene Daten">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.colors.primary} strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </span>
    );
  }
  return (
    <span style={styles.indicator} title="Keine personenbezogenen Daten">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.colors.textMuted} strokeWidth="2">
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </span>
  );
}

const FILTER_OPTIONS = [
  { value: '', label: 'Alle Status' },
  { value: 'fehlend', label: 'Fehlend' },
  { value: 'abgelaufen', label: 'Abgelaufen' },
  { value: 'erfuellt', label: 'Vorhanden' },
  { value: 'nicht_vorhanden', label: 'Nicht vorhanden' },
];

export default function ComplianceTab() {
  const { getComplianceStats } = useSuppliers();
  const navigate = useNavigate();
  const [compliance, setCompliance] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const data = await getComplianceStats();
        if (mounted) setCompliance(data);
      } catch (err) {
        console.error('Compliance load error:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [getComplianceStats]);

  if (isLoading) {
    return <div style={styles.loading}>Laden...</div>;
  }

  if (!compliance) {
    return <div style={styles.emptyText}>Keine Compliance-Daten vorhanden</div>;
  }

  const total = compliance.total_services || 0;
  const details = compliance.details || [];

  // Filter details
  const filteredDetails = statusFilter
    ? details.filter((d) =>
      d.avv_status === statusFilter ||
      d.nda_status === statusFilter ||
      d.rahmenvertrag_status === statusFilter
    )
    : details;

  return (
    <div style={styles.container}>
      {/* Stats Card */}
      <div style={styles.card}>
        <div style={styles.title}>Vertragsabdeckung</div>
        <div style={styles.statsGrid}>
          <StatBar
            label="AVV vorhanden"
            count={compliance.avv_count || 0}
            total={total}
          />
          <StatBar
            label="NDA vorhanden"
            count={compliance.nda_count || 0}
            total={total}
          />
          <StatBar
            label="Rahmenvertrag vorhanden"
            count={compliance.rahmenvertrag_count || 0}
            total={total}
          />
          <StatBar
            label="Personenbezug"
            count={compliance.personenbezug_count || 0}
            total={total}
          />
        </div>
      </div>

      {/* Detail Table */}
      {details.length > 0 && (
        <div style={styles.tableCard}>
          <div style={styles.tableTitle}>Regulatorik-Uebersicht</div>

          <div style={styles.filterRow}>
            <select
              style={styles.filterSelect}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, alignSelf: 'center' }}>
              {filteredDetails.length} von {details.length} Leistungen
            </span>
          </div>

          {/* Header */}
          <div style={styles.headerRow}>
            <span style={{ ...styles.headerCell, ...styles.colSupplier }}>Lieferant</span>
            <span style={{ ...styles.headerCell, ...styles.colLeistung }}>Leistung</span>
            <span style={{ ...styles.headerCell, ...styles.colPbd }}>pbD</span>
            <span style={{ ...styles.headerCell, ...styles.colDoc }}>AVV</span>
            <span style={{ ...styles.headerCell, ...styles.colDoc }}>NDA</span>
            <span style={{ ...styles.headerCell, ...styles.colDoc }}>RV</span>
          </div>

          {/* Rows */}
          {filteredDetails.map((item, i) => (
            <div
              key={`${item.supplier_id}-${item.leistung_id}`}
              style={styles.dataRow}
              onClick={() => navigate(`/apps/lieferantenmanagement/${item.supplier_id}?tab=regulatorik`)}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surfaceHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <span style={{ ...styles.cellText, ...styles.colSupplier, fontWeight: theme.typography.weights.medium }}>
                {item.firmenname}
              </span>
              <span style={{ ...styles.cellMuted, ...styles.colLeistung }}>
                {item.bezeichnung}
              </span>
              <span style={styles.colPbd}>
                <PbdIcon active={item.personenbezogene_daten} />
              </span>
              <span style={styles.colDoc}>
                <StatusIcon status={item.avv_status} />
              </span>
              <span style={styles.colDoc}>
                <StatusIcon status={item.nda_status} />
              </span>
              <span style={styles.colDoc}>
                <StatusIcon status={item.rahmenvertrag_status} />
              </span>
            </div>
          ))}

          {filteredDetails.length === 0 && (
            <div style={styles.emptyText}>Keine Eintraege fuer diesen Filter</div>
          )}
        </div>
      )}
    </div>
  );
}
