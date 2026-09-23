import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../config/theme';
import {
  ArrowLeftIcon, UploadIcon, DocumentIcon, RefreshIcon, LightningIcon,
} from '../../components/Icons';
import {
  wohngeldApi, ACCENT, ACCENT_LIGHT,
  DOKUMENT_TYP_LABEL, POSTEINGANG_STATUS_LABEL, POSTEINGANG_STATUS_ORDER, POSTEINGANG_QUELLE_LABEL,
} from './api';

const LEVEL_LABEL = { hoch: 'Hohe Übereinstimmung', mittel: 'Mögliche Übereinstimmung', gering: 'Geringe Übereinstimmung' };

/** Neutrale Füllung je Status (keine Farb-Rahmen) — analog StatusBadge. */
function statusTone(status) {
  switch (status) {
    case 'zugeordnet': return { backgroundColor: theme.colors.successLight, color: theme.colors.success };
    case 'analysiert': return { backgroundColor: theme.colors.primaryLight, color: theme.colors.primaryDark };
    case 'in_analyse': return { backgroundColor: theme.colors.infoLight, color: theme.colors.info };
    case 'fehler': return { backgroundColor: theme.colors.errorLight, color: theme.colors.error };
    case 'verworfen': return { backgroundColor: theme.colors.surfaceHover, color: theme.colors.textLight };
    case 'eingegangen':
    default: return { backgroundColor: theme.colors.warningLight, color: theme.colors.warning };
  }
}

function levelTone(level) {
  if (level === 'hoch') return { backgroundColor: theme.colors.successLight, color: theme.colors.success };
  if (level === 'mittel') return { backgroundColor: theme.colors.warningLight, color: theme.colors.warning };
  return { backgroundColor: theme.colors.surfaceHover, color: theme.colors.textMuted };
}

