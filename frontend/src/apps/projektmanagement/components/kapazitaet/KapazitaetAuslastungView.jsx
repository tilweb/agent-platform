/**
 * KapazitaetAuslastungView — Ressourcen- & Engpassansicht im Kapazitätsplanung-Tab.
 *
 * Analog zur Portfolio-Heatmap, aber über ALLE zentralen Personen und pro Person
 * ausklappbar: neben der Gesamt-Auslastung je Monat zeigt die Aufklappung die
 * Zusammensetzung aus Kapazität, Linie, Projekten (genehmigt/laufend) und
 * Projektanfragen (Entwürfe) sowie „frei". Zellen der Auslastungszeile getönt:
 * grün ≤85 %, gelb 85–100 %, rot >100 % (Engpass). Szenario-Umschalter blendet
 * die Projektanfragen (Entwürfe) in die Auslastung ein.
 * Datenquelle: GET /kapazitaeten/auslastung.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { theme } from '../../../../config/theme';
import { useProjektmanagement } from '../../../../hooks/useProjektmanagement';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const fmtPT = (n) => (Number(n) || 0).toLocaleString('de-DE', { maximumFractionDigits: 1 });

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

function bandColors(pct) {
  if (pct === null) return { bg: theme.colors.background, fg: theme.colors.textMuted };
  if (pct <= 85) return { bg: theme.colors.successLight, fg: theme.colors.success };
  if (pct <= 100) return { bg: theme.colors.warningLight, fg: theme.colors.warning };
  return { bg: theme.colors.errorLight, fg: theme.colors.error };
}

/** frei (PT) = Kapazität − Linie − genehmigt (− Entwurf im Szenario). */
function freiOf(cell, includeEntwurf) {
  return (Number(cell?.kapazitaet) || 0)
    - (Number(cell?.linie) || 0)
    - (Number(cell?.bedarf_genehmigt) || 0)
    - (includeEntwurf ? (Number(cell?.bedarf_entwurf) || 0) : 0);
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
    padding: `${theme.spacing.xs} ${theme.spacing.md}`, backgroundColor: 'transparent',
    border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.textMuted, cursor: 'pointer',
  },
  toggleActive: { backgroundColor: theme.colors.primaryLight, color: theme.colors.primary, borderColor: theme.colors.primaryLight },
  legend: { display: 'flex', gap: theme.spacing.md, alignItems: 'center', marginLeft: 'auto', flexWrap: 'wrap' },
  legendItem: { display: 'flex', alignItems: 'center', gap: theme.spacing.xs, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted },
  legendSwatch: { width: 12, height: 12, borderRadius: theme.borderRadius.sm },

  tableWrap: { overflowX: 'auto', border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg },
  table: { borderCollapse: 'collapse', minWidth: '100%' },
  th: {
    fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.semibold, color: theme.colors.textMuted,
    padding: `${theme.spacing.sm} ${theme.spacing.sm}`, borderBottom: `1px solid ${theme.colors.border}`, textAlign: 'center', whiteSpace: 'nowrap',
  },
  thRow: { textAlign: 'left', position: 'sticky', left: 0, zIndex: 1, backgroundColor: theme.colors.surface, minWidth: 200 },

  nameCell: {
    position: 'sticky', left: 0, zIndex: 1, backgroundColor: theme.colors.surface,
    padding: `${theme.spacing.sm} ${theme.spacing.sm}`, borderBottom: `1px solid ${theme.colors.borderLight}`,
    borderRight: `1px solid ${theme.colors.border}`, whiteSpace: 'nowrap', cursor: 'pointer',
  },
  nameInner: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm },
  caret: { color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm, width: 12, textAlign: 'center' },
  nameText: { fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.text },
  roleText: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginLeft: theme.spacing.xs },
  pctCell: {
    padding: `${theme.spacing.sm} ${theme.spacing.sm}`, borderBottom: `1px solid ${theme.colors.borderLight}`,
    textAlign: 'center', fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, whiteSpace: 'nowrap',
  },

  // Aufgeklappte Zusammensetzung
  subLabelCell: {
    position: 'sticky', left: 0, zIndex: 1, backgroundColor: theme.colors.background,
    padding: `4px ${theme.spacing.sm} 4px ${theme.spacing.xl}`, borderBottom: `1px solid ${theme.colors.borderLight}`,
    borderRight: `1px solid ${theme.colors.border}`, whiteSpace: 'nowrap',
    fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary,
  },
  subCell: {
    padding: `4px ${theme.spacing.sm}`, borderBottom: `1px solid ${theme.colors.borderLight}`, backgroundColor: theme.colors.background,
    textAlign: 'center', fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary, whiteSpace: 'nowrap',
  },

  empty: { textAlign: 'center', padding: theme.spacing['2xl'], color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm, fontStyle: 'italic' },
};

