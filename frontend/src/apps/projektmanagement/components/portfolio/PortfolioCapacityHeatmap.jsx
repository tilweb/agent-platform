/**
 * PortfolioCapacityHeatmap — Ressourcen- & Engpassansicht im Portfolio-Dashboard.
 *
 * Zeilen umschaltbar Rollen (aggregiert) ↔ Personen, Spalten = Monate. Je Zelle
 * die Auslastung% = (Linie + Projektbedarf) / Kapazität, getönt: grün ≤85 %,
 * gelb 85–100 %, rot >100 %. Zweiter Umschalter: nur genehmigte/laufende Projekte
 * vs. inkl. Entwürfe (Szenario). Datenquelle: GET /portfolios/:id/capacity — die
 * Belegung je Person ist die GESAMT-Auslastung (Linie + alle verknüpften
 * Projekte, portfolioübergreifend), damit echte Engpässe sichtbar werden.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { theme } from '../../../../config/theme';
import { useProjektmanagement } from '../../../../hooks/useProjektmanagement';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

function monthLabel(key) {
  const m = parseInt(key.slice(5), 10);
  return `${MONTHS_SHORT[m - 1] || key} ${key.slice(2, 4)}`;
}

/** Auslastung% einer Zelle. `null` wenn keine Kapazität hinterlegt. */
function auslastungPct(cell, includeEntwurf) {
  const kap = Number(cell?.kapazitaet) || 0;
  if (kap <= 0) return null;
  const belegt = (Number(cell?.linie) || 0)
    + (Number(cell?.bedarf_genehmigt) || 0)
    + (includeEntwurf ? (Number(cell?.bedarf_entwurf) || 0) : 0);
  return (belegt / kap) * 100;
}

/** Farbband der Zelle nach Auslastung. */
function bandColors(pct) {
  if (pct === null) return { bg: theme.colors.background, fg: theme.colors.textMuted };
  if (pct <= 85) return { bg: theme.colors.successLight, fg: theme.colors.success };
  if (pct <= 100) return { bg: theme.colors.warningLight, fg: theme.colors.warning };
  return { bg: theme.colors.errorLight, fg: theme.colors.error };
}

function configLabel(appConfig, key, value) {
  if (!appConfig || !value) return value || '';
  const list = appConfig[key];
  if (!Array.isArray(list)) return value;
  const hit = list.find((o) => o.value === value);
  return hit?.label || value;
}

