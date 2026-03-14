import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../../../config/theme';
import { useSuppliers } from '../../../../hooks/useSuppliers';

// Handles both legacy boolean and new string values
function isDora(val) {
  return val === true || val === 'ja';
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xl,
  },
  summaryCard: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    display: 'flex',
    gap: theme.spacing['2xl'],
    alignItems: 'center',
  },
  summaryItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
  },
  summaryLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.weights.medium,
  },
  summaryValue: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  complianceBar: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
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
    backgroundColor: theme.colors.primary,
    transition: `width ${theme.transitions.slow}`,
  },
  barLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  table: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
  },
  tableTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    padding: `${theme.spacing.lg} ${theme.spacing.xl}`,
    borderBottom: `1px solid ${theme.colors.border}`,
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

export default function DoraTab() {
  const navigate = useNavigate();
  const { suppliers, isLoading } = useSuppliers();
  const [doraSuppliers, setDoraSuppliers] = useState([]);
  const [compliancePct, setCompliancePct] = useState(0);

  useEffect(() => {
    const active = (suppliers || []).filter((s) => s.status === 'active');

    // Find DORA-relevant suppliers (any service with dora_relevant flag or regulatorik.dora_relevant)
    const dora = active.filter((s) => {
      return s.leistungen?.some((l) =>
        l.regulatorik?.dora_relevant || l.dora_relevant
      );
    });

    // Calculate compliance: how many have rahmenvertrag_dora_konform
    const konform = dora.filter((s) => {
      return s.leistungen?.some((l) =>
        (l.regulatorik?.dora_relevant || l.dora_relevant) &&
        isDora(l.regulatorik?.rahmenvertrag?.dora_konform)
      );
    });

    setDoraSuppliers(dora);
    setCompliancePct(dora.length > 0 ? Math.round((konform.length / dora.length) * 100) : 0);
  }, [suppliers]);

  if (isLoading) {
    return <div style={styles.loading}>Laden...</div>;
  }

  const konformCount = doraSuppliers.filter((s) =>
    s.leistungen?.some((l) =>
      (l.regulatorik?.dora_relevant || l.dora_relevant) &&
      isDora(l.regulatorik?.rahmenvertrag?.dora_konform)
    )
  ).length;

  return (
    <div style={styles.container}>
      {/* Summary */}
      <div style={styles.summaryCard}>
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>DORA-relevant</span>
          <span style={styles.summaryValue}>{doraSuppliers.length}</span>
        </div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>Konform</span>
          <span style={{ ...styles.summaryValue, color: theme.colors.success }}>{konformCount}</span>
        </div>
        <div style={styles.complianceBar}>
          <div style={styles.barLabel}>
            <span>DORA-Konformitaet</span>
            <span style={{ fontWeight: theme.typography.weights.semibold }}>{compliancePct}%</span>
          </div>
          <div style={styles.barContainer}>
            <div style={{ ...styles.bar, width: `${compliancePct}%` }} />
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={styles.table}>
        <div style={styles.tableTitle}>DORA-relevante Lieferanten</div>
        <div style={styles.headerRow}>
          <span style={{ ...styles.headerCell, flex: 2 }}>Firmenname</span>
          <span style={{ ...styles.headerCell, flex: 1 }}>Leistung</span>
          <span style={{ ...styles.headerCell, width: 160 }}>RV DORA-konform</span>
          <span style={{ ...styles.headerCell, width: 120 }}>Status</span>
        </div>

        {doraSuppliers.length === 0 ? (
          <div style={styles.emptyText}>Keine DORA-relevanten Lieferanten vorhanden</div>
        ) : (
          doraSuppliers.map((supplier) => {
            const doraServices = (supplier.leistungen || []).filter(
              (l) => l.regulatorik?.dora_relevant || l.dora_relevant
            );
            return doraServices.map((service, si) => {
              const doraVal = service.regulatorik?.rahmenvertrag?.dora_konform;
              const isKonform = isDora(doraVal);
              const doraLabel = doraVal === 'nicht_anwendbar' ? 'N/A' : isKonform ? 'Konform' : 'Nicht konform';
              return (
                <div
                  key={`${supplier.id}-${si}`}
                  style={styles.dataRow}
                  onClick={() => navigate(`/apps/lieferantenmanagement/${supplier.id}`)}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surfaceHover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <span style={{ ...styles.cell, flex: 2, fontWeight: theme.typography.weights.medium }}>
                    {si === 0 ? supplier.firmenname : ''}
                  </span>
                  <span style={{ ...styles.cellMuted, flex: 1 }}>
                    {service.bezeichnung || '-'}
                  </span>
                  <span style={{ width: 160 }}>
                    <span style={{
                      ...styles.statusBadge,
                      backgroundColor: isKonform ? theme.colors.successLight : doraVal === 'nicht_anwendbar' ? theme.colors.surfaceHover : theme.colors.errorLight,
                      color: isKonform ? theme.colors.success : doraVal === 'nicht_anwendbar' ? theme.colors.textMuted : theme.colors.error,
                    }}>
                      {doraLabel}
                    </span>
                  </span>
                  <span style={{ ...styles.cellMuted, width: 120 }}>
                    {supplier.status === 'active' ? 'Aktiv' : supplier.status}
                  </span>
                </div>
              );
            });
          })
        )}
      </div>
    </div>
  );
}
