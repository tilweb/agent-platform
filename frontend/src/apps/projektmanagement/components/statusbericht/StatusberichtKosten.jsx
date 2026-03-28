/**
 * StatusberichtKosten
 * Earned Value Management: Monatliche Kosteneingabe, kumulierte Berechnung,
 * Kennzahlen (CPI/SPI) und S-Kurven-Chart.
 * Earned Value wird automatisch errechnet: Budget × Gesamtfortschritt (aus Ziele-Tab).
 */

import { useMemo } from 'react';
import { theme } from '../../../../config/theme';

// ============== Helpers ==============

const formatCurrency = (value) => {
  if (value == null || isNaN(value)) return '—';
  return value.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
};

const formatMonthLabel = (monthKey) => {
  if (!monthKey) return '';
  const [y, m] = monthKey.split('-');
  const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  return `${months[parseInt(m, 10) - 1]} ${y.slice(2)}`;
};

const parseNum = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

const daysBetween = (a, b) => {
  const da = new Date(a), db = new Date(b);
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return null;
  return Math.round((db - da) / (1000 * 60 * 60 * 24));
};

// ============== Cumulative Calculation ==============

function computeCumulative(months, budget, fortschritt) {
  let cumPlan = 0, cumIst = 0, cumForecast = 0;
  let lastIstIndex = -1;

  // Find last month with Ist > 0
  for (let i = months.length - 1; i >= 0; i--) {
    if (months[i].ist > 0) { lastIstIndex = i; break; }
  }

  // Earned Value (single cumulative value) = Budget × Fortschritt%
  const cumEV = budget * (fortschritt / 100);

  const totalPlanUpToIst = months.slice(0, lastIstIndex + 1).reduce((s, m) => s + m.plan, 0);

  return months.map((m, i) => {
    cumPlan += m.plan;
    cumIst += m.ist;

    // Forecast: cumulate Ist for past, then forecast for future
    if (i <= lastIstIndex) {
      cumForecast += m.ist;
    } else {
      cumForecast += m.forecast;
    }

    // Distribute EV proportionally across months with Ist (based on plan weight)
    let evAtMonth = null;
    if (i <= lastIstIndex && totalPlanUpToIst > 0) {
      const planSoFar = months.slice(0, i + 1).reduce((s, x) => s + x.plan, 0);
      evAtMonth = cumEV * (planSoFar / totalPlanUpToIst);
    } else if (i <= lastIstIndex) {
      // Equal distribution if no plan data
      evAtMonth = cumEV * ((i + 1) / (lastIstIndex + 1));
    }

    const cpi = (i <= lastIstIndex && cumIst > 0 && evAtMonth != null) ? evAtMonth / cumIst : null;
    const spi = (i <= lastIstIndex && cumPlan > 0 && evAtMonth != null) ? evAtMonth / cumPlan : null;

    return {
      month: m.month,
      cumPlan,
      cumIst: i <= lastIstIndex ? cumIst : null,
      cumForecast: i >= lastIstIndex ? cumForecast : null,
      cumEV: evAtMonth,
      cpi,
      spi,
    };
  });
}

function computePrognose(cumData, budget, cumEV) {
  // Find latest CPI/SPI (at the last Ist month)
  let latestCpi = null, latestSpi = null;
  for (let i = cumData.length - 1; i >= 0; i--) {
    if (cumData[i].cpi != null) { latestCpi = cumData[i].cpi; break; }
  }
  for (let i = cumData.length - 1; i >= 0; i--) {
    if (cumData[i].spi != null) { latestSpi = cumData[i].spi; break; }
  }

  // EAC = Budget / CPI
  const budgetPrognose = latestCpi && latestCpi > 0 ? budget / latestCpi : null;
  const budgetAbweichung = budgetPrognose != null ? budgetPrognose - budget : null;

  // Prognose line: project EV forward using SPI
  let lastCumPlanAtEV = 0;
  for (let i = cumData.length - 1; i >= 0; i--) {
    if (cumData[i].cumEV != null) {
      lastCumPlanAtEV = cumData[i].cumPlan;
      break;
    }
  }

  const prognoseValues = cumData.map((d) => {
    if (d.cumEV != null) return d.cumEV;
    if (latestSpi == null || latestSpi <= 0 || cumEV <= 0) return null;
    const planDelta = d.cumPlan - lastCumPlanAtEV;
    return cumEV + planDelta * latestSpi;
  });

  return { latestCpi, latestSpi, budgetPrognose, budgetAbweichung, prognoseValues };
}

