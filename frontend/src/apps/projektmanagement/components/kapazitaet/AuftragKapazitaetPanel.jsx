/**
 * AuftragKapazitaetPanel — pro Teammitglied im Projektauftrag (ausklappbar).
 *
 * (a) Verknüpfung mit einer zentralen Kapazitätsperson (person_id).
 * (b) Gewünschter Bedarf dieses Projekts in PT/Monat (Ø + Monats-Overrides).
 * (c) Read-only: für die verknüpfte Person je Monat Linie + Bedarf aus anderen
 *     (genehmigten/laufenden) Projekten + verbleibend frei — aus dem
 *     `auslastung`-Endpoint (der den aktuellen Auftrag ausschließt).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { theme } from '../../../../config/theme';
import { useProjektmanagement } from '../../../../hooks/useProjektmanagement';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const fmtPT = (n) => (Number(n) || 0).toLocaleString('de-DE', { maximumFractionDigits: 1 });

function toMonthKey(d) {
  if (!d) return null;
  const s = String(d);
  return s.length >= 7 ? s.slice(0, 7) : null;
}
function monthKeys(from, to) {
  const [fy, fm] = from.split('-').map((s) => parseInt(s, 10));
  const [ty, tm] = to.split('-').map((s) => parseInt(s, 10));
  const out = [];
  if (!fy || !fm || !ty || !tm) return out;
  let y = fy; let m = fm;
  for (let i = 0; i < 240 && (y < ty || (y === ty && m <= tm)); i++) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}
function labelOf(key) {
  const m = parseInt(key.slice(5), 10);
  return `${MONTHS_SHORT[m - 1]} ${key.slice(2, 4)}`;
}

const styles = {
  panel: { marginTop: theme.spacing.md, padding: theme.spacing.lg, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.background, display: 'flex', flexDirection: 'column', gap: theme.spacing.md },
  linkRow: { display: 'flex', gap: theme.spacing.lg, flexWrap: 'wrap', alignItems: 'flex-end' },
  field: { display: 'flex', flexDirection: 'column', gap: theme.spacing.xs, minWidth: 200, flex: 1 },
  avgField: { display: 'flex', flexDirection: 'column', gap: theme.spacing.xs, width: 150 },
  label: { fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.medium, color: theme.colors.textSecondary },
  select: { padding: theme.spacing.md, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, fontSize: theme.typography.sizes.sm, backgroundColor: theme.colors.surface, color: theme.colors.text, cursor: 'pointer' },
  input: { padding: theme.spacing.md, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, fontSize: theme.typography.sizes.sm, backgroundColor: theme.colors.surface, color: theme.colors.text, outline: 'none', boxSizing: 'border-box' },
  hint: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted },
  tableWrap: { overflowX: 'auto' },
  table: { borderCollapse: 'collapse', minWidth: '100%' },
  th: { fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.semibold, color: theme.colors.textMuted, padding: `${theme.spacing.xs} ${theme.spacing.sm}`, borderBottom: `1px solid ${theme.colors.border}`, textAlign: 'center', whiteSpace: 'nowrap' },
  thLeft: { textAlign: 'left', position: 'sticky', left: 0, backgroundColor: theme.colors.background },
  td: { padding: `${theme.spacing.xs} ${theme.spacing.sm}`, borderBottom: `1px solid ${theme.colors.borderLight}`, textAlign: 'center', fontSize: theme.typography.sizes.sm },
  tdLeft: { textAlign: 'left', color: theme.colors.textSecondary, whiteSpace: 'nowrap', position: 'sticky', left: 0, backgroundColor: theme.colors.background },
  monthInput: { width: 52, padding: '4px 6px', border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, fontSize: theme.typography.sizes.sm, textAlign: 'center', backgroundColor: theme.colors.surface, color: theme.colors.text, outline: 'none' },
};

export default function AuftragKapazitaetPanel({ member, onChange, auftragId, startDate, endDate, personen, canEdit }) {
  const { getPersonAuslastung } = useProjektmanagement();
  const [auslastung, setAuslastung] = useState(null);

  const range = useMemo(() => {
    const y = new Date().getFullYear();
    return { from: toMonthKey(startDate) || `${y}-01`, to: toMonthKey(endDate) || `${y}-12` };
  }, [startDate, endDate]);
  const keys = useMemo(() => monthKeys(range.from, range.to), [range]);

  const reloadAuslastung = useCallback(async () => {
    if (!member.person_id) { setAuslastung(null); return; }
    try {
      const a = await getPersonAuslastung(member.person_id, { from: range.from, to: range.to, exclude: auftragId });
      setAuslastung(a);
    } catch { setAuslastung(null); }
  }, [member.person_id, range.from, range.to, auftragId, getPersonAuslastung]);
  // Mount-/Prop-getriebener Server-Fetch, der lokalen State synchronisiert; kein
  // Render-Cascade (gesetzter State ist nicht in den Effekt-Deps).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { reloadAuslastung(); }, [reloadAuslastung]);

  const bedarf = member.projekt_bedarf || {};
  const ausMap = useMemo(() => {
    const m = {};
    (auslastung?.monate || []).forEach((x) => { m[x.month] = x; });
    return m;
  }, [auslastung]);

  const setBedarfMonth = (key, raw) => {
    const monate = { ...(bedarf.monate || {}) };
    if (raw === '') delete monate[key]; else monate[key] = Number(raw) || 0;
    onChange({ projekt_bedarf: { ...bedarf, monate } });
  };
  const setBedarfAvg = (raw) => onChange({ projekt_bedarf: { ...bedarf, avg: raw === '' ? undefined : (Number(raw) || 0) } });
  const bedarfOf = (key) => (bedarf.monate?.[key] !== undefined ? Number(bedarf.monate[key]) : (bedarf.avg !== undefined ? Number(bedarf.avg) : 0));

  return (
    <div style={styles.panel}>
      <div style={styles.linkRow}>
        <div style={styles.field}>
          <label style={styles.label}>Verknüpfte Person (Kapazitätsplanung)</label>
          <select style={styles.select} value={member.person_id || ''} onChange={(e) => onChange({ person_id: e.target.value || undefined })} disabled={!canEdit}>
            <option value="">— nicht verknüpft —</option>
            {personen.map((p) => <option key={p.id} value={p.id}>{p.name}{p.role ? ` (${p.role})` : ''}</option>)}
          </select>
        </div>
        <div style={styles.avgField}>
          <label style={styles.label}>Bedarf Ø (PT/Monat)</label>
          <input style={styles.input} type="number" min="0" step="0.5" value={bedarf.avg ?? ''} onChange={(e) => setBedarfAvg(e.target.value)} placeholder="0" readOnly={!canEdit} />
        </div>
      </div>

      {keys.length > 0 ? (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, ...styles.thLeft }} />
                {keys.map((k) => <th key={k} style={styles.th}>{labelOf(k)}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...styles.td, ...styles.tdLeft }}>Bedarf dieses Projekt (PT)</td>
                {keys.map((k) => (
                  <td key={k} style={styles.td}>
                    <input
                      style={styles.monthInput} type="number" min="0" step="0.5"
                      placeholder={fmtPT(bedarf.avg || 0)}
                      value={bedarf.monate?.[k] ?? ''}
                      onChange={(e) => setBedarfMonth(k, e.target.value)}
                      readOnly={!canEdit}
                    />
                  </td>
                ))}
              </tr>
              {member.person_id && (
                <>
                  <tr>
                    <td style={{ ...styles.td, ...styles.tdLeft }}>Linie (PT)</td>
                    {keys.map((k) => <td key={k} style={styles.td}>{fmtPT(ausMap[k]?.linie)}</td>)}
                  </tr>
                  <tr>
                    <td style={{ ...styles.td, ...styles.tdLeft }}>Bedarf andere (genehmigt)</td>
                    {keys.map((k) => <td key={k} style={styles.td}>{fmtPT(ausMap[k]?.bedarf_genehmigt)}</td>)}
                  </tr>
                  <tr>
                    <td style={{ ...styles.td, ...styles.tdLeft }}>verbleibend frei (PT)</td>
                    {keys.map((k) => {
                      const base = ausMap[k] ? (ausMap[k].kapazitaet - ausMap[k].linie - ausMap[k].bedarf_genehmigt) : 0;
                      const frei = base - bedarfOf(k);
                      return <td key={k} style={{ ...styles.td, color: frei < 0 ? theme.colors.error : theme.colors.text }}>{fmtPT(frei)}</td>;
                    })}
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={styles.hint}>Kein Zeitraum am Auftrag — Start-/Enddatum im Basis-Tab setzen, dann erscheinen die Monatsspalten.</div>
      )}

      {!member.person_id && <div style={styles.hint}>Verknüpfe eine Person, um Linie und Belegung aus anderen Projekten zu sehen.</div>}
    </div>
  );
}
