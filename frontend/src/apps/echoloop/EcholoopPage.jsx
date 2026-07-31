import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../config/theme';
import { useAppPermission } from '../../components/RequireAppPermission';
import { echoloopApi } from './api';

const PURPLE = '#452C71';

const styles = {
  container: { padding: `${theme.spacing.xl} ${theme.spacing['2xl']}`, maxWidth: 1000, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing.xl },
  title: { fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, color: theme.colors.text },
  subtitle: { fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted, marginTop: theme.spacing.xs, maxWidth: 620, lineHeight: 1.5 },
  btn: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`, backgroundColor: PURPLE, color: '#fff', border: 'none',
    borderRadius: theme.borderRadius.lg, fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, cursor: 'pointer',
  },
  btnGhost: {
    padding: `6px ${theme.spacing.md}`, backgroundColor: 'transparent', color: PURPLE, border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md, fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.medium, cursor: 'pointer',
  },
  card: {
    backgroundColor: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg, marginBottom: theme.spacing.md,
  },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' },
  kundeName: { fontSize: theme.typography.sizes.md, fontWeight: theme.typography.weights.semibold, color: theme.colors.text },
  kundeMeta: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginTop: 2 },
  prozessRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.md, cursor: 'pointer', marginTop: theme.spacing.xs,
    border: `1px solid ${theme.colors.borderLight}`,
  },
  input: {
    padding: theme.spacing.sm, fontSize: theme.typography.sizes.sm, border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.surface, color: theme.colors.text, outline: 'none',
  },
  form: { display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.md, flexWrap: 'wrap', alignItems: 'center' },
  empty: { padding: theme.spacing['3xl'], textAlign: 'center', color: theme.colors.textMuted },
  error: { padding: theme.spacing.md, backgroundColor: theme.colors.errorLight, color: theme.colors.error, borderRadius: theme.borderRadius.md, marginBottom: theme.spacing.md, fontSize: theme.typography.sizes.sm },
};

export default function EcholoopPage() {
  const navigate = useNavigate();
  const { role } = useAppPermission();
  const canEdit = role === 'owner' || role === 'editor';

  const [kunden, setKunden] = useState([]);
  const [prozesse, setProzesse] = useState({}); // kundeId -> [prozess]
  const [open, setOpen] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [newKunde, setNewKunde] = useState(null); // {name,branche}
  const [newProzess, setNewProzess] = useState({}); // kundeId -> {name,emmaPlanNr}

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setKunden(await echoloopApi.listKunden()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function toggle(kundeId) {
    const next = !open[kundeId];
    setOpen((o) => ({ ...o, [kundeId]: next }));
    if (next && !prozesse[kundeId]) {
      try { setProzesse((p) => ({ ...p, [kundeId]: [] })); const list = await echoloopApi.listProzesse(kundeId); setProzesse((p) => ({ ...p, [kundeId]: list })); }
      catch (e) { setError(e.message); }
    }
  }

  async function createKunde() {
    if (!newKunde?.name?.trim()) return;
    try {
      const k = await echoloopApi.createKunde({ name: newKunde.name.trim(), branche: newKunde.branche });
      setKunden((ks) => [k, ...ks]); setNewKunde(null);
    } catch (e) { setError(e.message); }
  }

  async function createProzess(kundeId) {
    const form = newProzess[kundeId];
    if (!form?.name?.trim()) return;
    try {
      const p = await echoloopApi.createProzess({ kundeId, name: form.name.trim(), emmaPlanNr: form.emmaPlanNr });
      setProzesse((prev) => ({ ...prev, [kundeId]: [p, ...(prev[kundeId] || [])] }));
      setNewProzess((n) => ({ ...n, [kundeId]: null }));
      setOpen((o) => ({ ...o, [kundeId]: true }));
    } catch (e) { setError(e.message); }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Echo-Loop</h1>
          <p style={styles.subtitle}>
            RPA-Prozesse (EMMA Studio) analysieren und benoten: EMMA-Export hochladen → deterministischer Prüfmuster-Check
            + Reifegrad-Vorbenotung (D1–D10) → Review durch Analyst → Baustand mit Gesamt-RG / RGQ / SE-Quotient.
          </p>
        </div>
        {canEdit && <button style={styles.btn} onClick={() => setNewKunde({ name: '', branche: '' })}>+ Neuer Kunde</button>}
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {newKunde && (
        <div style={styles.card}>
          <div style={styles.kundeName}>Neuer Kunde</div>
          <div style={styles.form}>
            <input style={{ ...styles.input, flex: 1 }} placeholder="Name" autoFocus value={newKunde.name} onChange={(e) => setNewKunde({ ...newKunde, name: e.target.value })} />
            <input style={styles.input} placeholder="Branche (optional)" value={newKunde.branche} onChange={(e) => setNewKunde({ ...newKunde, branche: e.target.value })} />
            <button style={styles.btn} onClick={createKunde}>Anlegen</button>
            <button style={styles.btnGhost} onClick={() => setNewKunde(null)}>Abbrechen</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={styles.empty}>Lädt…</div>
      ) : kunden.length === 0 && !newKunde ? (
        <div style={styles.empty}>Noch keine Kunden. {canEdit ? 'Lege den ersten Kunden an.' : ''}</div>
      ) : (
        kunden.map((k) => (
          <div key={k.id} style={styles.card}>
            <div style={styles.cardHead} onClick={() => toggle(k.id)}>
              <div>
                <div style={styles.kundeName}>{open[k.id] ? '▾ ' : '▸ '}{k.name}</div>
                <div style={styles.kundeMeta}>{k.branche || 'Kunde'}</div>
              </div>
              {canEdit && (
                <button style={styles.btnGhost} onClick={(e) => { e.stopPropagation(); setOpen((o) => ({ ...o, [k.id]: true })); setNewProzess((n) => ({ ...n, [k.id]: { name: '', emmaPlanNr: '' } })); }}>
                  + Prozess
                </button>
              )}
            </div>

            {open[k.id] && (
              <div style={{ marginTop: theme.spacing.sm }}>
                {newProzess[k.id] && (
                  <div style={styles.form}>
                    <input style={{ ...styles.input, flex: 1 }} placeholder="Prozessname" autoFocus value={newProzess[k.id].name} onChange={(e) => setNewProzess((n) => ({ ...n, [k.id]: { ...n[k.id], name: e.target.value } }))} />
                    <input style={{ ...styles.input, width: 140 }} placeholder="EMMA-Plan-Nr." value={newProzess[k.id].emmaPlanNr} onChange={(e) => setNewProzess((n) => ({ ...n, [k.id]: { ...n[k.id], emmaPlanNr: e.target.value } }))} />
                    <button style={styles.btn} onClick={() => createProzess(k.id)}>Anlegen</button>
                    <button style={styles.btnGhost} onClick={() => setNewProzess((n) => ({ ...n, [k.id]: null }))}>Abbrechen</button>
                  </div>
                )}
                {(prozesse[k.id] || []).length === 0 && !newProzess[k.id] ? (
                  <div style={{ ...styles.kundeMeta, padding: theme.spacing.sm }}>Keine Prozesse.</div>
                ) : (
                  (prozesse[k.id] || []).map((p) => (
                    <div
                      key={p.id}
                      style={styles.prozessRow}
                      onClick={() => navigate(`/apps/echoloop/prozess/${p.id}`)}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surfaceHover; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text }}>{p.name}</span>
                      <span style={styles.kundeMeta}>{p.emmaPlanNr ? `Plan ${p.emmaPlanNr}` : ''} ›</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
