import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { theme } from '../../config/theme';
import { ArrowLeftIcon } from '../../components/Icons';
import { useAppPermission } from '../../components/RequireAppPermission';
import {
  wohngeldApi,
  WOHNGELDART_LABEL, ANTRAGSART_LABEL, STATUS_LABEL, STATUS_ORDER,
  PRIORITAET_LABEL, ROLLE_LABEL, DOKUMENT_TYP_LABEL, SCHREIBEN_ART_LABEL,
  ACCENT, ACCENT_LIGHT,
} from './api';
import StatusBadge from './components/StatusBadge';
import SektionCard, { FeldGrid } from './components/SektionCard';
import PersonCard from './components/PersonCard';
import PruefschrittItem from './components/PruefschrittItem';

const MAIN_TABS = [
  { id: 'uebersicht', label: 'Übersicht' },
  { id: 'schreiben', label: 'Schreiben' },
  { id: 'plausibilitaet', label: 'Plausibilitätsprüfung' },
  { id: 'prognose', label: 'Einkommensprognose' },
  { id: 'verfuegung', label: 'Verfügung' },
];
const SIDE_TABS = [
  { id: 'details', label: 'Details' },
  { id: 'pruefschritte', label: 'Prüfschritte' },
  { id: 'dokumente', label: 'Dokumente' },
];
const PRUEF_FILTER = [
  { id: 'alle', label: 'Alle' },
  { id: 'offen', label: 'Offen' },
  { id: 'erledigt', label: 'Erledigt' },
];

const styles = {
  page: { width: '100%' },
  header: { padding: `${theme.spacing.xl} ${theme.spacing['2xl']}`, borderBottom: `1px solid ${theme.colors.border}` },
  backLink: { display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs, fontSize: theme.typography.sizes.sm, color: ACCENT, cursor: 'pointer', marginBottom: theme.spacing.md, border: 'none', background: 'none', padding: 0, fontWeight: theme.typography.weights.medium },
  crumb: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginBottom: theme.spacing.xs },
  headRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: theme.spacing.lg, flexWrap: 'wrap' },
  title: { fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, color: theme.colors.text },
  subtitle: { fontSize: theme.typography.sizes.base, color: theme.colors.textSecondary, display: 'flex', gap: theme.spacing.md, alignItems: 'center', marginTop: theme.spacing.xs, flexWrap: 'wrap' },
  headActions: { display: 'flex', gap: theme.spacing.md, alignItems: 'center' },
  layout: { display: 'flex', gap: theme.spacing.lg, alignItems: 'flex-start', padding: theme.spacing.xl, flexWrap: 'wrap' },
  main: { flex: 1, minWidth: 320 },
  side: { width: 360, flexShrink: 0, minWidth: 300 },
  tabs: { display: 'flex', gap: theme.spacing.sm, marginBottom: theme.spacing.lg, flexWrap: 'wrap' },
  tab: { padding: `${theme.spacing.sm} ${theme.spacing.md}`, backgroundColor: 'transparent', border: 'none', borderRadius: theme.borderRadius.md, fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.textMuted, cursor: 'pointer' },
  tabActive: { backgroundColor: ACCENT_LIGHT, color: ACCENT },
  sideCard: { backgroundColor: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.xl, padding: theme.spacing.lg },
  btn: { padding: `${theme.spacing.sm} ${theme.spacing.lg}`, backgroundColor: ACCENT, color: '#fff', border: 'none', borderRadius: theme.borderRadius.lg, fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, cursor: 'pointer' },
  btnGhost: { padding: `${theme.spacing.sm} ${theme.spacing.lg}`, backgroundColor: 'transparent', color: theme.colors.text, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, cursor: 'pointer' },
  btnSmall: { padding: `4px ${theme.spacing.md}`, fontSize: theme.typography.sizes.xs, borderRadius: theme.borderRadius.md, border: `1px solid ${theme.colors.border}`, backgroundColor: theme.colors.surface, color: theme.colors.text, cursor: 'pointer' },
  select: { padding: `6px ${theme.spacing.md}`, fontSize: theme.typography.sizes.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.surface, color: theme.colors.text, cursor: 'pointer' },
  input: { width: '100%', padding: theme.spacing.sm, fontSize: theme.typography.sizes.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.surface, color: theme.colors.text, outline: 'none' },
  editRow: { display: 'grid', gridTemplateColumns: 'minmax(140px, 220px) 1fr', rowGap: theme.spacing.sm, columnGap: theme.spacing.lg, alignItems: 'center' },
  editLabel: { fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted },
  error: { padding: theme.spacing.md, backgroundColor: theme.colors.errorLight, color: theme.colors.error, borderRadius: theme.borderRadius.md, marginBottom: theme.spacing.md, fontSize: theme.typography.sizes.sm },
  info: { padding: theme.spacing.md, backgroundColor: theme.colors.infoLight, color: theme.colors.info, borderRadius: theme.borderRadius.md, marginBottom: theme.spacing.md, fontSize: theme.typography.sizes.sm },
  sideTitle: { fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.semibold, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', margin: `${theme.spacing.md} 0 ${theme.spacing.sm}` },
  activity: { fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary, padding: `${theme.spacing.sm} 0`, borderBottom: `1px solid ${theme.colors.borderLight}`, lineHeight: 1.5 },
  label: { display: 'block', fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.text, marginBottom: theme.spacing.xs },
  textarea: { width: '100%', minHeight: 260, fontFamily: theme.typography.fontFamily, fontSize: theme.typography.sizes.sm, padding: theme.spacing.md, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.surface, color: theme.colors.text, outline: 'none', resize: 'vertical', lineHeight: 1.6 },
  placeholder: { textAlign: 'center', padding: theme.spacing['3xl'], color: theme.colors.textMuted },
  chip: { fontSize: theme.typography.sizes.xs, padding: `2px ${theme.spacing.sm}`, borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.surfaceHover, color: theme.colors.textMuted },
  docItem: { padding: `${theme.spacing.sm} 0`, borderBottom: `1px solid ${theme.colors.borderLight}` },
};

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return iso.slice(0, 10); }
}
function fmtDateTime(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}
function eur(v) {
  if (v == null) return '—';
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}
function download(name, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
}