// ============== Styles ==============

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xl,
  },
  header: {
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  sectionLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: theme.spacing.md,
  },
  budgetRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
  },
  budgetLabel: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    minWidth: '120px',
  },
  budgetInput: {
    width: '180px',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    textAlign: 'right',
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
    outline: 'none',
  },
  budgetUnit: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
  },
  evInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceHover,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  evValue: {
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  tableWrapper: {
    overflowX: 'auto',
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: theme.typography.sizes.xs,
  },
  th: {
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    textAlign: 'right',
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    backgroundColor: theme.colors.surfaceHover,
    borderBottom: `1px solid ${theme.colors.border}`,
    whiteSpace: 'nowrap',
  },
  thLabel: {
    textAlign: 'left',
    minWidth: '100px',
  },
  thTotal: {
    backgroundColor: theme.colors.surfaceHover,
    fontWeight: theme.typography.weights.bold,
  },
  td: {
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    textAlign: 'right',
    borderBottom: `1px solid ${theme.colors.borderLight || theme.colors.border}20`,
    color: theme.colors.text,
    whiteSpace: 'nowrap',
  },
  tdLabel: {
    textAlign: 'left',
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    paddingLeft: theme.spacing.md,
  },
  tdTotal: {
    fontWeight: theme.typography.weights.semibold,
    backgroundColor: `${theme.colors.surfaceHover}80`,
  },
  cellInput: {
    width: '90px',
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.sm,
    fontSize: theme.typography.sizes.xs,
    textAlign: 'right',
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
    outline: 'none',
  },
  kpiRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: theme.spacing.md,
  },
  kpiCard: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    textAlign: 'center',
  },
  kpiValue: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  kpiLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  chartContainer: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
  },
  chartTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
    justifyContent: 'center',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  legendDot: {
    width: '10px',
    height: '3px',
    borderRadius: '1px',
  },
  prognoseGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing.xl,
  },
  prognosePanel: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
  },
  prognosePanelTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  prognoseTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: theme.typography.sizes.sm,
  },
  prognoseTd: {
    padding: `${theme.spacing.sm} ${theme.spacing.xs}`,
    color: theme.colors.text,
  },
  prognoseTdLabel: {
    color: theme.colors.textMuted,
    fontWeight: theme.typography.weights.medium,
    whiteSpace: 'nowrap',
  },
  prognoseTdValue: {
    textAlign: 'right',
    fontWeight: theme.typography.weights.semibold,
    whiteSpace: 'nowrap',
  },
  prognoseTdDays: {
    textAlign: 'right',
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.xs,
    whiteSpace: 'nowrap',
    paddingLeft: theme.spacing.md,
  },
  prognoseDivider: {
    height: '1px',
    backgroundColor: theme.colors.border,
    margin: `${theme.spacing.sm} 0`,
  },
  warningValue: {
    color: theme.colors.error,
  },
};

// ============== Chart Colors ==============

const COLORS = {
  budget: theme.colors.error,
  plan: theme.colors.primary,
  ist: theme.colors.success,
  forecast: '#E5A100',
  ev: '#8B5CF6',
  prognose: '#F97316',
};

// ============== SVG Line Chart ==============