const styles = {
  page: { width: '100%' },
  header: { padding: `${theme.spacing.xl} ${theme.spacing['2xl']}`, borderBottom: `1px solid ${theme.colors.border}` },
  backLink: { display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs, fontSize: theme.typography.sizes.sm, color: ACCENT, cursor: 'pointer', marginBottom: theme.spacing.lg, border: 'none', background: 'none', padding: 0, fontWeight: theme.typography.weights.medium },
  title: { fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, color: theme.colors.text },
  subtitle: { fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted, marginTop: theme.spacing.xs, maxWidth: 760, lineHeight: 1.5 },

  body: { padding: `${theme.spacing.xl} ${theme.spacing['2xl']}`, display: 'flex', flexDirection: 'column', gap: theme.spacing.lg },
  error: { padding: theme.spacing.md, backgroundColor: theme.colors.errorLight, color: theme.colors.error, borderRadius: theme.borderRadius.md, fontSize: theme.typography.sizes.sm },

  dropzone: { border: `1px dashed ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md, padding: theme.spacing.xl, color: theme.colors.textMuted, cursor: 'pointer', transition: `all ${theme.transitions.fast}`, textAlign: 'center' },
  dropzoneActive: { borderColor: ACCENT, backgroundColor: ACCENT_LIGHT },

  toolbar: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm, flexWrap: 'wrap' },
  tabs: { display: 'flex', gap: theme.spacing.xs, flexWrap: 'wrap' },
  tab: { padding: `${theme.spacing.xs} ${theme.spacing.md}`, backgroundColor: 'transparent', border: 'none', borderRadius: theme.borderRadius.md, fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.textMuted, cursor: 'pointer' },
  tabActive: { backgroundColor: theme.colors.primaryLight, color: theme.colors.primary },

  bulkBar: { display: 'flex', alignItems: 'center', gap: theme.spacing.md, padding: `${theme.spacing.sm} ${theme.spacing.md}`, backgroundColor: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg },
  bulkInfo: { fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted },

  btnPrimary: { padding: `${theme.spacing.sm} ${theme.spacing.md}`, backgroundColor: ACCENT, color: '#fff', border: 'none', borderRadius: theme.borderRadius.lg, fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs },
  btnSecondary: { padding: `${theme.spacing.sm} ${theme.spacing.md}`, backgroundColor: 'transparent', color: theme.colors.text, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs },

  tableWrap: { backgroundColor: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.xl, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: theme.typography.sizes.sm },
  th: { textAlign: 'left', padding: `${theme.spacing.sm} ${theme.spacing.md}`, fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.semibold, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: `1px solid ${theme.colors.border}`, whiteSpace: 'nowrap' },
  td: { padding: `${theme.spacing.md} ${theme.spacing.md}`, borderBottom: `1px solid ${theme.colors.border}`, color: theme.colors.text, verticalAlign: 'middle' },
  rowHover: { cursor: 'pointer' },
  badge: { display: 'inline-block', fontSize: theme.typography.sizes.xs, padding: `${theme.spacing.xs} ${theme.spacing.md}`, borderRadius: theme.borderRadius.full, fontWeight: theme.typography.weights.medium, whiteSpace: 'nowrap' },
  muted: { color: theme.colors.textMuted },
  strong: { fontWeight: theme.typography.weights.medium, color: theme.colors.text },
  empty: { padding: theme.spacing['2xl'], textAlign: 'center', color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm },
};

/** Deutsches Datum + Uhrzeit (kurz). */
function fmtDatum(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ', ' +
    d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

/** Erkannter (Haupt-)Typ eines Eingangs: Antragstyp bevorzugt, sonst erster erkannter Typ. */
function erkannterTyp(eingang) {
  const dateien = eingang.dateien || [];
  const antrag = dateien.find((d) => d.typ === 'wohngeldantrag');
  const first = antrag || dateien.find((d) => d.typ);
  return first?.typ ? DOKUMENT_TYP_LABEL[first.typ] || first.typ : null;
}

export default function PosteingangPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [eingaenge, setEingaenge] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const laden = useCallback(async (filter) => {
    setLoading(true);
    try {
      const list = await wohngeldApi.listPosteingang(filter ? { status: filter } : {});
      setEingaenge(list || []);
      setError(null);
    } catch (e) {
      setError(e.message || 'Posteingang konnte nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { laden(statusFilter); }, [laden, statusFilter]);

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploading(true);
    setError(null);
    try {
      await wohngeldApi.ingestPosteingang(files, { quelle: 'manuell' });
      await laden(statusFilter);
    } catch (e) {
      setError(e.message || 'Einliefern fehlgeschlagen');
    } finally {
      setUploading(false);
    }
  }

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const selectedIds = [...selected];
  const selectedEintraege = eingaenge.filter((e) => selected.has(e.id));
  const auswertbar = selectedEintraege.filter((e) => ['eingegangen', 'analysiert', 'fehler'].includes(e.status));
  const zuordenbar = selectedEintraege.filter((e) => e.status === 'analysiert');

  async function auswertenAuswahl() {
    const ids = auswertbar.map((e) => e.id);
    if (!ids.length || busy) return;
    setBusy(true);
    setError(null);
    try {
      await wohngeldApi.analysierePosteingang(ids);
      setSelected(new Set());
      await laden(statusFilter);
    } catch (e) {
      setError(e.message || 'Auswertung fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  function zuordnenAuswahl() {
    // Zuordnung braucht ein Ziel (Akte/Vorgang) je Eingang → auf der Detailseite.
    if (zuordenbar.length) navigate(`/apps/wohngeld/posteingang/${zuordenbar[0].id}`);
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button style={styles.backLink} onClick={() => navigate('/apps/wohngeld')}><ArrowLeftIcon /> Wohngeld</button>
        <h1 style={styles.title}>Posteingang</h1>
        <p style={styles.subtitle}>
          Eingehende Unterlagen werden hier gesammelt und bleiben erhalten. Das Einliefern speichert die Dateien nur —
          die Auswertung (Klassifikation, Extraktion, Zuordnungs-Vorschlag) starten Sie je Eingang oder als Sammelaktion.
        </p>
      </div>

      <div style={styles.body}>
        {error && <div style={styles.error}>{error}</div>}

        {/* Hinzufügen (ingest — keine Auto-Auswertung) */}
        <div
          style={{ ...styles.dropzone, ...(dragOver ? styles.dropzoneActive : {}) }}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        >
          <UploadIcon size={22} color={theme.colors.textLight} />
          <span>{uploading ? 'Wird eingeliefert…' : 'Dateien hierher ziehen oder klicken, um einen neuen Eingang anzulegen (ohne Auswertung)'}</span>
        </div>
        <input ref={fileInputRef} type="file" multiple accept="application/pdf" style={{ display: 'none' }} onChange={(e) => handleFiles(e.target.files)} />

        {/* Statusfilter */}
        <div style={styles.toolbar}>
          <div style={styles.tabs}>
            <button style={{ ...styles.tab, ...(statusFilter === '' ? styles.tabActive : {}) }} onClick={() => setStatusFilter('')}>Alle</button>
            {POSTEINGANG_STATUS_ORDER.map((s) => (
              <button key={s} style={{ ...styles.tab, ...(statusFilter === s ? styles.tabActive : {}) }} onClick={() => setStatusFilter(s)}>
                {POSTEINGANG_STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Sammelaktionen */}
        {selectedIds.length > 0 && (
          <div style={styles.bulkBar}>
            <span style={styles.bulkInfo}>{selectedIds.length} ausgewählt</span>
            <button
              style={{ ...styles.btnPrimary, opacity: auswertbar.length && !busy ? 1 : 0.5, cursor: auswertbar.length && !busy ? 'pointer' : 'not-allowed' }}
              onClick={auswertenAuswahl} disabled={!auswertbar.length || busy}
            >
              {busy ? <RefreshIcon size={14} /> : <LightningIcon size={14} color="#fff" />} Auswertung starten{auswertbar.length ? ` (${auswertbar.length})` : ''}
            </button>
            <button
              style={{ ...styles.btnSecondary, opacity: zuordenbar.length ? 1 : 0.5, cursor: zuordenbar.length ? 'pointer' : 'not-allowed' }}
              onClick={zuordnenAuswahl} disabled={!zuordenbar.length}
            >
              <DocumentIcon size={14} /> Zuordnen{zuordenbar.length ? ` (${zuordenbar.length})` : ''}
            </button>
          </div>
        )}

        {/* Queue-Tabelle */}
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, width: 32 }} />
                <th style={styles.th}>Quelle</th>
                <th style={styles.th}>Eingang</th>
                <th style={styles.th}>Betreff / Dateien</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Erkannter Typ</th>
                <th style={styles.th}>Zuordnungs-Vorschlag</th>
                <th style={styles.th}>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td style={{ ...styles.td, ...styles.empty }} colSpan={8}>Wird geladen…</td></tr>
              )}
              {!loading && eingaenge.length === 0 && (
                <tr><td style={{ ...styles.td, ...styles.empty }} colSpan={8}>Keine Eingänge{statusFilter ? ' in diesem Status' : ''}. Legen Sie oben einen neuen Eingang an.</td></tr>
              )}
              {!loading && eingaenge.map((e) => {
                const best = (e.matchVorschlag || [])[0];
                const typ = erkannterTyp(e);
                const anzahl = (e.dateien || []).length;
                const titel = e.betreff || (e.dateien?.[0]?.dateiname) || 'Ohne Betreff';
                return (
                  <tr key={e.id} style={styles.rowHover} onClick={() => navigate(`/apps/wohngeld/posteingang/${e.id}`)}>
                    <td style={styles.td} onClick={(ev) => ev.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} />
                    </td>
                    <td style={styles.td}>{POSTEINGANG_QUELLE_LABEL[e.quelle] || e.quelle}</td>
                    <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>{fmtDatum(e.eingegangenAm)}</td>
                    <td style={styles.td}>
                      <div style={styles.strong}>{titel}</div>
                      <div style={styles.muted}>{anzahl} Datei{anzahl === 1 ? '' : 'en'}</div>
                    </td>
                    <td style={styles.td}><span style={{ ...styles.badge, ...statusTone(e.status) }}>{POSTEINGANG_STATUS_LABEL[e.status] || e.status}</span></td>
                    <td style={styles.td}>{typ || <span style={styles.muted}>—</span>}</td>
                    <td style={styles.td}>
                      {best
                        ? (
                          <span style={{ ...styles.badge, ...levelTone(best.level) }} title={best.antragstellerName || best.antragsId || ''}>
                            {LEVEL_LABEL[best.level] || best.level}
                          </span>
                        )
                        : e.status === 'analysiert'
                          ? <span style={styles.muted}>Kein Vorschlag</span>
                          : <span style={styles.muted}>—</span>}
                    </td>
                    <td style={styles.td} onClick={(ev) => ev.stopPropagation()}>
                      <button style={styles.btnSecondary} onClick={() => navigate(`/apps/wohngeld/posteingang/${e.id}`)}>Öffnen</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
