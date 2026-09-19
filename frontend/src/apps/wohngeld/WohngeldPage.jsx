import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../config/theme';
import { useAppPermission } from '../../components/RequireAppPermission';
import {
  wohngeldApi, WOHNGELDART_LABEL, ANTRAGSART_LABEL, STATUS_LABEL, STATUS_ORDER,
  ACCENT, ACCENT_LIGHT,
} from './api';
import StatusBadge from './components/StatusBadge';

const styles = {
  container: { padding: `${theme.spacing.xl} ${theme.spacing['2xl']}`, maxWidth: 1100, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing.xl, gap: theme.spacing.lg },
  title: { fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, color: theme.colors.text },
  subtitle: { fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted, marginTop: theme.spacing.xs, maxWidth: 640, lineHeight: 1.5 },
  btn: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`, backgroundColor: ACCENT, color: '#fff', border: 'none',
    borderRadius: theme.borderRadius.lg, fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  btnGhost: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`, backgroundColor: 'transparent', color: theme.colors.text, border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg, fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, cursor: 'pointer',
  },
  toolbar: { display: 'flex', gap: theme.spacing.md, marginBottom: theme.spacing.lg, flexWrap: 'wrap', alignItems: 'center' },
  search: {
    flex: 1, minWidth: 220, padding: `${theme.spacing.md} ${theme.spacing.lg}`, fontSize: theme.typography.sizes.base,
    border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.surface, color: theme.colors.text, outline: 'none',
  },
  filterTabs: { display: 'flex', gap: theme.spacing.xs, flexWrap: 'wrap' },
  filterTab: {
    padding: `6px ${theme.spacing.md}`, backgroundColor: 'transparent', border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.full,
    fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.medium, color: theme.colors.textMuted, cursor: 'pointer',
  },
  filterTabActive: { backgroundColor: ACCENT_LIGHT, color: ACCENT, borderColor: ACCENT_LIGHT },
  tableWrap: { border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.xl, overflow: 'hidden', backgroundColor: theme.colors.surface },
  tableScroll: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: theme.typography.sizes.sm, minWidth: 820 },
  th: { textAlign: 'left', padding: `${theme.spacing.md} ${theme.spacing.lg}`, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, fontWeight: theme.typography.weights.semibold, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: `1px solid ${theme.colors.border}`, whiteSpace: 'nowrap' },
  td: { padding: `${theme.spacing.md} ${theme.spacing.lg}`, color: theme.colors.text, borderBottom: `1px solid ${theme.colors.borderLight}`, whiteSpace: 'nowrap' },
  row: { cursor: 'pointer' },
  empty: { padding: theme.spacing['3xl'], textAlign: 'center', color: theme.colors.textMuted },
  error: { padding: theme.spacing.md, backgroundColor: theme.colors.errorLight, color: theme.colors.error, borderRadius: theme.borderRadius.md, marginBottom: theme.spacing.md, fontSize: theme.typography.sizes.sm },
  // Modal
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.xl, width: '90%', maxWidth: 520, padding: theme.spacing.xl, maxHeight: '90vh', overflow: 'auto' },
  modalTitle: { fontSize: theme.typography.sizes.lg, fontWeight: theme.typography.weights.semibold, color: theme.colors.text, marginBottom: theme.spacing.lg },
  label: { display: 'block', fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.text, marginBottom: theme.spacing.xs },
  input: { width: '100%', padding: theme.spacing.md, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, fontSize: theme.typography.sizes.sm, backgroundColor: theme.colors.surface, color: theme.colors.text, outline: 'none', marginBottom: theme.spacing.lg },
  select: { width: '100%', padding: theme.spacing.md, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, fontSize: theme.typography.sizes.sm, backgroundColor: theme.colors.surface, color: theme.colors.text, cursor: 'pointer', marginBottom: theme.spacing.lg },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: theme.spacing.md, marginTop: theme.spacing.sm },
};

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return iso.slice(0, 10); }
}

