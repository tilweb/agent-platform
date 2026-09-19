import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../config/theme';
import { ArrowLeftIcon, UploadIcon, DocumentIcon, RefreshIcon, TrashIcon } from '../../components/Icons';
import {
  wohngeldApi, ACCENT, ACCENT_LIGHT,
  DOKUMENT_TYP_LABEL, WOHNGELDART_LABEL, ANTRAGSART_LABEL,
} from './api';

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
};

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
    } catch (e) {
      setError(e.message || 'Upload fehlgeschlagen');
    } finally {
      setUploading(false);
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

              {/* Verteilung */}
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
