import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { theme } from '../../config/theme';
import { ArrowLeftIcon } from '../../components/Icons';
import { useAppPermission } from '../../components/RequireAppPermission';
import { echoloopApi, DIMENSIONEN } from './api';
import KennzahlBadges from './components/KennzahlBadges';
import ReifegradPanel from './components/ReifegradPanel';
import BefundeListe from './components/BefundeListe';
import Dropzone from './components/Dropzone';

const PURPLE = '#452C71';
const TABS = [{ id: 'uebersicht', label: 'Übersicht' }, { id: 'rga', label: 'RGA-Review' }, { id: 'analysen', label: 'Analysen' }];
const STATUS_LABEL = { entwurf: 'Entwurf', in_review: 'In Review', freigegeben: 'Freigegeben' };
const PHASES = [
  { key: 'extract', label: 'Text aus PDF extrahieren' },
  { key: 'checker', label: 'Prüfmuster prüfen (deterministisch)' },
  { key: 'llm', label: 'KI-Vor-Benotung D1–D10' },
  { key: 'persist', label: 'Baustand anlegen' },
];
const RGA_SUBTABS = [
  { id: 'profil', label: 'Kennzahlen & Profil' },
  { id: 'befunde', label: 'Befunde' },
  { id: 'bauanleitung', label: 'Bauanleitungen' },
  { id: 'kundenfassung', label: 'Kundenfassung' },
];

const styles = {
  page: { width: '100%' },
  header: { padding: `${theme.spacing.xl} ${theme.spacing['2xl']}`, borderBottom: `1px solid ${theme.colors.border}` },
  backLink: { display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs, fontSize: theme.typography.sizes.sm, color: PURPLE, cursor: 'pointer', marginBottom: theme.spacing.lg, border: 'none', background: 'none', padding: 0, fontWeight: theme.typography.weights.medium },
  headRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, color: theme.colors.text },
  subtitle: { fontSize: theme.typography.sizes.base, color: theme.colors.textSecondary, display: 'flex', gap: theme.spacing.md, alignItems: 'center', marginTop: theme.spacing.xs },
  statusBadge: { fontSize: theme.typography.sizes.xs, padding: `${theme.spacing.xs} ${theme.spacing.md}`, borderRadius: theme.borderRadius.full, fontWeight: theme.typography.weights.medium },
  tabs: { display: 'flex', gap: theme.spacing.sm, padding: `${theme.spacing.md} ${theme.spacing['2xl']}`, borderBottom: `1px solid ${theme.colors.border}` },
  tab: { padding: `${theme.spacing.sm} ${theme.spacing.lg}`, backgroundColor: 'transparent', border: 'none', borderRadius: theme.borderRadius.md, fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.textMuted, cursor: 'pointer' },
  tabActive: { backgroundColor: '#F4EFFB', color: PURPLE },
  body: { padding: `${theme.spacing.xl} ${theme.spacing['2xl']}` },
  section: { backgroundColor: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.xl, padding: theme.spacing.xl, marginBottom: theme.spacing.lg },
  sectionTitle: { fontSize: theme.typography.sizes.md, fontWeight: theme.typography.weights.semibold, color: theme.colors.text, marginBottom: theme.spacing.md },
  btn: { padding: `${theme.spacing.sm} ${theme.spacing.lg}`, backgroundColor: PURPLE, color: '#fff', border: 'none', borderRadius: theme.borderRadius.lg, fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, cursor: 'pointer' },
  btnGhost: { padding: `${theme.spacing.sm} ${theme.spacing.lg}`, backgroundColor: 'transparent', color: theme.colors.text, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, cursor: 'pointer' },
  baustandRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: theme.spacing.md, border: `1px solid ${theme.colors.borderLight}`, borderRadius: theme.borderRadius.md, marginBottom: theme.spacing.sm, cursor: 'pointer' },
  noten: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, fontFamily: theme.typography.fontMono },
  error: { padding: theme.spacing.md, backgroundColor: theme.colors.errorLight, color: theme.colors.error, borderRadius: theme.borderRadius.md, marginBottom: theme.spacing.md, fontSize: theme.typography.sizes.sm },
  meta: { fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary, lineHeight: 1.6 },
};