// Zusammensetzungs-Zeilen (Reihenfolge = Anzeige). `key` referenziert das Zellfeld
// bzw. abgeleitete Werte.
const SUB_ROWS = [
  { key: 'kapazitaet', label: 'Kapazität (PT)' },
  { key: 'linie', label: 'Linie (PT)' },
  { key: 'bedarf_genehmigt', label: 'Projekte (genehmigt/laufend, PT)' },
  { key: 'bedarf_entwurf', label: 'Projektanfragen (Entwürfe, PT)' },
  { key: 'frei', label: 'frei (PT)' },
];

export default function KapazitaetAuslastungView({ appConfig }) {
  const { getKapazitaetOverview } = useProjektmanagement();
  const [overview, setOverview] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [includeEntwurf, setIncludeEntwurf] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const o = await getKapazitaetOverview();
      setOverview(o);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [getKapazitaetOverview]);
  useEffect(() => { reload(); }, [reload]);

  const months = overview?.months || [];
  const personen = useMemo(() => overview?.personen || [], [overview]);

  const toggle = (id) => setExpanded((prev) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  if (isLoading) return <div style={styles.empty}>Lade Auslastung…</div>;
  if (error) return <div style={{ ...styles.empty, color: theme.colors.error }}>{error}</div>;
  if (personen.length === 0 || months.length === 0) {
    return <div style={styles.empty}>Noch keine Personen erfasst — lege im Reiter „Personen" welche an, dann erscheint hier die Auslastung.</div>;
  }

  const subValue = (row, cell) => (row.key === 'frei' ? freiOf(cell, includeEntwurf) : (Number(cell?.[row.key]) || 0));

  return (
    <div>
      <div style={styles.toolbar}>
        <div style={styles.toggleGroup}>
          <span style={styles.toggleLabel}>Szenario</span>
          <button type="button" style={{ ...styles.toggle, ...(!includeEntwurf ? styles.toggleActive : {}) }} onClick={() => setIncludeEntwurf(false)}>nur genehmigt/laufend</button>
          <button type="button" style={{ ...styles.toggle, ...(includeEntwurf ? styles.toggleActive : {}) }} onClick={() => setIncludeEntwurf(true)}>inkl. Projektanfragen</button>
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
              <th style={{ ...styles.th, ...styles.thRow }}>Person</th>
              {months.map((m) => <th key={m} style={styles.th}>{monthLabel(m)}</th>)}
            </tr>
          </thead>
          <tbody>
            {personen.map((p) => {
              const open = expanded.has(p.id);
              return (
                <FragmentRow
                  key={p.id}
                  person={p}
                  open={open}
                  includeEntwurf={includeEntwurf}
                  appConfig={appConfig}
                  onToggle={() => toggle(p.id)}
                  subValue={subValue}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FragmentRow({ person, open, includeEntwurf, appConfig, onToggle, subValue }) {
  return (
    <>
      <tr>
        <td style={styles.nameCell} onClick={onToggle}>
          <div style={styles.nameInner}>
            <span style={styles.caret}>{open ? '▾' : '▸'}</span>
            <span style={styles.nameText}>{person.name || 'Unbenannt'}</span>
            {person.role && <span style={styles.roleText}>{configLabel(appConfig, 'role', person.role)}</span>}
          </div>
        </td>
        {person.monate.map((cell) => {
          const pct = auslastungPct(cell, includeEntwurf);
          const c = bandColors(pct);
          return (
            <td key={cell.month} style={{ ...styles.pctCell, backgroundColor: c.bg, color: c.fg }}>
              {pct === null ? '—' : `${Math.round(pct)} %`}
            </td>
          );
        })}
      </tr>
      {open && SUB_ROWS.map((row) => (
        <tr key={row.key}>
          <td style={styles.subLabelCell}>{row.label}</td>
          {person.monate.map((cell) => {
            const v = subValue(row, cell);
            const isFrei = row.key === 'frei';
            return (
              <td key={cell.month} style={{ ...styles.subCell, ...(isFrei && v < 0 ? { color: theme.colors.error, fontWeight: theme.typography.weights.semibold } : {}) }}>
                {fmtPT(v)}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
