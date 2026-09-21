import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../config/theme';
import {
  ArrowLeftIcon, UploadIcon, DocumentIcon, RefreshIcon, TrashIcon,
  CheckCircleIcon, AlertTriangleIcon, InfoIcon, ChevronDownIcon, UserIcon,
} from '../../components/Icons';
import {
  wohngeldApi, ACCENT, ACCENT_LIGHT,
  DOKUMENT_TYP_LABEL, WOHNGELDART_LABEL, ANTRAGSART_LABEL,
} from './api';

const LEVEL_LABEL = { hoch: 'Hohe Übereinstimmung', mittel: 'Mögliche Übereinstimmung', gering: 'Geringe Übereinstimmung' };
const STATUS_LABEL = { gleich: 'Übereinstimmung', abweichung: 'Abweichung', fehlt: 'Fehlt' };

/** Identifizierendes Match-Signal aus den Previews eines Eingangs (Antrag-Stammdaten + Nachweis-Identität). */
function buildMatchInput(previews, stammPayload) {
  const antrag = previews.find((p) => p.typ === 'wohngeldantrag' && p.stammdaten);
  const stammdaten = stammPayload || antrag?.stammdaten;
  // Erstes Nachweis-Dokument mit Identitäts-Signal (z. B. Ausweis-Scan).
  const identitaet = previews.map((p) => p.identitaet).find((i) => i && (i.nachname || i.vorname || i.geburtsdatum));
  if (!stammdaten && !identitaet) return null;
  return { stammdaten, identitaet };
}

const styles = {
  page: { width: '100%' },
  header: { padding: `${theme.spacing.xl} ${theme.spacing['2xl']}`, borderBottom: `1px solid ${theme.colors.border}` },
  backLink: { display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs, fontSize: theme.typography.sizes.sm, color: ACCENT, cursor: 'pointer', marginBottom: theme.spacing.lg, border: 'none', background: 'none', padding: 0, fontWeight: theme.typography.weights.medium },
  title: { fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, color: theme.colors.text },
  subtitle: { fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted, marginTop: theme.spacing.xs, maxWidth: 760, lineHeight: 1.5 },

  split: { display: 'flex', gap: theme.spacing.lg, padding: `${theme.spacing.xl} ${theme.spacing['2xl']}`, alignItems: 'stretch', flexWrap: 'wrap' },
  leftCol: { flex: 1.3, minWidth: 340, display: 'flex', flexDirection: 'column', gap: theme.spacing.lg },
  rightCol: { flex: 1, minWidth: 300, display: 'flex' },
  pane: { flex: 1, backgroundColor: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.xl, padding: theme.spacing.xl, display: 'flex', flexDirection: 'column' },
  paneTitle: { fontSize: theme.typography.sizes.md, fontWeight: theme.typography.weights.semibold, color: theme.colors.text, marginBottom: theme.spacing.md },
  sectionTitle: { fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.semibold, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: theme.spacing.sm, marginTop: theme.spacing.md },

  dropzone: { border: `1px dashed ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: theme.spacing['2xl'], color: theme.colors.textMuted, gap: theme.spacing.sm, cursor: 'pointer', transition: `all ${theme.transitions.fast}`, minHeight: 220 },
  dropzoneActive: { borderColor: ACCENT, backgroundColor: ACCENT_LIGHT },
  hint: { fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted, lineHeight: 1.5, maxWidth: 340 },

  label: { display: 'block', fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginBottom: theme.spacing.xs, fontWeight: theme.typography.weights.medium },
  input: { width: '100%', padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, fontSize: theme.typography.sizes.sm, backgroundColor: theme.colors.surface, color: theme.colors.text, outline: 'none', boxSizing: 'border-box' },
  select: { width: '100%', padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, fontSize: theme.typography.sizes.sm, backgroundColor: theme.colors.surface, color: theme.colors.text, cursor: 'pointer' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md },
  field: { marginBottom: theme.spacing.md },

  docRow: { display: 'flex', alignItems: 'center', gap: theme.spacing.md, padding: theme.spacing.sm, borderRadius: theme.borderRadius.md, cursor: 'pointer', border: `1px solid transparent` },
  docRowActive: { backgroundColor: ACCENT_LIGHT, border: `1px solid ${ACCENT}33` },
  docName: { fontSize: theme.typography.sizes.sm, color: theme.colors.text, fontWeight: theme.typography.weights.medium, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  typeSelect: { padding: `${theme.spacing.xs} ${theme.spacing.sm}`, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, fontSize: theme.typography.sizes.xs, backgroundColor: theme.colors.surface, color: theme.colors.text, cursor: 'pointer' },

  btnPrimary: { padding: `${theme.spacing.md} ${theme.spacing.lg}`, backgroundColor: ACCENT, color: '#fff', border: 'none', borderRadius: theme.borderRadius.lg, fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: theme.spacing.sm },
  btnSecondary: { padding: `${theme.spacing.sm} ${theme.spacing.md}`, backgroundColor: 'transparent', color: theme.colors.text, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs },
  radioRow: { display: 'flex', gap: theme.spacing.lg, marginBottom: theme.spacing.md },
  radio: { display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs, fontSize: theme.typography.sizes.sm, color: theme.colors.text, cursor: 'pointer' },

  preview: { flex: 1, minHeight: 300, backgroundColor: theme.colors.background, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, padding: theme.spacing.md, fontFamily: theme.typography.fontMono, fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary, whiteSpace: 'pre-wrap', overflow: 'auto', lineHeight: 1.5 },
  placeholder: { flex: 1, minHeight: 300, border: `1px dashed ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: theme.spacing.xl, color: theme.colors.textMuted, gap: theme.spacing.sm },
  error: { padding: theme.spacing.md, backgroundColor: theme.colors.errorLight, color: theme.colors.error, borderRadius: theme.borderRadius.md, fontSize: theme.typography.sizes.sm, marginBottom: theme.spacing.md },

  // Vorschlags-Zuordnung
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
  weitereToggle: { display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs, marginTop: theme.spacing.lg, fontSize: theme.typography.sizes.sm, color: ACCENT, cursor: 'pointer', border: 'none', background: 'none', padding: 0, fontWeight: theme.typography.weights.medium },
  weitereItem: { marginTop: theme.spacing.lg, paddingTop: theme.spacing.lg, borderTop: `1px solid ${theme.colors.border}` },
};