function statusStyle(status) {
  if (status === 'freigegeben') return { backgroundColor: theme.colors.successLight, color: theme.colors.success };
  if (status === 'in_review') return { backgroundColor: theme.colors.warningLight, color: theme.colors.warning };
  return { backgroundColor: theme.colors.surfaceHover, color: theme.colors.textMuted };
}

export default function ProzessDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAppPermission();
  const canEdit = role === 'owner' || role === 'editor';

  const [tab, setTab] = useState('uebersicht');
  const [prozess, setProzess] = useState(null);
  const [baustaende, setBaustaende] = useState([]);
  const [active, setActive] = useState(null); // full baustand under review
  const [dims, setDims] = useState({});
  const [kennzahlen, setKennzahlen] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [phases, setPhases] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [narrativBusy, setNarrativBusy] = useState(false);
  const [narrativElapsed, setNarrativElapsed] = useState(0);
  const [rgaSub, setRgaSub] = useState('profil');
  const [bau, setBau] = useState(null);
  const [bauBusy, setBauBusy] = useState(false);
  const [bauDirty, setBauDirty] = useState(false);
  const [bauSaving, setBauSaving] = useState(false);
  const debounceRef = useRef(null);
  const timerRef = useRef(null);
  const narrativTimerRef = useRef(null);

  useEffect(() => { load(); }, [id]);

  async function load() {
    try {
      const [p, bs] = await Promise.all([echoloopApi.getProzess(id), echoloopApi.listBaustaende(id)]);
      setProzess(p); setBaustaende(bs);
      if (bs.length) await openBaustand(bs[0], false);
    } catch (e) { setError(e.message); }
  }

  async function openBaustand(b, switchTab = true) {
    const full = await echoloopApi.getBaustand(b.id);
    setActive(full);
    setDims(full.dimensionen || {});
    setKennzahlen(full.kennzahlen);
    setBau(full.bauanleitung || null);
    setBauDirty(false);
    setDirty(false);
    if (switchTab) setTab('rga');
  }

  // Live-Recompute (debounced, serverseitig = Single Source of Truth)
  function onDimsChange(next) {
    setDims(next); setDirty(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try { setKennzahlen(await echoloopApi.scoring(next)); } catch { /* ignore live errors */ }
    }, 300);
  }

  async function save() {
    if (!active) return;
    setSaving(true); setError('');
    try {
      const updated = await echoloopApi.updateBaustand(active.id, { dimensionen: dims, expectedVersion: active.version });
      setActive(updated); setKennzahlen(updated.kennzahlen); setDirty(false);
      setBaustaende((bs) => bs.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e) { setError(e.status === 409 ? 'Konflikt: Baustand wurde parallel geändert — neu laden.' : e.message); }
    finally { setSaving(false); }
  }

  async function freigeben() {
    if (!active) return;
    if (dirty) { await save(); }
    setSaving(true); setError('');
    try {
      const updated = await echoloopApi.freigabe(active.id, active.version + (dirty ? 1 : 0));
      // nach Freigabe sicher neu laden (Version könnte durch vorheriges save gestiegen sein)
      const fresh = await echoloopApi.getBaustand(active.id);
      setActive(fresh); setBaustaende((bs) => bs.map((x) => (x.id === fresh.id ? fresh : x)));
    } catch {
      const fresh = await echoloopApi.getBaustand(active.id).catch(() => null);
      if (fresh) { setActive(fresh); setBaustaende((bs) => bs.map((x) => (x.id === fresh.id ? fresh : x))); }
      else setError('Freigabe fehlgeschlagen.');
    }
    finally { setSaving(false); }
  }

  function onPhaseEvent(phase, d) {
    setPhases((prev) => {
      const n = { ...(prev || {}) };
      const setP = (k, status, detail) => { n[k] = { status, detail: detail ?? n[k]?.detail ?? '' }; };
      const done = (k) => { if (n[k]) n[k] = { ...n[k], status: 'done' }; };
      switch (phase) {
        case 'extract': setP('extract', 'active', `Datei ${d.index}/${d.total}: ${d.file}`); break;
        case 'checker': done('extract'); setP('checker', 'active'); break;
        case 'checker_done': setP('checker', 'done', `${d.prozesse} Prozesse · ${d.befunde} Befunde`); break;
        case 'llm': done('extract'); done('checker'); setP('llm', 'active'); break;
        case 'llm_done': setP('llm', 'done', d.status === 'fallback' ? 'ohne KI — Levels manuell erfassen' : 'abgeschlossen'); break;
        case 'persist': done('llm'); setP('persist', 'active'); break;
        default: break;
      }
      return n;
    });
  }

  async function upload(files) {
    setUploading(true); setError(''); setElapsed(0);
    const initial = {}; PHASES.forEach((p, i) => { initial[p.key] = { status: i === 0 ? 'active' : 'pending', detail: '' }; });
    setPhases(initial);
    const t0 = Date.now();
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      const b = await echoloopApi.analyseStream(id, fd, onPhaseEvent);
      setPhases((prev) => { const n = { ...prev }; PHASES.forEach((p) => { n[p.key] = { ...n[p.key], status: 'done' }; }); return n; });
      const bs = await echoloopApi.listBaustaende(id);
      setBaustaende(bs);
      if (b) await openBaustand(b, true);
    } catch (e) { setError(e.message); }
    finally {
      clearInterval(timerRef.current);
      setUploading(false);
      setPhases(null);
    }
  }

  async function generateNarrativ() {
    if (!active) return;
    setNarrativBusy(true); setNarrativElapsed(0); setError('');
    const t0 = Date.now();
    narrativTimerRef.current = setInterval(() => setNarrativElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    try {
      const updated = await echoloopApi.narrativStream(active.id, () => {});
      if (updated) { setActive(updated); setBaustaende((bs) => bs.map((x) => (x.id === updated.id ? updated : x))); }
    } catch (e) {
      setError(`Kundenfassung fehlgeschlagen: ${e.message}`);
    } finally {
      clearInterval(narrativTimerRef.current);
      setNarrativBusy(false);
    }
  }

  async function generateBau() {
    if (!active) return;
    setBauBusy(true); setError('');
    try {
      const updated = await echoloopApi.generateBauanleitung(active.id);
      setActive(updated); setBau(updated.bauanleitung || null); setBauDirty(false);
      setBaustaende((bs) => bs.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e) { setError(`Bauanleitung fehlgeschlagen: ${e.message}`); }
    finally { setBauBusy(false); }
  }

  function editBau(mutator) {
    setBau((prev) => { if (!prev) return prev; const next = structuredClone(prev); mutator(next); return next; });
    setBauDirty(true);
  }

  async function saveBau() {
    if (!active || !bau) return;
    setBauSaving(true); setError('');
    try {
      const updated = await echoloopApi.updateBaustand(active.id, { bauanleitung: bau, expectedVersion: active.version });
      setActive(updated); setBau(updated.bauanleitung || null); setBauDirty(false);
      setBaustaende((bs) => bs.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e) { setError(e.status === 409 ? 'Konflikt: Baustand wurde parallel geändert — neu laden.' : e.message); }
    finally { setBauSaving(false); }
  }

  function renderBauanleitung() {
    const bauReadOnly = !canEdit;
    const STATUS = [['offen', 'offen'], ['in_arbeit', 'in Arbeit'], ['erledigt', 'erledigt'], ['frage', 'Frage an Echo'], ['anders_gebaut', 'anders gebaut']];
    const prioColor = { hoch: theme.colors.error, mittel: theme.colors.warning, niedrig: theme.colors.textMuted };
    const prioBg = { hoch: theme.colors.errorLight, mittel: theme.colors.warningLight, niedrig: theme.colors.surfaceHover };
    const selStyle = { padding: '4px 8px', fontSize: theme.typography.sizes.xs, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.surface, color: theme.colors.text, cursor: 'pointer' };
    return (
      <div>
        {bau.einleitung && <p style={{ ...styles.meta, marginBottom: theme.spacing.md }}>{bau.einleitung}</p>}
        {bau.karten?.map((k, ki) => (
          <div key={k.id} style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg, marginBottom: theme.spacing.md }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: theme.spacing.md }}>
              <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text }}>
                <span style={{ color: PURPLE }}>{k.id}</span> · {k.titel} {k.dimension && <span style={{ color: theme.colors.textMuted, fontWeight: 400 }}>({k.dimension})</span>}
              </div>
              <span style={{ flex: 'none', fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.medium, padding: `2px ${theme.spacing.sm}`, borderRadius: theme.borderRadius.full, color: prioColor[k.prio], backgroundColor: prioBg[k.prio] }}>{k.prio}</span>
            </div>
            {k.warum && <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, margin: `4px 0 ${theme.spacing.sm}`, lineHeight: 1.5 }}>{k.warum}</div>}
            {k.schritte?.map((s, si) => (
              <label key={si} style={{ display: 'flex', gap: theme.spacing.sm, alignItems: 'flex-start', padding: '4px 0', fontSize: theme.typography.sizes.sm, cursor: bauReadOnly ? 'default' : 'pointer' }}>
                <input type="checkbox" checked={!!s.done} disabled={bauReadOnly} onChange={() => editBau((n) => { n.karten[ki].schritte[si].done = !n.karten[ki].schritte[si].done; })} style={{ accentColor: PURPLE, marginTop: 3, flex: 'none' }} />
                <span style={{ textDecoration: s.done ? 'line-through' : 'none', color: s.done ? theme.colors.textMuted : theme.colors.text }}>{s.text}</span>
              </label>
            ))}
            <div style={{ display: 'flex', gap: theme.spacing.md, alignItems: 'center', marginTop: theme.spacing.sm, flexWrap: 'wrap' }}>
              <select style={selStyle} value={k.status || 'offen'} disabled={bauReadOnly} onChange={(e) => editBau((n) => { n.karten[ki].status = e.target.value; })}>
                {STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input placeholder="Feedback / Rückfrage…" value={k.feedback || ''} disabled={bauReadOnly}
                onChange={(e) => editBau((n) => { n.karten[ki].feedback = e.target.value; })}
                style={{ flex: 1, minWidth: 180, padding: '4px 8px', fontSize: theme.typography.sizes.xs, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.surface, color: theme.colors.text, outline: 'none' }} />
            </div>
          </div>
        ))}
        <div style={{ fontSize: '0.7rem', color: theme.colors.textMuted }}>Ziel: RG{bau.zielLevel} · erzeugt {bau.erzeugtAm?.slice(0, 10)} · Modell {bau.modell}</div>
      </div>
    );
  }

  function renderNarrativ(n) {
    const listStyle = { margin: `${theme.spacing.xs} 0 ${theme.spacing.sm} ${theme.spacing.lg}`, fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary, lineHeight: 1.5 };
    return (
      <div>
        {n.exec?.was && <p style={{ ...styles.meta, marginBottom: theme.spacing.md }}>{n.exec.was}</p>}
        {n.stabilityNote && (
          <div style={{ backgroundColor: theme.colors.surfaceHover, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary, marginBottom: theme.spacing.md }}>{n.stabilityNote}</div>
        )}
        {n.prosa?.map((p, i) => <p key={i} style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text, lineHeight: 1.6, marginBottom: theme.spacing.sm }}>{p}</p>)}
        {n.exec?.staerken?.length > 0 && (
          <div style={{ marginTop: theme.spacing.md }}>
            <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text }}>Stärken</div>
            <ul style={listStyle}>{n.exec.staerken.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </div>
        )}
        {n.exec?.findings?.length > 0 && (
          <div>
            <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text }}>Kern-Befunde</div>
            <ul style={listStyle}>{n.exec.findings.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </div>
        )}
        <div style={{ marginTop: theme.spacing.lg, borderTop: `1px solid ${theme.colors.borderLight}`, paddingTop: theme.spacing.md }}>
          {DIMENSIONEN.map(({ key, label }) => {
            const d = n.dims?.[key];
            if (!d || (!d.beleg && !(d.recs?.length))) return null;
            return (
              <div key={key} style={{ marginBottom: theme.spacing.md }}>
                <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: PURPLE }}>{key.toUpperCase()} · {label}</div>
                {d.purpose && <div style={{ fontSize: '0.7rem', color: theme.colors.textMuted, marginBottom: 2 }}>{d.purpose}</div>}
                {d.beleg && <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary, lineHeight: 1.5 }}>{d.beleg}</div>}
                {d.recs?.length > 0 && <ul style={listStyle}>{d.recs.map((r, i) => <li key={i}>{r}</li>)}</ul>}
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: '0.7rem', color: theme.colors.textMuted, marginTop: theme.spacing.sm }}>Erzeugt {n.erzeugtAm?.slice(0, 10)} · Modell {n.modell}</div>
      </div>
    );
  }

  function renderProgress() {
    const activeKey = PHASES.find((p) => phases?.[p.key]?.status === 'active')?.key;
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md }}>
          <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text, fontWeight: theme.typography.weights.semibold }}>Analyse läuft…</span>
          <span style={{ fontSize: theme.typography.sizes.sm, color: PURPLE, fontFamily: theme.typography.fontMono }}>{elapsed}s</span>
        </div>
        {PHASES.map((p) => {
          const st = phases?.[p.key]?.status || 'pending';
          const detail = phases?.[p.key]?.detail;
          const glyph = st === 'done' ? '✓' : st === 'active' ? '●' : '○';
          const color = st === 'done' ? theme.colors.success : st === 'active' ? PURPLE : theme.colors.textMuted;
          return (
            <div key={p.key} style={{ display: 'flex', alignItems: 'flex-start', gap: theme.spacing.md, padding: `${theme.spacing.sm} 0` }}>
              <span style={{ width: 18, textAlign: 'center', color, fontWeight: 700, lineHeight: 1.5 }}>{glyph}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: theme.typography.sizes.sm, color: st === 'pending' ? theme.colors.textMuted : theme.colors.text, fontWeight: st === 'active' ? theme.typography.weights.semibold : theme.typography.weights.normal }}>
                  {p.label}{p.key === activeKey ? ` … ${elapsed}s` : ''}
                </div>
                {detail && <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginTop: 2 }}>{detail}</div>}
              </div>
            </div>
          );
        })}
        <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginTop: theme.spacing.sm }}>
          Die KI-Vor-Benotung kann bei großen Prozess-Familien länger dauern — die Schritte oben zeigen den laufenden Fortschritt.
        </div>
      </div>
    );
  }

  if (!prozess) return <div style={{ padding: theme.spacing['2xl'] }}>{error ? <div style={styles.error}>{error}</div> : 'Lädt…'}</div>;

  const readOnly = !canEdit || active?.status === 'freigegeben';

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button style={styles.backLink} onClick={() => navigate('/apps/echoloop')}><ArrowLeftIcon /> Echo-Loop</button>
        <div style={styles.headRow}>
          <div>
            <h1 style={styles.title}>{prozess.name}</h1>
            <div style={styles.subtitle}>
              {prozess.emmaPlanNr && <span>EMMA-Plan {prozess.emmaPlanNr}</span>}
              {active && <span style={{ ...styles.statusBadge, ...statusStyle(active.status) }}>{STATUS_LABEL[active.status]}</span>}
              {active && <span style={styles.noten}>{active.kennzahlen?.notenZeile?.split(' · Limiter')[0]}</span>}
            </div>
          </div>
        </div>
      </div>

      <div style={styles.tabs}>
        {TABS.map((t) => (
          <button key={t.id} style={{ ...styles.tab, ...(tab === t.id ? styles.tabActive : {}) }} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      <div style={styles.body}>
        {error && <div style={styles.error}>{error}</div>}

        {tab === 'uebersicht' && (
          <>
            <div style={styles.section}>
              <div style={styles.sectionTitle}>Prozess-Akte</div>
              <div style={styles.meta}>
                <div><strong>Name:</strong> {prozess.name}</div>
                {prozess.emmaPlanNr && <div><strong>EMMA-Plan-Nr.:</strong> {prozess.emmaPlanNr}</div>}
                {prozess.beschreibung && <div><strong>Beschreibung:</strong> {prozess.beschreibung}</div>}
                <div><strong>Baustände:</strong> {baustaende.length}</div>
              </div>
            </div>
            {kennzahlen && (
              <div style={styles.section}>
                <div style={styles.sectionTitle}>Aktuelle Kennzahlen {active && `(${STATUS_LABEL[active.status]})`}</div>
                <KennzahlBadges kennzahlen={kennzahlen} />
              </div>
            )}
          </>
        )}

        {tab === 'rga' && (
          !active ? (
            <div style={styles.section}>Noch kein Baustand. Lade unter „Analysen" einen EMMA-Export hoch.</div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: theme.spacing.sm, marginBottom: theme.spacing.lg, flexWrap: 'wrap' }}>
                {RGA_SUBTABS.map((s) => (
                  <button key={s.id} style={{ ...styles.tab, ...(rgaSub === s.id ? styles.tabActive : {}) }} onClick={() => setRgaSub(s.id)}>{s.label}</button>
                ))}
              </div>

              {rgaSub === 'profil' && (
                <>
                  <div style={styles.section}>
                    <div style={styles.sectionTitle}>Kennzahlen (live)</div>
                    <KennzahlBadges kennzahlen={kennzahlen} />
                  </div>
                  {active.topHebel?.length > 0 && (
                    <div style={styles.section}>
                      <div style={styles.sectionTitle}>Top-Hebel (priorisiert, deterministisch)</div>
                      {active.topHebel.map((t, i) => (
                        <div key={i} style={{ display: 'flex', gap: theme.spacing.md, padding: `${theme.spacing.sm} 0`, borderBottom: i < active.topHebel.length - 1 ? `1px solid ${theme.colors.borderLight}` : 'none' }}>
                          <span style={{ fontWeight: theme.typography.weights.bold, color: PURPLE, minWidth: 34 }}>{t.dim}</span>
                          <div>
                            <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.text }}>{t.titel}</div>
                            <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginTop: 2 }}>{t.wirkung}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={styles.section}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md }}>
                      <div style={styles.sectionTitle}>Reifegrad-Profil · {active.datum} — {active.quelle}</div>
                      {canEdit && active.status !== 'freigegeben' && (
                        <div style={{ display: 'flex', gap: theme.spacing.sm }}>
                          <button style={styles.btnGhost} onClick={save} disabled={saving || !dirty}>{saving ? 'Speichert…' : dirty ? 'Speichern *' : 'Gespeichert'}</button>
                          <button style={styles.btn} onClick={freigeben} disabled={saving}>✓ Freigeben</button>
                        </div>
                      )}
                    </div>
                    {active.status === 'entwurf' && (
                      <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary, marginBottom: theme.spacing.md }}>
                        Entwurf der Vor-Benotung — jede Benotung menschlich prüfen. Soll je Dimension setzen (bis Compass-Modul die Soll-Werte liefert), Relevanz-Maske nur mit Owner-Begründung. Freigabe = Mensch-Review-Gate.
                      </div>
                    )}
                    <ReifegradPanel dimensionen={dims} begruendung={active.llmBegruendung || {}} onChange={onDimsChange} readOnly={readOnly} />
                  </div>
                </>
              )}

              {rgaSub === 'befunde' && (
                <div style={styles.section}>
                  <div style={styles.sectionTitle}>Deterministische Checker-Befunde ({active.befunde?.length || 0})</div>
                  <BefundeListe befunde={active.befunde || []} />
                </div>
              )}

              {rgaSub === 'bauanleitung' && (
                <div style={styles.section}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md, gap: theme.spacing.md, flexWrap: 'wrap' }}>
                    <div style={styles.sectionTitle}>Bauanleitungen (D-061 · abhaken + Feedback)</div>
                    {canEdit && (
                      <div style={{ display: 'flex', gap: theme.spacing.sm }}>
                        {bau && <button style={styles.btnGhost} onClick={saveBau} disabled={bauSaving || !bauDirty}>{bauSaving ? 'Speichert…' : bauDirty ? 'Speichern *' : 'Gespeichert'}</button>}
                        <button style={styles.btn} onClick={generateBau} disabled={bauBusy}>{bauBusy ? 'Generiert…' : bau ? 'Neu generieren' : 'Bauanleitung generieren'}</button>
                      </div>
                    )}
                  </div>
                  {bauBusy && <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginBottom: theme.spacing.md }}>Leitet aus der RGA die priorisierten Bau-Maßnahmen ab …</div>}
                  {bau
                    ? renderBauanleitung()
                    : (!bauBusy && <div style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm }}>Noch keine Bauanleitung. Nach dem Review der Levels generieren — die Karten leiten sich aus Lücken, Befunden und Top-Hebeln ab.</div>)}
                </div>
              )}

              {rgaSub === 'kundenfassung' && (
                <div style={styles.section}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md }}>
                    <div style={styles.sectionTitle}>Kundenfassung (KI-Analyse)</div>
                    {canEdit && (
                      <button style={styles.btn} onClick={generateNarrativ} disabled={narrativBusy}>
                        {narrativBusy ? `Erzeugt… ${narrativElapsed}s` : active.narrativ ? 'Neu erzeugen' : 'Kundenfassung erzeugen'}
                      </button>
                    )}
                  </div>
                  {narrativBusy && (
                    <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginBottom: theme.spacing.md }}>
                      Die KI-Analyse-Synthese läuft … {narrativElapsed}s
                    </div>
                  )}
                  {active.narrativ
                    ? renderNarrativ(active.narrativ)
                    : (!narrativBusy && <div style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm }}>Noch keine Kundenfassung erzeugt. Nach dem Review der Levels erzeugen.</div>)}
                </div>
              )}
            </>
          )
        )}

        {tab === 'analysen' && (
          <>
            {canEdit && (
              <div style={styles.section}>
                <div style={styles.sectionTitle}>Neue Analyse</div>
                {phases ? renderProgress() : <Dropzone onFiles={upload} busy={uploading} />}
              </div>
            )}
            <div style={styles.section}>
              <div style={styles.sectionTitle}>Baustände ({baustaende.length})</div>
              {baustaende.length === 0 ? (
                <div style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm }}>Noch keine Baustände.</div>
              ) : (
                baustaende.map((b) => (
                  <div key={b.id} style={styles.baustandRow} onClick={() => openBaustand(b)}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surfaceHover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
                    <div>
                      <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text, fontWeight: theme.typography.weights.medium }}>
                        {b.datum} · <span style={{ ...styles.statusBadge, ...statusStyle(b.status) }}>{STATUS_LABEL[b.status]}</span>
                      </div>
                      <div style={styles.noten}>
                        RG{b.kennzahlen?.gesamtRg} · RG*{b.kennzahlen?.rgStar} · RGQ {b.kennzahlen?.rgq}% · SE {b.kennzahlen?.seQuotient}% · {b.befunde?.length || 0} Befunde
                      </div>
                    </div>
                    <span style={styles.noten}>›</span>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
