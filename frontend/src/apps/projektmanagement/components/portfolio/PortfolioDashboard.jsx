/**
 * PortfolioDashboard — Übersicht-Tab im Portfolio-Detail (Executive Dashboard).
 *
 * Layout (top-to-bottom, alles auf einer Seite):
 *   1. KPI-Reihe (Gesamtstatus · Aktive Projekte · Projektideen · Budget-Forecast)
 *   2. Ampelübersicht · Budgetübersicht (Plan/Ist/Forecast) · Kritische Hinweise
 *   3. Idea-to-Project-Funnel (5 Stufen)
 *   4. Projektübersicht (Status/Fortschritt/Budget/Forecast/Hinweis)
 *   5. Kritische Abhängigkeiten (Edge-Liste)
 *   6. Ressourcen- & Engpassansicht (Kapazitäts-Heatmap: Rollen/Personen × Monat)
 *   7. Top-Risiken (offen)
 *   8. Letzte Statusberichte
 *
 * Alle Kennzahlen kommen aus dem Aggregat `getPortfolioDashboard`. KI-Narrative
 * der RuhrPM-Vorlage sind hier regel-basiert ersetzt (Gesamtstatus, kritische
 * Hinweise). Klick auf Projektnamen/SB navigiert ins Projekt-Detail.
 */