/** Farbwahl je Vergleichsstatus (kein Farbrahmen — nur Hintergrund/Text). */
function statusStyle(status) {
  if (status === 'gleich') return { backgroundColor: theme.colors.successLight, color: theme.colors.success };
  if (status === 'abweichung') return { backgroundColor: theme.colors.warningLight, color: theme.colors.warning };
  return { backgroundColor: theme.colors.surfaceHover, color: theme.colors.textMuted };
}

function levelBadgeStyle(level) {
  if (level === 'hoch') return { backgroundColor: theme.colors.successLight, color: theme.colors.success };
  if (level === 'mittel') return { backgroundColor: theme.colors.warningLight, color: theme.colors.warning };
  return { backgroundColor: theme.colors.surfaceHover, color: theme.colors.textMuted };
}

/** Transparenz-Vergleichstabelle: Nachreichung ↔ Vorgang, je Feld ein Status. */
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

const TYP_OPTIONS = Object.keys(DOKUMENT_TYP_LABEL);

function emptyStamm() {
  return {
    antragsdatum: '', wohngeldart: 'mietzuschuss', antragsart: 'erstantrag',
    vorname: '', nachname: '', geburtsdatum: '',
    strasse: '', hausnummer: '', plz: '', ort: '',
    miete: '', wohnflaeche_qm: '',
  };
}

