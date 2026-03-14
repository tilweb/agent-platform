import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../../../config/theme';
import RiskBadge from '../shared/RiskBadge';
import { useSuppliers } from '../../../../hooks/useSuppliers';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  },
  section: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  count: {
    fontSize: theme.typography.sizes.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
  },
  suppliersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  supplierCard: {
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.borderLight}`,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  supplierName: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  supplierDetail: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  emptySection: {
    padding: theme.spacing.lg,
    textAlign: 'center',
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
  },
  loading: {
    textAlign: 'center',
    padding: theme.spacing['2xl'],
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
};

const RISK_LEVELS = [
  { key: 'very_high', label: 'Sehr hoch', bg: theme.colors.errorLight, color: theme.colors.error, cardBg: `${theme.colors.error}08` },
  { key: 'high', label: 'Hoch', bg: theme.colors.warningLight, color: theme.colors.warning, cardBg: `${theme.colors.warning}08` },
  { key: 'medium', label: 'Mittel', bg: theme.colors.infoLight, color: theme.colors.info, cardBg: `${theme.colors.info}08` },
  { key: 'low', label: 'Niedrig', bg: theme.colors.successLight, color: theme.colors.success, cardBg: `${theme.colors.success}08` },
];

export default function RiskMatrixTab() {
  const navigate = useNavigate();
  const { suppliers, isLoading } = useSuppliers();
  const [grouped, setGrouped] = useState({});

  useEffect(() => {
    const active = (suppliers || []).filter((s) => s.status === 'active');
    const groups = { very_high: [], high: [], medium: [], low: [], none: [] };
    active.forEach((s) => {
      const level = s.gesamtrisiko || 'none';
      if (groups[level]) {
        groups[level].push(s);
      } else {
        groups.none.push(s);
      }
    });
    setGrouped(groups);
  }, [suppliers]);

  if (isLoading) {
    return <div style={styles.loading}>Laden...</div>;
  }

  return (
    <div style={styles.container}>
      {RISK_LEVELS.map((level) => {
        const items = grouped[level.key] || [];
        return (
          <div key={level.key} style={styles.section}>
            <div style={styles.sectionHeader}>
              <div style={styles.sectionTitle}>
                <RiskBadge level={level.key} />
                <span>{level.label}</span>
              </div>
              <span style={{
                ...styles.count,
                backgroundColor: level.bg,
                color: level.color,
              }}>
                {items.length}
              </span>
            </div>

            {items.length === 0 ? (
              <div style={styles.emptySection}>Keine Lieferanten in dieser Risikostufe</div>
            ) : (
              <div style={styles.suppliersGrid}>
                {items.map((supplier) => (
                  <div
                    key={supplier.id}
                    style={{
                      ...styles.supplierCard,
                      backgroundColor: level.cardBg,
                    }}
                    onClick={() => navigate(`/apps/lieferantenmanagement/${supplier.id}`)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = level.color;
                      e.currentTarget.style.boxShadow = theme.shadows.sm;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = theme.colors.borderLight;
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={styles.supplierName}>{supplier.firmenname}</div>
                    <div style={styles.supplierDetail}>
                      {supplier.leistungen?.length || 0} Leistungen
                      {supplier.kundennummer ? ` | ${supplier.kundennummer}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