export default function WohngeldPage() {
  const navigate = useNavigate();
  const { role } = useAppPermission();
  const canEdit = role === 'owner' || role === 'editor';

  const [vorgaenge, setVorgaenge] = useState([]);
  const [akten, setAkten] = useState({}); // akteId -> akte
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('alle');
  const [query, setQuery] = useState('');

  const [dialog, setDialog] = useState(null); // { name, wohngeldart, antragsart }
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [vg, ak] = await Promise.all([wohngeldApi.listVorgaenge(), wohngeldApi.listAkten()]);
        if (cancelled) return;
        setVorgaenge(vg);
        setAkten(Object.fromEntries((ak || []).map((a) => [a.id, a])));
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function antragstellerName(v) {
    const a = akten[v.akteId];
    return a?.antragstellerName || a?.name || '—';
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vorgaenge.filter((v) => {
      if (statusFilter !== 'alle' && v.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [v.antragsId, antragstellerName(v), v.sachbearbeiter, WOHNGELDART_LABEL[v.wohngeldart], ANTRAGSART_LABEL[v.antragsart]]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vorgaenge, akten, statusFilter, query]);

  async function createVorgang() {
    if (!dialog?.name?.trim()) return;
    setSaving(true); setError('');
    try {
      const akte = await wohngeldApi.createAkte({ name: dialog.name.trim(), antragstellerName: dialog.name.trim() });
      const vorgang = await wohngeldApi.createVorgang({
        akteId: akte.id,
        wohngeldart: dialog.wohngeldart,
        antragsart: dialog.antragsart,
      });
      setAkten((m) => ({ ...m, [akte.id]: akte }));
      setVorgaenge((vs) => [vorgang, ...vs]);
      setDialog(null);
      navigate(`/apps/wohngeld/vorgang/${vorgang.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const statusTabs = ['alle', ...STATUS_ORDER];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Wohngeld</h1>
          <p style={styles.subtitle}>
            Wohngeldanträge auf Vollständigkeit und Plausibilität prüfen und Nachforderungen erstellen.
            Jeder Vorgang bündelt Personen, Nachweise, Prüfschritte und Schreiben.
          </p>
        </div>
        {canEdit && (
          <button style={styles.btn} onClick={() => setDialog({ name: '', wohngeldart: 'mietzuschuss', antragsart: 'erstantrag' })}>
            + Neuer Vorgang
          </button>
        )}
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.toolbar}>
        <input
          style={styles.search}
          placeholder="Suche nach Antrags-ID, Antragsteller, Sachbearbeiter …"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div style={styles.filterTabs}>
          {statusTabs.map((s) => (
            <button
              key={s}
              style={{ ...styles.filterTab, ...(statusFilter === s ? styles.filterTabActive : {}) }}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'alle' ? 'Alle' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={styles.empty}>Lädt…</div>
      ) : filtered.length === 0 ? (
        <div style={styles.empty}>
          {vorgaenge.length === 0 ? 'Noch keine Vorgänge.' : 'Keine Vorgänge für diesen Filter.'}
          {canEdit && vorgaenge.length === 0 ? ' Lege den ersten Vorgang an.' : ''}
        </div>
      ) : (
        <div style={styles.tableWrap}>
          <div style={styles.tableScroll}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Antrags-ID</th>
                  <th style={styles.th}>Antragsteller</th>
                  <th style={styles.th}>Wohngeldart</th>
                  <th style={styles.th}>Antragsart</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Sachbearbeiter</th>
                  <th style={styles.th}>Letzte Änderung</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <tr
                    key={v.id}
                    style={styles.row}
                    onClick={() => navigate(`/apps/wohngeld/vorgang/${v.id}`)}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surfaceHover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <td style={{ ...styles.td, fontWeight: theme.typography.weights.medium }}>{v.antragsId}</td>
                    <td style={styles.td}>{antragstellerName(v)}</td>
                    <td style={styles.td}>{WOHNGELDART_LABEL[v.wohngeldart] || v.wohngeldart}</td>
                    <td style={styles.td}>{ANTRAGSART_LABEL[v.antragsart] || v.antragsart}</td>
                    <td style={styles.td}><StatusBadge status={v.status} /></td>
                    <td style={styles.td}>{v.sachbearbeiter || '—'}</td>
                    <td style={{ ...styles.td, color: theme.colors.textMuted }}>{fmtDate(v.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {dialog && (
        <div style={styles.overlay} onClick={() => !saving && setDialog(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>Neuer Vorgang</div>

            <label style={styles.label}>Name der antragstellenden Person</label>
            <input
              style={styles.input}
              autoFocus
              placeholder="z. B. Nachname, Vorname"
              value={dialog.name}
              onChange={(e) => setDialog({ ...dialog, name: e.target.value })}
            />

            <label style={styles.label}>Wohngeldart</label>
            <select style={styles.select} value={dialog.wohngeldart} onChange={(e) => setDialog({ ...dialog, wohngeldart: e.target.value })}>
              {Object.entries(WOHNGELDART_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>

            <label style={styles.label}>Antragsart</label>
            <select style={styles.select} value={dialog.antragsart} onChange={(e) => setDialog({ ...dialog, antragsart: e.target.value })}>
              {Object.entries(ANTRAGSART_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>

            <div style={styles.modalActions}>
              <button style={styles.btnGhost} onClick={() => setDialog(null)} disabled={saving}>Abbrechen</button>
              <button style={styles.btn} onClick={createVorgang} disabled={saving || !dialog.name.trim()}>
                {saving ? 'Legt an…' : 'Anlegen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