function stammFromPreview(p) {
  const s = p?.stammdaten || {};
  return {
    antragsdatum: s.antragsdatum || '',
    wohngeldart: s.wohngeldart || 'mietzuschuss',
    antragsart: s.antragsart || 'erstantrag',
    vorname: s.antragsteller?.vorname || '',
    nachname: s.antragsteller?.nachname || '',
    geburtsdatum: s.antragsteller?.geburtsdatum || '',
    strasse: s.adresse?.strasse || '',
    hausnummer: s.adresse?.hausnummer || '',
    plz: s.adresse?.plz || '',
    ort: s.adresse?.ort || '',
    miete: s.wohnung?.miete ?? '',
    wohnflaeche_qm: s.wohnung?.wohnflaeche_qm ?? '',
  };
}

/** Formularwerte → Stammdaten-Struktur (wie vom Backend erwartet). */
function stammToPayload(f) {
  const num = (v) => (v === '' || v === null || v === undefined ? undefined : Number(v));
  return {
    antragsdatum: f.antragsdatum || undefined,
    wohngeldart: f.wohngeldart || undefined,
    antragsart: f.antragsart || undefined,
    antragsteller: { vorname: f.vorname || undefined, nachname: f.nachname || undefined, geburtsdatum: f.geburtsdatum || undefined },
    adresse: { strasse: f.strasse || undefined, hausnummer: f.hausnummer || undefined, plz: f.plz || undefined, ort: f.ort || undefined },
    wohnung: { miete: num(f.miete), wohnflaeche_qm: num(f.wohnflaeche_qm) },
  };
}