import { Fragment, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../../../config/theme';
import { useProjektmanagement } from '../../../../hooks/useProjektmanagement';
import PortfolioCapacityHeatmap from './PortfolioCapacityHeatmap';

const AMPEL = {
  gruen: { fg: theme.colors.success, bg: theme.colors.successLight, label: 'Grün' },
  gelb: { fg: theme.colors.warning, bg: theme.colors.warningLight, label: 'Gelb' },
  rot: { fg: theme.colors.error, bg: theme.colors.errorLight, label: 'Rot' },
};

const GESAMTSTATUS = {
  gruen: { fg: theme.colors.success, label: 'GRÜN' },
  gelb: { fg: theme.colors.warning, label: 'GELB' },
  rot: { fg: theme.colors.error, label: 'ROT' },
  unbekannt: { fg: theme.colors.textMuted, label: '—' },
};

// Funnel-Stufen: fixe Idea-to-Project-Pipeline. Farben aus dem Theme (5 distinkte
// Töne), Zähler kommen aus dem Aggregat (ideen.funnel.*).
const FUNNEL_STAGES = [
  { key: 'idee', label: 'Projektidee', desc: 'Nutzen, Scope, Grobschätzung', fg: theme.colors.thinking, bg: theme.colors.thinkingLight },
  { key: 'vorbewertung', label: 'Vorbewertung', desc: 'Risiko- & Ähnlichkeitscheck', fg: theme.colors.info, bg: theme.colors.infoLight },
  { key: 'kandidat', label: 'Portfolio-Kandidat', desc: 'Priorität, Ressourcenbedarf', fg: theme.colors.warning, bg: theme.colors.warningLight },
  { key: 'freigegeben', label: 'Freigegeben', desc: 'Budget, Termin, Verantwortliche', fg: theme.colors.success, bg: theme.colors.successLight },
  { key: 'laufend', label: 'Laufendes Projekt', desc: 'Status, Forecast, Lessons Learned', fg: theme.colors.primary, bg: theme.colors.primaryLight },
];

const styles = {
  container: { display: 'flex', flexDirection: 'column', gap: theme.spacing.xl },

  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: theme.spacing.md,
  },
  row3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: theme.spacing.md,
  },

  card: {
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
    fontWeight: theme.typography.weights.semibold,
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

  // Ampelübersicht
  ampelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.xs,
  },
  ampelDot: { width: 12, height: 12, borderRadius: '50%', flexShrink: 0 },
  ampelLabel: { flex: 1, fontSize: theme.typography.sizes.sm, color: theme.colors.text },
  ampelCount: { fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.bold, color: theme.colors.text },
  footnote: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.sm,
  },

  // Budget-Bars
  barRow: { marginBottom: theme.spacing.md },
  barHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: theme.spacing.xs,
  },
  barLabel: { fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary },
  barValue: { fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text },
  barTrack: { height: 12, backgroundColor: theme.colors.surfaceHover, borderRadius: theme.borderRadius.full, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: theme.borderRadius.full },

  // Kritische Hinweise
  hinweisRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    lineHeight: 1.4,
  },
  hinweisDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 6 },

  // Funnel
  funnelRow: {
    display: 'flex',
    alignItems: 'stretch',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  funnelStage: {
    flex: '1 1 160px',
    minWidth: 150,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  funnelStageTitle: { fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.bold },
  funnelCount: { fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, lineHeight: 1.1 },
  funnelDesc: { fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary },
  funnelArrow: { alignSelf: 'center', color: theme.colors.textMuted, fontSize: theme.typography.sizes.lg, flexShrink: 0 },

  // Tabellen
  table: { width: '100%', borderCollapse: 'collapse' },
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
  thRight: { textAlign: 'right' },
  td: {
    padding: theme.spacing.sm,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    borderBottom: `1px solid ${theme.colors.border}`,
    verticalAlign: 'top',
  },
  tdRight: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
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
    textAlign: 'left',
  },
  ampelChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    fontSize: theme.typography.sizes.xs,
    padding: `2px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
  },
  ampelChipDot: { width: 8, height: 8, borderRadius: '50%' },

  // Fortschrittsbalken in Tabelle
  progressWrap: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm },
  progressTrack: { flex: 1, height: 6, minWidth: 48, backgroundColor: theme.colors.surfaceHover, borderRadius: theme.borderRadius.full, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.full },

  // Abhängigkeiten
  depList: { display: 'flex', flexDirection: 'column', gap: theme.spacing.sm },
  depRow: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm, flexWrap: 'wrap' },
  depChip: {
    fontSize: theme.typography.sizes.sm,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
  },
  depArrow: { color: theme.colors.textMuted, fontSize: theme.typography.sizes.lg },

  // Platzhalter
  placeholder: {
    padding: theme.spacing.xl,
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
    lineHeight: 1.5,
    border: `1px dashed ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.background,
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
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)} %`;
}

function formatMio(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio. €`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toLocaleString('de-DE', { maximumFractionDigits: 0 })} Tsd. €`;
  return `${v.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`;
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

// ---- Sub-Komponenten ----

function KpiCard({ label, value, valueColor, subtext }) {
  return (
    <div style={styles.card}>
      <div style={styles.kpiLabel}>{label}</div>
      <div style={{ ...styles.kpiValue, ...(valueColor ? { color: valueColor } : {}) }}>{value}</div>
      {subtext ? <div style={styles.kpiSubtext}>{subtext}</div> : null}
    </div>
  );
}

function AmpelChip({ ampel }) {
  const a = ampel ? AMPEL[ampel] : null;
  if (!a) return <span style={{ color: theme.colors.textMuted }}>—</span>;
  return (
    <span style={{ ...styles.ampelChip, backgroundColor: a.bg, color: a.fg }}>
      <span style={{ ...styles.ampelChipDot, backgroundColor: a.fg }} />
      {a.label}
    </span>
  );
}

function BudgetBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={styles.barRow}>
      <div style={styles.barHead}>
        <span style={styles.barLabel}>{label}</span>
        <span style={styles.barValue}>{formatMio(value)}</span>
      </div>
      <div style={styles.barTrack}>
        <div style={{ ...styles.barFill, width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// ---- Hauptkomponente ----

export default function PortfolioDashboard({ portfolioId, appConfig }) {
  const navigate = useNavigate();
  const { getPortfolioDashboard } = useProjektmanagement();
  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const d = await getPortfolioDashboard(portfolioId);
      setDashboard(d);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [portfolioId, getPortfolioDashboard]);

  useEffect(() => { reload(); }, [reload]);

  if (isLoading) return <div style={styles.emptyRow}>Lade Dashboard…</div>;
  if (error) return <div style={{ ...styles.emptyRow, color: theme.colors.error }}>{error}</div>;
  if (!dashboard) return <div style={styles.emptyRow}>Keine Daten.</div>;

  const {
    projekte_aktiv, gesamtstatus, health, budget, ideen,
    kritische_hinweise, projekte_detail, dependencies, top_risiken, letzte_statusberichte,
  } = dashboard;

  const status = GESAMTSTATUS[gesamtstatus] || GESAMTSTATUS.unbekannt;
  const budgetMax = Math.max(budget.plan_total, budget.ist_total, budget.forecast_total, 1);
  const goToProjekt = (id) => navigate(`/apps/projektmanagement/${id}`);

  return (
    <div style={styles.container}>
      {/* 1. KPI-Reihe */}
      <div style={styles.kpiGrid}>
        <KpiCard
          label="Gesamtstatus"
          value={status.label}
          valueColor={status.fg}
          subtext={`${health.rot} kritisch · ${health.gelb} beobachtet`}
        />
        <KpiCard
          label="Aktive Projekte"
          value={projekte_aktiv}
          subtext={`${health.rot} kritisch · ${health.gelb} beobachtet`}
        />
        <KpiCard
          label="Projektideen"
          value={ideen.total}
          subtext={`${ideen.funnel_offen} im Portfolio-Funnel`}
        />
        <KpiCard
          label="Budget-Forecast"
          value={formatMio(budget.forecast_total)}
          valueColor={
            budget.forecast_abweichung_pct === null ? theme.colors.text
              : budget.forecast_abweichung_pct > 5 ? theme.colors.error
              : budget.forecast_abweichung_pct > 0 ? theme.colors.warning
              : theme.colors.success
          }
          subtext={`${formatPct(budget.forecast_abweichung_pct)} ggü. Plan`}
        />
      </div>

      {/* 2. Ampelübersicht · Budgetübersicht · Kritische Hinweise */}
      <div style={styles.row3}>
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Ampelübersicht</div>
          {[
            { key: 'gruen', count: health.gruen },
            { key: 'gelb', count: health.gelb },
            { key: 'rot', count: health.rot },
          ].map(({ key, count }) => (
            <div key={key} style={{ ...styles.ampelRow, backgroundColor: AMPEL[key].bg }}>
              <span style={{ ...styles.ampelDot, backgroundColor: AMPEL[key].fg }} />
              <span style={styles.ampelLabel}>{AMPEL[key].label}</span>
              <span style={styles.ampelCount}>{count}</span>
            </div>
          ))}
          {health.unbekannt > 0 ? (
            <div style={styles.footnote}>{health.unbekannt} ohne Statusbericht</div>
          ) : null}
          <div style={styles.footnote}>Status aus Terminen, Budget, Risiken aggregiert.</div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>Budgetübersicht</div>
          <BudgetBar label="Plan" value={budget.plan_total} max={budgetMax} color={theme.colors.info} />
          <BudgetBar label="Ist" value={budget.ist_total} max={budgetMax} color={theme.colors.success} />
          <BudgetBar label="Forecast" value={budget.forecast_total} max={budgetMax} color={theme.colors.error} />
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>Kritische Hinweise</div>
          {kritische_hinweise.length === 0 ? (
            <div style={styles.emptyRow}>Keine kritischen Hinweise.</div>
          ) : (
            kritische_hinweise.map((h, idx) => (
              <div key={idx} style={styles.hinweisRow}>
                <span style={{ ...styles.hinweisDot, backgroundColor: h.ampel === 'rot' ? theme.colors.error : theme.colors.warning }} />
                <span>{h.text}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 3. Idea-to-Project-Funnel */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Idea-to-Project-Funnel und Entscheidungslogik</div>
        <div style={styles.funnelRow}>
          {FUNNEL_STAGES.map((stage, idx) => (
            <Fragment key={stage.key}>
              <div style={{ ...styles.funnelStage, backgroundColor: stage.bg }}>
                <span style={{ ...styles.funnelStageTitle, color: stage.fg }}>{stage.label}</span>
                <span style={{ ...styles.funnelCount, color: stage.fg }}>{ideen.funnel[stage.key]}</span>
                <span style={styles.funnelDesc}>{stage.desc}</span>
              </div>
              {idx < FUNNEL_STAGES.length - 1 ? <span style={styles.funnelArrow}>›</span> : null}
            </Fragment>
          ))}
        </div>
      </div>

      {/* 4. Projektübersicht */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Projektübersicht</div>
        {projekte_detail.length === 0 ? (
          <div style={styles.emptyRow}>Keine Projekte im Portfolio.</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Projekt</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Fortschritt</th>
                <th style={{ ...styles.th, ...styles.thRight }}>Budget</th>
                <th style={{ ...styles.th, ...styles.thRight }}>Forecast</th>
                <th style={styles.th}>Hinweis</th>
              </tr>
            </thead>
            <tbody>
              {projekte_detail.map((p) => (
                <tr key={p.id}>
                  <td style={styles.td}>
                    <button type="button" style={styles.linkLike} onClick={() => goToProjekt(p.id)}>{p.name}</button>
                  </td>
                  <td style={styles.td}><AmpelChip ampel={p.ampel} /></td>
                  <td style={styles.td}>
                    {p.fortschritt === null ? (
                      <span style={{ color: theme.colors.textMuted }}>—</span>
                    ) : (
                      <div style={styles.progressWrap}>
                        <div style={styles.progressTrack}>
                          <div style={{ ...styles.progressFill, width: `${Math.max(0, Math.min(100, p.fortschritt))}%` }} />
                        </div>
                        <span>{Math.round(p.fortschritt)} %</span>
                      </div>
                    )}
                  </td>
                  <td style={{ ...styles.td, ...styles.tdRight }}>{formatMio(p.budget)}</td>
                  <td style={{ ...styles.td, ...styles.tdRight, color: p.forecast > p.budget ? theme.colors.error : theme.colors.text }}>
                    {formatMio(p.forecast)}
                  </td>
                  <td style={{ ...styles.td, color: theme.colors.textSecondary }}>{p.hinweis || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 5. Kritische Abhängigkeiten */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Kritische Abhängigkeiten</div>
        {dependencies.length === 0 ? (
          <div style={styles.emptyRow}>Keine Abhängigkeiten gepflegt (im Tab „Roadmap" pflegbar).</div>
        ) : (
          <div style={styles.depList}>
            {dependencies.map((d, idx) => (
              <div key={idx} style={styles.depRow}>
                <span style={styles.depChip}>{d.from_name}{d.from?.startsWith('idee-') ? ' (Idee)' : ''}</span>
                <span style={styles.depArrow}>→</span>
                <span style={styles.depChip}>{d.to_name}{d.to?.startsWith('idee-') ? ' (Idee)' : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6. Ressourcen- & Engpassansicht (Kapazitäts-Heatmap) */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Ressourcen- & Engpassansicht</div>
        <PortfolioCapacityHeatmap portfolioId={portfolioId} appConfig={appConfig} />
      </div>

      {/* 7. Top-Risiken */}
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
                <th style={{ ...styles.th, ...styles.thRight }}>Score</th>
              </tr>
            </thead>
            <tbody>
              {top_risiken.map((r, idx) => (
                <tr key={`${r.projekt_id}-${idx}`}>
                  <td style={styles.td}>
                    <button type="button" style={styles.linkLike} onClick={() => goToProjekt(r.projekt_id)}>{r.projekt_name}</button>
                  </td>
                  <td style={styles.td}>{r.risk_text}</td>
                  <td style={styles.td}>{configLabel(appConfig, 'probability', r.wahrscheinlichkeit)}</td>
                  <td style={styles.td}>{configLabel(appConfig, 'impact', r.auswirkung)}</td>
                  <td style={{ ...styles.td, ...styles.tdRight }}>
                    <span style={{ fontWeight: theme.typography.weights.semibold, color: r.score >= 6 ? theme.colors.error : r.score >= 4 ? theme.colors.warning : theme.colors.text }}>
                      {r.score}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 8. Letzte Statusberichte */}
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
              {letzte_statusberichte.map((entry) => (
                <tr key={entry.projekt_id}>
                  <td style={styles.td}>
                    <button
                      type="button"
                      style={styles.linkLike}
                      onClick={() => navigate(
                        entry.sb_id
                          ? `/apps/projektmanagement/${entry.projekt_id}?tab=statusberichte&sb=${entry.sb_id}`
                          : `/apps/projektmanagement/${entry.projekt_id}`,
                      )}
                    >
                      {entry.projekt_name}
                    </button>
                  </td>
                  <td style={styles.td}>{entry.sb_nummer ? `SB #${entry.sb_nummer}` : '—'}</td>
                  <td style={styles.td}>{formatDate(entry.datum)}</td>
                  <td style={styles.td}><AmpelChip ampel={entry.ampel} /></td>
                  <td style={{ ...styles.td, color: theme.colors.textSecondary }}>{entry.management_summary || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
