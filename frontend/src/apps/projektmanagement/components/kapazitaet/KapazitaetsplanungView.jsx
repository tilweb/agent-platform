/**
 * KapazitaetsplanungView — Inhalt des Haupt-Tabs „Kapazitätsplanung" in ProjektePage.
 *
 * Zentrale, projektübergreifende Personen-Stammdaten: Rolle, Wochenarbeitszeit %,
 * Linien-Belegung (Ø PT/Monat + Monats-Overrides). Daraus abgeleitet die für
 * Projekte verfügbare Kapazität je Monat:
 *   Kapazität/Monat = 17 × Wochenarbeitszeit%/100   (Vollzeit-Basis nach Urlaub/…)
 *   Linie/Monat     = linie_monate[m] ?? linie_avg_pt
 *   verfügbar/Monat = Kapazität − Linie
 *
 * Jede Person ist eine ausklappbare Zeile mit Editor (Basisfelder + Monatstabelle).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { theme } from '../../../../config/theme';
import { useProjektmanagement } from '../../../../hooks/useProjektmanagement';
import { useAppPermission } from '../../../../components/RequireAppPermission';

const MAX_PT = 17; // Vollzeit-Basis PT/Monat
const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

const fmtPT = (n) => (Number(n) || 0).toLocaleString('de-DE', { maximumFractionDigits: 1 });

const styles = {
  container: { padding: theme.spacing['2xl'], height: '100%', display: 'flex', flexDirection: 'column' },
  actions: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.xl, gap: theme.spacing.md },
  intro: { fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted, maxWidth: 640 },
  createButton: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`, backgroundColor: theme.colors.primary, color: '#fff',
    border: 'none', borderRadius: theme.borderRadius.lg, fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  list: { display: 'flex', flexDirection: 'column', gap: theme.spacing.md },
  card: { backgroundColor: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg },
  cardHead: {
    display: 'flex', alignItems: 'center', gap: theme.spacing.lg, padding: theme.spacing.lg, cursor: 'pointer',
  },
  cardName: { fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold, color: theme.colors.text, flex: 1, minWidth: 0 },
  meta: { fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted, display: 'flex', gap: theme.spacing.lg, flexWrap: 'wrap' },
  metaStrong: { color: theme.colors.text, fontWeight: theme.typography.weights.medium },
  caret: { color: theme.colors.textMuted, fontSize: theme.typography.sizes.lg, width: 16, textAlign: 'center' },
  editor: { borderTop: `1px solid ${theme.colors.border}`, padding: theme.spacing.lg, display: 'flex', flexDirection: 'column', gap: theme.spacing.lg },
  fieldRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: theme.spacing.lg },
  field: { display: 'flex', flexDirection: 'column', gap: theme.spacing.xs },
  label: { fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.text },
  input: {
    padding: theme.spacing.md, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm, backgroundColor: theme.colors.surface, color: theme.colors.text, outline: 'none', boxSizing: 'border-box',
  },
  select: {
    padding: theme.spacing.md, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm, backgroundColor: theme.colors.surface, color: theme.colors.text, cursor: 'pointer',
  },
  hint: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted },
  monthHeaderRow: { display: 'flex', alignItems: 'center', gap: theme.spacing.md, marginBottom: theme.spacing.sm },
  monthTitle: { fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text },
  tableWrap: { overflowX: 'auto' },
  table: { borderCollapse: 'collapse', minWidth: '100%' },
  th: {
    fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.semibold, color: theme.colors.textMuted,
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`, borderBottom: `1px solid ${theme.colors.border}`, textAlign: 'center', whiteSpace: 'nowrap',
  },
  thLeft: { textAlign: 'left', position: 'sticky', left: 0, backgroundColor: theme.colors.surface },
  td: { padding: `${theme.spacing.xs} ${theme.spacing.sm}`, borderBottom: `1px solid ${theme.colors.borderLight}`, textAlign: 'center', fontSize: theme.typography.sizes.sm },
  tdLeft: { textAlign: 'left', color: theme.colors.textSecondary, whiteSpace: 'nowrap', position: 'sticky', left: 0, backgroundColor: theme.colors.surface },
  monthInput: { width: 52, padding: '4px 6px', border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, fontSize: theme.typography.sizes.sm, textAlign: 'center', backgroundColor: theme.colors.surface, color: theme.colors.text, outline: 'none' },
  editorActions: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.md },
  saveBtn: { padding: `${theme.spacing.sm} ${theme.spacing.lg}`, backgroundColor: theme.colors.primary, color: '#fff', border: 'none', borderRadius: theme.borderRadius.lg, fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, cursor: 'pointer' },
  deleteBtn: { padding: `${theme.spacing.sm} ${theme.spacing.lg}`, backgroundColor: 'transparent', color: theme.colors.error, border: `1px solid ${theme.colors.error}30`, borderRadius: theme.borderRadius.lg, fontSize: theme.typography.sizes.sm, cursor: 'pointer' },
  empty: { textAlign: 'center', padding: theme.spacing['3xl'], color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm },
  banner: { padding: theme.spacing.md, borderRadius: theme.borderRadius.lg, fontSize: theme.typography.sizes.sm, marginBottom: theme.spacing.md, backgroundColor: theme.colors.errorLight, color: theme.colors.error },
};

function monthKeys(year) {
  return MONTHS_SHORT.map((_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
}

export default function KapazitaetsplanungView() {
  const { listKapazitaetspersonen, createKapazitaetsperson, updateKapazitaetsperson, deleteKapazitaetsperson, getConfig } = useProjektmanagement();
  const { role: appRole } = useAppPermission('projektmanagement');
  const canEdit = appRole === 'editor' || appRole === 'owner';

  const [personen, setPersonen] = useState([]);
  const [config, setConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [draft, setDraft] = useState(null);   // { version, name, role, wochenarbeitszeit_pct, linie_avg_pt, linie_monate }
  const [year, setYear] = useState(new Date().getFullYear());
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setIsLoading(true); setError(null);
    try {
      const [list, cfg] = await Promise.all([listKapazitaetspersonen(), getConfig().catch(() => null)]);
      setPersonen(list);
      setConfig(cfg);
    } catch (err) { setError(err.message); }
    finally { setIsLoading(false); }
  }, [listKapazitaetspersonen, getConfig]);
  useEffect(() => { reload(); }, [reload]);

  const roleOpts = useMemo(() => config?.role || [], [config]);
  const roleLabel = (v) => roleOpts.find((o) => o.value === v)?.label || v || '—';

  const openEditor = (p) => {
    if (expandedId === p.id) { setExpandedId(null); setDraft(null); return; }
    setExpandedId(p.id);
    setDraft({
      version: p.version,
      name: p.name || '',
      role: p.role || '',
      wochenarbeitszeit_pct: p.wochenarbeitszeit_pct ?? 100,
      linie_avg_pt: p.linie_avg_pt ?? 0,
      linie_monate: { ...(p.linie_monate || {}) },
    });
  };

  const setDraftField = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const setMonth = (key, raw) => setDraft((d) => {
    const m = { ...d.linie_monate };
    if (raw === '' || raw === null) delete m[key];
    else m[key] = Number(raw) || 0;
    return { ...d, linie_monate: m };
  });

  const kapMonat = (waz) => MAX_PT * (Number(waz) || 0) / 100;
  const linieOfMonth = (d, key) => (d.linie_monate[key] !== undefined ? Number(d.linie_monate[key]) : Number(d.linie_avg_pt) || 0);

  const addPerson = async () => {
    setError(null);
    try {
      const p = await createKapazitaetsperson({ name: 'Neue Person', wochenarbeitszeit_pct: 100, linie_avg_pt: 0 });
      await reload();
      // Editor mit leerem Namensfeld öffnen (Placeholder als Hinweis) — der
      // Nutzer soll nicht erst "Neue Person" löschen müssen.
      if (p) { openEditor(p); setDraftField('name', ''); }
    } catch (err) { setError(err.message); }
  };

  const save = async (id) => {
    setSaving(true); setError(null);
    try {
      await updateKapazitaetsperson(id, {
        name: draft.name.trim() || 'Unbenannt',
        role: draft.role || undefined,
        wochenarbeitszeit_pct: Number(draft.wochenarbeitszeit_pct) || 0,
        linie_avg_pt: Number(draft.linie_avg_pt) || 0,
        linie_monate: draft.linie_monate,
        expectedVersion: draft.version,
      });
      setExpandedId(null); setDraft(null);
      await reload();
    } catch (err) {
      setError(err.current ? 'Die Person wurde zwischenzeitlich geändert. Bitte neu laden.' : err.message);
    } finally { setSaving(false); }
  };

  const remove = async (id) => {
    setError(null);
    try { await deleteKapazitaetsperson(id); setExpandedId(null); setDraft(null); await reload(); }
    catch (err) { setError(err.message); }
  };

  const keys = monthKeys(year);

  return (
    <div style={styles.container}>
      <div style={styles.actions}>
        <div style={styles.intro}>
          Zentrale Personen mit Rolle, Wochenarbeitszeit und Linien-Belegung. Basis für die Projekt-Verfügbarkeit
          und die Ressourcen-Heatmap. Annahme: max. {MAX_PT} PT/Monat bei 100 % (nach Urlaub, Krankheit, Weiterbildung).
        </div>
        {canEdit && <button type="button" style={styles.createButton} onClick={addPerson}>+ Person</button>}
      </div>

      {error && <div style={styles.banner}>{error}</div>}

      {isLoading ? (
        <div style={styles.empty}>Lade…</div>
      ) : personen.length === 0 ? (
        <div style={styles.empty}>Noch keine Personen erfasst. Lege die erste mit „+ Person" an.</div>
      ) : (
        <div style={styles.list}>
          {personen.map((p) => {
            const open = expandedId === p.id;
            const oVerfuegbar = kapMonat(p.wochenarbeitszeit_pct) - (Number(p.linie_avg_pt) || 0);
            return (
              <div key={p.id} style={styles.card}>
                <div style={styles.cardHead} onClick={() => openEditor(p)}>
                  <span style={styles.caret}>{open ? '▾' : '▸'}</span>
                  <span style={styles.cardName}>{p.name || 'Unbenannt'}</span>
                  <span style={styles.meta}>
                    <span>{roleLabel(p.role)}</span>
                    <span><span style={styles.metaStrong}>{p.wochenarbeitszeit_pct ?? 100} %</span> WAZ</span>
                    <span>Linie Ø <span style={styles.metaStrong}>{fmtPT(p.linie_avg_pt)}</span> PT</span>
                    <span>frei Ø <span style={{ ...styles.metaStrong, color: oVerfuegbar < 0 ? theme.colors.error : theme.colors.success }}>{fmtPT(oVerfuegbar)}</span> PT</span>
                  </span>
                </div>

                {open && draft && (
                  <div style={styles.editor}>
                    <div style={styles.fieldRow}>
                      <div style={styles.field}>
                        <label style={styles.label}>Name</label>
                        <input style={styles.input} value={draft.name} onChange={(e) => setDraftField('name', e.target.value)} placeholder="Name der Person" readOnly={!canEdit} />
                      </div>
                      <div style={styles.field}>
                        <label style={styles.label}>Rolle / Funktion</label>
                        <select style={styles.select} value={draft.role} onChange={(e) => setDraftField('role', e.target.value)} disabled={!canEdit}>
                          <option value="">— wählen —</option>
                          {roleOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <div style={styles.field}>
                        <label style={styles.label}>Wochenarbeitszeit %</label>
                        <input style={styles.input} type="number" min="0" max="100" value={draft.wochenarbeitszeit_pct} onChange={(e) => setDraftField('wochenarbeitszeit_pct', e.target.value)} readOnly={!canEdit} />
                      </div>
                      <div style={styles.field}>
                        <label style={styles.label}>Linie Ø (PT/Monat)</label>
                        <input style={styles.input} type="number" min="0" step="0.5" value={draft.linie_avg_pt} onChange={(e) => setDraftField('linie_avg_pt', e.target.value)} readOnly={!canEdit} />
                      </div>
                    </div>

                    <div>
                      <div style={styles.monthHeaderRow}>
                        <span style={styles.monthTitle}>Linien-Belegung pro Monat (überschreibt den Ø)</span>
                        <select style={{ ...styles.select, padding: '4px 8px' }} value={year} onChange={(e) => setYear(Number(e.target.value))}>
                          {[year - 1, year, year + 1, year + 2].map((y) => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <span style={styles.hint}>Kapazität/Monat = {fmtPT(kapMonat(draft.wochenarbeitszeit_pct))} PT</span>
                      </div>
                      <div style={styles.tableWrap}>
                        <table style={styles.table}>
                          <thead>
                            <tr>
                              <th style={{ ...styles.th, ...styles.thLeft }} />
                              {keys.map((k, i) => <th key={k} style={styles.th}>{MONTHS_SHORT[i]}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td style={{ ...styles.td, ...styles.tdLeft }}>Linie (PT)</td>
                              {keys.map((k) => (
                                <td key={k} style={styles.td}>
                                  <input
                                    style={styles.monthInput}
                                    type="number" min="0" step="0.5"
                                    placeholder={fmtPT(draft.linie_avg_pt)}
                                    value={draft.linie_monate[k] ?? ''}
                                    onChange={(e) => setMonth(k, e.target.value)}
                                    readOnly={!canEdit}
                                  />
                                </td>
                              ))}
                            </tr>
                            <tr>
                              <td style={{ ...styles.td, ...styles.tdLeft }}>frei für Projekte (PT)</td>
                              {keys.map((k) => {
                                const frei = kapMonat(draft.wochenarbeitszeit_pct) - linieOfMonth(draft, k);
                                return <td key={k} style={{ ...styles.td, color: frei < 0 ? theme.colors.error : theme.colors.text }}>{fmtPT(frei)}</td>;
                              })}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {canEdit && (
                      <div style={styles.editorActions}>
                        <button type="button" style={styles.deleteBtn} onClick={() => remove(p.id)}>Löschen</button>
                        <button type="button" style={{ ...styles.saveBtn, opacity: saving ? 0.6 : 1 }} onClick={() => save(p.id)} disabled={saving}>
                          {saving ? 'Speichern…' : 'Speichern'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
