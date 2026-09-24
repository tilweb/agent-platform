import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { theme } from '../../config/theme';
import {
  ArrowLeftIcon, DocumentIcon, RefreshIcon, LightningIcon,
  CheckCircleIcon, AlertTriangleIcon, InfoIcon, ChevronDownIcon, UserIcon, XIcon,
} from '../../components/Icons';
import {
  wohngeldApi, ACCENT, ACCENT_LIGHT,
  DOKUMENT_TYP_LABEL, WOHNGELDART_LABEL, ANTRAGSART_LABEL,
  POSTEINGANG_STATUS_LABEL, POSTEINGANG_QUELLE_LABEL,
} from './api';
import AuswertungsFortschritt from './components/AuswertungsFortschritt';
import { istHaengend } from './fortschritt';

const LEVEL_LABEL = { hoch: 'Hohe Übereinstimmung', mittel: 'Mögliche Übereinstimmung', gering: 'Geringe Übereinstimmung' };
const STATUS_LABEL = { gleich: 'Übereinstimmung', abweichung: 'Abweichung', fehlt: 'Fehlt' };
const TYP_OPTIONS = Object.keys(DOKUMENT_TYP_LABEL);

// ── Styles (aus der bisherigen Erfassungs-Oberfläche recycelt) ───────────────
const styles = {
  page: { width: '100%' },
  header: { padding: `${theme.spacing.xl} ${theme.spacing['2xl']}`, borderBottom: `1px solid ${theme.colors.border}` },
  backLink: { display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs, fontSize: theme.typography.sizes.sm, color: ACCENT, cursor: 'pointer', marginBottom: theme.spacing.lg, border: 'none', background: 'none', padding: 0, fontWeight: theme.typography.weights.medium },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: theme.spacing.lg, flexWrap: 'wrap' },
  title: { fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, color: theme.colors.text },
  subtitle: { fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted, marginTop: theme.spacing.xs, display: 'flex', alignItems: 'center', gap: theme.spacing.md, flexWrap: 'wrap' },
  headerActions: { display: 'flex', gap: theme.spacing.md, flexWrap: 'wrap' },
  badge: { display: 'inline-block', fontSize: theme.typography.sizes.xs, padding: `${theme.spacing.xs} ${theme.spacing.md}`, borderRadius: theme.borderRadius.full, fontWeight: theme.typography.weights.medium, whiteSpace: 'nowrap' },

  split: { display: 'flex', gap: theme.spacing.lg, padding: `${theme.spacing.xl} ${theme.spacing['2xl']}`, alignItems: 'stretch', flexWrap: 'wrap' },
  leftCol: { flex: 1.3, minWidth: 340, display: 'flex', flexDirection: 'column', gap: theme.spacing.lg },
  rightCol: { flex: 1, minWidth: 300, display: 'flex' },
  pane: { flex: 1, backgroundColor: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.xl, padding: theme.spacing.xl, display: 'flex', flexDirection: 'column' },
  paneTitle: { fontSize: theme.typography.sizes.md, fontWeight: theme.typography.weights.semibold, color: theme.colors.text, marginBottom: theme.spacing.md },
  sectionTitle: { fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.semibold, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: theme.spacing.sm, marginTop: theme.spacing.md },
  hint: { fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted, lineHeight: 1.5 },

  label: { display: 'block', fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginBottom: theme.spacing.xs, fontWeight: theme.typography.weights.medium },
  input: { width: '100%', padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, fontSize: theme.typography.sizes.sm, backgroundColor: theme.colors.surface, color: theme.colors.text, outline: 'none', boxSizing: 'border-box' },
  select: { width: '100%', padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, fontSize: theme.typography.sizes.sm, backgroundColor: theme.colors.surface, color: theme.colors.text, cursor: 'pointer' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md },
  field: { marginBottom: theme.spacing.md },

  docRow: { display: 'flex', alignItems: 'center', gap: theme.spacing.md, padding: theme.spacing.sm, borderRadius: theme.borderRadius.md, cursor: 'pointer', border: `1px solid transparent` },
  docRowActive: { backgroundColor: ACCENT_LIGHT, border: `1px solid ${ACCENT}33` },
  docName: { fontSize: theme.typography.sizes.sm, color: theme.colors.text, fontWeight: theme.typography.weights.medium, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  typeSelect: { padding: `${theme.spacing.xs} ${theme.spacing.sm}`, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, fontSize: theme.typography.sizes.xs, backgroundColor: theme.colors.surface, color: theme.colors.text, cursor: 'pointer' },

  btnPrimary: { padding: `${theme.spacing.sm} ${theme.spacing.lg}`, backgroundColor: ACCENT, color: '#fff', border: 'none', borderRadius: theme.borderRadius.lg, fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: theme.spacing.sm },
  btnSecondary: { padding: `${theme.spacing.sm} ${theme.spacing.md}`, backgroundColor: 'transparent', color: theme.colors.text, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs },
  btnDanger: { color: theme.colors.error, borderColor: `${theme.colors.error}30` },
  radioRow: { display: 'flex', gap: theme.spacing.lg, marginBottom: theme.spacing.md },
  radio: { display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs, fontSize: theme.typography.sizes.sm, color: theme.colors.text, cursor: 'pointer' },

  preview: { flex: 1, minHeight: 300, backgroundColor: theme.colors.background, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, padding: theme.spacing.md, fontFamily: theme.typography.fontMono, fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary, whiteSpace: 'pre-wrap', overflow: 'auto', lineHeight: 1.5 },
  placeholder: { flex: 1, minHeight: 300, border: `1px dashed ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: theme.spacing.xl, color: theme.colors.textMuted, gap: theme.spacing.sm },
  error: { padding: theme.spacing.md, backgroundColor: theme.colors.errorLight, color: theme.colors.error, borderRadius: theme.borderRadius.md, fontSize: theme.typography.sizes.sm, marginBottom: theme.spacing.md },

  matchHead: { display: 'flex', alignItems: 'flex-start', gap: theme.spacing.md, marginBottom: theme.spacing.md },
  matchTitle: { fontSize: theme.typography.sizes.md, fontWeight: theme.typography.weights.semibold, color: theme.colors.text },
  matchSub: { fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted, marginTop: 2 },
  levelBadge: { fontSize: theme.typography.sizes.xs, padding: `${theme.spacing.xs} ${theme.spacing.md}`, borderRadius: theme.borderRadius.full, fontWeight: theme.typography.weights.medium, whiteSpace: 'nowrap' },
  hinweisAbweichung: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm, padding: theme.spacing.md, backgroundColor: theme.colors.warningLight, color: theme.colors.warning, borderRadius: theme.borderRadius.md, fontSize: theme.typography.sizes.sm, marginTop: theme.spacing.md, fontWeight: theme.typography.weights.medium },

  cmpTable: { width: '100%', borderCollapse: 'collapse', marginTop: theme.spacing.md, fontSize: theme.typography.sizes.sm },
  cmpHeadCell: { textAlign: 'left', padding: `${theme.spacing.xs} ${theme.spacing.sm}`, fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.semibold, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: `1px solid ${theme.colors.border}` },
  cmpCell: { padding: `${theme.spacing.sm} ${theme.spacing.sm}`, borderBottom: `1px solid ${theme.colors.border}`, color: theme.colors.text, verticalAlign: 'top' },
  cmpLabel: { color: theme.colors.textMuted, fontWeight: theme.typography.weights.medium, whiteSpace: 'nowrap' },
  cmpMissing: { color: theme.colors.textLight, fontStyle: 'italic' },
  cmpStatus: { display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs, fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.medium },

  matchButtons: { display: 'flex', gap: theme.spacing.md, marginTop: theme.spacing.lg, flexWrap: 'wrap' },
  groupHead: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm, padding: `${theme.spacing.sm} ${theme.spacing.sm} ${theme.spacing.xs}`, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, flexWrap: 'wrap' },
  groupName: { fontWeight: theme.typography.weights.semibold, color: theme.colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 },
  groupBody: { marginLeft: theme.spacing.lg, paddingLeft: theme.spacing.sm, borderLeft: `2px solid ${theme.colors.border}` },
  seitenBadge: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, whiteSpace: 'nowrap' },
  linkBtn: { border: 'none', background: 'none', padding: 0, color: ACCENT, cursor: 'pointer', fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.medium, whiteSpace: 'nowrap' },
  trennHinweis: { display: 'flex', alignItems: 'flex-start', gap: theme.spacing.xs, fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary, backgroundColor: theme.colors.warningLight, borderRadius: theme.borderRadius.md, padding: `${theme.spacing.xs} ${theme.spacing.sm}`, margin: `0 ${theme.spacing.sm} ${theme.spacing.sm}` },
  trennForm: { margin: `${theme.spacing.xs} ${theme.spacing.sm} ${theme.spacing.md}`, padding: theme.spacing.md, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.background },
  weitereToggle: { display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs, marginTop: theme.spacing.lg, fontSize: theme.typography.sizes.sm, color: ACCENT, cursor: 'pointer', border: 'none', background: 'none', padding: 0, fontWeight: theme.typography.weights.medium },
  weitereItem: { marginTop: theme.spacing.lg, paddingTop: theme.spacing.lg, borderTop: `1px solid ${theme.colors.border}` },
};

function statusTone(status) {
  switch (status) {
    case 'zugeordnet': return { backgroundColor: theme.colors.successLight, color: theme.colors.success };
    case 'analysiert': return { backgroundColor: theme.colors.primaryLight, color: theme.colors.primaryDark };
    case 'in_analyse': return { backgroundColor: theme.colors.infoLight, color: theme.colors.info };
    case 'fehler': return { backgroundColor: theme.colors.errorLight, color: theme.colors.error };
    case 'verworfen': return { backgroundColor: theme.colors.surfaceHover, color: theme.colors.textLight };
    default: return { backgroundColor: theme.colors.warningLight, color: theme.colors.warning };
  }
}
function statusStyle(status) {
  if (status === 'gleich') return { backgroundColor: theme.colors.successLight, color: theme.colors.success };
  if (status === 'abweichung') return { backgroundColor: theme.colors.warningLight, color: theme.colors.warning };
  return { backgroundColor: theme.colors.surfaceHover, color: theme.colors.textMuted };
}
function seitenText(von, bis) {
  return von === bis ? `S. ${von}` : `S. ${von}–${bis}`;
}

/**
 * Gruppiert die Dateiliste für die Anzeige: Teile einer getrennten Sammel-PDF
 * (gleicher `teilVon.hash`) werden zu einer Gruppe, alle anderen Dateien bleiben
 * einzeln. Der Original-Index bleibt erhalten (Auswahl/Typ-PATCH arbeiten per Index).
 */
function gruppiereDateien(dateien) {
  const gruppen = [];
  const byHash = new Map();
  dateien.forEach((d, i) => {
    const h = d.teilVon?.hash;
    if (!h) { gruppen.push({ typ: 'einzeln', eintraege: [{ d, i }] }); return; }
    let g = byHash.get(h);
    if (!g) { g = { typ: 'getrennt', hash: h, teilVon: d.teilVon, eintraege: [] }; byHash.set(h, g); gruppen.push(g); }
    g.eintraege.push({ d, i });
  });
  for (const g of gruppen) if (g.typ === 'getrennt') g.eintraege.sort((a, b) => a.d.teilVon.seiteVon - b.d.teilVon.seiteVon);
  return gruppen;
}

/** Kann diese (ungetrennte) Datei manuell getrennt werden? */
function istTrennbar(d) {
  const pdf = d.contentType === 'application/pdf' || /\.pdf$/i.test(d.dateiname || '');
  if (!pdf || d.teilVon) return false;
  const t = d.trennung;
  return Boolean(t && (t.seitenGesamt > 1 || t.status === 'unsicher' || t.status === 'nicht_moeglich'));
}

function levelBadgeStyle(level) {
  if (level === 'hoch') return { backgroundColor: theme.colors.successLight, color: theme.colors.success };
  if (level === 'mittel') return { backgroundColor: theme.colors.warningLight, color: theme.colors.warning };
  return { backgroundColor: theme.colors.surfaceHover, color: theme.colors.textMuted };
}

function VergleichTabelle({ vergleich }) {
  if (!vergleich?.length) return null;
  return (
    <table style={styles.cmpTable}>
      <thead>
        <tr>
          <th style={styles.cmpHeadCell}>Feld</th>
          <th style={styles.cmpHeadCell}>Aus der Nachreichung</th>
          <th style={styles.cmpHeadCell}>Im Vorgang</th>
          <th style={styles.cmpHeadCell}>Status</th>
        </tr>
      </thead>
      <tbody>
        {vergleich.map((z) => (
          <tr key={z.feld}>
            <td style={{ ...styles.cmpCell, ...styles.cmpLabel }}>{z.label}</td>
            <td style={styles.cmpCell}>{z.ausDokument || <span style={styles.cmpMissing}>—</span>}</td>
            <td style={styles.cmpCell}>{z.imVorgang || <span style={styles.cmpMissing}>—</span>}</td>
            <td style={styles.cmpCell}>
              <span style={{ ...styles.cmpStatus, ...statusStyle(z.status), padding: `2px ${theme.spacing.sm}`, borderRadius: theme.borderRadius.full }}>
                {z.status === 'gleich' && <CheckCircleIcon size={12} />}
                {z.status === 'abweichung' && <AlertTriangleIcon size={12} />}
                {z.status === 'fehlt' && <InfoIcon size={12} />}
                {STATUS_LABEL[z.status]}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function emptyStamm() {
  return { antragsdatum: '', wohngeldart: 'mietzuschuss', antragsart: 'erstantrag', vorname: '', nachname: '', geburtsdatum: '', strasse: '', hausnummer: '', plz: '', ort: '', miete: '', wohnflaeche_qm: '' };
}
function stammFromDatei(d) {
  const s = d?.stammdaten || {};
  return {
    antragsdatum: s.antragsdatum || '', wohngeldart: s.wohngeldart || 'mietzuschuss', antragsart: s.antragsart || 'erstantrag',
    vorname: s.antragsteller?.vorname || '', nachname: s.antragsteller?.nachname || '', geburtsdatum: s.antragsteller?.geburtsdatum || '',
    strasse: s.adresse?.strasse || '', hausnummer: s.adresse?.hausnummer || '', plz: s.adresse?.plz || '', ort: s.adresse?.ort || '',
    miete: s.wohnung?.miete ?? '', wohnflaeche_qm: s.wohnung?.wohnflaeche_qm ?? '',
  };
}
function stammToPayload(f) {
  const num = (v) => (v === '' || v === null || v === undefined ? undefined : Number(v));
  return {
    antragsdatum: f.antragsdatum || undefined, wohngeldart: f.wohngeldart || undefined, antragsart: f.antragsart || undefined,
    antragsteller: { vorname: f.vorname || undefined, nachname: f.nachname || undefined, geburtsdatum: f.geburtsdatum || undefined },
    adresse: { strasse: f.strasse || undefined, hausnummer: f.hausnummer || undefined, plz: f.plz || undefined, ort: f.ort || undefined },
    wohnung: { miete: num(f.miete), wohnflaeche_qm: num(f.wohnflaeche_qm) },
  };
}

export default function PosteingangDetail() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [eingang, setEingang] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [trennEdit, setTrennEdit] = useState(null); // { hash, seitenGesamt, wert }
  const [stamm, setStamm] = useState(emptyStamm());
  const [busy, setBusy] = useState(false);
  const [weitereOffen, setWeitereOffen] = useState(false);

  // Verteilung (manuell)
  const [akten, setAkten] = useState([]);
  const [akteMode, setAkteMode] = useState('new');
  const [akteId, setAkteId] = useState('');
  const [neueAkteName, setNeueAkteName] = useState('');
  const [vorgaenge, setVorgaenge] = useState([]);
  const [vorgangMode, setVorgangMode] = useState('new');
  const [vorgangId, setVorgangId] = useState('');
  const [showManual, setShowManual] = useState(false);

  const laden = useCallback(async ({ still = false } = {}) => {
    if (!still) setLoading(true);
    try {
      const e = await wohngeldApi.getPosteingang(id);
      setEingang(e);
      if (still && e.status === 'in_analyse') return; // Formularwerte erst nach Abschluss übernehmen
      const antrag = (e.dateien || []).find((d) => d.typ === 'wohngeldantrag' && d.stammdaten) || (e.dateien || []).find((d) => d.typ === 'wohngeldantrag');
      setStamm(antrag ? stammFromDatei(antrag) : emptyStamm());
      if (antrag?.stammdaten?.antragsteller) {
        const a = antrag.stammdaten.antragsteller;
        setNeueAkteName([a.nachname, a.vorname].filter(Boolean).join(', '));
      }
      const best = (e.matchVorschlag || [])[0];
      setShowManual(!(best && (best.level === 'hoch' || best.level === 'mittel')));
      setError(null);
    } catch (err) {
      setError(err.message || 'Eingang konnte nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { laden(); }, [laden]);

  // Während der Auswertung alle 2 s nachladen (Fortschritt), danach einmal vollständig.
  const laeuft = eingang?.status === 'in_analyse' && !istHaengend(eingang);
  useEffect(() => {
    if (!laeuft) return undefined;
    const t = setInterval(() => { laden({ still: true }); }, 2000);
    return () => clearInterval(t);
  }, [laeuft, laden]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try { const list = await wohngeldApi.listAkten(); if (!cancelled) setAkten(list); } catch { /* optional */ }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (akteMode !== 'existing' || !akteId) { setVorgaenge([]); return; }
    (async () => {
      try { const list = await wohngeldApi.listAkteVorgaenge(akteId); if (!cancelled) setVorgaenge(list); }
      catch { if (!cancelled) setVorgaenge([]); }
    })();
    return () => { cancelled = true; };
  }, [akteMode, akteId]);

  const dateien = eingang?.dateien || [];
  const selected = dateien[selectedIndex];
  const s = (key) => (v) => setStamm((prev) => ({ ...prev, [key]: v }));

  async function auswerten() {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const r = await wohngeldApi.analysierePosteingang([id]);
      if (r?.abgelehnt?.length) setError(r.abgelehnt[0].error);
      await laden({ still: true });
    } catch (e) { setError(e.message || 'Auswertung fehlgeschlagen'); }
    finally { setBusy(false); }
  }

  async function verwerfen() {
    const grund = window.prompt('Grund für das Verwerfen (optional):', '');
    if (grund === null) return;
    setBusy(true); setError(null);
    try {
      await wohngeldApi.verwerfenPosteingang(id, grund || undefined);
      navigate('/apps/wohngeld/posteingang');
    } catch (e) { setError(e.message || 'Verwerfen fehlgeschlagen'); setBusy(false); }
  }

  async function setTyp(index, typ) {
    // optimistisch + persistieren (PATCH)
    setEingang((prev) => prev ? { ...prev, dateien: prev.dateien.map((d, i) => (i === index ? { ...d, typ } : d)) } : prev);
    try { await wohngeldApi.patchPosteingang(id, { dateiTypen: [{ index, typ }] }); }
    catch (e) { setError(e.message || 'Typ konnte nicht gespeichert werden'); }
  }

  function oeffneTrennung(hash, seitenGesamt, startSeiten) {
    setTrennEdit({ hash, seitenGesamt, wert: (startSeiten && startSeiten.length ? startSeiten : [1]).join(', ') });
  }

  async function trennungSpeichern(alsEinDokument) {
    if (!trennEdit || busy) return;
    let startSeiten = [];
    if (!alsEinDokument) {
      const teile = trennEdit.wert.split(/[,;\s]+/).filter(Boolean);
      startSeiten = teile.map((t) => Number(t));
      if (!startSeiten.length || startSeiten.some((n) => !Number.isInteger(n) || n < 1)) {
        setError('Bitte Seitenzahlen als ganze Zahlen angeben, z. B. „1, 4, 7".');
        return;
      }
    }
    setBusy(true); setError(null);
    try {
      await wohngeldApi.trennePosteingang(id, trennEdit.hash, startSeiten);
      setTrennEdit(null);
      setSelectedIndex(0);
      await laden();
    } catch (e) { setError(e.message || 'Trennung konnte nicht gespeichert werden'); }
    finally { setBusy(false); }
  }

  async function zuordnenZuVorgang(zielVorgangId, matchLevel) {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const res = await wohngeldApi.zuordnenPosteingang(id, {
        vorgangId: zielVorgangId, viaVorschlag: true, matchLevel, pruefen: true, stammdaten: stammToPayload(stamm),
      });
      navigate(`/apps/wohngeld/vorgang/${res?.vorgang?.id || zielVorgangId}`);
    } catch (e) { setError(e.message || 'Zuordnung fehlgeschlagen'); setBusy(false); }
  }

  async function zuordnenManuell() {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const payload = { pruefen: true, stammdaten: stammToPayload(stamm) };
      if (akteMode === 'existing' && akteId) payload.akteId = akteId;
      else payload.neueAkte = { name: neueAkteName || undefined };
      if (akteMode === 'existing' && vorgangMode === 'existing' && vorgangId) payload.vorgangId = vorgangId;
      const res = await wohngeldApi.zuordnenPosteingang(id, payload);
      if (res?.vorgang?.id) navigate(`/apps/wohngeld/vorgang/${res.vorgang.id}`);
    } catch (e) { setError(e.message || 'Zuordnung fehlgeschlagen'); setBusy(false); }
  }

  if (loading) return <div style={styles.page}><div style={styles.header}><h1 style={styles.title}>Posteingang</h1><p style={styles.subtitle}>Wird geladen…</p></div></div>;
  if (!eingang) return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button style={styles.backLink} onClick={() => navigate('/apps/wohngeld/posteingang')}><ArrowLeftIcon /> Posteingang</button>
        <h1 style={styles.title}>Eingang nicht gefunden</h1>
        {error && <p style={styles.subtitle}>{error}</p>}
      </div>
    </div>
  );

  const kandidaten = eingang.matchVorschlag || [];
  const bestKandidat = kandidaten[0];
  const zeigeVorschlag = Boolean(bestKandidat && (bestKandidat.level === 'hoch' || bestKandidat.level === 'mittel'));
  const weitereKandidaten = kandidaten.slice(1);
  const hatAbweichung = (k) => (k?.vergleich || []).some((z) => z.status === 'abweichung');
  const analysiert = eingang.status === 'analysiert';
  const auswertbar = ['eingegangen', 'fehler'].includes(eingang.status) || istHaengend(eingang);
  const inAnalyse = eingang.status === 'in_analyse';
  const terminal = eingang.status === 'zugeordnet' || eingang.status === 'verworfen';

  const canAssign = dateien.length > 0 && !busy
    && (akteMode === 'existing' ? Boolean(akteId) : Boolean(neueAkteName.trim()))
    && !(akteMode === 'existing' && vorgangMode === 'existing' && !vorgangId);

  const renderKandidat = (k, { primary }) => (
    <>
      <div style={styles.matchHead}>
        {hatAbweichung(k)
          ? <AlertTriangleIcon size={20} color={theme.colors.warning} style={{ flexShrink: 0, marginTop: 2 }} />
          : <CheckCircleIcon size={20} color={ACCENT} style={{ flexShrink: 0, marginTop: 2 }} />}
        <div style={{ flex: 1 }}>
          <div style={styles.matchTitle}>
            {primary ? 'Vermutlich zuzuordnen: ' : ''}{k.antragstellerName || 'Unbenannter Vorgang'}{k.antragsId ? ` · ${k.antragsId}` : ''}
          </div>
          {k.akteName && <div style={styles.matchSub}>Akte: {k.akteName}</div>}
        </div>
        <span style={{ ...styles.levelBadge, ...levelBadgeStyle(k.level) }}>{LEVEL_LABEL[k.level] || k.level}</span>
      </div>
      <VergleichTabelle vergleich={k.vergleich} />
      {hatAbweichung(k) && (
        <div style={styles.hinweisAbweichung}><AlertTriangleIcon size={16} /> Angaben weichen ab — bitte prüfen.</div>
      )}
      <div style={styles.matchButtons}>
        <button style={{ ...styles.btnPrimary, opacity: busy ? 0.5 : 1, cursor: busy ? 'not-allowed' : 'pointer' }} onClick={() => zuordnenZuVorgang(k.vorgangId, k.level)} disabled={busy}>
          {busy ? <RefreshIcon size={16} /> : <DocumentIcon size={16} color="#fff" />}
          {busy ? 'Wird zugeordnet…' : 'Diesem Vorgang zuordnen'}
        </button>
        {primary && (
          <button style={styles.btnSecondary} onClick={() => setShowManual(true)} disabled={busy}>
            <UserIcon size={14} /> Anderer Vorgang / neu
          </button>
        )}
      </div>
    </>
  );

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button style={styles.backLink} onClick={() => navigate('/apps/wohngeld/posteingang')}><ArrowLeftIcon /> Posteingang</button>
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>{eingang.betreff || dateien[0]?.dateiname || 'Eingang'}</h1>
            <div style={styles.subtitle}>
              <span style={{ ...styles.badge, ...statusTone(eingang.status) }}>{POSTEINGANG_STATUS_LABEL[eingang.status] || eingang.status}</span>
              <span>Quelle: {POSTEINGANG_QUELLE_LABEL[eingang.quelle] || eingang.quelle}</span>
              <span>·</span>
              <span>Eingang: {new Date(eingang.eingegangenAm).toLocaleString('de-DE')}</span>
              <span>·</span>
              <span>{dateien.length} Datei{dateien.length === 1 ? '' : 'en'}</span>
            </div>
          </div>
          <div style={styles.headerActions}>
            {(auswertbar || analysiert) && (
              <button style={{ ...styles.btnPrimary, opacity: busy ? 0.5 : 1 }} onClick={auswerten} disabled={busy}>
                {busy ? <RefreshIcon size={16} /> : <LightningIcon size={16} color="#fff" />}
                {analysiert ? 'Neu auswerten' : 'Auswertung starten'}
              </button>
            )}
            {!terminal && (
              <button style={{ ...styles.btnSecondary, ...styles.btnDanger }} onClick={verwerfen} disabled={busy}>
                <XIcon size={14} /> Verwerfen
              </button>
            )}
          </div>
        </div>
      </div>

      {error && <div style={{ ...styles.error, margin: `${theme.spacing.lg} ${theme.spacing['2xl']} 0` }}>{error}</div>}

      {/* Terminal-Hinweise */}
      {eingang.status === 'zugeordnet' && (
        <div style={styles.split}>
          <div style={styles.pane}>
            <div style={styles.paneTitle}>Zugeordnet</div>
            <p style={styles.hint}>Dieser Eingang wurde einem Vorgang zugeordnet. Die Daten leben ab jetzt im Vorgang.</p>
            {eingang.zugeordneterVorgangId && (
              <div style={{ marginTop: theme.spacing.md }}>
                <button style={styles.btnPrimary} onClick={() => navigate(`/apps/wohngeld/vorgang/${eingang.zugeordneterVorgangId}`)}>
                  <DocumentIcon size={16} color="#fff" /> Zum Vorgang
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {eingang.status === 'verworfen' && (
        <div style={styles.split}>
          <div style={styles.pane}>
            <div style={styles.paneTitle}>Verworfen</div>
            <p style={styles.hint}>{eingang.verworfenGrund ? `Grund: ${eingang.verworfenGrund}` : 'Dieser Eingang wurde verworfen.'}</p>
          </div>
        </div>
      )}

      {!terminal && (
        <div style={styles.split}>
          {/* LINKS */}
          <div style={styles.leftCol}>
            {auswertbar && (
              <div style={styles.pane}>
                <div style={styles.paneTitle}>Noch nicht ausgewertet</div>
                <p style={styles.hint}>
                  Die Dateien sind gespeichert. Starten Sie die Auswertung, um Dokumente zu klassifizieren, Stammdaten zu
                  extrahieren und einen Zuordnungs-Vorschlag zu ermitteln.
                </p>
              </div>
            )}
            {inAnalyse && (
              <div style={styles.pane}>
                <AuswertungsFortschritt eingang={eingang} />
              </div>
            )}

            {analysiert && (
              <>
                {/* Stammdaten */}
                <div style={styles.pane}>
                  <div style={styles.paneTitle}>Stammdaten des Antrags</div>
                  <div style={styles.grid2}>
                    <div style={styles.field}><label style={styles.label}>Vorname</label><input style={styles.input} value={stamm.vorname} onChange={(e) => s('vorname')(e.target.value)} /></div>
                    <div style={styles.field}><label style={styles.label}>Nachname</label><input style={styles.input} value={stamm.nachname} onChange={(e) => s('nachname')(e.target.value)} /></div>
                  </div>
                  <div style={styles.grid2}>
                    <div style={styles.field}><label style={styles.label}>Geburtsdatum</label><input style={styles.input} placeholder="JJJJ-MM-TT" value={stamm.geburtsdatum} onChange={(e) => s('geburtsdatum')(e.target.value)} /></div>
                    <div style={styles.field}><label style={styles.label}>Antragsdatum</label><input style={styles.input} placeholder="JJJJ-MM-TT" value={stamm.antragsdatum} onChange={(e) => s('antragsdatum')(e.target.value)} /></div>
                  </div>
                  <div style={styles.grid2}>
                    <div style={styles.field}><label style={styles.label}>Wohngeldart</label>
                      <select style={styles.select} value={stamm.wohngeldart} onChange={(e) => s('wohngeldart')(e.target.value)}>
                        {Object.entries(WOHNGELDART_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div style={styles.field}><label style={styles.label}>Antragsart</label>
                      <select style={styles.select} value={stamm.antragsart} onChange={(e) => s('antragsart')(e.target.value)}>
                        {Object.entries(ANTRAGSART_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={styles.sectionTitle}>Wohnung</div>
                  <div style={styles.grid2}>
                    <div style={styles.field}><label style={styles.label}>Straße</label><input style={styles.input} value={stamm.strasse} onChange={(e) => s('strasse')(e.target.value)} /></div>
                    <div style={styles.field}><label style={styles.label}>Hausnummer</label><input style={styles.input} value={stamm.hausnummer} onChange={(e) => s('hausnummer')(e.target.value)} /></div>
                  </div>
                  <div style={styles.grid2}>
                    <div style={styles.field}><label style={styles.label}>PLZ</label><input style={styles.input} value={stamm.plz} onChange={(e) => s('plz')(e.target.value)} /></div>
                    <div style={styles.field}><label style={styles.label}>Ort</label><input style={styles.input} value={stamm.ort} onChange={(e) => s('ort')(e.target.value)} /></div>
                  </div>
                  <div style={styles.grid2}>
                    <div style={styles.field}><label style={styles.label}>Bruttokaltmiete (EUR)</label><input style={styles.input} type="number" value={stamm.miete} onChange={(e) => s('miete')(e.target.value)} /></div>
                    <div style={styles.field}><label style={styles.label}>Wohnfläche (m²)</label><input style={styles.input} type="number" value={stamm.wohnflaeche_qm} onChange={(e) => s('wohnflaeche_qm')(e.target.value)} /></div>
                  </div>
                </div>

                {/* Nachweise */}
                <div style={styles.pane}>
                  <div style={styles.paneTitle}>Erkannte Dokumente ({dateien.length})</div>
                  {gruppiereDateien(dateien).map((g) => {
                    const renderRow = ({ d, i }, teil) => (
                      <div key={`${d.hash || d.dateiname}-${i}`} style={{ ...styles.docRow, ...(i === selectedIndex ? styles.docRowActive : {}) }} onClick={() => setSelectedIndex(i)}>
                        <DocumentIcon size={16} color={theme.colors.textMuted} />
                        <div style={{ ...styles.docName, flex: 1 }} title={d.dateiname}>
                          {teil ? (d.titel || DOKUMENT_TYP_LABEL[d.typ] || d.dateiname) : d.dateiname}{d.analyseFehler ? ' — Fehler' : ''}
                        </div>
                        {teil && <span style={styles.seitenBadge}>{seitenText(d.teilVon.seiteVon, d.teilVon.seiteBis)}</span>}
                        {!teil && istTrennbar(d) && (
                          <button style={styles.linkBtn} disabled={busy} onClick={(e) => { e.stopPropagation(); oeffneTrennung(d.hash, d.trennung?.seitenGesamt, [1]); }}>Trennen…</button>
                        )}
                        <select style={styles.typeSelect} value={d.typ || 'sonstiges'} onClick={(e) => e.stopPropagation()} onChange={(e) => setTyp(i, e.target.value)}>
                          {TYP_OPTIONS.map((t) => <option key={t} value={t}>{DOKUMENT_TYP_LABEL[t]}</option>)}
                        </select>
                      </div>
                    );
                    const formHash = g.typ === 'getrennt' ? g.hash : g.eintraege[0].d.hash;
                    const trennForm = trennEdit && trennEdit.hash === formHash && (
                      <div style={styles.trennForm}>
                        <label style={styles.label}>Neues Dokument beginnt auf Seite</label>
                        <input style={styles.input} value={trennEdit.wert} placeholder="z. B. 1, 4, 7" onChange={(e) => setTrennEdit((t) => ({ ...t, wert: e.target.value }))} />
                        <p style={{ ...styles.hint, fontSize: theme.typography.sizes.xs, marginTop: theme.spacing.xs }}>
                          {trennEdit.seitenGesamt ? `Die Datei hat ${trennEdit.seitenGesamt} Seiten. ` : ''}Jede Zahl markiert den Beginn eines Dokuments. Neue Teile werden direkt ausgewertet.
                        </p>
                        <div style={{ display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.sm, flexWrap: 'wrap' }}>
                          <button style={{ ...styles.btnPrimary, opacity: busy ? 0.5 : 1 }} disabled={busy} onClick={() => trennungSpeichern(false)}>{busy ? 'Wird gespeichert…' : 'Übernehmen'}</button>
                          <button style={styles.btnSecondary} disabled={busy} onClick={() => trennungSpeichern(true)}>Als ein Dokument</button>
                          <button style={styles.btnSecondary} disabled={busy} onClick={() => setTrennEdit(null)}>Abbrechen</button>
                        </div>
                      </div>
                    );
                    if (g.typ === 'einzeln') {
                      const d = g.eintraege[0].d;
                      const hinweis = d.trennung && d.trennung.status !== 'ein_dokument' ? d.trennung.hinweis : null;
                      return (
                        <div key={`e-${g.eintraege[0].i}`}>
                          {renderRow(g.eintraege[0], false)}
                          {hinweis && <div style={styles.trennHinweis}><InfoIcon size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {hinweis}</div>}
                          {trennForm}
                        </div>
                      );
                    }
                    return (
                      <div key={`g-${g.hash}`}>
                        <div style={styles.groupHead}>
                          <span style={styles.groupName} title={g.teilVon.dateiname}>{g.teilVon.dateiname}</span>
                          <span>· {g.teilVon.seitenGesamt} Seiten · in {g.eintraege.length} Dokumente getrennt{g.teilVon.manuell ? ' (manuell)' : ''}</span>
                          <button style={{ ...styles.linkBtn, marginLeft: 'auto' }} disabled={busy}
                            onClick={() => oeffneTrennung(g.hash, g.teilVon.seitenGesamt, g.eintraege.map((e) => e.d.teilVon.seiteVon))}>
                            Trennung korrigieren
                          </button>
                        </div>
                        <div style={styles.groupBody}>{g.eintraege.map((e) => renderRow(e, true))}</div>
                        {trennForm}
                      </div>
                    );
                  })}
                </div>

                {/* Zuordnungs-Vorschlag */}
                {zeigeVorschlag && (
                  <div style={styles.pane}>
                    <div style={styles.paneTitle}>Zuordnungs-Vorschlag</div>
                    {renderKandidat(bestKandidat, { primary: true })}
                    {weitereKandidaten.length > 0 && (
                      <>
                        <button style={styles.weitereToggle} onClick={() => setWeitereOffen((o) => !o)}>
                          <ChevronDownIcon size={14} style={{ transform: weitereOffen ? 'rotate(180deg)' : 'none' }} />
                          {weitereOffen ? 'Weitere Kandidaten ausblenden' : `Weitere Kandidaten (${weitereKandidaten.length})`}
                        </button>
                        {weitereOffen && weitereKandidaten.map((k) => (
                          <div key={k.vorgangId} style={styles.weitereItem}>{renderKandidat(k, { primary: false })}</div>
                        ))}
                      </>
                    )}
                  </div>
                )}

                {/* Verteilung (manuell) */}
                {(showManual || !zeigeVorschlag) && (
                  <div style={styles.pane}>
                    <div style={styles.paneTitle}>Verteilung</div>
                    <div style={styles.sectionTitle}>Akte</div>
                    <div style={styles.radioRow}>
                      <label style={styles.radio}><input type="radio" checked={akteMode === 'new'} onChange={() => setAkteMode('new')} /> Neue Akte</label>
                      <label style={styles.radio}><input type="radio" checked={akteMode === 'existing'} onChange={() => setAkteMode('existing')} /> Bestehende Akte</label>
                    </div>
                    {akteMode === 'new' ? (
                      <div style={styles.field}><label style={styles.label}>Aktenname</label><input style={styles.input} placeholder="z. B. Nachname, Vorname" value={neueAkteName} onChange={(e) => setNeueAkteName(e.target.value)} /></div>
                    ) : (
                      <div style={styles.field}><label style={styles.label}>Akte wählen</label>
                        <select style={styles.select} value={akteId} onChange={(e) => { setAkteId(e.target.value); setVorgangId(''); }}>
                          <option value="">— bitte wählen —</option>
                          {akten.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      </div>
                    )}
                    {akteMode === 'existing' && akteId && (
                      <>
                        <div style={styles.sectionTitle}>Vorgang</div>
                        <div style={styles.radioRow}>
                          <label style={styles.radio}><input type="radio" checked={vorgangMode === 'new'} onChange={() => setVorgangMode('new')} /> Neuer Vorgang</label>
                          <label style={styles.radio}><input type="radio" checked={vorgangMode === 'existing'} onChange={() => setVorgangMode('existing')} /> Bestehender Vorgang (Nachreichung)</label>
                        </div>
                        {vorgangMode === 'existing' && (
                          <div style={styles.field}>
                            <select style={styles.select} value={vorgangId} onChange={(e) => setVorgangId(e.target.value)}>
                              <option value="">— bitte wählen —</option>
                              {vorgaenge.map((v) => <option key={v.id} value={v.id}>{v.antragsId} · {ANTRAGSART_LABEL[v.antragsart] || v.antragsart}</option>)}
                            </select>
                          </div>
                        )}
                      </>
                    )}
                    <div style={{ marginTop: theme.spacing.md }}>
                      <button style={{ ...styles.btnPrimary, opacity: canAssign ? 1 : 0.5, cursor: canAssign ? 'pointer' : 'not-allowed' }} onClick={zuordnenManuell} disabled={!canAssign}>
                        {busy ? <RefreshIcon size={16} /> : <DocumentIcon size={16} color="#fff" />}
                        {busy ? 'Wird zugeordnet…' : 'Zuordnen'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* RECHTS: Vorschau */}
          <div style={styles.rightCol}>
            <div style={styles.pane}>
              <div style={styles.paneTitle}>Dateivorschau</div>
              {selected ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
                    <DocumentIcon size={16} color={ACCENT} />
                    <span style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.text }}>{selected.dateiname}</span>
                    <a href={wohngeldApi.posteingangDateiUrl(id, selectedIndex)} target="_blank" rel="noreferrer" style={{ marginLeft: 'auto', fontSize: theme.typography.sizes.xs, color: ACCENT }}>Öffnen</a>
                  </div>
                  <div style={styles.preview}>
                    {selected.analyseFehler
                      ? `Auswertung fehlgeschlagen: ${selected.analyseFehler}`
                      : (selected.extrahierterTextGekuerzt?.trim()
                        ? selected.extrahierterTextGekuerzt
                        : 'Für dieses Dokument liegt noch kein extrahierter Text vor (z. B. Bild-Scan ohne Textebene, oder noch nicht ausgewertet).')}
                  </div>
                </>
              ) : (
                <div style={styles.placeholder}>
                  <DocumentIcon size={36} color={theme.colors.textLight} />
                  <div style={styles.hint}>Wählen Sie links ein Dokument, um die Vorschau zu sehen.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