const styles = {
  toolbar: { display: 'flex', gap: theme.spacing.lg, flexWrap: 'wrap', alignItems: 'center', marginBottom: theme.spacing.md },
  toggleGroup: { display: 'flex', gap: theme.spacing.xs, alignItems: 'center' },
  toggleLabel: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginRight: theme.spacing.xs },
  toggle: {
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    backgroundColor: 'transparent',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    cursor: 'pointer',
  },
  toggleActive: { backgroundColor: theme.colors.primaryLight, color: theme.colors.primary, borderColor: theme.colors.primaryLight },

  legend: { display: 'flex', gap: theme.spacing.md, alignItems: 'center', marginLeft: 'auto', flexWrap: 'wrap' },
  legendItem: { display: 'flex', alignItems: 'center', gap: theme.spacing.xs, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted },
  legendSwatch: { width: 12, height: 12, borderRadius: theme.borderRadius.sm },

  tableWrap: { overflowX: 'auto', border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg },
  table: { borderCollapse: 'collapse', minWidth: '100%' },
  th: {
    fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.semibold, color: theme.colors.textMuted,
    padding: `${theme.spacing.sm} ${theme.spacing.sm}`, borderBottom: `1px solid ${theme.colors.border}`,
    textAlign: 'center', whiteSpace: 'nowrap',
  },
  thRow: {
    textAlign: 'left', position: 'sticky', left: 0, zIndex: 1,
    backgroundColor: theme.colors.surface, minWidth: 180,
  },
  rowLabelCell: {
    position: 'sticky', left: 0, zIndex: 1, backgroundColor: theme.colors.surface,
    padding: `${theme.spacing.sm} ${theme.spacing.sm}`, borderBottom: `1px solid ${theme.colors.borderLight}`,
    borderRight: `1px solid ${theme.colors.border}`, whiteSpace: 'nowrap',
  },
  rowLabelName: { fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.text },
  rowLabelSub: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted },
  cell: {
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`, borderBottom: `1px solid ${theme.colors.borderLight}`,
    textAlign: 'center', fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, whiteSpace: 'nowrap',
  },
  emptyRow: { padding: theme.spacing.lg, fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted, fontStyle: 'italic', textAlign: 'center' },
};

export default function PortfolioCapacityHeatmap({ portfolioId, appConfig }) {
  const { getPortfolioCapacity } = useProjektmanagement();
  const [capacity, setCapacity] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rowMode, setRowMode] = useState('rollen');       // 'rollen' | 'personen'
  const [includeEntwurf, setIncludeEntwurf] = useState(false);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const cap = await getPortfolioCapacity(portfolioId);
      setCapacity(cap);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [portfolioId, getPortfolioCapacity]);
  useEffect(() => { reload(); }, [reload]);

  const months = capacity?.months || [];
  const rows = useMemo(() => {
    if (!capacity) return [];
    const base = rowMode === 'rollen' ? capacity.rollen : capacity.personen;
    return (base || []).map((r) => ({
      ...r,
      display: rowMode === 'rollen'
        ? (r.id === '__none__' ? 'Ohne Rolle' : configLabel(appConfig, 'role', r.id))
        : r.name,
      sub: rowMode === 'personen' ? (r.role ? configLabel(appConfig, 'role', r.role) : null) : null,
    }));
  }, [capacity, rowMode, appConfig]);

  if (isLoading) return <div style={styles.emptyRow}>Lade Kapazitätsdaten…</div>;
  if (error) return <div style={{ ...styles.emptyRow, color: theme.colors.error }}>{error}</div>;
  if (!capacity || rows.length === 0 || months.length === 0) {
    return (
      <div style={styles.emptyRow}>
        Keine verknüpften Kapazitätspersonen in diesem Portfolio. Verknüpfe im Projektauftrag (Tab „Personen")
        Teammitglieder mit zentralen Personen aus der Kapazitätsplanung, dann erscheint hier die Heatmap.
      </div>
    );
  }

  return (
    <div>
      <div style={styles.toolbar}>
        <div style={styles.toggleGroup}>
          <span style={styles.toggleLabel}>Zeilen</span>
          <button type="button" style={{ ...styles.toggle, ...(rowMode === 'rollen' ? styles.toggleActive : {}) }} onClick={() => setRowMode('rollen')}>Rollen</button>
          <button type="button" style={{ ...styles.toggle, ...(rowMode === 'personen' ? styles.toggleActive : {}) }} onClick={() => setRowMode('personen')}>Personen</button>
        </div>
        <div style={styles.toggleGroup}>
          <span style={styles.toggleLabel}>Szenario</span>
          <button type="button" style={{ ...styles.toggle, ...(!includeEntwurf ? styles.toggleActive : {}) }} onClick={() => setIncludeEntwurf(false)}>nur genehmigt/laufend</button>
          <button type="button" style={{ ...styles.toggle, ...(includeEntwurf ? styles.toggleActive : {}) }} onClick={() => setIncludeEntwurf(true)}>inkl. Entwürfe</button>
        </div>
        <div style={styles.legend}>
          <div style={styles.legendItem}><span style={{ ...styles.legendSwatch, backgroundColor: theme.colors.successLight }} /> ≤ 85 %</div>
          <div style={styles.legendItem}><span style={{ ...styles.legendSwatch, backgroundColor: theme.colors.warningLight }} /> 85–100 %</div>
          <div style={styles.legendItem}><span style={{ ...styles.legendSwatch, backgroundColor: theme.colors.errorLight }} /> &gt; 100 % (Engpass)</div>
        </div>
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, ...styles.thRow }}>{rowMode === 'rollen' ? 'Rolle' : 'Person'}</th>
              {months.map((m) => <th key={m} style={styles.th}>{monthLabel(m)}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={styles.rowLabelCell}>
                  <div style={styles.rowLabelName}>{row.display || '—'}</div>
                  {row.sub && <div style={styles.rowLabelSub}>{row.sub}</div>}
                </td>
                {row.monate.map((cell) => {
                  const pct = auslastungPct(cell, includeEntwurf);
                  const c = bandColors(pct);
                  return (
                    <td
                      key={cell.month}
                      style={{ ...styles.cell, backgroundColor: c.bg, color: c.fg }}
                      title={pct === null
                        ? 'Keine Kapazität hinterlegt'
                        : `Kapazität ${(+cell.kapazitaet).toFixed(1)} · Linie ${(+cell.linie).toFixed(1)} · Bedarf genehmigt ${(+cell.bedarf_genehmigt).toFixed(1)}${includeEntwurf ? ` · Entwurf ${(+cell.bedarf_entwurf).toFixed(1)}` : ''} PT`}
                    >
                      {pct === null ? '—' : `${Math.round(pct)} %`}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
