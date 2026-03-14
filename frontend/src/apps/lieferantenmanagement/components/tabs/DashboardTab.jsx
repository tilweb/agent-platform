import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../../../config/theme';
import { apiGet } from '../../../../utils/apiFetch';
import RiskBadge from '../shared/RiskBadge';

const BASE = '/apps/lieferantenmanagement';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xl,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: theme.spacing.lg,
  },
  statCard: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
  },
  statLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.weights.medium,
  },
  statValue: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  section: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  sectionsRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing.lg,
  },
  tableHeader: {
    display: 'flex',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    gap: theme.spacing.md,
  },
  tableHeaderCell: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  tableRow: {
    display: 'flex',
    padding: `${theme.spacing.md} ${theme.spacing.md}`,
    borderBottom: `1px solid ${theme.colors.borderLight}`,
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  itemName: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    fontWeight: theme.typography.weights.medium,
    flex: 1,
  },
  itemDetail: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  itemDate: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  riskRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${theme.spacing.sm} 0`,
    borderBottom: `1px solid ${theme.colors.borderLight}`,
  },
  riskBar: {
    height: 8,
    borderRadius: theme.borderRadius.full,
    transition: `width ${theme.transitions.normal}`,
  },
  riskBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: theme.colors.borderLight,
    borderRadius: theme.borderRadius.full,
    margin: `0 ${theme.spacing.md}`,
  },
  riskCount: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    minWidth: 30,
    textAlign: 'right',
  },
  emptyText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
    padding: theme.spacing.xl,
  },
  loading: {
    textAlign: 'center',
    padding: theme.spacing['2xl'],
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
  clickable: {
    cursor: 'pointer',
    transition: `background-color ${theme.transitions.fast}`,
  },
};

const RISK_BAR_COLORS = {
  very_high: theme.colors.error,
  high: theme.colors.warning,
  medium: theme.colors.info,
  low: theme.colors.success,
};

const RISK_LABELS = {
  very_high: 'Sehr hoch',
  high: 'Hoch',
  medium: 'Mittel',
  low: 'Niedrig',
};

const AUDIT_STATUS_STYLES = {
  geplant: { backgroundColor: theme.colors.surfaceHover, color: theme.colors.textMuted },
  in_durchfuehrung: { backgroundColor: theme.colors.infoLight, color: theme.colors.info },
  abgeschlossen: { backgroundColor: theme.colors.successLight, color: theme.colors.success },
};

const AUDIT_STATUS_LABELS = {
  geplant: 'Geplant',
  in_durchfuehrung: 'In Durchfuehrung',
};

export default function DashboardTab({ stats, suppliers, onNavigate }) {
  const navigate = useNavigate();
  const [expiringItems, setExpiringItems] = useState([]);
  const [pendingItems, setPendingItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [expiringRes, auditsRes, reviewsRes] = await Promise.all([
          apiGet(`${BASE}/stats/expiring`),
          apiGet(`${BASE}/audits`),
          apiGet(`${BASE}/stats/pending-reviews`),
        ]);
        if (!mounted) return;

        const expiring = expiringRes.ok ? (await expiringRes.json()).expiring : [];
        const allAudits = auditsRes.ok ? (await auditsRes.json()).audits : [];
        const reviews = reviewsRes.ok ? (await reviewsRes.json()).reviews : [];

        setExpiringItems(expiring || []);

        // Merge pending audits + pending reviews into one sorted list
        const now = new Date().toISOString().split('T')[0];
        const auditItems = (allAudits || [])
          .filter((a) => a.status === 'geplant' || a.status === 'in_durchfuehrung')
          .map((a) => ({
            id: a.id,
            typ: 'audit',
            label: a.typ?.replace(/_/g, ' ') || 'Audit',
            supplier_id: a.supplier_id,
            datum: a.geplant_fuer || '',
            status: a.status,
            ueberfaellig: a.geplant_fuer ? a.geplant_fuer < now : false,
          }));

        const reviewItems = (reviews || []).map((r) => ({
          id: `review-${r.supplier_id}-${r.leistung_id}`,
          typ: 'review',
          label: r.leistung || 'Review',
          supplier_id: r.supplier_id,
          datum: r.faellig,
          status: 'review',
          ueberfaellig: r.ueberfaellig,
        }));

        const merged = [...auditItems, ...reviewItems]
          .sort((a, b) => {
            // Overdue first, then by date
            if (a.ueberfaellig !== b.ueberfaellig) return a.ueberfaellig ? -1 : 1;
            return (a.datum || '9999').localeCompare(b.datum || '9999');
          })
          .slice(0, 12);

        setPendingItems(merged);
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  if (!stats) {
    return <div style={styles.loading}>Laden...</div>;
  }

  const riskDistribution = stats.riskDistribution || {};
  const riskTotal = Object.values(riskDistribution).reduce((sum, v) => sum + (v || 0), 0);

  return (
    <div style={styles.container}>
      {/* Stat Cards */}
      <div style={styles.statsGrid}>
        <div style={{ ...styles.statCard, ...styles.clickable }} onClick={() => onNavigate('suppliers')}>
          <span style={styles.statLabel}>Lieferanten gesamt</span>
          <span style={styles.statValue}>{stats.gesamt || 0}</span>
        </div>
        <div style={{ ...styles.statCard, ...styles.clickable }} onClick={() => onNavigate('suppliers', { status: 'active' })}>
          <span style={styles.statLabel}>Aktive Lieferanten</span>
          <span style={styles.statValue}>{stats.active || 0}</span>
        </div>
        <div style={{ ...styles.statCard, ...styles.clickable }} onClick={() => onNavigate('audits')}>
          <span style={styles.statLabel}>Offene Audits</span>
          <span style={styles.statValue}>{stats.offeneAudits || 0}</span>
        </div>
        <div style={{ ...styles.statCard, ...styles.clickable }} onClick={() => onNavigate('suppliers', { dora: 'true' })}>
          <span style={styles.statLabel}>DORA-relevant</span>
          <span style={styles.statValue}>{stats.doraRelevant || 0}</span>
        </div>
      </div>

      {/* Two columns: Expiring + Audits */}
      <div style={styles.sectionsRow}>
        {/* Expiring Items */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Ablaufende Dokumente</div>
          {expiringItems.length === 0 ? (
            <div style={styles.emptyText}>Keine ablaufenden Dokumente</div>
          ) : (
            <div>
              <div style={styles.tableHeader}>
                <span style={{ ...styles.tableHeaderCell, flex: 1 }}>Dokument</span>
                <span style={{ ...styles.tableHeaderCell, width: 160 }}>Lieferant</span>
                <span style={{ ...styles.tableHeaderCell, width: 100 }}>Ablaufdatum</span>
              </div>
              {expiringItems.map((item, i) => {
                const targetTab = item.typ === 'zertifizierung' ? 'stammdaten' : 'regulatorik';
                return (
                  <div
                    key={i}
                    style={{
                      ...styles.tableRow,
                      ...styles.clickable,
                    }}
                    onClick={() => navigate(`/apps/lieferantenmanagement/${item.supplier_id}?tab=${targetTab}`)}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surfaceHover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <span style={styles.itemName}>{item.bezeichnung || item.typ || 'Dokument'}</span>
                    <span style={{ ...styles.itemDetail, width: 160 }}>{item.firmenname || '-'}</span>
                    <span style={{ ...styles.itemDate, width: 100 }}>
                      {item.ablauf ? new Date(item.ablauf).toLocaleDateString('de-DE') : '-'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pending Audits & Reviews */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Anstehende Audits & Reviews</div>
          {pendingItems.length === 0 ? (
            <div style={styles.emptyText}>Keine anstehenden Audits oder Reviews</div>
          ) : (
            <div>
              <div style={styles.tableHeader}>
                <span style={{ ...styles.tableHeaderCell, flex: 1 }}>Bezeichnung</span>
                <span style={{ ...styles.tableHeaderCell, width: 120 }}>Status</span>
                <span style={{ ...styles.tableHeaderCell, width: 100 }}>Faellig</span>
              </div>
              {pendingItems.map((item) => {
                const supplierName = (suppliers || []).find((s) => s.id === item.supplier_id)?.firmenname || '-';
                const targetTab = item.typ === 'audit' ? 'pruefungen' : 'leistungen';
                const statusStyle = item.ueberfaellig
                  ? { backgroundColor: theme.colors.errorLight, color: theme.colors.error }
                  : item.typ === 'review'
                    ? { backgroundColor: theme.colors.primaryLight, color: theme.colors.primary }
                    : (AUDIT_STATUS_STYLES[item.status] || {});
                const statusLabel = item.ueberfaellig
                  ? 'Ueberfaellig'
                  : item.typ === 'review'
                    ? 'Review'
                    : (AUDIT_STATUS_LABELS[item.status] || item.status);
                return (
                  <div
                    key={item.id}
                    style={{
                      ...styles.tableRow,
                      ...styles.clickable,
                      ...(item.ueberfaellig ? { backgroundColor: `${theme.colors.error}06` } : {}),
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = item.ueberfaellig ? `${theme.colors.error}12` : theme.colors.surfaceHover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = item.ueberfaellig ? `${theme.colors.error}06` : 'transparent'; }}
                    onClick={() => navigate(`/apps/lieferantenmanagement/${item.supplier_id}?tab=${targetTab}`)}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.itemName}>{item.label}</div>
                      <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>{supplierName}</div>
                    </div>
                    <span style={{ width: 120 }}>
                      <span style={{
                        fontSize: theme.typography.sizes.xs,
                        padding: `${theme.spacing.xs} ${theme.spacing.md}`,
                        borderRadius: theme.borderRadius.full,
                        fontWeight: theme.typography.weights.medium,
                        ...statusStyle,
                      }}>
                        {statusLabel}
                      </span>
                    </span>
                    <span style={{ ...styles.itemDate, width: 100, ...(item.ueberfaellig ? { color: theme.colors.error, fontWeight: theme.typography.weights.medium } : {}) }}>
                      {item.datum ? new Date(item.datum).toLocaleDateString('de-DE') : '-'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Risk Distribution - full width */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Risikoverteilung</div>
        {riskDistribution && riskTotal > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
            {['very_high', 'high', 'medium', 'low'].map((level) => {
              const count = riskDistribution[level] || 0;
              const pct = riskTotal > 0 ? (count / riskTotal) * 100 : 0;
              return (
                <div
                  key={level}
                  style={{ ...styles.riskRow, ...styles.clickable, borderRadius: theme.borderRadius.md, padding: `${theme.spacing.sm} ${theme.spacing.md}` }}
                  onClick={() => onNavigate('suppliers', { risk: level })}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surfaceHover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <div style={{ width: 80 }}>
                    <RiskBadge level={level} size="small" />
                  </div>
                  <div style={styles.riskBarContainer}>
                    <div
                      style={{
                        ...styles.riskBar,
                        width: `${pct}%`,
                        backgroundColor: RISK_BAR_COLORS[level],
                      }}
                    />
                  </div>
                  <span style={styles.riskCount}>{count}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={styles.emptyText}>Keine Risikodaten vorhanden</div>
        )}
      </div>
    </div>
  );
}