export default function VorgangDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAppPermission();
  const canEdit = role === 'owner' || role === 'editor';

  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [mainTab, setMainTab] = useState('uebersicht');
  const [sideTab, setSideTab] = useState('details');
  const [busy, setBusy] = useState(false);

  // Übersicht-Bearbeitung (Vorgang-Ebene)
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState(null);

  // Prüfschritte
  const [pruefFilter, setPruefFilter] = useState('alle');
  const [neueAnforderung, setNeueAnforderung] = useState('');

  // Schreiben-Editor (id -> {betreff, frist, body, version})
  const [schreibenEdit, setSchreibenEdit] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await wohngeldApi.getVorgangDetail(id);
        if (!cancelled) setDetail(d);
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  async function reload() {
    try { setDetail(await wohngeldApi.getVorgangDetail(id)); }
    catch (e) { setError(e.message); }
  }

  if (!detail) {
    return <div style={{ padding: theme.spacing['2xl'] }}>{error ? <div style={styles.error}>{error}</div> : 'Lädt…'}</div>;
  }

  const { vorgang, akte, personen, dokumente, pruefschritte, schreiben, aktivitaeten } = detail;
  const antragsteller = personen.find((p) => p.rolle === 'antragsteller');
  const antragstellerName = antragsteller
    ? [antragsteller.vorname, antragsteller.nachname].filter(Boolean).join(' ')
    : (akte?.antragstellerName || akte?.name || '—');

  // ── Ampel-Zählung: offene Prüfschritte grob je Sektion (personId/Kategorie/Stichwort). ──
  const offen = pruefschritte.filter((p) => p.status === 'offen');
  const matches = (p, re) => re.test(`${p.titel || ''} ${p.belegtext || ''}`);
  const countAllgemein = offen.filter((p) => !p.personId && p.kategorie === 'vollstaendigkeit').length;
  const countPersonen = offen.filter((p) => p.personId).length;
  const countWohnung = offen.filter((p) => matches(p, /miet|wohn|heiz|warmwasser|fläche|flaeche/i)).length;
  const countEinkommen = offen.filter((p) => matches(p, /einkomm|einkünf|einkuenf|gehalt|lohn|rente|verdienst|abzug/i)).length;
  const countZahlung = offen.filter((p) => matches(p, /iban|zahlung|bewilligung|konto/i)).length;

  // ── Übersicht-Bearbeitung ──
  function startEdit() {
    const w = vorgang.wohnung || {};
    setForm({
      antragsdatum: vorgang.antragsdatum || '',
      wohngeldart: vorgang.wohngeldart,
      antragsart: vorgang.antragsart,
      bwz_start: vorgang.bwz_start || '',
      bwz_ende: vorgang.bwz_ende || '',
      iban: vorgang.iban || '',
      wohnung: {
        strasse: w.strasse || '', hausnummer: w.hausnummer || '', plz: w.plz || '', ort: w.ort || '',
        wohnflaeche_qm: w.wohnflaeche_qm ?? '', miete: w.miete ?? '', heizkosten: w.heizkosten ?? '', warmwasser: w.warmwasser ?? '',
      },
    });
    setEditMode(true);
  }
  function num(v) { return v === '' || v == null ? undefined : Number(v); }
  async function saveEdit() {
    setBusy(true); setError('');
    try {
      const payload = {
        antragsdatum: form.antragsdatum || undefined,
        wohngeldart: form.wohngeldart,
        antragsart: form.antragsart,
        bwz_start: form.bwz_start || undefined,
        bwz_ende: form.bwz_ende || undefined,
        iban: form.iban || undefined,
        wohnung: {
          strasse: form.wohnung.strasse || undefined,
          hausnummer: form.wohnung.hausnummer || undefined,
          plz: form.wohnung.plz || undefined,
          ort: form.wohnung.ort || undefined,
          wohnflaeche_qm: num(form.wohnung.wohnflaeche_qm),
          miete: num(form.wohnung.miete),
          heizkosten: num(form.wohnung.heizkosten),
          warmwasser: num(form.wohnung.warmwasser),
        },
        expectedVersion: vorgang.version,
      };
      const updated = await wohngeldApi.updateVorgang(id, payload);
      setDetail((d) => ({ ...d, vorgang: updated }));
      setEditMode(false);
    } catch (e) {
      if (e.status === 409) { setError('Konflikt: Der Vorgang wurde parallel geändert. Die Ansicht wird neu geladen.'); await reload(); setEditMode(false); }
      else setError(e.message);
    } finally { setBusy(false); }
  }

  async function changeStatus(status) {
    setBusy(true); setError('');
    try {
      const updated = await wohngeldApi.updateVorgang(id, { status, expectedVersion: vorgang.version });
      setDetail((d) => ({ ...d, vorgang: updated }));
      await reload();
    } catch (e) {
      if (e.status === 409) { setError('Konflikt: Der Vorgang wurde parallel geändert. Die Ansicht wird neu geladen.'); await reload(); }
      else setError(e.message);
    } finally { setBusy(false); }
  }

  // ── Prüfschritte ──
  async function pruefen() {
    setBusy(true); setError('');
    try {
      await wohngeldApi.pruefen(id);
      await reload();
      setSideTab('pruefschritte');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function setPruefStatus(p, status) {
    setBusy(true); setError('');
    try {
      const updated = await wohngeldApi.updatePruefschritt(p.id, { status, expectedVersion: p.version });
      setDetail((d) => ({ ...d, pruefschritte: d.pruefschritte.map((x) => (x.id === updated.id ? updated : x)) }));
    } catch (e) {
      if (e.status === 409) { setError('Konflikt: Der Prüfschritt wurde parallel geändert. Die Ansicht wird neu geladen.'); await reload(); }
      else setError(e.message);
    } finally { setBusy(false); }
  }
  async function addAnforderung() {
    if (!neueAnforderung.trim()) return;
    setBusy(true); setError('');
    try {
      await wohngeldApi.createPruefschritt(id, {
        titel: neueAnforderung.trim(), kategorie: 'vollstaendigkeit', typ: 'anforderung', status: 'offen',
      });
      setNeueAnforderung('');
      await reload();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  // ── Schreiben ──
  async function generiereSchreiben() {
    setBusy(true); setError('');
    try {
      await wohngeldApi.generiereSchreiben(id, { art: 'erstanforderung', fristTage: 14 });
      await reload();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  function editState(s) {
    return schreibenEdit[s.id] || { betreff: s.betreff || '', frist: s.frist ? s.frist.slice(0, 10) : '', body: s.body || '', version: s.version };
  }
  function setEditField(s, field, value) {
    setSchreibenEdit((m) => ({ ...m, [s.id]: { ...editState(s), [field]: value } }));
  }
  async function saveSchreiben(s) {
    const st = editState(s);
    setBusy(true); setError('');
    try {
      const updated = await wohngeldApi.updateSchreiben(s.id, {
        betreff: st.betreff, frist: st.frist || undefined, body: st.body, expectedVersion: s.version,
      });
      setDetail((d) => ({ ...d, schreiben: d.schreiben.map((x) => (x.id === updated.id ? updated : x)) }));
      setSchreibenEdit((m) => { const n = { ...m }; delete n[s.id]; return n; });
    } catch (e) {
      if (e.status === 409) { setError('Konflikt: Das Schreiben wurde parallel geändert. Die Ansicht wird neu geladen.'); await reload(); }
      else setError(e.message);
    } finally { setBusy(false); }
  }

  // ── Sektionen der Übersicht ──
  const w = vorgang.wohnung || {};
  const adresse = [w.strasse, w.hausnummer].filter(Boolean).join(' ');
  const ortZeile = [w.plz, w.ort].filter(Boolean).join(' ');

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button style={styles.backLink} onClick={() => navigate('/apps/wohngeld')}><ArrowLeftIcon /> Wohngeld</button>
        <div style={styles.crumb}>Vorgänge › {vorgang.antragsId}</div>
        <div style={styles.headRow}>
          <div>
            <h1 style={styles.title}>{vorgang.antragsId}</h1>
            <div style={styles.subtitle}>
              <span>{antragstellerName}</span>
              <StatusBadge status={vorgang.status} />
              <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>
                {WOHNGELDART_LABEL[vorgang.wohngeldart]} · {ANTRAGSART_LABEL[vorgang.antragsart]}
              </span>
            </div>
          </div>
          {canEdit && (
            <div style={styles.headActions}>
              <select
                style={styles.select}
                value={vorgang.status}
                disabled={busy}
                onChange={(e) => changeStatus(e.target.value)}
                title="Status ändern"
              >
                {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      <div style={styles.layout}>
        {/* ── MITTE ── */}
        <div style={styles.main}>
          <div style={styles.tabs}>
            {MAIN_TABS.map((t) => (
              <button key={t.id} style={{ ...styles.tab, ...(mainTab === t.id ? styles.tabActive : {}) }} onClick={() => setMainTab(t.id)}>{t.label}</button>
            ))}
          </div>

          {error && <div style={styles.error}>{error}</div>}

          {mainTab === 'uebersicht' && (
            <>
              <SektionCard
                title="Allgemein"
                offenCount={countAllgemein}
                action={canEdit && (
                  editMode
                    ? <div style={{ display: 'flex', gap: theme.spacing.sm }}>
                        <button style={styles.btnSmall} onClick={() => setEditMode(false)} disabled={busy}>Abbrechen</button>
                        <button style={styles.btn} onClick={saveEdit} disabled={busy}>{busy ? 'Speichert…' : 'Speichern'}</button>
                      </div>
                    : <button style={styles.btnSmall} onClick={startEdit}>Bearbeiten</button>
                )}
              >
                {editMode ? (
                  <div style={styles.editRow}>
                    <span style={styles.editLabel}>Antragsdatum</span>
                    <input type="date" style={styles.input} value={form.antragsdatum} onChange={(e) => setForm({ ...form, antragsdatum: e.target.value })} />
                    <span style={styles.editLabel}>Wohngeldart</span>
                    <select style={styles.input} value={form.wohngeldart} onChange={(e) => setForm({ ...form, wohngeldart: e.target.value })}>
                      {Object.entries(WOHNGELDART_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <span style={styles.editLabel}>Antragsart</span>
                    <select style={styles.input} value={form.antragsart} onChange={(e) => setForm({ ...form, antragsart: e.target.value })}>
                      {Object.entries(ANTRAGSART_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                ) : (
                  <FeldGrid felder={[
                    { label: 'Antragsdatum', value: fmtDate(vorgang.antragsdatum) },
                    { label: 'Wohngeldart', value: WOHNGELDART_LABEL[vorgang.wohngeldart] },
                    { label: 'Antragsart', value: ANTRAGSART_LABEL[vorgang.antragsart] },
                    { label: 'Antragsteller', value: antragstellerName },
                  ]} />
                )}
              </SektionCard>

              <SektionCard title="Personen" offenCount={countPersonen}>
                {personen.length === 0
                  ? <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>Noch keine Personen erfasst.</div>
                  : personen.map((p) => <PersonCard key={p.id} person={p} />)}
              </SektionCard>

              <SektionCard
                title="Wohnung & Miete"
                offenCount={countWohnung}
              >
                {editMode ? (
                  <div style={styles.editRow}>
                    <span style={styles.editLabel}>Straße / Hausnr.</span>
                    <div style={{ display: 'flex', gap: theme.spacing.sm }}>
                      <input style={{ ...styles.input, flex: 2 }} placeholder="Straße" value={form.wohnung.strasse} onChange={(e) => setForm({ ...form, wohnung: { ...form.wohnung, strasse: e.target.value } })} />
                      <input style={{ ...styles.input, flex: 1 }} placeholder="Nr." value={form.wohnung.hausnummer} onChange={(e) => setForm({ ...form, wohnung: { ...form.wohnung, hausnummer: e.target.value } })} />
                    </div>
                    <span style={styles.editLabel}>PLZ / Ort</span>
                    <div style={{ display: 'flex', gap: theme.spacing.sm }}>
                      <input style={{ ...styles.input, flex: 1 }} placeholder="PLZ" value={form.wohnung.plz} onChange={(e) => setForm({ ...form, wohnung: { ...form.wohnung, plz: e.target.value } })} />
                      <input style={{ ...styles.input, flex: 2 }} placeholder="Ort" value={form.wohnung.ort} onChange={(e) => setForm({ ...form, wohnung: { ...form.wohnung, ort: e.target.value } })} />
                    </div>
                    <span style={styles.editLabel}>Wohnfläche (m²)</span>
                    <input type="number" style={styles.input} value={form.wohnung.wohnflaeche_qm} onChange={(e) => setForm({ ...form, wohnung: { ...form.wohnung, wohnflaeche_qm: e.target.value } })} />
                    <span style={styles.editLabel}>Miete (Bruttokalt)</span>
                    <input type="number" style={styles.input} value={form.wohnung.miete} onChange={(e) => setForm({ ...form, wohnung: { ...form.wohnung, miete: e.target.value } })} />
                    <span style={styles.editLabel}>Heizkosten</span>
                    <input type="number" style={styles.input} value={form.wohnung.heizkosten} onChange={(e) => setForm({ ...form, wohnung: { ...form.wohnung, heizkosten: e.target.value } })} />
                    <span style={styles.editLabel}>Warmwasser</span>
                    <input type="number" style={styles.input} value={form.wohnung.warmwasser} onChange={(e) => setForm({ ...form, wohnung: { ...form.wohnung, warmwasser: e.target.value } })} />
                  </div>
                ) : (
                  <FeldGrid felder={[
                    { label: 'Adresse', value: adresse || '—' },
                    { label: 'PLZ / Ort', value: ortZeile || '—' },
                    { label: 'Wohnfläche', value: w.wohnflaeche_qm != null ? `${w.wohnflaeche_qm} m²` : '—' },
                    { label: 'Miete (Bruttokalt)', value: eur(w.miete) },
                    { label: 'Heizkosten', value: eur(w.heizkosten) },
                    { label: 'Warmwasser', value: eur(w.warmwasser) },
                  ]} />
                )}
              </SektionCard>

              <SektionCard title="Einkommen & Abzugsbeträge" offenCount={countEinkommen}>
                {personen.length === 0 ? (
                  <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>Keine Personen mit Einkommensangaben.</div>
                ) : (
                  personen.map((p) => {
                    const ek = p.einkommen || [];
                    const sumM = ek.reduce((a, e) => a + (e.betrag_monatlich || 0), 0);
                    const sumJ = ek.reduce((a, e) => a + (e.betrag_jaehrlich || 0), 0);
                    return (
                      <div key={p.id} style={{ marginBottom: theme.spacing.md }}>
                        <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text, marginBottom: theme.spacing.xs }}>
                          {[p.vorname, p.nachname].filter(Boolean).join(' ')} <span style={{ color: theme.colors.textMuted, fontWeight: 400 }}>· {ROLLE_LABEL[p.rolle]}</span>
                        </div>
                        {ek.length === 0 ? (
                          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>Keine Positionen erfasst.</div>
                        ) : (
                          <>
                            {ek.map((e) => (
                              <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm, padding: '2px 0', color: theme.colors.textSecondary }}>
                                <span>{e.bezeichnung || e.art}{!e.beruecksichtigt && <span style={{ color: theme.colors.textMuted }}> (nicht berücksichtigt)</span>}</span>
                                <span>{eur(e.betrag_monatlich)} / Mon.</span>
                              </div>
                            ))}
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, borderTop: `1px solid ${theme.colors.borderLight}`, marginTop: theme.spacing.xs, paddingTop: theme.spacing.xs, color: theme.colors.text }}>
                              <span>Summe</span>
                              <span>{eur(sumM)} / Mon.{sumJ ? ` · ${eur(sumJ)} / Jahr` : ''}</span>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </SektionCard>

              <SektionCard title="Bewilligungszeitraum & Zahlung" offenCount={countZahlung}>
                {editMode ? (
                  <div style={styles.editRow}>
                    <span style={styles.editLabel}>Zeitraum von</span>
                    <input type="date" style={styles.input} value={form.bwz_start} onChange={(e) => setForm({ ...form, bwz_start: e.target.value })} />
                    <span style={styles.editLabel}>Zeitraum bis</span>
                    <input type="date" style={styles.input} value={form.bwz_ende} onChange={(e) => setForm({ ...form, bwz_ende: e.target.value })} />
                    <span style={styles.editLabel}>IBAN</span>
                    <input style={styles.input} value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} />
                  </div>
                ) : (
                  <FeldGrid felder={[
                    { label: 'Bewilligungszeitraum', value: (vorgang.bwz_start || vorgang.bwz_ende) ? `${fmtDate(vorgang.bwz_start)} – ${fmtDate(vorgang.bwz_ende)}` : '—' },
                    { label: 'IBAN', value: vorgang.iban || '—' },
                  ]} />
                )}
              </SektionCard>
            </>
          )}

          {mainTab === 'schreiben' && (
            <SektionCard
              title="Schreiben"
              action={canEdit && <button style={styles.btn} onClick={generiereSchreiben} disabled={busy}>{busy ? 'Erstellt…' : 'Anforderungsschreiben generieren'}</button>}
            >
              {schreiben.length === 0 ? (
                <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>
                  Noch keine Schreiben. Aus den offenen Anforderungen lässt sich ein Nachforderungsschreiben erzeugen.
                </div>
              ) : (
                schreiben.map((s) => {
                  const st = editState(s);
                  return (
                    <div key={s.id} style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg, marginBottom: theme.spacing.md }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md, gap: theme.spacing.md, flexWrap: 'wrap' }}>
                        <span style={styles.chip}>{SCHREIBEN_ART_LABEL[s.art] || s.art}</span>
                        <div style={{ display: 'flex', gap: theme.spacing.sm }}>
                          <button style={styles.btnSmall} onClick={() => download(`${s.betreff || 'Schreiben'}.txt`, `${st.betreff}\n\n${st.body}`)}>Als Text-Datei herunterladen</button>
                          {canEdit && <button style={styles.btn} onClick={() => saveSchreiben(s)} disabled={busy}>Speichern</button>}
                        </div>
                      </div>
                      <label style={styles.label}>Betreff</label>
                      <input style={{ ...styles.input, marginBottom: theme.spacing.md }} value={st.betreff} disabled={!canEdit} onChange={(e) => setEditField(s, 'betreff', e.target.value)} />
                      <label style={styles.label}>Frist</label>
                      <input type="date" style={{ ...styles.input, marginBottom: theme.spacing.md, maxWidth: 200 }} value={st.frist} disabled={!canEdit} onChange={(e) => setEditField(s, 'frist', e.target.value)} />
                      <label style={styles.label}>Text</label>
                      <textarea style={styles.textarea} value={st.body} disabled={!canEdit} onChange={(e) => setEditField(s, 'body', e.target.value)} />
                    </div>
                  );
                })
              )}
            </SektionCard>
          )}

          {mainTab === 'plausibilitaet' && (
            <SektionCard title="Plausibilitätsprüfung">
              {(() => {
                const list = pruefschritte.filter((p) => p.kategorie === 'plausibilitaet');
                if (list.length === 0) return <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>Keine Plausibilitäts-Prüfschritte. Starte rechts „Neu prüfen".</div>;
                return list.map((p) => (
                  <PruefschrittItem key={p.id} pruefschritt={p} canEdit={canEdit} busy={busy} onStatus={(s) => setPruefStatus(p, s)} />
                ));
              })()}
            </SektionCard>
          )}

          {mainTab === 'prognose' && (
            <SektionCard title="Einkommensprognose">
              <div style={styles.placeholder}>
                <div style={{ fontSize: theme.typography.sizes.md, fontWeight: theme.typography.weights.medium, color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }}>In Vorbereitung</div>
                <div style={{ fontSize: theme.typography.sizes.sm, maxWidth: 420, margin: '0 auto', lineHeight: 1.5 }}>
                  Die Prognose des anrechenbaren Einkommens über den Bewilligungszeitraum wird derzeit erarbeitet.
                  Es werden hier keine vorläufigen Zahlen angezeigt.
                </div>
              </div>
            </SektionCard>
          )}

          {mainTab === 'verfuegung' && (
            <SektionCard title="Verfügung">
              <div style={styles.placeholder}>
                <div style={{ fontSize: theme.typography.sizes.md, fontWeight: theme.typography.weights.medium, color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }}>In Vorbereitung</div>
                <div style={{ fontSize: theme.typography.sizes.sm, maxWidth: 420, margin: '0 auto', lineHeight: 1.5, marginBottom: theme.spacing.lg }}>
                  Die Erstellung der abschließenden Verfügung folgt in einem späteren Schritt.
                </div>
                <button style={{ ...styles.btnGhost, cursor: 'not-allowed', opacity: 0.5 }} disabled title="Noch nicht verfügbar">Verfügung herunterladen</button>
              </div>
            </SektionCard>
          )}
        </div>

        {/* ── RECHTE SEITENLEISTE ── */}
        <div style={styles.side}>
          <div style={styles.sideCard}>
            <div style={styles.tabs}>
              {SIDE_TABS.map((t) => (
                <button key={t.id} style={{ ...styles.tab, ...(sideTab === t.id ? styles.tabActive : {}) }} onClick={() => setSideTab(t.id)}>{t.label}</button>
              ))}
            </div>

            {sideTab === 'details' && (
              <div>
                <FeldGrid felder={[
                  { label: 'Sachbearbeiter', value: vorgang.sachbearbeiter || '—' },
                  { label: 'Priorität', value: PRIORITAET_LABEL[vorgang.prioritaet] || vorgang.prioritaet },
                  { label: 'Letzte Änderung', value: fmtDateTime(vorgang.updated_at) },
                ]} />
                <div style={styles.sideTitle}>Labels</div>
                {(vorgang.labels || []).length === 0
                  ? <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>Keine Labels.</div>
                  : <div style={{ display: 'flex', gap: theme.spacing.xs, flexWrap: 'wrap' }}>{vorgang.labels.map((l) => <span key={l} style={styles.chip}>{l}</span>)}</div>}
                <div style={styles.sideTitle}>Aktivitäten</div>
                {aktivitaeten.length === 0
                  ? <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>Noch keine Aktivitäten.</div>
                  : aktivitaeten.slice().reverse().map((a) => (
                    <div key={a.id} style={styles.activity}>
                      <div style={{ color: theme.colors.text }}>{a.beschreibung || a.typ}</div>
                      <div style={{ color: theme.colors.textMuted }}>{fmtDateTime(a.created_at)}{a.akteur ? ` · ${a.akteur}` : ''}</div>
                    </div>
                  ))}
              </div>
            )}

            {sideTab === 'pruefschritte' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md, gap: theme.spacing.sm, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: theme.spacing.xs }}>
                    {PRUEF_FILTER.map((f) => (
                      <button key={f.id} style={{ ...styles.tab, ...(pruefFilter === f.id ? styles.tabActive : {}) }} onClick={() => setPruefFilter(f.id)}>{f.label}</button>
                    ))}
                  </div>
                  {canEdit && <button style={styles.btnSmall} onClick={pruefen} disabled={busy}>{busy ? 'Prüft…' : 'Neu prüfen'}</button>}
                </div>

                {(() => {
                  const filtered = pruefschritte.filter((p) => pruefFilter === 'alle' || p.status === pruefFilter);
                  if (filtered.length === 0) return <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>Keine Prüfschritte für diesen Filter.</div>;
                  // Gruppierung: je Person + „Allgemein".
                  const groups = [{ key: 'allgemein', label: 'Allgemein', items: filtered.filter((p) => !p.personId) }];
                  for (const p of personen) {
                    const items = filtered.filter((x) => x.personId === p.id);
                    if (items.length) groups.push({ key: p.id, label: [p.vorname, p.nachname].filter(Boolean).join(' ') || 'Person', items });
                  }
                  return groups.filter((g) => g.items.length).map((g) => (
                    <div key={g.key} style={{ marginBottom: theme.spacing.md }}>
                      <div style={styles.sideTitle}>{g.label} ({g.items.length})</div>
                      {g.items.map((p) => (
                        <PruefschrittItem key={p.id} pruefschritt={p} canEdit={canEdit} busy={busy} onStatus={(s) => setPruefStatus(p, s)} />
                      ))}
                    </div>
                  ));
                })()}

                {canEdit && (
                  <div style={{ marginTop: theme.spacing.lg, borderTop: `1px solid ${theme.colors.borderLight}`, paddingTop: theme.spacing.md }}>
                    <div style={styles.sideTitle}>Anforderung ergänzen</div>
                    <div style={{ display: 'flex', gap: theme.spacing.sm }}>
                      <input style={styles.input} placeholder="Titel der Anforderung" value={neueAnforderung} onChange={(e) => setNeueAnforderung(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addAnforderung(); }} />
                      <button style={styles.btnSmall} onClick={addAnforderung} disabled={busy || !neueAnforderung.trim()}>+ Anforderung</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {sideTab === 'dokumente' && (
              <div>
                {(() => {
                  const nachweise = dokumente.filter((d) => !d.istOriginal);
                  const originale = dokumente.filter((d) => d.istOriginal);
                  const renderDoc = (d) => (
                    <div key={d.id} style={styles.docItem}>
                      <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.text }}>
                        {DOKUMENT_TYP_LABEL[d.typ] || d.typ}
                      </div>
                      {d.titel && <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>{d.titel}</div>}
                      <div style={{ fontSize: '0.7rem', color: theme.colors.textMuted, marginTop: 2 }}>
                        {[d.quelle, d.seiten ? `${d.seiten} S.` : null, d.eingegangenAm ? fmtDate(d.eingegangenAm) : null].filter(Boolean).join(' · ')}
                      </div>
                      {(d.flags || []).length > 0 && (
                        <div style={{ display: 'flex', gap: theme.spacing.xs, flexWrap: 'wrap', marginTop: theme.spacing.xs }}>
                          {d.flags.map((f) => (
                            <span key={f.code} style={{ ...styles.chip, backgroundColor: theme.colors.warningLight, color: theme.colors.warning }} title={f.hinweis}>{f.hinweis || f.code}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                  if (dokumente.length === 0) return <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>Noch keine Dokumente.</div>;
                  return (
                    <>
                      <div style={styles.sideTitle}>Nachweise ({nachweise.length})</div>
                      {nachweise.length === 0 ? <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>Keine klassifizierten Nachweise.</div> : nachweise.map(renderDoc)}
                      <div style={styles.sideTitle}>Originaldateien ({originale.length})</div>
                      {originale.length === 0 ? <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>Keine Originaldateien.</div> : originale.map(renderDoc)}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