function EarnedValueChart({ cumData, budget, prognoseValues }) {
  const W = 700, H = 320, PAD = { top: 20, right: 30, bottom: 40, left: 70 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  if (!cumData || cumData.length === 0) return null;

  // Find max value for Y axis
  const allValues = [
    budget,
    ...cumData.map(d => d.cumPlan),
    ...cumData.filter(d => d.cumIst != null).map(d => d.cumIst),
    ...cumData.filter(d => d.cumForecast != null).map(d => d.cumForecast),
    ...cumData.filter(d => d.cumEV != null).map(d => d.cumEV),
    ...(prognoseValues || []).filter(v => v != null),
  ].filter(v => v != null && v > 0);

  const maxVal = allValues.length > 0 ? Math.max(...allValues) * 1.1 : budget || 100000;

  const xScale = (i) => PAD.left + (i / Math.max(cumData.length - 1, 1)) * chartW;
  const yScale = (v) => PAD.top + chartH - (v / maxVal) * chartH;

  const buildPath = (points) => {
    const valid = points.filter(p => p.v != null);
    if (valid.length < 2) return null;
    return valid.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  };

  const budgetLine = budget > 0
    ? `M${PAD.left},${yScale(budget).toFixed(1)} L${(PAD.left + chartW).toFixed(1)},${yScale(budget).toFixed(1)}`
    : null;

  const planPoints = cumData.map((d, i) => ({ x: xScale(i), y: yScale(d.cumPlan), v: d.cumPlan }));
  const istPoints = cumData.map((d, i) => ({ x: xScale(i), y: d.cumIst != null ? yScale(d.cumIst) : null, v: d.cumIst }));
  const forecastPoints = cumData.map((d, i) => ({ x: xScale(i), y: d.cumForecast != null ? yScale(d.cumForecast) : null, v: d.cumForecast }));
  const evPoints = cumData.map((d, i) => ({ x: xScale(i), y: d.cumEV != null ? yScale(d.cumEV) : null, v: d.cumEV }));
  const prognosePoints = (prognoseValues || []).map((v, i) => ({ x: xScale(i), y: v != null ? yScale(v) : null, v }));

  const yTicks = 5;
  const yStep = maxVal / yTicks;
  const gridLines = Array.from({ length: yTicks + 1 }, (_, i) => {
    const val = i * yStep;
    return { y: yScale(val), label: formatCurrency(Math.round(val)) };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: `${W}px`, height: 'auto' }}>
      {gridLines.map((g, i) => (
        <g key={i}>
          <line x1={PAD.left} y1={g.y} x2={W - PAD.right} y2={g.y} stroke={theme.colors.border} strokeWidth="0.5" strokeDasharray="4,4" />
          <text x={PAD.left - 8} y={g.y + 3} textAnchor="end" fontSize="9" fill={theme.colors.textMuted}>{g.label}</text>
        </g>
      ))}
      {cumData.map((d, i) => (
        <text key={i} x={xScale(i)} y={H - 10} textAnchor="middle" fontSize="9" fill={theme.colors.textMuted}>
          {formatMonthLabel(d.month)}
        </text>
      ))}
      {budgetLine && <path d={budgetLine} fill="none" stroke={COLORS.budget} strokeWidth="1.5" strokeDasharray="6,3" />}
      {buildPath(planPoints) && <path d={buildPath(planPoints)} fill="none" stroke={COLORS.plan} strokeWidth="2" />}
      {buildPath(forecastPoints) && <path d={buildPath(forecastPoints)} fill="none" stroke={COLORS.forecast} strokeWidth="2" strokeDasharray="6,3" />}
      {buildPath(istPoints) && <path d={buildPath(istPoints)} fill="none" stroke={COLORS.ist} strokeWidth="2" />}
      {buildPath(evPoints) && <path d={buildPath(evPoints)} fill="none" stroke={COLORS.ev} strokeWidth="2" />}
      {buildPath(prognosePoints) && <path d={buildPath(prognosePoints)} fill="none" stroke={COLORS.prognose} strokeWidth="1.5" strokeDasharray="4,3" />}
      {istPoints.filter(p => p.v != null).map((p, i) => (
        <circle key={`ist-${i}`} cx={p.x} cy={p.y} r="3" fill={COLORS.ist} />
      ))}
      {evPoints.filter(p => p.v != null).map((p, i) => (
        <circle key={`ev-${i}`} cx={p.x} cy={p.y} r="3" fill={COLORS.ev} />
      ))}
    </svg>
  );
}

// ============== Prognosewerte Panel ==============

