/**
 * PortfolioDashboard — Uebersicht-Tab im Portfolio-Detail.
 *
 * Layout (top-to-bottom):
 *   1. KPI-Reihe (4 Karten: Projekte/Health/Budget/Termine)
 *   2. Phase-Mix Stacked-Bar
 *   3. Top-5-Risiken Tabelle
 *   4. Letzte Statusberichte Tabelle
 *
 * Klick auf Projekt-Namen oder SB-Eintrag navigiert zum Projekt-Detail
 * (mit `?tab=...&sb=...` fuer SB-Direct-Link).
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../../../config/theme';
import { useProjektmanagement } from '../../../../hooks/useProjektmanagement';
import HealthDonut from './HealthDonut';
import PhaseMixBar from './PhaseMixBar';

const AMPEL_COLOR = {
  gruen: { fg: theme.colors.success, label: 'Grün' },
  gelb: { fg: theme.colors.warning, label: 'Gelb' },
  rot: { fg: theme.colors.error, label: 'Rot' },
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xl,
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: theme.spacing.md,
  },
  kpiCard: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
  },
  kpiLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: theme.spacing.xs,
  },
  kpiValue: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  kpiSubtext: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  kpiBreakdown: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
  },
  kpiBreakdownRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    fontSize: theme.typography.sizes.sm,
  },
  kpiBreakdownDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },
  kpiBreakdownValue: {
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    minWidth: 24,
    textAlign: 'right',
  },
  kpiBreakdownLabel: {
    color: theme.colors.textSecondary,
  },
  section: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.sm,
  },
  td: {
    padding: theme.spacing.sm,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    borderBottom: `1px solid ${theme.colors.border}`,
    verticalAlign: 'top',
  },
  linkLike: {
    color: theme.colors.primary,
    textDecoration: 'none',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: 0,
    fontSize: 'inherit',
    fontFamily: 'inherit',
    fontWeight: theme.typography.weights.medium,
  },
  ampelChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    fontSize: theme.typography.sizes.xs,
  },
  ampelDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
  emptyRow: {
    padding: theme.spacing.lg,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
  },
};

function formatPct(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function formatMoney(n) {
  if (!n) return '0';
  return n.toLocaleString('de-DE', { maximumFractionDigits: 0 });
}

function formatDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function configLabel(appConfig, key, value) {
  if (!appConfig || !value) return value || '';
  const list = appConfig[key];
  if (!list) return value;
  return list.find((o) => o.value === value)?.label || value;
}

export default function PortfolioDashboard({ portfolioId, appConfig }) {
  const navigate = useNavigate();
  const { getPortfolioDashboard } = useProjektmanagement();
  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    getPortfolioDashboard(portfolioId)
      .then((d) => { if (active) setDashboard(d); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [portfolioId, getPortfolioDashboard]);

  if (isLoading) {
    return <div style={styles.emptyRow}>Lade Dashboard…</div>;
  }
  if (error) {
    return <div style={{ ...styles.emptyRow, color: theme.colors.error }}>{error}</div>;
  }
  if (!dashboard) {
    return <div style={styles.emptyRow}>Keine Daten.</div>;
  }

  const { projekte_total, projekte_aktiv, projekte_abgeschlossen, health, phase_mix, budget, termine, top_risiken, letzte_statusberichte } = dashboard;

  return (
    <div style={styles.container}>
      {/* KPI-Reihe */}
      <div style={styles.kpiGrid}>
        <div style={styles.kpiCard}>
          <div style={styles.kpiLabel}>Projekte</div>
          <div style={styles.kpiValue}>{projekte_total}</div>
          <div style={styles.kpiSubtext}>
            {projekte_aktiv} aktiv · {projekte_abgeschlossen} abgeschlossen
          </div>
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiLabel}>Health</div>
          <HealthDonut health={health} size={100} thickness={14} />
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiLabel}>Budget-Abweichung</div>
          <div style={{
            ...styles.kpiValue,
            color: budget.abweichung_pct === null
              ? theme.colors.textMuted
              : budget.abweichung_pct > 5 ? theme.colors.error
              : budget.abweichung_pct > 0 ? theme.colors.warning
              : theme.colors.success,
          }}>
            {formatPct(budget.abweichung_pct)}
          </div>
          <div style={styles.kpiSubtext}>
            Ist {formatMoney(budget.ist_total)} / Plan {formatMoney(budget.plan_total)}
          </div>
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiLabel}>Termine</div>
          <div style={styles.kpiBreakdown}>
            <div style={styles.kpiBreakdownRow}>
              <span style={{ ...styles.kpiBreakdownDot, backgroundColor: theme.colors.success }} />
              <span style={styles.kpiBreakdownValue}>{termine.on_track}</span>
              <span style={styles.kpiBreakdownLabel}>im Plan</span>
            </div>
            <div style={styles.kpiBreakdownRow}>
              <span style={{ ...styles.kpiBreakdownDot, backgroundColor: theme.colors.warning }} />
              <span style={styles.kpiBreakdownValue}>{termine.gefaehrdet}</span>
              <span style={styles.kpiBreakdownLabel}>gefährdet</span>
            </div>
            <div style={styles.kpiBreakdownRow}>
              <span style={{ ...styles.kpiBreakdownDot, backgroundColor: theme.colors.error }} />
              <span style={styles.kpiBreakdownValue}>{termine.verspaetet}</span>
              <span style={styles.kpiBreakdownLabel}>verspätet</span>
            </div>
          </div>
        </div>
      </div>

      {/* Phase-Mix */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Phase-Mix</div>
        <PhaseMixBar mix={phase_mix} />
      </div>

      {/* Top-Risiken */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Top-Risiken (offen)</div>
        {top_risiken.length === 0 ? (
          <div style={styles.emptyRow}>
            Keine offenen Risiken erfasst — entweder noch nicht im Statusbericht eingetragen oder bereits vermieden.
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Projekt</th>
                <th style={styles.th}>Risiko</th>
                <th style={styles.th}>Wahrscheinlichkeit</th>
                <th style={styles.th}>Auswirkung</th>
                <th style={styles.th}>Score</th>
              </tr>
            </thead>
            <tbody>
              {top_risiken.map((r, idx) => (
                <tr key={`${r.projekt_id}-${idx}`}>
                  <td style={styles.td}>
                    <button
                      type="button"
                      style={styles.linkLike}
                      onClick={() => navigate(`/apps/projektmanagement/${r.projekt_id}`)}
                    >
                      {r.projekt_name}
                    </button>
                  </td>
                  <td style={styles.td}>{r.risk_text}</td>
                  <td style={styles.td}>{configLabel(appConfig, 'probability', r.wahrscheinlichkeit)}</td>
                  <td style={styles.td}>{configLabel(appConfig, 'impact', r.auswirkung)}</td>
                  <td style={styles.td}>
                    <span style={{
                      fontWeight: theme.typography.weights.semibold,
                      color: r.score >= 6 ? theme.colors.error : r.score >= 4 ? theme.colors.warning : theme.colors.text,
                    }}>
                      {r.score}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Letzte Statusberichte */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Letzte Statusberichte</div>
        {letzte_statusberichte.length === 0 ? (
          <div style={styles.emptyRow}>Keine Projekte im Portfolio.</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Projekt</th>
                <th style={styles.th}>Letzter SB</th>
                <th style={styles.th}>Datum</th>
                <th style={styles.th}>Ampel</th>
                <th style={styles.th}>Management-Summary</th>
              </tr>
            </thead>
            <tbody>
              {letzte_statusberichte.map((entry) => {
                const ampel = entry.ampel ? AMPEL_COLOR[entry.ampel] : null;
                return (
                  <tr key={entry.projekt_id}>
                    <td style={styles.td}>
                      <button
                        type="button"
                        style={styles.linkLike}
                        onClick={() => {
                          const target = entry.sb_id
                            ? `/apps/projektmanagement/${entry.projekt_id}?tab=statusberichte&sb=${entry.sb_id}`
                            : `/apps/projektmanagement/${entry.projekt_id}`;
                          navigate(target);
                        }}
                      >
                        {entry.projekt_name}
                      </button>
                    </td>
                    <td style={styles.td}>{entry.sb_nummer ? `SB #${entry.sb_nummer}` : '—'}</td>
                    <td style={styles.td}>{formatDate(entry.datum)}</td>
                    <td style={styles.td}>
                      {ampel ? (
                        <span style={styles.ampelChip}>
                          <span style={{ ...styles.ampelDot, backgroundColor: ampel.fg }} />
                          {ampel.label}
                        </span>
                      ) : <span style={{ color: theme.colors.textMuted }}>—</span>}
                    </td>
                    <td style={styles.td}>{entry.management_summary || ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