export default function PosteingangPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [previews, setPreviews] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [stamm, setStamm] = useState(emptyStamm());
  const [hasAntrag, setHasAntrag] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);

  // Zuordnungs-Vorschlag
  const [matchKandidaten, setMatchKandidaten] = useState([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [showManual, setShowManual] = useState(false); // manuellen Picker erzwungen anzeigen
  const [weitereOffen, setWeitereOffen] = useState(false);

  // Verteilung
  const [akten, setAkten] = useState([]);
  const [akteMode, setAkteMode] = useState('new'); // 'new' | 'existing'
  const [akteId, setAkteId] = useState('');
  const [neueAkteName, setNeueAkteName] = useState('');
  const [vorgaenge, setVorgaenge] = useState([]);
  const [vorgangMode, setVorgangMode] = useState('new'); // 'new' | 'existing'
  const [vorgangId, setVorgangId] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await wohngeldApi.listAkten();
        if (!cancelled) setAkten(list);
      } catch { /* Akten-Liste optional */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Vorgänge der gewählten Akte laden (für bestehenden Vorgang).
  useEffect(() => {
    let cancelled = false;
    if (akteMode !== 'existing' || !akteId) { setVorgaenge([]); return; }
    (async () => {
      try {
        const list = await wohngeldApi.listAkteVorgaenge(akteId);
        if (!cancelled) setVorgaenge(list);
      } catch { if (!cancelled) setVorgaenge([]); }
    })();
    return () => { cancelled = true; };
  }, [akteMode, akteId]);

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploading(true);
    setError(null);
    try {
      const result = await wohngeldApi.uploadPosteingang(files);
      const list = result || [];
      setPreviews(list);
      setSelectedIndex(0);
      const antrag = list.find((p) => p.typ === 'wohngeldantrag' && p.stammdaten) || list.find((p) => p.typ === 'wohngeldantrag');
      setHasAntrag(Boolean(antrag));
      setStamm(antrag ? stammFromPreview(antrag) : emptyStamm());
      // Vorschlag für neuen Akte-Namen aus dem Antrag.
      if (antrag?.stammdaten?.antragsteller) {
        const a = antrag.stammdaten.antragsteller;
        setNeueAkteName([a.nachname, a.vorname].filter(Boolean).join(', '));
      }
      // Zuordnungs-Vorschlag ermitteln (rein informativ — es wird nichts zugeordnet).
      await ermittleVorschlag(list);
    } catch (e) {
      setError(e.message || 'Upload fehlgeschlagen');
    } finally {
      setUploading(false);
    }
  }

  /**
   * Vorschlag ermitteln: identifizierende Daten des Eingangs gegen bestehende
   * Vorgänge abgleichen. Bei einem tragfähigen Kandidaten (hoch/mittel) wird die
   * Vorschlagskarte gezeigt; sonst direkt der manuelle Picker.
   */
  async function ermittleVorschlag(list) {
    setMatchKandidaten([]);
    setWeitereOffen(false);
    const input = buildMatchInput(list);
    if (!input) { setShowManual(true); return; } // zu wenig Daten → rein manuell
    setMatchLoading(true);
    try {
      const kandidaten = await wohngeldApi.matchPosteingang(input);
      setMatchKandidaten(kandidaten || []);
      const best = (kandidaten || [])[0];
      // Kein/zu schwacher Match → manueller Picker (heutiges Verhalten).
      setShowManual(!(best && (best.level === 'hoch' || best.level === 'mittel')));
    } catch {
      setMatchKandidaten([]);
      setShowManual(true);
    } finally {
      setMatchLoading(false);
    }
  }

  /** Alle Previews an einen bestehenden Vorgang zuordnen (bestätigter Vorschlag). */
  async function zuordnenZuVorgang(vorgangId, matchLevel) {
    if (!previews.length || assigning) return;
    setAssigning(true);
    setError(null);
    try {
      const stammPayload = stammToPayload(stamm);
      const dokumente = previews.map((p) =>
        p.typ === 'wohngeldantrag' ? { ...p, stammdaten: stammPayload } : p
      );
      const res = await wohngeldApi.verteilePosteingang({
        vorgangId, dokumente, pruefen: true, viaVorschlag: true, matchLevel,
      });
      const newVorgangId = res?.vorgang?.id || vorgangId;
      if (newVorgangId) navigate(`/apps/wohngeld/vorgang/${newVorgangId}`);
    } catch (e) {
      setError(e.message || 'Zuordnung fehlgeschlagen');
    } finally {
      setAssigning(false);
    }
  }

  function setTyp(i, typ) {
    setPreviews((prev) => prev.map((p, idx) => (idx === i ? { ...p, typ } : p)));
  }

  function removePreview(i) {
    setPreviews((prev) => prev.filter((_, idx) => idx !== i));
    setSelectedIndex((s) => (s >= i && s > 0 ? s - 1 : s));
  }

  async function zuordnen() {
    if (!previews.length) return;
    setAssigning(true);
    setError(null);
    try {
      // Antrag-Preview mit den (editierten) Stammdaten anreichern.
      const stammPayload = stammToPayload(stamm);
      const dokumente = previews.map((p) =>
        p.typ === 'wohngeldantrag' ? { ...p, stammdaten: stammPayload } : p
      );

      const payload = { dokumente };
      if (akteMode === 'existing' && akteId) payload.akteId = akteId;
      else payload.neueAkte = { name: neueAkteName || undefined };
      if (akteMode === 'existing' && vorgangMode === 'existing' && vorgangId) payload.vorgangId = vorgangId;

      const res = await wohngeldApi.verteilePosteingang(payload);
      const newVorgangId = res?.vorgang?.id;
      if (newVorgangId) navigate(`/apps/wohngeld/vorgang/${newVorgangId}`);
    } catch (e) {
      setError(e.message || 'Zuordnung fehlgeschlagen');
    } finally {
      setAssigning(false);
    }
  }

  const selected = previews[selectedIndex];
  const canAssign = previews.length > 0 && !assigning
    && (akteMode === 'existing' ? Boolean(akteId) : Boolean(neueAkteName.trim()))
    && !(akteMode === 'existing' && vorgangMode === 'existing' && !vorgangId);

  const s = (key) => (v) => setStamm((prev) => ({ ...prev, [key]: v }));

  const bestKandidat = matchKandidaten[0];
  const zeigeVorschlag = Boolean(bestKandidat && (bestKandidat.level === 'hoch' || bestKandidat.level === 'mittel'));
  const weitereKandidaten = matchKandidaten.slice(1).filter((k) => k.level === 'hoch' || k.level === 'mittel' || k.level === 'gering');
  const hatAbweichung = (k) => (k?.vergleich || []).some((z) => z.status === 'abweichung');

  /** Ein Kandidatenblock: Titel + Level-Badge + Vergleichstabelle + Zuordnen-Button. */
  const renderKandidat = (k, { primary }) => (
    <>
      <div style={styles.matchHead}>
        {hatAbweichung(k)
          ? <AlertTriangleIcon size={20} color={theme.colors.warning} style={{ flexShrink: 0, marginTop: 2 }} />
          : <CheckCircleIcon size={20} color={ACCENT} style={{ flexShrink: 0, marginTop: 2 }} />}
        <div style={{ flex: 1 }}>
          <div style={styles.matchTitle}>
            {primary ? 'Vermutlich zuzuordnen: ' : ''}{k.antragstellerName || 'Unbenannter Vorgang'}
            {k.antragsId ? ` · ${k.antragsId}` : ''}
          </div>
          {k.akteName && <div style={styles.matchSub}>Akte: {k.akteName}</div>}
        </div>
        <span style={{ ...styles.levelBadge, ...levelBadgeStyle(k.level) }}>{LEVEL_LABEL[k.level] || k.level}</span>
      </div>

      <VergleichTabelle vergleich={k.vergleich} />

      {hatAbweichung(k) && (
        <div style={styles.hinweisAbweichung}>
          <AlertTriangleIcon size={16} /> Angaben weichen ab — bitte prüfen.
        </div>
      )}

      <div style={styles.matchButtons}>
        <button
          style={{ ...styles.btnPrimary, opacity: assigning ? 0.5 : 1, cursor: assigning ? 'not-allowed' : 'pointer' }}
          onClick={() => zuordnenZuVorgang(k.vorgangId, k.level)}
          disabled={assigning}
        >
          {assigning ? <RefreshIcon size={16} /> : <DocumentIcon size={16} color="#fff" />}
          {assigning ? 'Wird zugeordnet…' : 'Diesem Vorgang zuordnen'}
        </button>
        {primary && (
          <button style={styles.btnSecondary} onClick={() => setShowManual(true)} disabled={assigning}>
            <UserIcon size={14} /> Anderer Vorgang / neu
          </button>
        )}
      </div>
    </>
  );

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button style={styles.backLink} onClick={() => navigate('/apps/wohngeld')}><ArrowLeftIcon /> Wohngeld</button>
        <h1 style={styles.title}>Posteingang</h1>
        <p style={styles.subtitle}>
          Eingehende Antragsunterlagen hochladen — die Dokumente werden automatisch klassifiziert und die Stammdaten
          des Antrags extrahiert. Nach der Kontrolle ordnen Sie die Unterlagen einer Akte und einem Vorgang zu.
        </p>
      </div>

      <div style={styles.split}>
        {/* LINKS: Upload / Stammdaten / Nachweise / Verteilung */}
        <div style={styles.leftCol}>
          {error && <div style={styles.error}>{error}</div>}

          {previews.length === 0 ? (
            <div style={styles.pane}>
              <div style={styles.paneTitle}>Dokumente hochladen</div>
              <div
                style={{ ...styles.dropzone, ...(dragOver ? styles.dropzoneActive : {}) }}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
              >
                <UploadIcon size={40} color={theme.colors.textLight} />
                <div style={{ fontWeight: theme.typography.weights.medium, color: theme.colors.text }}>
                  {uploading ? 'Dokumente werden analysiert…' : 'Dateien hierher ziehen oder klicken'}
                </div>
                <div style={styles.hint}>
                  PDF-Dokumente (Antrag, Nachweise). Mehrere Dateien möglich. Die Klassifikation und Extraktion
                  starten automatisch nach dem Hochladen.
                </div>
              </div>
              <input
                ref={fileInputRef} type="file" multiple accept="application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>
          ) : (
            <>
              {/* Stammdaten des Antrags */}
              <div style={styles.pane}>
                <div style={styles.paneTitle}>Stammdaten des Antrags</div>
                {!hasAntrag && (
                  <div style={{ ...styles.hint, marginBottom: theme.spacing.md }}>
                    Kein Wohngeldantrag unter den hochgeladenen Dokumenten erkannt. Die Angaben können manuell erfasst
                    werden oder später im Vorgang ergänzt werden.
                  </div>
                )}
                <div style={styles.grid2}>
                  <div style={styles.field}>
                    <label style={styles.label}>Vorname</label>
                    <input style={styles.input} value={stamm.vorname} onChange={(e) => s('vorname')(e.target.value)} />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Nachname</label>
                    <input style={styles.input} value={stamm.nachname} onChange={(e) => s('nachname')(e.target.value)} />
                  </div>
                </div>
                <div style={styles.grid2}>
                  <div style={styles.field}>
                    <label style={styles.label}>Geburtsdatum</label>
                    <input style={styles.input} placeholder="JJJJ-MM-TT" value={stamm.geburtsdatum} onChange={(e) => s('geburtsdatum')(e.target.value)} />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Antragsdatum</label>
                    <input style={styles.input} placeholder="JJJJ-MM-TT" value={stamm.antragsdatum} onChange={(e) => s('antragsdatum')(e.target.value)} />
                  </div>
                </div>
                <div style={styles.grid2}>
                  <div style={styles.field}>
                    <label style={styles.label}>Wohngeldart</label>
                    <select style={styles.select} value={stamm.wohngeldart} onChange={(e) => s('wohngeldart')(e.target.value)}>
                      {Object.entries(WOHNGELDART_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Antragsart</label>
                    <select style={styles.select} value={stamm.antragsart} onChange={(e) => s('antragsart')(e.target.value)}>
                      {Object.entries(ANTRAGSART_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                </div>
                <div style={styles.sectionTitle}>Wohnung</div>
                <div style={styles.grid2}>
                  <div style={styles.field}>
                    <label style={styles.label}>Straße</label>
                    <input style={styles.input} value={stamm.strasse} onChange={(e) => s('strasse')(e.target.value)} />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Hausnummer</label>
                    <input style={styles.input} value={stamm.hausnummer} onChange={(e) => s('hausnummer')(e.target.value)} />
                  </div>
                </div>
                <div style={styles.grid2}>
                  <div style={styles.field}>
                    <label style={styles.label}>PLZ</label>
                    <input style={styles.input} value={stamm.plz} onChange={(e) => s('plz')(e.target.value)} />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Ort</label>
                    <input style={styles.input} value={stamm.ort} onChange={(e) => s('ort')(e.target.value)} />
                  </div>
                </div>
                <div style={styles.grid2}>
                  <div style={styles.field}>
                    <label style={styles.label}>Bruttokaltmiete (EUR)</label>
                    <input style={styles.input} type="number" value={stamm.miete} onChange={(e) => s('miete')(e.target.value)} />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Wohnfläche (m²)</label>
                    <input style={styles.input} type="number" value={stamm.wohnflaeche_qm} onChange={(e) => s('wohnflaeche_qm')(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Erkannte Nachweise */}
              <div style={styles.pane}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={styles.paneTitle}>Erkannte Dokumente ({previews.length})</div>
                  <button style={styles.btnSecondary} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    <UploadIcon size={14} /> {uploading ? 'Lädt…' : 'Weitere'}
                  </button>
                  <input
                    ref={fileInputRef} type="file" multiple accept="application/pdf"
                    style={{ display: 'none' }}
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                </div>
                {previews.map((p, i) => (
                  <div
                    key={`${p.dateiname}-${i}`}
                    style={{ ...styles.docRow, ...(i === selectedIndex ? styles.docRowActive : {}) }}
                    onClick={() => setSelectedIndex(i)}
                  >
                    <DocumentIcon size={16} color={theme.colors.textMuted} />
                    <div style={{ ...styles.docName, flex: 1 }} title={p.dateiname}>{p.dateiname}</div>
                    <select
                      style={styles.typeSelect}
                      value={p.typ}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setTyp(i, e.target.value)}
                    >
                      {TYP_OPTIONS.map((t) => <option key={t} value={t}>{DOKUMENT_TYP_LABEL[t]}</option>)}
                    </select>
                    <button
                      style={{ ...styles.btnSecondary, padding: theme.spacing.xs, border: 'none' }}
                      title="Entfernen"
                      onClick={(e) => { e.stopPropagation(); removePreview(i); }}
                    >
                      <TrashIcon size={14} color={theme.colors.textMuted} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Zuordnungs-Vorschlag (Vorschlag — keine automatische Zuordnung) */}
              {matchLoading && (
                <div style={styles.pane}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm }}>
                    <RefreshIcon size={16} /> Passenden Vorgang suchen…
                  </div>
                </div>
              )}

              {!matchLoading && zeigeVorschlag && (
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
                        <div key={k.vorgangId} style={styles.weitereItem}>
                          {renderKandidat(k, { primary: false })}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* Verteilung (manuell) — Fallback bzw. wenn kein tragfähiger Vorschlag */}
              {(showManual || !zeigeVorschlag) && (
              <div style={styles.pane}>
                <div style={styles.paneTitle}>Verteilung</div>

                <div style={styles.sectionTitle}>Akte</div>
                <div style={styles.radioRow}>
                  <label style={styles.radio}>
                    <input type="radio" checked={akteMode === 'new'} onChange={() => setAkteMode('new')} /> Neue Akte
                  </label>
                  <label style={styles.radio}>
                    <input type="radio" checked={akteMode === 'existing'} onChange={() => setAkteMode('existing')} /> Bestehende Akte
                  </label>
                </div>
                {akteMode === 'new' ? (
                  <div style={styles.field}>
                    <label style={styles.label}>Aktenname</label>
                    <input style={styles.input} placeholder="z. B. Nachname, Vorname" value={neueAkteName} onChange={(e) => setNeueAkteName(e.target.value)} />
                  </div>
                ) : (
                  <div style={styles.field}>
                    <label style={styles.label}>Akte wählen</label>
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
                      <label style={styles.radio}>
                        <input type="radio" checked={vorgangMode === 'new'} onChange={() => setVorgangMode('new')} /> Neuer Vorgang
                      </label>
                      <label style={styles.radio}>
                        <input type="radio" checked={vorgangMode === 'existing'} onChange={() => setVorgangMode('existing')} /> Bestehender Vorgang
                      </label>
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
                  <button style={{ ...styles.btnPrimary, opacity: canAssign ? 1 : 0.5, cursor: canAssign ? 'pointer' : 'not-allowed' }} onClick={zuordnen} disabled={!canAssign}>
                    {assigning ? <RefreshIcon size={16} /> : <DocumentIcon size={16} color="#fff" />}
                    {assigning ? 'Wird zugeordnet…' : 'Zuordnen'}
                  </button>
                </div>
              </div>
              )}
            </>
          )}
        </div>

        {/* RECHTS: Dateivorschau */}
        <div style={styles.rightCol}>
          <div style={styles.pane}>
            <div style={styles.paneTitle}>Dateivorschau</div>
            {selected ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
                  <DocumentIcon size={16} color={ACCENT} />
                  <span style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.text }}>{selected.dateiname}</span>
                </div>
                <div style={styles.preview}>
                  {selected.extrahierterTextGekuerzt?.trim()
                    ? selected.extrahierterTextGekuerzt
                    : 'Für dieses Dokument konnte kein Text extrahiert werden (z. B. Bild-Scan ohne Textebene).'}
                </div>
              </>
            ) : (
              <div style={styles.placeholder}>
                <DocumentIcon size={36} color={theme.colors.textLight} />
                <div style={styles.hint}>Die Vorschau des ausgewählten Dokuments erscheint hier — mit dem extrahierten Text als Kontrolle.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