function PrognosewertePanels({ projektauftrag, berichtsDatum, budget, prognose, cumEV }) {
  const startDate = projektauftrag?.start_date || '';
  const endDate = projektauftrag?.end_date || '';

  // Zeiträume (Tage seit Projektstart)
  const daysStart = 0;
  const daysBericht = daysBetween(startDate, berichtsDatum);
  const daysEnd = daysBetween(startDate, endDate);

  // Termin-Prognose: Geplante Dauer / SPI
  let terminPrognose = null;
  let terminPrognoseDays = null;
  let terminAbweichung = null;
  if (prognose.latestSpi && prognose.latestSpi > 0 && daysEnd != null) {
    terminPrognoseDays = Math.round(daysEnd / prognose.latestSpi);
    const startMs = new Date(startDate).getTime();
    if (!isNaN(startMs)) {
      terminPrognose = new Date(startMs + terminPrognoseDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }
    if (daysEnd != null) {
      terminAbweichung = terminPrognoseDays - daysEnd;
    }
  }

  const hasAbweichung = terminAbweichung != null && terminAbweichung > 0;
  const hasBudgetAbweichung = prognose.budgetAbweichung != null && prognose.budgetAbweichung > 0;

  return (
    <div style={styles.prognoseGrid}>
      {/* Termin-Prognose */}
      <div style={styles.prognosePanel}>
        <div style={styles.prognosePanelTitle}>Terminprognose</div>
        <table style={styles.prognoseTable}>
          <tbody>
            <tr>
              <td style={{ ...styles.prognoseTd, ...styles.prognoseTdLabel }}>Starttermin</td>
              <td style={{ ...styles.prognoseTd, ...styles.prognoseTdValue }}>{formatDate(startDate)}</td>
              <td style={styles.prognoseTdDays}></td>
            </tr>
            <tr>
              <td style={{ ...styles.prognoseTd, ...styles.prognoseTdLabel }}>Berichtsdatum</td>
              <td style={{ ...styles.prognoseTd, ...styles.prognoseTdValue }}>{formatDate(berichtsDatum)}</td>
              <td style={styles.prognoseTdDays}>{daysBericht != null ? `${daysBericht} d` : ''}</td>
            </tr>
            <tr>
              <td style={{ ...styles.prognoseTd, ...styles.prognoseTdLabel }}>Endtermin (Soll)</td>
              <td style={{ ...styles.prognoseTd, ...styles.prognoseTdValue }}>{formatDate(endDate)}</td>
              <td style={styles.prognoseTdDays}>{daysEnd != null ? `${daysEnd} d` : ''}</td>
            </tr>
            <tr>
              <td colSpan="3"><div style={styles.prognoseDivider} /></td>
            </tr>
            <tr>
              <td style={{ ...styles.prognoseTd, ...styles.prognoseTdLabel }}>Termin (Prognose)</td>
              <td style={{
                ...styles.prognoseTd,
                ...styles.prognoseTdValue,
                ...(hasAbweichung ? styles.warningValue : {}),
              }}>
                {terminPrognose ? formatDate(terminPrognose) : '—'}
              </td>
              <td style={styles.prognoseTdDays}>{terminPrognoseDays != null ? `${terminPrognoseDays} d` : ''}</td>
            </tr>
            <tr>
              <td style={{ ...styles.prognoseTd, ...styles.prognoseTdLabel }}>Abweichung</td>
              <td style={{
                ...styles.prognoseTd,
                ...styles.prognoseTdValue,
                ...(hasAbweichung ? styles.warningValue : {}),
              }}>
                {terminAbweichung != null ? `${terminAbweichung > 0 ? '+' : ''}${terminAbweichung} Tage` : '—'}
              </td>
              <td style={styles.prognoseTdDays}>
                {prognose.latestSpi != null ? `SPI ${prognose.latestSpi.toFixed(2)}` : ''}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Budget-Prognose */}
      <div style={styles.prognosePanel}>
        <div style={styles.prognosePanelTitle}>Budgetprognose</div>
        <table style={styles.prognoseTable}>
          <tbody>
            <tr>
              <td style={{ ...styles.prognoseTd, ...styles.prognoseTdLabel }}>Budget (Plan)</td>
              <td style={{ ...styles.prognoseTd, ...styles.prognoseTdValue }}>{formatCurrency(budget)}</td>
              <td style={styles.prognoseTdDays}></td>
            </tr>
            <tr>
              <td style={{ ...styles.prognoseTd, ...styles.prognoseTdLabel }}>Earned Value</td>
              <td style={{ ...styles.prognoseTd, ...styles.prognoseTdValue }}>
                {formatCurrency(Math.round(cumEV))}
              </td>
              <td style={styles.prognoseTdDays}></td>
            </tr>
            <tr>
              <td colSpan="3"><div style={styles.prognoseDivider} /></td>
            </tr>
            <tr>
              <td style={{ ...styles.prognoseTd, ...styles.prognoseTdLabel }}>Budget (Prognose)</td>
              <td style={{
                ...styles.prognoseTd,
                ...styles.prognoseTdValue,
                ...(hasBudgetAbweichung ? styles.warningValue : {}),
              }}>
                {prognose.budgetPrognose != null ? formatCurrency(Math.round(prognose.budgetPrognose)) : '—'}
              </td>
              <td style={styles.prognoseTdDays}>
                {prognose.latestCpi != null ? `CPI ${prognose.latestCpi.toFixed(2)}` : ''}
              </td>
            </tr>
            <tr>
              <td style={{ ...styles.prognoseTd, ...styles.prognoseTdLabel }}>Abweichung</td>
              <td style={{
                ...styles.prognoseTd,
                ...styles.prognoseTdValue,
                ...(hasBudgetAbweichung ? styles.warningValue : {}),
              }}>
                {prognose.budgetAbweichung != null
                  ? `${prognose.budgetAbweichung > 0 ? '+' : ''}${formatCurrency(Math.round(prognose.budgetAbweichung))}`
                  : '—'}
              </td>
              <td style={styles.prognoseTdDays}></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============== Main Component ==============

function StatusberichtKosten({ data, onChange, projektauftrag }) {
  const budget = data.cost_budget ?? 0;
  const months = data.cost_months || [];
  const fortschritt = data.goals_tracking?.fortschritt ?? 0;

  // Earned Value = Budget × Gesamtfortschritt%
  const cumEV = budget * (fortschritt / 100);

  const handleBudgetChange = (value) => {
    onChange({ cost_budget: parseNum(value) });
  };

  const handleMonthChange = (index, field, value) => {
    const updated = [...months];
    updated[index] = { ...updated[index], [field]: parseNum(value) };
    onChange({ cost_months: updated });
  };

  const cumData = useMemo(() => computeCumulative(months, budget, fortschritt), [months, budget, fortschritt]);
  const prognose = useMemo(() => computePrognose(cumData, budget, cumEV), [cumData, budget, cumEV]);

  const totals = useMemo(() => ({
    plan: months.reduce((s, m) => s + m.plan, 0),
    ist: months.reduce((s, m) => s + m.ist, 0),
    forecast: months.reduce((s, m) => s + m.forecast, 0),
  }), [months]);

  if (months.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h2 style={styles.title}>Kosten</h2>
          <p style={styles.subtitle}>
            Keine Monate verfügbar. Bitte Start- und Enddatum im Projektauftrag definieren.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Kosten</h2>
        <p style={styles.subtitle}>
          Erfassen Sie die monatlichen Plan-, Ist- und Forecast-Kosten. Der Earned Value wird aus dem Gesamtfortschritt (Ziele-Tab) errechnet.
        </p>
      </div>

      {/* Budget + EV Info */}
      <div>
        <div style={styles.sectionLabel}>Gesamtbudget</div>
        <div style={styles.budgetRow}>
          <span style={styles.budgetLabel}>Budget (Plan)</span>
          <input
            type="number"
            value={budget || ''}
            onChange={(e) => handleBudgetChange(e.target.value)}
            style={styles.budgetInput}
            placeholder="0"
            onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
            onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
          />
          <span style={styles.budgetUnit}>€</span>
        </div>
        <div style={{ ...styles.evInfo, marginTop: theme.spacing.sm }}>
          <span>Earned Value (errechnet):</span>
          <span style={styles.evValue}>{formatCurrency(Math.round(cumEV))}</span>
          <span>= {formatCurrency(budget)} × {fortschritt}% Fortschritt</span>
        </div>
      </div>

      {/* Monatliche Kosten */}
      <div>
        <div style={styles.sectionLabel}>Kosten — monatlich</div>
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, ...styles.thLabel }}>Kategorie</th>
                {months.map((m) => (
                  <th key={m.month} style={styles.th}>{formatMonthLabel(m.month)}</th>
                ))}
                <th style={{ ...styles.th, ...styles.thTotal }}>Gesamt</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...styles.td, ...styles.tdLabel }}>Plan</td>
                {months.map((m, i) => (
                  <td key={m.month} style={styles.td}>
                    <input
                      type="number"
                      value={m.plan || ''}
                      onChange={(e) => handleMonthChange(i, 'plan', e.target.value)}
                      style={styles.cellInput}
                      placeholder="0"
                      onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
                      onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
                    />
                  </td>
                ))}
                <td style={{ ...styles.td, ...styles.tdTotal }}>{formatCurrency(totals.plan)}</td>
              </tr>
              <tr>
                <td style={{ ...styles.td, ...styles.tdLabel }}>Ist</td>
                {months.map((m, i) => (
                  <td key={m.month} style={styles.td}>
                    <input
                      type="number"
                      value={m.ist || ''}
                      onChange={(e) => handleMonthChange(i, 'ist', e.target.value)}
                      style={styles.cellInput}
                      placeholder="0"
                      onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
                      onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
                    />
                  </td>
                ))}
                <td style={{ ...styles.td, ...styles.tdTotal }}>{formatCurrency(totals.ist)}</td>
              </tr>
              <tr>
                <td style={{ ...styles.td, ...styles.tdLabel }}>Forecast</td>
                {months.map((m, i) => (
                  <td key={m.month} style={styles.td}>
                    <input
                      type="number"
                      value={m.forecast || ''}
                      onChange={(e) => handleMonthChange(i, 'forecast', e.target.value)}
                      style={styles.cellInput}
                      placeholder="0"
                      onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
                      onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
                    />
                  </td>
                ))}
                <td style={{ ...styles.td, ...styles.tdTotal }}>{formatCurrency(totals.forecast)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Kumuliert (errechnet) */}
      <div>
        <div style={styles.sectionLabel}>Kosten — kumuliert (errechnet)</div>
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, ...styles.thLabel }}>Kategorie</th>
                {cumData.map((d) => (
                  <th key={d.month} style={styles.th}>{formatMonthLabel(d.month)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...styles.td, ...styles.tdLabel }}>Budget</td>
                {cumData.map((d) => (
                  <td key={d.month} style={styles.td}>{formatCurrency(budget)}</td>
                ))}
              </tr>
              <tr>
                <td style={{ ...styles.td, ...styles.tdLabel }}>Plan</td>
                {cumData.map((d) => (
                  <td key={d.month} style={styles.td}>{formatCurrency(d.cumPlan)}</td>
                ))}
              </tr>
              <tr>
                <td style={{ ...styles.td, ...styles.tdLabel }}>Ist</td>
                {cumData.map((d) => (
                  <td key={d.month} style={styles.td}>{d.cumIst != null ? formatCurrency(d.cumIst) : ''}</td>
                ))}
              </tr>
              <tr>
                <td style={{ ...styles.td, ...styles.tdLabel }}>Forecast</td>
                {cumData.map((d) => (
                  <td key={d.month} style={styles.td}>{d.cumForecast != null ? formatCurrency(d.cumForecast) : ''}</td>
                ))}
              </tr>
              <tr>
                <td style={{ ...styles.td, ...styles.tdLabel }}>Earned Value</td>
                {cumData.map((d) => (
                  <td key={d.month} style={styles.td}>{d.cumEV != null ? formatCurrency(Math.round(d.cumEV)) : ''}</td>
                ))}
              </tr>
              <tr>
                <td style={{ ...styles.td, ...styles.tdLabel }}>Prognose</td>
                {prognose.prognoseValues.map((v, i) => (
                  <td key={i} style={styles.td}>{v != null ? formatCurrency(Math.round(v)) : ''}</td>
                ))}
              </tr>
              <tr>
                <td style={{ ...styles.td, ...styles.tdLabel }}>CPI</td>
                {cumData.map((d) => (
                  <td key={d.month} style={styles.td}>{d.cpi != null ? d.cpi.toFixed(2) : ''}</td>
                ))}
              </tr>
              <tr>
                <td style={{ ...styles.td, ...styles.tdLabel }}>SPI</td>
                {cumData.map((d) => (
                  <td key={d.month} style={styles.td}>{d.spi != null ? d.spi.toFixed(2) : ''}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Prognosewerte + Kennzahlen */}
      <div>
        <div style={styles.sectionLabel}>Prognosewerte</div>
        <PrognosewertePanels
          projektauftrag={projektauftrag}
          berichtsDatum={data.datum}
          budget={budget}
          prognose={prognose}
          cumEV={cumEV}
        />
      </div>

      {/* Chart */}
      <div style={styles.chartContainer}>
        <div style={styles.chartTitle}>Earned Value Analyse (kumuliert)</div>
        <EarnedValueChart cumData={cumData} budget={budget} prognoseValues={prognose.prognoseValues} />
        <div style={styles.legend}>
          {[
            { color: COLORS.budget, label: 'Budget', dashed: true },
            { color: COLORS.plan, label: 'Plan' },
            { color: COLORS.ist, label: 'Ist' },
            { color: COLORS.forecast, label: 'Forecast', dashed: true },
            { color: COLORS.ev, label: 'Earned Value' },
            { color: COLORS.prognose, label: 'Prognose', dashed: true },
          ].map((item) => (
            <div key={item.label} style={styles.legendItem}>
              <div style={{
                ...styles.legendDot,
                backgroundColor: item.color,
                ...(item.dashed ? { background: `repeating-linear-gradient(90deg, ${item.color} 0px, ${item.color} 4px, transparent 4px, transparent 7px)` } : {}),
              }} />
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default StatusberichtKosten;
