import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { theme } from '../../../config/theme';
import { ArrowLeftIcon, UploadIcon, CopyIcon, PanelRightIcon, ChevronDownIcon, InfoIcon, PlusIcon, TrashIcon, SearchIcon, CheckIcon, XIcon, ClockIcon, EyeIcon, DownloadIcon, ArchiveIcon } from '../../../components/Icons';
import { useAppPermission } from '../../../components/RequireAppPermission';
import {
  grundsicherungApi,
  ANTRAGSART_LABEL, ANSPRUCHSGRUND_LABEL, ANSPRUCHSGRUND_KURZ, WOHNSITUATION_LABEL, WARMWASSER_LABEL,
  VORBEZUG_LEISTUNG_LABEL, STATUS_LABEL, STATUS_ORDER, ABSCHLUSS_ERGEBNIS_LABEL, FINALE_ERGEBNISSE,
  PRIORITAET_LABEL, ROLLE_LABEL, DOKUMENT_TYP_LABEL, SCHREIBEN_ART_LABEL,
  APP_ROLE_LABEL, aktionLabel,
  ACCENT, ACCENT_LIGHT,
} from './api';
import StatusBadge from './components/StatusBadge';
import SektionCard, { FeldGrid } from '../kern/components/SektionCard';
import PersonCard from './components/PersonCard';
import PruefschrittItem from '../kern/components/PruefschrittItem';
import PanelSection from '../kern/components/PanelSection';
import { FeldStatusDot, FeldStatusFreigabe } from '../kern/components/FeldStatusMark';
import { buildFeldStatusMap, fsKey } from '../kern/feldStatusMap';
import NotizPanel from '../kern/components/NotizPanel';
import ExtraktionsBaum from '../kern/components/ExtraktionsBaum';
import { EXTRAKTION_BAUM_PROPS } from './extraktionLabels';
import SeitenVorschau from '../kern/components/SeitenVorschau';
import { KiVerbrauchAnsicht, KiVerbrauchZeile } from '../kern/components/KiVerbrauch';
import GrundsicherungKernProvider from './GrundsicherungKernProvider';

const MAIN_TABS = [
  { id: 'uebersicht', label: 'Übersicht' },
  { id: 'schreiben', label: 'Schreiben' },
  { id: 'protokoll', label: 'Protokoll' },
  { id: 'ki_verbrauch', label: 'KI-Verbrauch' },
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
  main: { flex: 1, minWidth: 300 },
  side: { width: 440, flexShrink: 0, minWidth: 360 },
  tabs: { display: 'flex', gap: theme.spacing.sm, marginBottom: theme.spacing.lg, flexWrap: 'wrap' },
  tab: { padding: `${theme.spacing.sm} ${theme.spacing.md}`, backgroundColor: 'transparent', border: 'none', borderRadius: theme.borderRadius.md, fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.textMuted, cursor: 'pointer' },
  tabActive: { backgroundColor: ACCENT_LIGHT, color: ACCENT },
  sideCard: { backgroundColor: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.xl, padding: theme.spacing.lg },
  btn: { padding: `${theme.spacing.sm} ${theme.spacing.lg}`, backgroundColor: ACCENT, color: '#fff', border: 'none', borderRadius: theme.borderRadius.lg, fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, cursor: 'pointer' },
  btnGhost: { padding: `${theme.spacing.sm} ${theme.spacing.lg}`, backgroundColor: 'transparent', color: theme.colors.text, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, cursor: 'pointer' },
  btnSmall: { padding: `4px ${theme.spacing.md}`, fontSize: theme.typography.sizes.xs, borderRadius: theme.borderRadius.md, border: `1px solid ${theme.colors.border}`, backgroundColor: theme.colors.surface, color: theme.colors.text, cursor: 'pointer' },
  pruefStand: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginBottom: theme.spacing.md },
  pruefHinweis: { fontSize: theme.typography.sizes.sm, color: theme.colors.text, backgroundColor: theme.colors.surfaceHover, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  zustaendigRow: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm, flexWrap: 'wrap', marginBottom: theme.spacing.sm },
  docPersonRow: { display: 'flex', alignItems: 'center', gap: theme.spacing.xs, marginTop: 4, flexWrap: 'wrap' },
  docPersonSelect: { padding: '2px 6px', fontSize: '0.75rem', border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.surface, color: theme.colors.text, cursor: 'pointer', maxWidth: '100%' },
  select: { padding: `6px ${theme.spacing.md}`, fontSize: theme.typography.sizes.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.surface, color: theme.colors.text, cursor: 'pointer' },
  input: { width: '100%', padding: theme.spacing.sm, fontSize: theme.typography.sizes.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.surface, color: theme.colors.text, outline: 'none' },
  editRow: { display: 'grid', gridTemplateColumns: 'minmax(140px, 220px) 1fr', rowGap: theme.spacing.sm, columnGap: theme.spacing.lg, alignItems: 'center' },
  editLabel: { fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted },
  error: { padding: theme.spacing.md, backgroundColor: theme.colors.errorLight, color: theme.colors.error, borderRadius: theme.borderRadius.md, marginBottom: theme.spacing.md, fontSize: theme.typography.sizes.sm },
  info: { padding: theme.spacing.md, backgroundColor: theme.colors.infoLight, color: theme.colors.info, borderRadius: theme.borderRadius.md, marginBottom: theme.spacing.md, fontSize: theme.typography.sizes.sm },
  einschrBanner: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm, padding: `${theme.spacing.md} ${theme.spacing['2xl']}`, backgroundColor: theme.colors.warningLight, color: theme.colors.warning, fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, borderBottom: `1px solid ${theme.colors.border}` },
  govRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.sm, padding: '3px 0' },
  govLabel: { fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted },
  govValue: { fontSize: theme.typography.sizes.sm, color: theme.colors.text, fontWeight: theme.typography.weights.medium },
  bestaetigungBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.md, padding: `${theme.spacing.sm} ${theme.spacing.md}`, backgroundColor: ACCENT_LIGHT, borderRadius: theme.borderRadius.md, marginBottom: theme.spacing.md, fontSize: theme.typography.sizes.sm, flexWrap: 'wrap' },
  bestaetigungText: { display: 'inline-flex', alignItems: 'center', gap: theme.spacing.sm, color: theme.colors.text },
  bestaetigungDot: { width: 7, height: 7, borderRadius: theme.borderRadius.full, backgroundColor: ACCENT, flexShrink: 0 },
  sideTitle: { fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.semibold, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', margin: `${theme.spacing.md} 0 ${theme.spacing.sm}` },
  activity: { fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary, padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.background, marginBottom: theme.spacing.sm, lineHeight: 1.5 },
  kvRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: theme.spacing.md, padding: `${theme.spacing.sm} 0`, borderBottom: `1px solid ${theme.colors.borderLight}` },
  kvLabel: { fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted, flexShrink: 0 },
  kvValue: { fontSize: theme.typography.sizes.sm, color: theme.colors.text, textAlign: 'right', wordBreak: 'break-word' },
  protoAktion: { color: theme.colors.text, fontWeight: theme.typography.weights.medium },
  protoMeta: { color: theme.colors.textMuted, marginTop: 1 },
  protoRolle: { fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '0 5px', borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.surfaceHover, color: theme.colors.textMuted },
  protoToggle: { display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 3, fontSize: '0.65rem', color: ACCENT, background: 'none', border: 'none', padding: 0, cursor: 'pointer' },
  protoDiff: { marginTop: theme.spacing.xs, padding: theme.spacing.sm, backgroundColor: theme.colors.surfaceHover, borderRadius: theme.borderRadius.md, display: 'flex', flexDirection: 'column', gap: 4 },
  protoDiffRow: { display: 'grid', gridTemplateColumns: 'minmax(70px, auto) 1fr', columnGap: theme.spacing.sm, fontSize: '0.65rem', lineHeight: 1.4 },
  protoDiffFeld: { color: theme.colors.textMuted, fontWeight: theme.typography.weights.medium },
  protoAlt: { color: theme.colors.error, textDecoration: 'line-through', wordBreak: 'break-word' },
  protoNeu: { color: theme.colors.success, wordBreak: 'break-word' },
  label: { display: 'block', fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.text, marginBottom: theme.spacing.xs },
  textarea: { width: '100%', minHeight: 260, fontFamily: theme.typography.fontFamily, fontSize: theme.typography.sizes.sm, padding: theme.spacing.md, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.surface, color: theme.colors.text, outline: 'none', resize: 'vertical', lineHeight: 1.6 },
  placeholder: { textAlign: 'center', padding: theme.spacing['3xl'], color: theme.colors.textMuted },
  chip: { fontSize: theme.typography.sizes.xs, padding: `2px ${theme.spacing.sm}`, borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.surfaceHover, color: theme.colors.textMuted },
  docItem: { padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.background, marginBottom: theme.spacing.sm },
  iconBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xs, background: 'none', border: 'none', borderRadius: theme.borderRadius.md, cursor: 'pointer' },
  copiedHint: { position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 2, fontSize: '0.65rem', color: theme.colors.textMuted, backgroundColor: theme.colors.surfaceHover, borderRadius: theme.borderRadius.sm, padding: '1px 6px', whiteSpace: 'nowrap' },
  sideToggle: { display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs, padding: `4px ${theme.spacing.sm}`, background: 'none', border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, color: theme.colors.textMuted, cursor: 'pointer', fontSize: theme.typography.sizes.xs },
  tbPanel: { border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginTop: theme.spacing.sm, backgroundColor: theme.colors.surface },
  tbSearch: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, padding: `4px ${theme.spacing.sm}`, marginBottom: theme.spacing.sm, backgroundColor: theme.colors.background },
  tbSearchInput: { flex: 1, border: 'none', outline: 'none', background: 'transparent', color: theme.colors.text, fontSize: theme.typography.sizes.sm },
  tbList: { maxHeight: 220, overflowY: 'auto' },
  tbItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: theme.spacing.sm, padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.borderLight}`, cursor: 'pointer' },
  tbKat: { fontSize: '0.65rem', color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' },
  tbItemTitel: { fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.text },
  tbItemText: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginTop: 2, lineHeight: 1.4 },
  bezugList: { marginTop: theme.spacing.md, borderTop: `1px solid ${theme.colors.borderLight}`, paddingTop: theme.spacing.sm },
  bezugItem: { display: 'flex', alignItems: 'flex-start', gap: theme.spacing.xs, fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary, padding: '3px 0' },
  fristRow: { display: 'flex', alignItems: 'center', gap: theme.spacing.xs, fontSize: theme.typography.sizes.sm, color: theme.colors.text, padding: '2px 0' },
  fristLabel: { color: theme.colors.textMuted, minWidth: 110 },
  fristInput: { padding: `4px ${theme.spacing.sm}`, fontSize: theme.typography.sizes.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.surface, color: theme.colors.text, outline: 'none' },
  ueberfaelligBadge: { fontSize: '0.65rem', fontWeight: theme.typography.weights.semibold, padding: `1px ${theme.spacing.sm}`, borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.errorLight, color: theme.colors.error },
  todoItem: { display: 'flex', alignItems: 'flex-start', gap: theme.spacing.sm, padding: '3px 0' },
  todoCheck: { flexShrink: 0, width: 16, height: 16, marginTop: 2, borderRadius: theme.borderRadius.sm, border: `1px solid ${theme.colors.border}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: theme.colors.surface, padding: 0 },
  todoText: { flex: 1, fontSize: theme.typography.sizes.sm, color: theme.colors.text, lineHeight: 1.4 },
  miniRow: { display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  labelChip: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: theme.typography.sizes.xs, padding: `2px ${theme.spacing.sm}`, borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.surfaceHover, color: theme.colors.textMuted },
  labelRemove: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: theme.colors.textMuted },
  docActions: { display: 'flex', gap: theme.spacing.xs, flexWrap: 'wrap', marginTop: theme.spacing.xs },
  docLinkBtn: { fontSize: theme.typography.sizes.xs, color: ACCENT, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: theme.typography.weights.medium },
  iconAction: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, padding: 0, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.surface, color: theme.colors.textSecondary, cursor: 'pointer' },
  iconActionDanger: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, padding: 0, border: `1px solid ${theme.colors.error}30`, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.surface, color: theme.colors.error, cursor: 'pointer' },
  btnDanger: { padding: `${theme.spacing.sm} ${theme.spacing.lg}`, backgroundColor: theme.colors.error, color: '#fff', border: 'none', borderRadius: theme.borderRadius.lg, fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, cursor: 'pointer' },
  confirmModal: { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.xl, border: `1px solid ${theme.colors.border}`, padding: theme.spacing.xl, width: '90%', maxWidth: 440 },
  confirmTitle: { fontSize: theme.typography.sizes.lg, fontWeight: theme.typography.weights.semibold, color: theme.colors.text, marginBottom: theme.spacing.sm },
  confirmText: { fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary, lineHeight: 1.5, marginBottom: theme.spacing.lg },
  confirmActions: { display: 'flex', justifyContent: 'flex-end', gap: theme.spacing.md },
  ablageBadge: { fontSize: '0.65rem', fontWeight: theme.typography.weights.semibold, padding: `1px ${theme.spacing.sm}`, borderRadius: theme.borderRadius.full },
  docGroupTitle: { fontSize: '0.7rem', color: theme.colors.textMuted, fontWeight: theme.typography.weights.semibold, marginTop: theme.spacing.sm, marginBottom: 2 },
  previewOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: theme.spacing.xl },
  previewBox: { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.xl, width: '92%', maxWidth: 1180, height: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: `1px solid ${theme.colors.border}` },
  previewHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.md, padding: `${theme.spacing.md} ${theme.spacing.lg}`, borderBottom: `1px solid ${theme.colors.border}` },
  previewBody: { flex: 1, display: 'flex', minHeight: 0 },
  previewViewer: { flex: '2 1 340px', minWidth: 0, display: 'flex', flexDirection: 'column' },
  previewPanel: { flex: '1 1 300px', minWidth: 280, maxWidth: 400, borderLeft: `1px solid ${theme.colors.border}`, overflowY: 'auto', padding: theme.spacing.lg, backgroundColor: theme.colors.surface },
  previewPanelTitle: { fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.semibold, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: theme.spacing.md },
  previewFrame: { flex: 1, width: '100%', border: 'none', backgroundColor: theme.colors.background },
  previewFallback: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md, color: theme.colors.textMuted, textAlign: 'center', padding: theme.spacing.xl },
  modalLabel: { display: 'block', fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.text, marginBottom: theme.spacing.xs, marginTop: theme.spacing.md },
  checkLabel: { display: 'inline-flex', alignItems: 'center', gap: theme.spacing.sm, fontSize: theme.typography.sizes.sm, color: theme.colors.text, cursor: 'pointer' },
  personAdd: { display: 'inline-flex', alignItems: 'center', gap: 4 },
};

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return iso.slice(0, 10); }
}
/** ISO-Datum (YYYY-MM-DD) + n Tage → YYYY-MM-DD. Leer/ungültig → ''. */
function plusTageISO(iso, n) {
  if (!iso) return '';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
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
/** Protokoll-Diff-Wert lesbar darstellen (Objekte/Arrays kompakt als JSON). */
function fmtProtoValue(v) {
  if (v == null || v === '') return '—';
  if (typeof v === 'object') { try { return JSON.stringify(v); } catch { return String(v); } }
  return String(v);
}
/** Überfällig = Datum liegt vor heute (Tagesvergleich). Leeres/ungültiges Datum → false. */
function istUeberfaellig(iso) {
  if (!iso) return false;
  const d = new Date(iso.slice(0, 10));
  if (Number.isNaN(d.getTime())) return false;
  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  return d.getTime() < heute.getTime();
}
function genLocalId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
function download(name, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
}

/** Label/Wert-Zeilen mit dezenter Trennlinie (letzte Zeile ohne Rahmen). */
function KvRows({ rows }) {
  return rows.map((r, i) => (
    <div
      key={r.label}
      style={{ ...styles.kvRow, ...(i === rows.length - 1 ? { borderBottom: 'none', paddingBottom: 0 } : {}) }}
    >
      <span style={styles.kvLabel}>{r.label}</span>
      <span style={styles.kvValue}>{r.value}</span>
    </div>
  ));
}

export default function VorgangDetail() {
  return <GrundsicherungKernProvider><VorgangDetailSeite /></GrundsicherungKernProvider>;
}

function VorgangDetailSeite() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAppPermission();
  const canEditRole = role === 'owner' || role === 'editor';
  const isOwner = role === 'owner';

  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [mainTab, setMainTab] = useState('uebersicht');
  const [sideTab, setSideTab] = useState('details');
  const [busy, setBusy] = useState(false);
  const dokUploadRef = useRef(null);

  // Dateivorschau: { url, contentType, name, dok } — objectURL wird beim Wechsel/Unmount freigegeben
  const [preview, setPreview] = useState(null);
  // Dokument-Löschung mit Sicherheits-Modal: das zu löschende Dokument (oder null).
  const [docToDelete, setDocToDelete] = useState(null);
  // Extraktions-Transparenz: aufgeklappte Dokument-Kacheln (Set von Dokument-IDs)
  const [extraktionOffen, setExtraktionOffen] = useState(() => new Set());

  // Statuswechsel auf „Abgeschlossen": Abschluss-Vermerk { ergebnis, bemerkung } oder null
  const [abschlussDialog, setAbschlussDialog] = useState(null);
  // Aufbewahrungsfrist bearbeiten (Owner): Datum als Formularwert oder null
  const [aufbewahrungEdit, setAufbewahrungEdit] = useState(null);

  // UX: Nummer kopieren, Seitenleiste ein-/ausklappen, Dokument-Sprung
  const [copied, setCopied] = useState(false);
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const [highlightDocId, setHighlightDocId] = useState(null);
  const docRefs = useRef({});

  // Übersicht-Bearbeitung pro Block: Set von Block-Keys ('antrag'|'wohnung'|'verfahren')
  const [editBlocks, setEditBlocks] = useState(() => new Set());
  const [form, setForm] = useState(null);

  // Prüfschritte
  const [pruefFilter, setPruefFilter] = useState('alle');
  const [neueAnforderung, setNeueAnforderung] = useState('');

  // Schreiben-Editor (id -> {betreff, frist, body, version})
  const [schreibenEdit, setSchreibenEdit] = useState({});
  // Textbausteine: globale Snippet-Liste + Picker/Verwaltung
  const [textbausteine, setTextbausteine] = useState([]);
  const [tbOpenFor, setTbOpenFor] = useState(null); // schreiben-id, für das der Picker offen ist
  const [tbQuery, setTbQuery] = useState('');
  const [tbManage, setTbManage] = useState(false);
  const [tbForm, setTbForm] = useState({ kategorie: 'Allgemein', titel: '', text: '' });
  const bodyRefs = useRef({});

  // Notizen-Panel: { anker, label } oder null
  const [notizPanel, setNotizPanel] = useState(null);

  // Todos & Labels
  const [neuerTodo, setNeuerTodo] = useState('');
  const [neuesLabel, setNeuesLabel] = useState('');

  // Fall-Protokoll : welche Einträge ihren Vorher/Nachher-Diff aufgeklappt zeigen
  const [protokollOffen, setProtokollOffen] = useState({});
  // Token-Verbrauch: Zähler erzwingt Neuladen nach KI-Aktionen (Chat, Upload).
  const [kiVerbrauchStand, setKiVerbrauchStand] = useState(0);
  const [sachbearbeitung, setSachbearbeitung] = useState({ nutzer: [], ich: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await grundsicherungApi.getVorgangDetail(id);
        if (!cancelled) setDetail(d);
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
      try {
        const tb = await grundsicherungApi.listTextbausteine();
        if (!cancelled) setTextbausteine(tb);
      } catch { /* Textbausteine optional */ }
      try {
        const sb = await grundsicherungApi.getSachbearbeitung();
        if (!cancelled) setSachbearbeitung(sb);
      } catch { /* Auswahlliste optional — Anzeige funktioniert auch ohne */ }
    })();
    return () => { cancelled = true; };
  }, [id]);

  // Dokument-Sprung: kurzes Hervorheben + Scroll, danach Flash zurücksetzen.
  useEffect(() => {
    if (!highlightDocId) return undefined;
    const el = docRefs.current[highlightDocId];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t = setTimeout(() => setHighlightDocId(null), 2000);
    return () => clearTimeout(t);
  }, [highlightDocId]);

  // Vorschau-objectURL freigeben (beim Wechsel auf eine neue Vorschau und beim Unmount).
  useEffect(() => {
    if (!preview?.url) return undefined;
    return () => URL.revokeObjectURL(preview.url);
  }, [preview]);

  // Sachbearbeitung zuweisen (leer = Zuweisung aufheben). Der Server setzt den Anzeigenamen.
  async function zuweisen(sachbearbeiterId) {
    await saveVorgangData({ sachbearbeiterId: sachbearbeiterId || null });
  }

  // Nach Änderungen prüft der Server automatisch neu (ohne Versionssprung am Vorgang).
  // Nur Prüfschritte + Prüfzeitpunkt übernehmen — offene Formulare bleiben unberührt.
  async function ladePruefstand() {
    try {
      const neu = await grundsicherungApi.getVorgangDetail(id);
      setDetail((d) => (d ? { ...d, pruefschritte: neu.pruefschritte, vorgang: { ...d.vorgang, geprueftAm: neu.vorgang.geprueftAm } } : d));
    } catch { /* Anzeige best-effort */ }
  }

  async function reload() {
    try { setDetail(await grundsicherungApi.getVorgangDetail(id)); }
    catch (e) { setError(e.message); }
  }

  // ── Dateivorschau / Download / Ablage ──
  // Vorschau als serverseitig gerenderte Seitenbilder (kein eingebetteter PDF-Viewer — die
  // Content-Security-Policy der Instanz blockiert Blob-Rahmen).
  function openPreview(d) {
    setError('');
    setPreview({ name: DOKUMENT_TYP_LABEL[d.typ] || d.typ, dok: d });
  }
  function closePreview() { setPreview(null); }
  function toggleExtraktion(docId) {
    setExtraktionOffen((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId); else next.add(docId);
      return next;
    });
  }
  async function downloadDoc(d) {
    try { await grundsicherungApi.downloadDokumentDatei(d.id, d.quelle || `${DOKUMENT_TYP_LABEL[d.typ] || 'dokument'}`); }
    catch (e) { setError(e.message); }
  }
  async function downloadAlleOriginale(originale) {
    // Vereinfachung: sequentieller Einzel-Download je Datei (kein ZIP — keine neue Dependency).
    setError('');
    for (const d of originale) {
      try { await grundsicherungApi.downloadDokumentDatei(d.id, d.quelle || `original-${d.id}`); }
      catch { /* best-effort: einzelne Fehler überspringen */ }
    }
  }
  async function ablegen(d) {
    setBusy(true); setError('');
    try { await grundsicherungApi.ablegenDokument(d.id, d.version); await reload(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  // Nachweis einer Person zuordnen (oder fallübergreifend): speichern → neu prüfen → neu laden.
  async function zuordnenPerson(d, personId) {
    setBusy(true); setError('');
    try {
      await grundsicherungApi.updateDokument(d.id, {
        personId: personId || null,
        expectedVersion: d.version,
      });
      try { await grundsicherungApi.pruefen(id); } catch { /* Prüfung best-effort */ }
      await reload();
    } catch (e) {
      if (e.status === 409) { setError('Konflikt: Das Dokument wurde parallel geändert. Die Ansicht wird neu geladen.'); await reload(); }
      else setError(e.message);
    } finally { setBusy(false); }
  }

  // Dokument löschen (nach Modal-Bestätigung): entfernen → neu prüfen → neu laden.
  async function confirmDeleteDoc() {
    if (!docToDelete) return;
    setBusy(true); setError('');
    try {
      await grundsicherungApi.deleteDokument(docToDelete.id);
      // Nachweis entfernt → Prüfung neu ausführen, damit offene Anforderungen wieder erscheinen.
      try { await grundsicherungApi.pruefen(id); } catch { /* Prüfung best-effort */ }
      setDocToDelete(null);
      await reload();
    } catch (e) {
      setError(e.message || 'Dokument konnte nicht gelöscht werden');
    } finally {
      setBusy(false);
    }
  }

  function copyNummer(nummer) {
    navigator.clipboard?.writeText(nummer).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }

  function jumpToDokument(dokumentId) {
    setSideCollapsed(false);
    setSideTab('dokumente');
    setHighlightDocId(dokumentId);
  }

  async function uploadDokumente(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setBusy(true);
    setError(null);
    try {
      await grundsicherungApi.uploadVorgangDokument(id, files);
      await reload();
    } catch (e) {
      setError(e.message || 'Upload fehlgeschlagen');
    } finally {
      setBusy(false);
      setKiVerbrauchStand((n) => n + 1); // auch bei Fehler: Auswertung kann Tokens verbraucht haben
    }
  }

  if (!detail) {
    return <div style={{ padding: theme.spacing['2xl'] }}>{error ? <div style={styles.error}>{error}</div> : 'Lädt…'}</div>;
  }

  const { vorgang, akte, personen, dokumente, pruefschritte, schreiben } = detail;
  // Art. 18: bei eingeschränkter Verarbeitung sind alle Bearbeiten-Aktionen gesperrt (nur lesend).
  const eingeschraenkt = !!vorgang.eingeschraenkt;
  const canEdit = canEditRole && !eingeschraenkt;
  const protokoll = detail.protokoll || [];
  const feldStatus = detail.feldStatus || [];
  const notizen = detail.notizen || [];
  const feldStatusMap = buildFeldStatusMap(feldStatus);
  const offeneFelder = Object.values(feldStatusMap);
  const notizCount = (anker) => notizen.filter((n) => n.anker === anker).length;
  const antragsteller = personen.find((p) => p.rolle === 'antragsteller');
  const antragstellerName = (antragsteller && [antragsteller.vorname, antragsteller.nachname].filter(Boolean).join(' '))
    || akte?.antragstellerName || akte?.name || '—';

  const dokLabel = (docId) => {
    const d = dokumente.find((x) => x.id === docId);
    return d ? (DOKUMENT_TYP_LABEL[d.typ] || d.typ) : 'Beleg-Dokument';
  };

  // ── Ampel-Zählung: offene Prüfschritte je Sektion (Person bzw. Regel-ID). ──
  const offen = pruefschritte.filter((p) => p.status === 'offen');
  const einsatzIds = new Set(personen.filter((p) => p.rolle !== 'haushaltsangehoerig').map((p) => p.id));
  const haushaltIds = new Set(personen.filter((p) => p.rolle === 'haushaltsangehoerig').map((p) => p.id));
  const regel = (p, re) => re.test(p.regelId || '');
  const RE_WOHNEN = /miet|heiz|nebenkosten|eigentum/;
  const RE_VORRANG = /^vorrang-|wohngeld|sgb2|ersteingang/;
  const countWohnung = offen.filter((p) => !p.personId && regel(p, RE_WOHNEN)).length;
  const countVorrang = offen.filter((p) => !p.personId && regel(p, RE_VORRANG)).length;
  const countAntrag = offen.filter((p) => !p.personId && !regel(p, RE_WOHNEN) && !regel(p, RE_VORRANG)).length;
  const countEinsatz = offen.filter((p) => p.personId && einsatzIds.has(p.personId)).length;
  const countHaushalt = offen.filter((p) => p.personId && haushaltIds.has(p.personId)).length;
  // Klick auf eine „n offen"-Pill → rechte Seitenleiste öffnet die offenen Prüfschritte.
  const zeigeOffene = () => { setSideTab('pruefschritte'); setPruefFilter('offen'); };

  // ── Übersicht-Bearbeitung pro Block ──
  function num(v) { return v === '' || v == null ? undefined : Number(v); }
  function wahl(v) { return v === true ? 'ja' : v === false ? 'nein' : ''; }
  function ausWahl(v) { return v === 'ja' ? true : v === 'nein' ? false : undefined; }
  // Vollständiges Form-Objekt aus dem Vorgang (alle editierbaren Vorgang-Felder).
  function fullForm() {
    const w = vorgang.wohnung || {};
    const e = vorgang.ersteingang || {};
    const vb = vorgang.vorbezug || {};
    return {
      antragsdatum: vorgang.antragsdatum ? vorgang.antragsdatum.slice(0, 10) : '',
      antragsart: vorgang.antragsart,
      anspruchsgrund: vorgang.anspruchsgrund || '',
      wohnsituation: vorgang.wohnsituation || '',
      aktenzeichen: vorgang.aktenzeichen || '',
      iban: vorgang.iban || '',
      bwz_start: vorgang.bwz?.start || '',
      bwz_ende: vorgang.bwz?.ende || '',
      wohnung: {
        strasse: w.strasse || '', hausnummer: w.hausnummer || '', plz: w.plz || '', ort: w.ort || '',
        kaltmiete: w.kaltmiete ?? '', nebenkosten_kalt: w.nebenkosten_kalt ?? '', heizkosten: w.heizkosten ?? '',
        warmwasser: w.warmwasser || '', wohnflaeche_qm: w.wohnflaeche_qm ?? '', bewohner_anzahl: w.bewohner_anzahl ?? '',
        heizung_in_miete_enthalten: wahl(w.heizung_in_miete_enthalten),
      },
      ersteingang_datum: e.datum ? e.datum.slice(0, 10) : '',
      ersteingang_stelle: e.stelle || '',
      wohngeld_antrag_laeuft: wahl(vorgang.wohngeld_antrag_laeuft),
      vorbezug_leistung: vb.leistung || '',
      vorbezug_traeger: vb.traeger || '',
      vorbezug_bis: vb.bis ? vb.bis.slice(0, 10) : '',
    };
  }
  // Frische Feld-Defaults eines Blocks (für Start und Verwerfen).
  function blockDefaults(block) {
    const f = fullForm();
    if (block === 'antrag') return { antragsdatum: f.antragsdatum, antragsart: f.antragsart, anspruchsgrund: f.anspruchsgrund, wohnsituation: f.wohnsituation, aktenzeichen: f.aktenzeichen, iban: f.iban, bwz_start: f.bwz_start, bwz_ende: f.bwz_ende };
    if (block === 'wohnung') return { wohnung: f.wohnung };
    if (block === 'verfahren') return { ersteingang_datum: f.ersteingang_datum, ersteingang_stelle: f.ersteingang_stelle, wohngeld_antrag_laeuft: f.wohngeld_antrag_laeuft, vorbezug_leistung: f.vorbezug_leistung, vorbezug_traeger: f.vorbezug_traeger, vorbezug_bis: f.vorbezug_bis };
    return {};
  }
  const isBlockEdit = (block) => editBlocks.has(block);
  function startBlockEdit(block) {
    const base = form || fullForm();
    setForm({ ...base, ...blockDefaults(block) });
    setEditBlocks((s) => { const n = new Set(s); n.add(block); return n; });
  }
  function cancelBlockEdit(block) {
    const next = new Set(editBlocks); next.delete(block);
    setEditBlocks(next);
    if (next.size === 0) setForm(null);
    else setForm((f) => ({ ...f, ...blockDefaults(block) }));
  }
  // Payload nur der Felder des jeweiligen Blocks (Merge im Backend).
  function blockPayload(block) {
    if (block === 'antrag') {
      const bwz = form.bwz_start || form.bwz_ende ? { start: form.bwz_start || undefined, ende: form.bwz_ende || undefined } : undefined;
      return {
        antragsdatum: form.antragsdatum || undefined,
        antragsart: form.antragsart,
        anspruchsgrund: form.anspruchsgrund || undefined,
        wohnsituation: form.wohnsituation || undefined,
        aktenzeichen: (form.aktenzeichen || '').trim() || undefined,
        iban: (form.iban || '').trim() || undefined,
        bwz,
      };
    }
    if (block === 'wohnung') return {
      wohnung: {
        ...(vorgang.wohnung || {}),
        strasse: form.wohnung.strasse || undefined,
        hausnummer: form.wohnung.hausnummer || undefined,
        plz: form.wohnung.plz || undefined,
        ort: form.wohnung.ort || undefined,
        kaltmiete: num(form.wohnung.kaltmiete),
        nebenkosten_kalt: num(form.wohnung.nebenkosten_kalt),
        heizkosten: num(form.wohnung.heizkosten),
        warmwasser: form.wohnung.warmwasser || undefined,
        wohnflaeche_qm: num(form.wohnung.wohnflaeche_qm),
        bewohner_anzahl: num(form.wohnung.bewohner_anzahl),
        heizung_in_miete_enthalten: ausWahl(form.wohnung.heizung_in_miete_enthalten),
      },
    };
    if (block === 'verfahren') {
      const ersteingang = form.ersteingang_datum || form.ersteingang_stelle.trim()
        ? { datum: form.ersteingang_datum || undefined, stelle: form.ersteingang_stelle.trim() || undefined } : undefined;
      const vorbezug = form.vorbezug_leistung || form.vorbezug_traeger.trim() || form.vorbezug_bis
        ? { leistung: form.vorbezug_leistung || undefined, traeger: form.vorbezug_traeger.trim() || undefined, bis: form.vorbezug_bis || undefined } : undefined;
      return { ersteingang, vorbezug, wohngeld_antrag_laeuft: ausWahl(form.wohngeld_antrag_laeuft) };
    }
    return {};
  }
  async function saveBlock(block) {
    setBusy(true); setError('');
    try {
      const updated = await grundsicherungApi.updateVorgang(id, { ...blockPayload(block), expectedVersion: vorgang.version });
      setDetail((d) => ({ ...d, vorgang: updated }));
      await ladePruefstand();
      const next = new Set(editBlocks); next.delete(block);
      setEditBlocks(next);
      if (next.size === 0) setForm(null);
    } catch (e) {
      if (e.status === 409) { setError('Konflikt: Der Vorgang wurde parallel geändert. Die Ansicht wird neu geladen.'); await reload(); setEditBlocks(new Set()); setForm(null); }
      else setError(e.message);
    } finally { setBusy(false); }
  }
  // Kopf-Aktion je Block: „Bearbeiten" bzw. „Verwerfen"/„Speichern" (+ optionaler Zusatz-Button).
  function blockAction(block, extra) {
    if (!canEdit) return extra || null;
    if (isBlockEdit(block)) {
      return (
        <div style={{ display: 'flex', gap: theme.spacing.sm }}>
          <button style={styles.btnSmall} onClick={() => cancelBlockEdit(block)} disabled={busy}>Verwerfen</button>
          <button style={styles.btn} onClick={() => saveBlock(block)} disabled={busy}>{busy ? 'Speichert…' : 'Speichern'}</button>
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', gap: theme.spacing.sm, alignItems: 'center' }}>
        {extra}
        <button style={styles.btnSmall} onClick={() => startBlockEdit(block)}>Bearbeiten</button>
      </div>
    );
  }

  // Statuswechsel über die eigene Route; „Abgeschlossen" verlangt einen Abschluss-Vermerk.
  function changeStatus(status) {
    if (status === 'abgeschlossen') {
      setAbschlussDialog({ ergebnis: vorgang.abschluss?.ergebnis || '', bemerkung: vorgang.abschluss?.bemerkung || '' });
      return;
    }
    speichereStatus({ status });
  }
  async function speichereStatus(payload) {
    setBusy(true); setError('');
    try {
      const updated = await grundsicherungApi.setStatus(id, { ...payload, expectedVersion: vorgang.version });
      setDetail((d) => ({ ...d, vorgang: updated }));
      setAbschlussDialog(null);
      await reload();
    } catch (e) {
      if (e.status === 409) { setError('Konflikt: Der Vorgang wurde parallel geändert. Die Ansicht wird neu geladen.'); await reload(); setAbschlussDialog(null); }
      else setError(e.message);
    } finally { setBusy(false); }
  }
  // Aufbewahrungsfrist setzen/entfernen (Owner).
  async function speichereAufbewahrung(datum) {
    setBusy(true); setError('');
    try {
      const updated = await grundsicherungApi.setAufbewahrung(id, datum || null, vorgang.version);
      setDetail((d) => ({ ...d, vorgang: updated }));
      setAufbewahrungEdit(null);
      await reload();
    } catch (e) {
      if (e.status === 409) { setError('Konflikt: Der Vorgang wurde parallel geändert. Die Ansicht wird neu geladen.'); await reload(); }
      else setError(e.message);
    } finally { setBusy(false); }
  }

  // ── Legal Hold & Verarbeitungs-Einschränkung (Art. 18) ──
  async function toggleLegalHold() {
    setBusy(true); setError('');
    try {
      const updated = await grundsicherungApi.setLegalHold(id, !vorgang.legalHold, vorgang.version);
      setDetail((d) => ({ ...d, vorgang: updated }));
      await reload();
    } catch (e) {
      if (e.status === 409) { setError('Konflikt: Der Vorgang wurde parallel geändert. Die Ansicht wird neu geladen.'); await reload(); }
      else setError(e.message);
    } finally { setBusy(false); }
  }
  async function toggleEinschraenkung() {
    const setzen = !vorgang.eingeschraenkt;
    const frage = setzen
      ? 'Verarbeitung nach Art. 18 DSGVO einschränken? Der Vorgang wird dann für alle Bearbeiten-Aktionen gesperrt (nur lesend).'
      : 'Einschränkung aufheben und den Vorgang wieder zur Bearbeitung freigeben?';
    if (!window.confirm(frage)) return;
    setBusy(true); setError('');
    try {
      const updated = await grundsicherungApi.setEinschraenkung(id, setzen, vorgang.version);
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
      await grundsicherungApi.pruefen(id);
      await reload();
      setSideTab('pruefschritte');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function setPruefStatus(p, status) {
    setBusy(true); setError('');
    try {
      const updated = await grundsicherungApi.updatePruefschritt(p.id, { status, expectedVersion: p.version });
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
      await grundsicherungApi.createPruefschritt(id, {
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
      await grundsicherungApi.generiereSchreiben(id, { art: 'erstanforderung', fristTage: 14 });
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
      const updated = await grundsicherungApi.updateSchreiben(s.id, {
        betreff: st.betreff, frist: st.frist || undefined, body: st.body, expectedVersion: s.version,
      });
      setDetail((d) => ({ ...d, schreiben: d.schreiben.map((x) => (x.id === updated.id ? updated : x)) }));
      setSchreibenEdit((m) => { const n = { ...m }; delete n[s.id]; return n; });
    } catch (e) {
      if (e.status === 409) { setError('Konflikt: Das Schreiben wurde parallel geändert. Die Ansicht wird neu geladen.'); await reload(); }
      else setError(e.message);
    } finally { setBusy(false); }
  }

  async function neuErzeugen(s) {
    if (!window.confirm('„Neu erzeugen" überschreibt den aktuellen Entwurf dieses Schreibens mit den aktuellen offenen Prüfschritten. Fortfahren?')) return;
    setBusy(true); setError('');
    try {
      await grundsicherungApi.generiereSchreiben(id, { schreibenId: s.id, art: s.art });
      setSchreibenEdit((m) => { const n = { ...m }; delete n[s.id]; return n; });
      await reload();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  // ── Textbausteine: einfügen an Cursorposition + Verwaltung ──
  function insertBaustein(s, tb) {
    const cur = editState(s);
    const body = cur.body || '';
    const ta = bodyRefs.current[s.id];
    let next;
    if (ta && typeof ta.selectionStart === 'number' && document.activeElement === ta) {
      const pos = ta.selectionStart;
      next = `${body.slice(0, pos)}${tb.text}${body.slice(pos)}`;
    } else {
      next = body ? `${body}\n\n${tb.text}` : tb.text;
    }
    setEditField(s, 'body', next);
    setTbOpenFor(null); setTbQuery('');
  }
  async function addTextbaustein() {
    if (!tbForm.titel.trim() || !tbForm.text.trim()) return;
    setBusy(true); setError('');
    try {
      await grundsicherungApi.createTextbaustein({ kategorie: (tbForm.kategorie || 'Allgemein').trim(), titel: tbForm.titel.trim(), text: tbForm.text.trim() });
      setTbForm({ kategorie: 'Allgemein', titel: '', text: '' });
      setTextbausteine(await grundsicherungApi.listTextbausteine());
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function deleteTextbaustein(tb) {
    setBusy(true); setError('');
    try { await grundsicherungApi.deleteTextbaustein(tb.id); setTextbausteine(await grundsicherungApi.listTextbausteine()); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  // ── Feld-Status: KI-Vorschläge bestätigen/verwerfen ──
  async function bestaetigeFeld(fs) {
    setBusy(true); setError('');
    try { await grundsicherungApi.bestaetigeFeld(id, fs.id); await reload(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function verwerfeFeld(fs) {
    setBusy(true); setError('');
    try { await grundsicherungApi.verwerfeFeld(id, fs.id); await reload(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function bestaetigeAlleFelder() {
    setBusy(true); setError('');
    try { await grundsicherungApi.bestaetigeAlleFelder(id); await reload(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  // KI-Punkt am Zeilenanfang (vor dem Label) …
  function vfsDot(feldPfad) {
    const fs = feldStatusMap[fsKey('vorgang', vorgang.id, feldPfad)];
    return fs ? <FeldStatusDot fs={fs} /> : null;
  }
  // … und die Freigabe (✓/✗) am Wert — immer verfügbar (kein Bearbeiten-Modus nötig).
  function vfsFreigabe(feldPfad) {
    const fs = feldStatusMap[fsKey('vorgang', vorgang.id, feldPfad)];
    return fs ? <FeldStatusFreigabe fs={fs} canEdit={canEdit} busy={busy} onBestaetigen={bestaetigeFeld} onVerwerfen={verwerfeFeld} /> : null;
  }
  // Block enthält ≥1 unbestätigten KI-Vorschlag? (Headline-Punkt an der SektionCard)
  const vfsExists = (feldPfad) => !!feldStatusMap[fsKey('vorgang', vorgang.id, feldPfad)];

  // ── Personen-Listen: strukturierte Angaben speichern (data-Merge) ──
  async function savePersonData(personId, patch) {
    const person = detail.personen.find((x) => x.id === personId);
    if (!person) return;
    setBusy(true); setError('');
    try {
      const updated = await grundsicherungApi.updatePerson(personId, { ...patch, expectedVersion: person.version });
      setDetail((d) => ({ ...d, personen: d.personen.map((x) => (x.id === updated.id ? updated : x)) }));
      await ladePruefstand();
    } catch (e) {
      if (e.status === 409) { setError('Konflikt: Die Person wurde parallel geändert. Die Ansicht wird neu geladen.'); await reload(); }
      else setError(e.message);
    } finally { setBusy(false); }
  }

  // Person manuell anlegen (z. B. nach Vorsprache ohne Antrag). Namen danach in der Karte pflegen.
  async function addPerson(rolle) {
    setBusy(true); setError('');
    try {
      await grundsicherungApi.createPerson(id, { rolle, nachname: '', vorname: '' });
      await reload();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  // ── Bewilligungszeitraum-Vorschlag übernehmen (12 Monate ab Antragsmonat) ──
  async function bwzVorschlagUebernehmen() {
    setBusy(true); setError('');
    try {
      const updated = await grundsicherungApi.bwzVorschlagUebernehmen(id);
      setDetail((d) => ({ ...d, vorgang: updated }));
      await reload();
    } catch (e) {
      if (e.status === 409) { setError('Konflikt: Der Vorgang wurde parallel geändert. Die Ansicht wird neu geladen.'); await reload(); }
      else setError(e.message);
    } finally { setBusy(false); }
  }

  // ── Notizen ──
  async function addNotiz(anker, text) {
    setBusy(true); setError('');
    try { await grundsicherungApi.addNotiz(id, { anker, text }); await reload(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function deleteNotiz(n) {
    setBusy(true); setError('');
    try { await grundsicherungApi.deleteNotiz(n.id); await reload(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  // ── Vorgang-data speichern (Merge, Optimistic Locking) — Basis für Todos/Labels ──
  async function saveVorgangData(patch) {
    setBusy(true); setError('');
    try {
      const updated = await grundsicherungApi.updateVorgang(id, { ...patch, expectedVersion: vorgang.version });
      setDetail((d) => ({ ...d, vorgang: updated }));
      await ladePruefstand();
    } catch (e) {
      if (e.status === 409) { setError('Konflikt: Der Vorgang wurde parallel geändert. Die Ansicht wird neu geladen.'); await reload(); }
      else setError(e.message);
    } finally { setBusy(false); }
  }

  // Frist/Wiedervorlage einzeln setzen; beim Setzen der Frist die Wiedervorlage
  // auf Frist + 3 Tage vorbelegen, solange noch keine Wiedervorlage gesetzt ist.
  function setFristFeld(feld, wert) {
    const patch = { [feld]: wert || undefined };
    if (feld === 'frist' && wert && !vorgang.wiedervorlage) {
      patch.wiedervorlage = plusTageISO(wert, 3) || undefined;
    }
    saveVorgangData(patch);
  }

  // ── Schreiben als versendet markieren ──
  async function markVersendet(s) {
    if (!window.confirm('Schreiben als versendet markieren? Der Vorgang wird auf „Wartet auf Rückmeldung" gesetzt; die Wiedervorlage wird auf Frist + 3 Tage vorbelegt.')) return;
    setBusy(true); setError('');
    try {
      await grundsicherungApi.markSchreibenVersendet(id, s.id);
      await reload();
    } catch (e) {
      if (e.status === 409) { setError('Konflikt: Der Vorgang wurde parallel geändert. Die Ansicht wird neu geladen.'); await reload(); }
      else setError(e.message);
    } finally { setBusy(false); }
  }

  // ── Sektionen der Übersicht ──
  // Unbestätigte KI-Vorschläge je Block → Headline-Punkt an der SektionCard.
  const ANTRAG_FELDER = ['antragsdatum', 'antragsart', 'anspruchsgrund', 'wohnsituation', 'aktenzeichen', 'iban', 'bwz'];
  const WOHNUNG_FELDER = ['strasse', 'hausnummer', 'plz', 'ort', 'kaltmiete', 'nebenkosten_kalt', 'heizkosten', 'warmwasser', 'wohnflaeche_qm', 'bewohner_anzahl', 'heizung_in_miete_enthalten'].map((f) => `wohnung.${f}`);
  const VERFAHREN_FELDER = ['ersteingang', 'ersteingang.datum', 'ersteingang.stelle', 'wohngeld_antrag_laeuft', 'vorbezug', 'vorbezug.leistung', 'vorbezug.traeger', 'vorbezug.bis'];
  const unbestAntrag = ANTRAG_FELDER.some(vfsExists);
  const unbestWohnung = ['wohnung', ...WOHNUNG_FELDER].some(vfsExists);
  const unbestVerfahren = VERFAHREN_FELDER.some(vfsExists);
  const einsatz = personen.filter((p) => p.rolle !== 'haushaltsangehoerig')
    .sort((a, b) => (a.rolle === 'antragsteller' ? -1 : 0) - (b.rolle === 'antragsteller' ? -1 : 0));
  const haushalt = personen.filter((p) => p.rolle === 'haushaltsangehoerig');
  const personUnbest = (liste) => liste.some((p) => Object.keys(feldStatusMap).some((k) => k.startsWith(`person:${p.id}:`)));
  const w = vorgang.wohnung || {};
  const adresse = [w.strasse, w.hausnummer].filter(Boolean).join(' ');
  const ortZeile = [w.plz, w.ort].filter(Boolean).join(' ');
  const jaNein = (v) => (v === true ? 'Ja' : v === false ? 'Nein' : '—');
  const wohnkostenSumme = [w.kaltmiete, w.nebenkosten_kalt, w.heizkosten].some((x) => x != null)
    ? (Number(w.kaltmiete) || 0) + (Number(w.nebenkosten_kalt) || 0) + (Number(w.heizkosten) || 0) : null;
  const bwzText = vorgang.bwz?.start || vorgang.bwz?.ende ? `${fmtDate(vorgang.bwz.start)} – ${fmtDate(vorgang.bwz.ende)}` : '—';
  const bwzVorschlagMoeglich = !!vorgang.antragsdatum && !vorgang.bwz?.start;
  // „Wohngeld bezogen" ergibt sich aus Einkommensangaben oder dem Vorbezug.
  const wohngeldBezogen = personen.some((p) => (p.einkommen || []).some((e) => e.art === 'wohngeld')) || vorgang.vorbezug?.leistung === 'wohngeld';
  const ersteingang = vorgang.ersteingang || {};
  const vorbezug = vorgang.vorbezug || {};

  // ── Todos & Labels ──
  const todos = vorgang.todos || [];
  const todosOffen = todos.filter((t) => !t.erledigt).length;
  const labels = vorgang.labels || [];
  function addTodo() {
    const text = neuerTodo.trim();
    if (!text) return;
    saveVorgangData({ todos: [...todos, { id: genLocalId('todo'), text, erledigt: false }] });
    setNeuerTodo('');
  }
  function toggleTodo(t) { saveVorgangData({ todos: todos.map((x) => (x.id === t.id ? { ...x, erledigt: !x.erledigt } : x)) }); }
  function deleteTodo(t) { saveVorgangData({ todos: todos.filter((x) => x.id !== t.id) }); }
  function addLabel() {
    const l = neuesLabel.trim();
    if (!l || labels.includes(l)) { setNeuesLabel(''); return; }
    saveVorgangData({ labels: [...labels, l] });
    setNeuesLabel('');
  }
  function removeLabel(l) { saveVorgangData({ labels: labels.filter((x) => x !== l) }); }

  // Frist/Wiedervorlage
  const fristUeberfaellig = istUeberfaellig(vorgang.frist);
  const wvUeberfaellig = istUeberfaellig(vorgang.wiedervorlage);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button style={styles.backLink} onClick={() => navigate('/apps/grundsicherung')}><ArrowLeftIcon /> Grundsicherung</button>
        <div style={styles.crumb}>Vorgänge › {vorgang.vorgangsnummer}</div>
        <div style={styles.headRow}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
              <h1 style={styles.title} title={vorgang.aktenzeichen ? 'Aktenzeichen des Fachverfahrens' : 'Vorgangsnummer (intern) — das Aktenzeichen vergibt das Fachverfahren'}>
                {vorgang.aktenzeichen || vorgang.vorgangsnummer}
              </h1>
              <button
                style={{ ...styles.iconBtn, position: 'relative' }}
                onClick={() => copyNummer(vorgang.aktenzeichen || vorgang.vorgangsnummer)}
                title="Nummer kopieren"
                aria-label="Nummer kopieren"
              >
                <CopyIcon size={16} color={theme.colors.textMuted} />
                {copied && <span style={styles.copiedHint}>kopiert</span>}
              </button>
            </div>
            <div style={styles.subtitle}>
              <span>{antragstellerName}</span>
              {vorgang.aktenzeichen && (
                <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>Vorgangsnr. {vorgang.vorgangsnummer}</span>
              )}
              <StatusBadge status={vorgang.status} />
              <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>
                {[ANTRAGSART_LABEL[vorgang.antragsart], vorgang.anspruchsgrund ? ANSPRUCHSGRUND_KURZ[vorgang.anspruchsgrund] : null].filter(Boolean).join(' · ')}
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

      {eingeschraenkt && (
        <div style={styles.einschrBanner}>
          <InfoIcon size={16} color={theme.colors.warning} />
          Verarbeitung eingeschränkt (Art. 18 DSGVO) — dieser Vorgang ist gesperrt und kann nur gelesen werden.
        </div>
      )}

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
              {offeneFelder.length > 0 && (
                <div style={styles.bestaetigungBar}>
                  <span style={styles.bestaetigungText}>
                    <span style={styles.bestaetigungDot} />
                    {offeneFelder.length} {offeneFelder.length === 1 ? 'KI-Vorschlag' : 'KI-Vorschläge'} aus Dokumenten — bitte bestätigen oder verwerfen
                  </span>
                  {canEdit && (
                    <button style={styles.btnSmall} onClick={bestaetigeAlleFelder} disabled={busy}>Alle bestätigen</button>
                  )}
                </div>
              )}
              <SektionCard
                title="Antrag & Anspruchsgrund"
                ungeprueft={!vorgang.geprueftAm} offenCount={countAntrag} onOffenClick={zeigeOffene}
                collapsible
                unbestaetigt={unbestAntrag}
                notizCount={notizCount('sektion:antrag')}
                onNotizClick={() => setNotizPanel({ anker: 'sektion:antrag', label: 'Antrag & Anspruchsgrund' })}
                action={blockAction('antrag', canEdit && bwzVorschlagMoeglich && !isBlockEdit('antrag') ? (
                  <button style={styles.btnSmall} onClick={bwzVorschlagUebernehmen} disabled={busy} title="12 Monate ab Monatserster des Antragsmonats übernehmen">
                    {busy ? 'Übernimmt…' : 'Zeitraum-Vorschlag übernehmen'}
                  </button>
                ) : null)}
              >
                {isBlockEdit('antrag') ? (
                  <div style={styles.editRow}>
                    <span style={styles.editLabel}>Antragsdatum</span>
                    <input type="date" style={styles.input} value={form.antragsdatum} onChange={(e) => setForm({ ...form, antragsdatum: e.target.value })} />
                    <span style={styles.editLabel}>Antragsart</span>
                    <select style={styles.input} value={form.antragsart} onChange={(e) => setForm({ ...form, antragsart: e.target.value })}>
                      {Object.entries(ANTRAGSART_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <span style={styles.editLabel}>Anspruchsgrund</span>
                    <select style={styles.input} value={form.anspruchsgrund} onChange={(e) => setForm({ ...form, anspruchsgrund: e.target.value })}>
                      <option value="">Noch offen</option>
                      {Object.entries(ANSPRUCHSGRUND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <span style={styles.editLabel}>Wohnsituation</span>
                    <select style={styles.input} value={form.wohnsituation} onChange={(e) => setForm({ ...form, wohnsituation: e.target.value })}>
                      <option value="">—</option>
                      {Object.entries(WOHNSITUATION_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <span style={styles.editLabel}>Aktenzeichen (Fachverfahren)</span>
                    <input type="text" style={styles.input} value={form.aktenzeichen} placeholder="vom Fachverfahren vergeben" onChange={(e) => setForm({ ...form, aktenzeichen: e.target.value })} />
                    <span style={styles.editLabel}>IBAN</span>
                    <input style={styles.input} value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} />
                    <span style={styles.editLabel}>Bewilligungszeitraum von</span>
                    <input type="date" style={styles.input} value={form.bwz_start} onChange={(e) => setForm({ ...form, bwz_start: e.target.value })} />
                    <span style={styles.editLabel}>Bewilligungszeitraum bis</span>
                    <input type="date" style={styles.input} value={form.bwz_ende} onChange={(e) => setForm({ ...form, bwz_ende: e.target.value })} />
                  </div>
                ) : (
                  <FeldGrid felder={[
                    { label: 'Antragsdatum', value: fmtDate(vorgang.antragsdatum), dot: vfsDot('antragsdatum'), mark: vfsFreigabe('antragsdatum') },
                    { label: 'Antragsart', value: ANTRAGSART_LABEL[vorgang.antragsart] || vorgang.antragsart, dot: vfsDot('antragsart'), mark: vfsFreigabe('antragsart') },
                    { label: 'Anspruchsgrund', value: vorgang.anspruchsgrund ? ANSPRUCHSGRUND_LABEL[vorgang.anspruchsgrund] : 'Noch offen', dot: vfsDot('anspruchsgrund'), mark: vfsFreigabe('anspruchsgrund') },
                    { label: 'Wohnsituation', value: vorgang.wohnsituation ? WOHNSITUATION_LABEL[vorgang.wohnsituation] : '—', dot: vfsDot('wohnsituation'), mark: vfsFreigabe('wohnsituation') },
                    { label: 'Aktenzeichen (Fachverfahren)', value: vorgang.aktenzeichen || '—', dot: vfsDot('aktenzeichen'), mark: vfsFreigabe('aktenzeichen') },
                    { label: 'Vorgangsnummer (intern)', value: vorgang.vorgangsnummer },
                    { label: 'Antragsteller/in', value: antragstellerName },
                    { label: 'IBAN', value: vorgang.iban || '—', dot: vfsDot('iban'), mark: vfsFreigabe('iban') },
                    { label: 'Bewilligungszeitraum (Vorschlag)', value: bwzText, dot: vfsDot('bwz'), mark: vfsFreigabe('bwz') },
                  ]} />
                )}
              </SektionCard>

              <SektionCard
                title="Personen der Einsatzgemeinschaft"
                ungeprueft={!vorgang.geprueftAm} offenCount={countEinsatz} onOffenClick={zeigeOffene}
                collapsible
                unbestaetigt={personUnbest(einsatz)}
                notizCount={notizCount('sektion:personen')}
                onNotizClick={() => setNotizPanel({ anker: 'sektion:personen', label: 'Personen der Einsatzgemeinschaft' })}
                action={canEdit ? (
                  <button style={{ ...styles.btnSmall, ...styles.personAdd }} onClick={() => addPerson(einsatz.some((p) => p.rolle === 'antragsteller') ? 'partner' : 'antragsteller')} disabled={busy}>
                    <PlusIcon size={12} /> Person
                  </button>
                ) : null}
              >
                {einsatz.length === 0
                  ? <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>Noch keine Personen erfasst. Antragsteller/in und ggf. Partner/in bilden die Einsatzgemeinschaft.</div>
                  : einsatz.map((p) => (
                    <PersonCard
                      key={p.id}
                      person={p}
                      feldStatusMap={feldStatusMap}
                      canEdit={canEdit}
                      busy={busy}
                      onBestaetigen={bestaetigeFeld}
                      onVerwerfen={verwerfeFeld}
                      onSavePerson={savePersonData}
                      notizCount={notizCount(`person:${p.id}`)}
                      onNotizClick={() => setNotizPanel({ anker: `person:${p.id}`, label: [p.vorname, p.nachname].filter(Boolean).join(' ') || 'Person' })}
                    />
                  ))}
              </SektionCard>

              <SektionCard
                title="Haushaltsangehörige"
                ungeprueft={!vorgang.geprueftAm} offenCount={countHaushalt} onOffenClick={zeigeOffene}
                collapsible
                defaultOpen={haushalt.length > 0}
                unbestaetigt={personUnbest(haushalt)}
                notizCount={notizCount('sektion:haushalt')}
                onNotizClick={() => setNotizPanel({ anker: 'sektion:haushalt', label: 'Haushaltsangehörige' })}
                action={canEdit ? (
                  <button style={{ ...styles.btnSmall, ...styles.personAdd }} onClick={() => addPerson('haushaltsangehoerig')} disabled={busy}>
                    <PlusIcon size={12} /> Person
                  </button>
                ) : null}
              >
                <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginBottom: theme.spacing.sm }}>
                  Weitere Personen in der Wohnung gehören nicht zur Einsatzgemeinschaft; sie zählen nur für die Aufteilung der Wohnkosten nach Köpfen.
                </div>
                {haushalt.length === 0
                  ? <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>Keine weiteren Haushaltsangehörigen erfasst.</div>
                  : haushalt.map((p) => (
                    <PersonCard
                      key={p.id}
                      person={p}
                      haushaltsangehoerig
                      feldStatusMap={feldStatusMap}
                      canEdit={canEdit}
                      busy={busy}
                      onBestaetigen={bestaetigeFeld}
                      onVerwerfen={verwerfeFeld}
                      onSavePerson={savePersonData}
                      notizCount={notizCount(`person:${p.id}`)}
                      onNotizClick={() => setNotizPanel({ anker: `person:${p.id}`, label: [p.vorname, p.nachname].filter(Boolean).join(' ') || 'Person' })}
                    />
                  ))}
              </SektionCard>

              <SektionCard
                title="Wohnung und Heizung"
                ungeprueft={!vorgang.geprueftAm} offenCount={countWohnung} onOffenClick={zeigeOffene}
                collapsible
                unbestaetigt={unbestWohnung}
                notizCount={notizCount('sektion:wohnung')}
                onNotizClick={() => setNotizPanel({ anker: 'sektion:wohnung', label: 'Wohnung und Heizung' })}
                action={blockAction('wohnung')}
              >
                {isBlockEdit('wohnung') ? (
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
                    <span style={styles.editLabel}>Kaltmiete (€ / Monat)</span>
                    <input type="number" style={styles.input} value={form.wohnung.kaltmiete} onChange={(e) => setForm({ ...form, wohnung: { ...form.wohnung, kaltmiete: e.target.value } })} />
                    <span style={styles.editLabel}>Kalte Nebenkosten (€ / Monat)</span>
                    <input type="number" style={styles.input} value={form.wohnung.nebenkosten_kalt} onChange={(e) => setForm({ ...form, wohnung: { ...form.wohnung, nebenkosten_kalt: e.target.value } })} />
                    <span style={styles.editLabel}>Heizkosten (€ / Monat)</span>
                    <input type="number" style={styles.input} value={form.wohnung.heizkosten} onChange={(e) => setForm({ ...form, wohnung: { ...form.wohnung, heizkosten: e.target.value } })} />
                    <span style={styles.editLabel}>Heizung in der Miete enthalten</span>
                    <select style={styles.input} value={form.wohnung.heizung_in_miete_enthalten} onChange={(e) => setForm({ ...form, wohnung: { ...form.wohnung, heizung_in_miete_enthalten: e.target.value } })}>
                      <option value="">—</option>
                      <option value="ja">Ja (Pauschalmiete)</option>
                      <option value="nein">Nein</option>
                    </select>
                    <span style={styles.editLabel}>Warmwasser</span>
                    <select style={styles.input} value={form.wohnung.warmwasser} onChange={(e) => setForm({ ...form, wohnung: { ...form.wohnung, warmwasser: e.target.value } })}>
                      <option value="">—</option>
                      {Object.entries(WARMWASSER_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <span style={styles.editLabel}>Wohnfläche (m²)</span>
                    <input type="number" style={styles.input} value={form.wohnung.wohnflaeche_qm} onChange={(e) => setForm({ ...form, wohnung: { ...form.wohnung, wohnflaeche_qm: e.target.value } })} />
                    <span style={styles.editLabel}>Personen in der Wohnung</span>
                    <input type="number" style={styles.input} value={form.wohnung.bewohner_anzahl} onChange={(e) => setForm({ ...form, wohnung: { ...form.wohnung, bewohner_anzahl: e.target.value } })} />
                  </div>
                ) : (
                  <FeldGrid felder={[
                    { label: 'Adresse', value: adresse || '—', dot: vfsDot('wohnung.strasse') || vfsDot('wohnung.hausnummer'), mark: vfsFreigabe('wohnung.strasse') || vfsFreigabe('wohnung.hausnummer') },
                    { label: 'PLZ / Ort', value: ortZeile || '—', dot: vfsDot('wohnung.plz') || vfsDot('wohnung.ort'), mark: vfsFreigabe('wohnung.plz') || vfsFreigabe('wohnung.ort') },
                    { label: 'Kaltmiete', value: eur(w.kaltmiete), dot: vfsDot('wohnung.kaltmiete'), mark: vfsFreigabe('wohnung.kaltmiete') },
                    { label: 'Kalte Nebenkosten', value: eur(w.nebenkosten_kalt), dot: vfsDot('wohnung.nebenkosten_kalt'), mark: vfsFreigabe('wohnung.nebenkosten_kalt') },
                    { label: 'Heizkosten', value: eur(w.heizkosten), dot: vfsDot('wohnung.heizkosten'), mark: vfsFreigabe('wohnung.heizkosten') },
                    { label: 'Wohnkosten gesamt (laut Angaben)', value: wohnkostenSumme != null ? eur(wohnkostenSumme) : '—' },
                    { label: 'Heizung in der Miete enthalten', value: w.heizung_in_miete_enthalten === true ? 'Ja (Pauschalmiete)' : jaNein(w.heizung_in_miete_enthalten), dot: vfsDot('wohnung.heizung_in_miete_enthalten'), mark: vfsFreigabe('wohnung.heizung_in_miete_enthalten') },
                    { label: 'Warmwasser', value: w.warmwasser ? WARMWASSER_LABEL[w.warmwasser] : '—', dot: vfsDot('wohnung.warmwasser'), mark: vfsFreigabe('wohnung.warmwasser') },
                    { label: 'Wohnfläche', value: w.wohnflaeche_qm != null ? `${w.wohnflaeche_qm} m²` : '—', dot: vfsDot('wohnung.wohnflaeche_qm'), mark: vfsFreigabe('wohnung.wohnflaeche_qm') },
                    { label: 'Personen in der Wohnung', value: w.bewohner_anzahl != null ? String(w.bewohner_anzahl) : '—', dot: vfsDot('wohnung.bewohner_anzahl'), mark: vfsFreigabe('wohnung.bewohner_anzahl') },
                  ]} />
                )}
              </SektionCard>

              <SektionCard
                title="Vorrang & Verfahren"
                ungeprueft={!vorgang.geprueftAm} offenCount={countVorrang} onOffenClick={zeigeOffene}
                collapsible
                unbestaetigt={unbestVerfahren}
                notizCount={notizCount('sektion:verfahren')}
                onNotizClick={() => setNotizPanel({ anker: 'sektion:verfahren', label: 'Vorrang & Verfahren' })}
                action={blockAction('verfahren')}
              >
                {isBlockEdit('verfahren') ? (
                  <div style={styles.editRow}>
                    <span style={styles.editLabel}>Ersteingang bei anderer Stelle am</span>
                    <input type="date" style={styles.input} value={form.ersteingang_datum} onChange={(e) => setForm({ ...form, ersteingang_datum: e.target.value })} />
                    <span style={styles.editLabel}>Erstangegangene Stelle</span>
                    <input style={styles.input} value={form.ersteingang_stelle} placeholder="z. B. Rentenversicherung, Jobcenter" onChange={(e) => setForm({ ...form, ersteingang_stelle: e.target.value })} />
                    <span style={styles.editLabel}>Wohngeld beantragt (läuft parallel)</span>
                    <select style={styles.input} value={form.wohngeld_antrag_laeuft} onChange={(e) => setForm({ ...form, wohngeld_antrag_laeuft: e.target.value })}>
                      <option value="">—</option>
                      <option value="ja">Ja</option>
                      <option value="nein">Nein</option>
                    </select>
                    <span style={styles.editLabel}>Vorheriger Leistungsbezug</span>
                    <select style={styles.input} value={form.vorbezug_leistung} onChange={(e) => setForm({ ...form, vorbezug_leistung: e.target.value })}>
                      <option value="">Keiner</option>
                      {Object.entries(VORBEZUG_LEISTUNG_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <span style={styles.editLabel}>Träger des Vorbezugs</span>
                    <input style={styles.input} value={form.vorbezug_traeger} onChange={(e) => setForm({ ...form, vorbezug_traeger: e.target.value })} />
                    <span style={styles.editLabel}>Vorbezug bis</span>
                    <input type="date" style={styles.input} value={form.vorbezug_bis} onChange={(e) => setForm({ ...form, vorbezug_bis: e.target.value })} />
                  </div>
                ) : (
                  <FeldGrid felder={[
                    { label: 'Ersteingang bei anderer Stelle', value: ersteingang.datum ? fmtDate(ersteingang.datum) : '—', dot: vfsDot('ersteingang.datum') || vfsDot('ersteingang'), mark: vfsFreigabe('ersteingang.datum') || vfsFreigabe('ersteingang') },
                    { label: 'Erstangegangene Stelle', value: ersteingang.stelle || '—', dot: vfsDot('ersteingang.stelle'), mark: vfsFreigabe('ersteingang.stelle') },
                    { label: 'Wohngeld bezogen', value: wohngeldBezogen ? 'Ja (laut Angaben)' : 'Nicht angegeben' },
                    { label: 'Wohngeld beantragt (läuft parallel)', value: jaNein(vorgang.wohngeld_antrag_laeuft), dot: vfsDot('wohngeld_antrag_laeuft'), mark: vfsFreigabe('wohngeld_antrag_laeuft') },
                    { label: 'Vorheriger Leistungsbezug', value: vorbezug.leistung ? (VORBEZUG_LEISTUNG_LABEL[vorbezug.leistung] || vorbezug.leistung) : '—', dot: vfsDot('vorbezug.leistung') || vfsDot('vorbezug'), mark: vfsFreigabe('vorbezug.leistung') || vfsFreigabe('vorbezug') },
                    { label: 'Träger des Vorbezugs', value: vorbezug.traeger || '—' },
                    { label: 'Vorbezug bis', value: vorbezug.bis ? fmtDate(vorbezug.bis) : '—' },
                  ]} />
                )}
                <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginTop: theme.spacing.md, lineHeight: 1.5 }}>
                  Hinweise auf vorrangige Leistungen erscheinen als Prüfschritte vom Typ „Info". Die Entscheidung über den Vorrang trifft die Sachbearbeitung.
                </div>
              </SektionCard>
            </>
          )}

          {mainTab === 'schreiben' && (
            <SektionCard
              title="Schreiben"
              action={canEdit && (
                <div style={{ display: 'flex', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
                  <button style={styles.btnSmall} onClick={() => setTbManage((v) => !v)}>Textbausteine verwalten</button>
                  <button style={styles.btn} onClick={generiereSchreiben} disabled={busy}>{busy ? 'Erstellt…' : 'Nachforderung erzeugen'}</button>
                </div>
              )}
            >
              {tbManage && canEdit && (
                <div style={{ ...styles.tbPanel, marginBottom: theme.spacing.lg }}>
                  <div style={styles.label}>Textbausteine verwalten</div>
                  <div style={styles.tbList}>
                    {textbausteine.length === 0
                      ? <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>Noch keine Textbausteine.</div>
                      : textbausteine.map((tb) => (
                        <div key={tb.id} style={styles.tbItem}>
                          <div style={{ flex: 1 }}>
                            <div style={styles.tbKat}>{tb.kategorie}</div>
                            <div style={styles.tbItemTitel}>{tb.titel}</div>
                            <div style={styles.tbItemText}>{tb.text}</div>
                          </div>
                          <button style={styles.iconBtn} onClick={() => deleteTextbaustein(tb)} disabled={busy} title="Löschen" aria-label="Textbaustein löschen">
                            <TrashIcon size={14} color={theme.colors.textMuted} />
                          </button>
                        </div>
                      ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
                    <input style={styles.input} placeholder="Kategorie" value={tbForm.kategorie} onChange={(e) => setTbForm({ ...tbForm, kategorie: e.target.value })} />
                    <input style={styles.input} placeholder="Titel" value={tbForm.titel} onChange={(e) => setTbForm({ ...tbForm, titel: e.target.value })} />
                  </div>
                  <textarea style={{ ...styles.input, minHeight: 60, marginTop: theme.spacing.sm, resize: 'vertical' }} placeholder="Text des Bausteins" value={tbForm.text} onChange={(e) => setTbForm({ ...tbForm, text: e.target.value })} />
                  <div style={{ marginTop: theme.spacing.sm }}>
                    <button style={styles.btnSmall} onClick={addTextbaustein} disabled={busy || !tbForm.titel.trim() || !tbForm.text.trim()}>
                      <PlusIcon size={12} /> Baustein hinzufügen
                    </button>
                  </div>
                </div>
              )}

              {schreiben.length === 0 ? (
                <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>
                  Noch keine Schreiben. Aus den offenen Anforderungen lässt sich ein Nachforderungsschreiben (§ 60 SGB I) mit Frist
                  und Hinweis auf die Folgen fehlender Mitwirkung (§ 66 SGB I) erzeugen.
                </div>
              ) : (
                schreiben.map((s) => {
                  const st = editState(s);
                  const pickerOpen = tbOpenFor === s.id;
                  const tbFiltered = textbausteine.filter((tb) => `${tb.kategorie} ${tb.titel} ${tb.text}`.toLowerCase().includes(tbQuery.trim().toLowerCase()));
                  return (
                    <div key={s.id} style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg, marginBottom: theme.spacing.md }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md, gap: theme.spacing.md, flexWrap: 'wrap' }}>
                        <span style={styles.chip}>{SCHREIBEN_ART_LABEL[s.art] || s.art}</span>
                        <div style={{ display: 'flex', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
                          <button style={styles.btnSmall} onClick={() => grundsicherungApi.exportSchreiben(s.id, 'pdf').catch((e) => setError(e.message))}>Als PDF herunterladen</button>
                          <button style={styles.btnSmall} onClick={() => grundsicherungApi.exportSchreiben(s.id, 'docx').catch((e) => setError(e.message))}>Als Word-Datei herunterladen</button>
                          <button style={styles.btnSmall} onClick={() => download(`${s.betreff || 'Schreiben'}.txt`, `${st.betreff}\n\n${st.body}`)}>Als Text-Datei</button>
                          {canEdit && <button style={styles.btnSmall} onClick={() => neuErzeugen(s)} disabled={busy}>Neu erzeugen</button>}
                          {canEdit && <button style={styles.btnSmall} onClick={() => markVersendet(s)} disabled={busy}>Als versendet markieren</button>}
                          {canEdit && <button style={styles.btn} onClick={() => saveSchreiben(s)} disabled={busy}>Speichern</button>}
                        </div>
                      </div>
                      <label style={styles.label}>Betreff</label>
                      <input style={{ ...styles.input, marginBottom: theme.spacing.md }} value={st.betreff} disabled={!canEdit} onChange={(e) => setEditField(s, 'betreff', e.target.value)} />
                      <label style={styles.label}>Frist</label>
                      <input type="date" style={{ ...styles.input, marginBottom: theme.spacing.md, maxWidth: 200 }} value={st.frist} disabled={!canEdit} onChange={(e) => setEditField(s, 'frist', e.target.value)} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.sm }}>
                        <label style={styles.label}>Text</label>
                        {canEdit && (
                          <button style={styles.btnSmall} onClick={() => { setTbOpenFor(pickerOpen ? null : s.id); setTbQuery(''); }}>
                            {pickerOpen ? 'Bausteine schließen' : 'Textbaustein einfügen'}
                          </button>
                        )}
                      </div>
                      {pickerOpen && canEdit && (
                        <div style={styles.tbPanel}>
                          <div style={styles.tbSearch}>
                            <SearchIcon size={14} color={theme.colors.textMuted} />
                            <input style={styles.tbSearchInput} placeholder="Textbaustein suchen…" value={tbQuery} autoFocus onChange={(e) => setTbQuery(e.target.value)} />
                          </div>
                          <div style={styles.tbList}>
                            {tbFiltered.length === 0
                              ? <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted, padding: theme.spacing.sm }}>Kein Baustein gefunden.</div>
                              : tbFiltered.map((tb) => (
                                <div key={tb.id} style={styles.tbItem} onClick={() => insertBaustein(s, tb)} title="In den Text einfügen">
                                  <div style={{ flex: 1 }}>
                                    <div style={styles.tbKat}>{tb.kategorie}</div>
                                    <div style={styles.tbItemTitel}>{tb.titel}</div>
                                    <div style={styles.tbItemText}>{tb.text}</div>
                                  </div>
                                  <PlusIcon size={14} color={ACCENT} />
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                      <textarea ref={(el) => { bodyRefs.current[s.id] = el; }} style={styles.textarea} value={st.body} disabled={!canEdit} onChange={(e) => setEditField(s, 'body', e.target.value)} />
                      {(s.items || []).length > 0 && (
                        <div style={styles.bezugList}>
                          <div style={styles.sideTitle}>Bezug je Anforderungspunkt</div>
                          {s.items.map((it, idx) => {
                            const person = it.personId ? personen.find((x) => x.id === it.personId) : null;
                            const personName = person ? [person.vorname, person.nachname].filter(Boolean).join(' ') : null;
                            const bezug = [it.titel, personName, it.quellDokumentId ? dokLabel(it.quellDokumentId) : null].filter(Boolean).join(' · ');
                            return (
                              <div key={idx} style={styles.bezugItem} title={bezug}>
                                {it.quellDokumentId ? (
                                  <button style={{ ...styles.iconBtn, padding: 0 }} onClick={() => jumpToDokument(it.quellDokumentId)} title="Beleg im Dokumente-Tab öffnen" aria-label="Beleg öffnen">
                                    <InfoIcon size={13} color={ACCENT} />
                                  </button>
                                ) : <InfoIcon size={13} color={theme.colors.textMuted} style={{ flexShrink: 0, marginTop: 1 }} />}
                                <span>{bezug || it.text}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </SektionCard>
          )}

          {mainTab === 'ki_verbrauch' && (
            <SektionCard title="KI-Verbrauch (Tokens)">
              <KiVerbrauchAnsicht vorgangId={vorgang.id} reloadKey={kiVerbrauchStand} />
            </SektionCard>
          )}

          {mainTab === 'protokoll' && (
            <SektionCard title={`Protokoll${protokoll.length ? ` (${protokoll.length})` : ''}`}>
              {protokoll.length === 0
                ? <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>Noch keine protokollierten Aktionen.</div>
                : protokoll.map((e) => {
                  const diffFelder = e.vorher && typeof e.vorher === 'object'
                    ? Object.keys({ ...(e.vorher || {}), ...(e.nachher || {}) })
                    : [];
                  const hatDiff = diffFelder.length > 0;
                  const offen = !!protokollOffen[e.id];
                  return (
                    <div key={e.id} style={styles.activity}>
                      <div style={styles.protoAktion}>{aktionLabel(e.aktion)}</div>
                      {e.detail && <div style={{ color: theme.colors.textSecondary }}>{e.detail}</div>}
                      <div style={styles.protoMeta}>
                        {fmtDateTime(e.timestamp)}
                        {e.akteurName ? ` · ${e.akteurName}` : ''}
                        {e.akteurRolle ? <> · <span style={styles.protoRolle}>{APP_ROLE_LABEL[e.akteurRolle] || e.akteurRolle}</span></> : ''}
                      </div>
                      {hatDiff && (
                        <button
                          style={styles.protoToggle}
                          onClick={() => setProtokollOffen((m) => ({ ...m, [e.id]: !m[e.id] }))}
                        >
                          <ChevronDownIcon size={11} style={{ transform: offen ? 'rotate(180deg)' : 'none' }} />
                          {offen ? 'Änderungen ausblenden' : 'Änderungen anzeigen'}
                        </button>
                      )}
                      {hatDiff && offen && (
                        <div style={styles.protoDiff}>
                          {diffFelder.map((feld) => (
                            <div key={feld} style={styles.protoDiffRow}>
                              <span style={styles.protoDiffFeld}>{feld}</span>
                              <span>
                                <span style={styles.protoAlt}>{fmtProtoValue(e.vorher?.[feld])}</span>
                                {' → '}
                                <span style={styles.protoNeu}>{fmtProtoValue(e.nachher?.[feld])}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </SektionCard>
          )}
        </div>

        {/* ── RECHTE SEITENLEISTE ── */}
        {sideCollapsed ? (
          <div style={{ flexShrink: 0 }}>
            <button style={styles.sideToggle} onClick={() => setSideCollapsed(false)} title="Seitenleiste einblenden">
              <PanelRightIcon size={14} /> Einblenden
            </button>
          </div>
        ) : (
        <div style={styles.side}>
          <div style={styles.sideCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.sm }}>
              <div style={{ ...styles.tabs, marginBottom: 0 }}>
                {SIDE_TABS.map((t) => (
                  <button key={t.id} style={{ ...styles.tab, ...(sideTab === t.id ? styles.tabActive : {}) }} onClick={() => setSideTab(t.id)}>{t.label}</button>
                ))}
              </div>
              <button style={styles.iconBtn} onClick={() => setSideCollapsed(true)} title="Seitenleiste ausblenden" aria-label="Seitenleiste ausblenden">
                <PanelRightIcon size={16} color={theme.colors.textMuted} />
              </button>
            </div>
            <div style={{ marginBottom: theme.spacing.lg }} />

            {sideTab === 'details' && (
              <div>
                <PanelSection title="Allgemein">
                  <div style={styles.zustaendigRow}>
                    <span style={styles.fristLabel}>Sachbearbeitung</span>
                    {canEdit ? (
                      <>
                        <select
                          style={styles.fristInput}
                          value={vorgang.sachbearbeiterId || ''}
                          disabled={busy}
                          onChange={(e) => zuweisen(e.target.value)}
                          aria-label="Sachbearbeitung zuweisen"
                        >
                          <option value="">nicht zugewiesen</option>
                          {sachbearbeitung.nutzer.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                          {vorgang.sachbearbeiterId && !sachbearbeitung.nutzer.some((n) => n.id === vorgang.sachbearbeiterId) && (
                            <option value={vorgang.sachbearbeiterId}>{vorgang.sachbearbeiter || 'unbekannt'} (ohne Berechtigung)</option>
                          )}
                        </select>
                        {sachbearbeitung.ich && vorgang.sachbearbeiterId !== sachbearbeitung.ich && sachbearbeitung.nutzer.some((n) => n.id === sachbearbeitung.ich) && (
                          <button style={styles.btnSmall} onClick={() => zuweisen(sachbearbeitung.ich)} disabled={busy}>Übernehmen</button>
                        )}
                      </>
                    ) : (
                      <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text }}>{vorgang.sachbearbeiter || 'nicht zugewiesen'}</span>
                    )}
                  </div>
                  <KvRows rows={[
                    { label: 'Priorität', value: PRIORITAET_LABEL[vorgang.prioritaet] || vorgang.prioritaet },
                    { label: 'Letzte Änderung', value: fmtDateTime(vorgang.updated_at) },
                  ]} />

                  <div style={styles.sideTitle}>Fristen</div>
                  {canEdit ? (
                    <>
                      <div style={styles.fristRow}>
                        <ClockIcon size={14} color={fristUeberfaellig ? theme.colors.error : theme.colors.textMuted} />
                        <span style={styles.fristLabel}>Frist</span>
                        <input type="date" style={styles.fristInput} value={vorgang.frist ? vorgang.frist.slice(0, 10) : ''} disabled={busy} onChange={(e) => setFristFeld('frist', e.target.value)} />
                        {fristUeberfaellig && <span style={styles.ueberfaelligBadge}>überfällig</span>}
                      </div>
                      <div style={styles.fristRow}>
                        <ClockIcon size={14} color={wvUeberfaellig ? theme.colors.error : theme.colors.textMuted} />
                        <span style={styles.fristLabel}>Wiedervorlage</span>
                        <input type="date" style={styles.fristInput} value={vorgang.wiedervorlage ? vorgang.wiedervorlage.slice(0, 10) : ''} disabled={busy} onChange={(e) => setFristFeld('wiedervorlage', e.target.value)} />
                        {wvUeberfaellig && <span style={styles.ueberfaelligBadge}>überfällig</span>}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: theme.colors.textMuted, marginTop: 2 }}>
                        Beim Setzen der Frist wird die Wiedervorlage automatisch auf Frist + 3 Tage vorbelegt (nur solange sie leer ist).
                      </div>
                    </>
                  ) : (vorgang.frist || vorgang.wiedervorlage) ? (
                    <>
                      {vorgang.frist && (
                        <div style={styles.fristRow}>
                          <ClockIcon size={14} color={fristUeberfaellig ? theme.colors.error : theme.colors.textMuted} />
                          <span style={styles.fristLabel}>Frist</span>
                          <span style={fristUeberfaellig ? { color: theme.colors.error, fontWeight: theme.typography.weights.semibold } : {}}>{fmtDate(vorgang.frist)}</span>
                          {fristUeberfaellig && <span style={styles.ueberfaelligBadge}>überfällig</span>}
                        </div>
                      )}
                      {vorgang.wiedervorlage && (
                        <div style={styles.fristRow}>
                          <ClockIcon size={14} color={wvUeberfaellig ? theme.colors.error : theme.colors.textMuted} />
                          <span style={styles.fristLabel}>Wiedervorlage</span>
                          <span style={wvUeberfaellig ? { color: theme.colors.error, fontWeight: theme.typography.weights.semibold } : {}}>{fmtDate(vorgang.wiedervorlage)}</span>
                          {wvUeberfaellig && <span style={styles.ueberfaelligBadge}>überfällig</span>}
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>Keine Fristen gesetzt.</div>
                  )}
                </PanelSection>

                {/* Aufbewahrung, Legal Hold & Verarbeitungs-Einschränkung */}
                <PanelSection title="Aufbewahrung & Schutz">
                  {vorgang.abschluss?.ergebnis && (
                    <div style={{ ...styles.govRow, borderBottom: `1px solid ${theme.colors.borderLight}` }}>
                      <span style={styles.govLabel}>Abschluss</span>
                      <span style={styles.govValue} title={vorgang.abschluss.bemerkung || undefined}>
                        {ABSCHLUSS_ERGEBNIS_LABEL[vorgang.abschluss.ergebnis] || vorgang.abschluss.ergebnis}
                        {vorgang.abschluss.am ? ` · ${fmtDate(vorgang.abschluss.am)}` : ''}
                      </span>
                    </div>
                  )}
                  <div style={{ ...styles.govRow, borderBottom: `1px solid ${theme.colors.borderLight}` }}>
                    <span style={styles.govLabel}>Aufbewahrung bis</span>
                    {aufbewahrungEdit !== null ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: theme.spacing.sm }}>
                        <input type="date" style={styles.fristInput} value={aufbewahrungEdit} onChange={(e) => setAufbewahrungEdit(e.target.value)} aria-label="Aufbewahrung bis" />
                        <button style={styles.btnSmall} onClick={() => speichereAufbewahrung(aufbewahrungEdit)} disabled={busy}>Speichern</button>
                        <button style={styles.btnSmall} onClick={() => setAufbewahrungEdit(null)} disabled={busy}>Abbrechen</button>
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: theme.spacing.sm }}>
                        <span style={styles.govValue}>{vorgang.aufbewahrungBis ? fmtDate(vorgang.aufbewahrungBis) : 'Bei Abschluss'}</span>
                        {isOwner && (
                          <button style={styles.btnSmall} onClick={() => setAufbewahrungEdit(vorgang.aufbewahrungBis ? vorgang.aufbewahrungBis.slice(0, 10) : '')} disabled={busy}>
                            Ändern
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                  <div style={{ ...styles.govRow, borderBottom: `1px solid ${theme.colors.borderLight}` }}>
                    <span style={styles.govLabel}>Legal Hold</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: theme.spacing.sm }}>
                      <span style={styles.govValue}>{vorgang.legalHold ? 'Aktiv (Löschsperre)' : 'Nein'}</span>
                      {isOwner && (
                        <button style={styles.btnSmall} onClick={toggleLegalHold} disabled={busy}>
                          {vorgang.legalHold ? 'Aufheben' : 'Setzen'}
                        </button>
                      )}
                    </span>
                  </div>
                  <div style={styles.govRow}>
                    <span style={styles.govLabel}>Verarbeitung (Art. 18)</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: theme.spacing.sm }}>
                      <span style={{ ...styles.govValue, ...(eingeschraenkt ? { color: theme.colors.warning } : {}) }}>
                        {eingeschraenkt ? 'Eingeschränkt' : 'Normal'}
                      </span>
                      {eingeschraenkt
                        ? (isOwner && <button style={styles.btnSmall} onClick={toggleEinschraenkung} disabled={busy}>Aufheben</button>)
                        : (canEditRole && <button style={styles.btnSmall} onClick={toggleEinschraenkung} disabled={busy}>Einschränken</button>)}
                    </span>
                  </div>
                </PanelSection>

                <PanelSection title="Todos" count={todosOffen > 0 ? todosOffen : undefined}>
                  {todos.length === 0 && <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>Keine Todos.</div>}
                  {todos.map((t) => (
                    <div key={t.id} style={styles.todoItem}>
                      <button
                        style={{ ...styles.todoCheck, ...(t.erledigt ? { backgroundColor: ACCENT, borderColor: ACCENT } : {}), ...(canEdit ? {} : { cursor: 'default' }) }}
                        onClick={() => canEdit && toggleTodo(t)}
                        disabled={busy || !canEdit}
                        title={t.erledigt ? 'Als offen markieren' : 'Als erledigt markieren'}
                        aria-label={t.erledigt ? 'Todo als offen markieren' : 'Todo als erledigt markieren'}
                      >
                        {t.erledigt && <CheckIcon size={12} color="#fff" />}
                      </button>
                      <span style={{ ...styles.todoText, ...(t.erledigt ? { textDecoration: 'line-through', color: theme.colors.textMuted } : {}) }}>{t.text}</span>
                      {canEdit && (
                        <button style={styles.iconBtn} onClick={() => deleteTodo(t)} disabled={busy} title="Todo löschen" aria-label="Todo löschen">
                          <TrashIcon size={13} color={theme.colors.textMuted} />
                        </button>
                      )}
                    </div>
                  ))}
                  {canEdit && (
                    <div style={styles.miniRow}>
                      <input style={styles.input} placeholder="Neues Todo" value={neuerTodo} onChange={(e) => setNeuerTodo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addTodo(); }} />
                      <button style={styles.btnSmall} onClick={addTodo} disabled={busy || !neuerTodo.trim()}>+ Todo</button>
                    </div>
                  )}
                </PanelSection>

                <PanelSection title="Labels" count={labels.length > 0 ? labels.length : undefined}>
                  {labels.length === 0
                    ? <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>Keine Labels.</div>
                    : <div style={{ display: 'flex', gap: theme.spacing.xs, flexWrap: 'wrap' }}>
                        {labels.map((l) => (
                          <span key={l} style={styles.labelChip}>
                            {l}
                            {canEdit && (
                              <button style={styles.labelRemove} onClick={() => removeLabel(l)} disabled={busy} title="Label entfernen" aria-label={`Label ${l} entfernen`}>
                                <XIcon size={11} />
                              </button>
                            )}
                          </span>
                        ))}
                      </div>}
                  {canEdit && (
                    <div style={styles.miniRow}>
                      <input style={styles.input} placeholder="Neues Label" value={neuesLabel} onChange={(e) => setNeuesLabel(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addLabel(); }} />
                      <button style={styles.btnSmall} onClick={addLabel} disabled={busy || !neuesLabel.trim()}>+ Label</button>
                    </div>
                  )}
                </PanelSection>

                <PanelSection title="KI-Nutzung">
                  <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginBottom: theme.spacing.sm, lineHeight: 1.5 }}>
                    KI wird nur assistierend eingesetzt (Erkennen und Auslesen von Unterlagen). Die Entscheidung trifft ein Mensch.
                  </div>
                  <KiVerbrauchZeile vorgangId={vorgang.id} reloadKey={kiVerbrauchStand} onDetails={() => setMainTab('ki_verbrauch')} />
                </PanelSection>
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
                  {canEdit && <button style={styles.btnSmall} onClick={pruefen} disabled={busy}>{busy ? 'Prüft…' : (vorgang.geprueftAm ? 'Neu prüfen' : 'Jetzt prüfen')}</button>}
                </div>
                {vorgang.geprueftAm ? (
                  <div style={styles.pruefStand}>Zuletzt geprüft: {fmtDateTime(vorgang.geprueftAm)} · wird nach jeder Änderung automatisch aktualisiert</div>
                ) : (
                  <div style={styles.pruefHinweis}>
                    Für diesen Vorgang wurde noch keine Prüfung ausgeführt. Ohne Prüfung ist nicht bekannt, ob Unterlagen oder Angaben fehlen.
                  </div>
                )}

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
                    <PanelSection key={g.key} title={g.label} count={g.items.length}>
                      {g.items.map((p) => (
                        <PruefschrittItem key={p.id} pruefschritt={p} canEdit={canEdit} busy={busy} onStatus={(s) => setPruefStatus(p, s)} onOpenDokument={jumpToDokument} dokumentLabel={dokLabel(p.quellDokumentId)} />
                      ))}
                    </PanelSection>
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
                {canEdit && (
                  <div style={{ marginBottom: theme.spacing.md }}>
                    <button style={{ ...styles.btnSmall, display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs }} onClick={() => dokUploadRef.current?.click()} disabled={busy}>
                      <UploadIcon size={14} /> {busy ? 'Lädt…' : 'Dokument hochladen'}
                    </button>
                    <input
                      ref={dokUploadRef} type="file" multiple accept="application/pdf,image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => { uploadDokumente(e.target.files); e.target.value = ''; }}
                    />
                  </div>
                )}
                {(() => {
                  const hatDatei = (d) => !!(d.s3Key || d.pfad);
                  const nachweise = dokumente.filter((d) => !d.istOriginal);
                  const originale = dokumente.filter((d) => d.istOriginal);
                  // Gruppierung nach Eingangsdatum (neueste zuerst); ohne Datum ans Ende.
                  const groupByDatum = (list) => {
                    const sorted = [...list].sort((a, b) => {
                      const av = a.eingegangenAm || a.created_at || '';
                      const bv = b.eingegangenAm || b.created_at || '';
                      return av < bv ? 1 : av > bv ? -1 : 0;
                    });
                    const map = new Map();
                    for (const d of sorted) {
                      const key = d.eingegangenAm ? fmtDate(d.eingegangenAm) : 'Ohne Eingangsdatum';
                      if (!map.has(key)) map.set(key, []);
                      map.get(key).push(d);
                    }
                    return [...map.entries()];
                  };
                  const renderDoc = (d) => (
                    <div
                      key={d.id}
                      ref={(el) => { docRefs.current[d.id] = el; }}
                      style={{
                        ...styles.docItem,
                        ...(highlightDocId === d.id
                          ? { backgroundColor: ACCENT_LIGHT, transition: `background-color ${theme.transitions.fast}` }
                          : { transition: `background-color ${theme.transitions.fast}` }),
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.sm }}>
                        <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.text }}>
                          {DOKUMENT_TYP_LABEL[d.typ] || d.typ}
                        </div>
                        <span style={{ ...styles.ablageBadge, ...(d.abgelegt ? { backgroundColor: theme.colors.successLight, color: theme.colors.success } : { backgroundColor: theme.colors.surfaceHover, color: theme.colors.textMuted }) }}>
                          {d.abgelegt ? 'abgelegt' : 'nicht abgelegt'}
                        </span>
                      </div>
                      {d.titel && <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>{d.titel}</div>}
                      {(canEdit || d.personId) && !d.istOriginal && (() => {
                        const person = personen.find((p) => p.id === d.personId);
                        const label = (p) => `${p.vorname || ''} ${p.nachname || ''}`.trim() || 'Person ohne Namen';
                        return (
                          <div style={styles.docPersonRow}>
                            <span style={{ fontSize: '0.7rem', color: theme.colors.textMuted }}>Person:</span>
                            {canEdit ? (
                              <select
                                style={styles.docPersonSelect}
                                value={d.personId || ''}
                                onChange={(e) => zuordnenPerson(d, e.target.value)}
                                disabled={busy}
                                aria-label="Person zuordnen"
                                title="Nachweis einer Person zuordnen"
                              >
                                <option value="">Fallübergreifend (keine Person)</option>
                                {personen.map((p) => <option key={p.id} value={p.id}>{label(p)}</option>)}
                              </select>
                            ) : (
                              <span style={{ fontSize: '0.7rem', color: theme.colors.text }}>{person ? label(person) : 'Fallübergreifend'}</span>
                            )}
                          </div>
                        );
                      })()}
                      <div style={{ fontSize: '0.7rem', color: theme.colors.textMuted, marginTop: 2 }}>
                        {[d.quelle, d.seiten ? `${d.seiten} S.` : null].filter(Boolean).join(' · ')}
                      </div>
                      {(d.flags || []).length > 0 && (
                        <div style={{ display: 'flex', gap: theme.spacing.xs, flexWrap: 'wrap', marginTop: theme.spacing.xs }}>
                          {d.flags.map((f) => (
                            <span key={f.code} style={{ ...styles.chip, backgroundColor: theme.colors.warningLight, color: theme.colors.warning }} title={f.hinweis}>{f.hinweis || f.code}</span>
                          ))}
                        </div>
                      )}
                      <div style={styles.docActions}>
                        {hatDatei(d) ? (
                          <>
                            <button style={styles.iconAction} onClick={() => openPreview(d)} title="Vorschau" aria-label="Vorschau"><EyeIcon size={15} /></button>
                            <button style={styles.iconAction} onClick={() => downloadDoc(d)} title="Herunterladen" aria-label="Herunterladen"><DownloadIcon size={15} /></button>
                          </>
                        ) : (
                          <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>Keine Datei hinterlegt</span>
                        )}
                        {canEdit && !d.abgelegt && (
                          <button style={styles.iconAction} onClick={() => ablegen(d)} disabled={busy} title="Ins Fachverfahren ablegen" aria-label="Ins Fachverfahren ablegen"><ArchiveIcon size={15} /></button>
                        )}
                        {canEdit && (
                          <button style={styles.iconActionDanger} onClick={() => setDocToDelete(d)} disabled={busy} title="Dokument löschen" aria-label="Dokument löschen"><TrashIcon size={15} /></button>
                        )}
                      </div>
                      {(() => {
                        const hatWerte = (d.extraktion?.felder?.length || 0) > 0 || !!d.analyse;
                        if (!hatWerte) return null;
                        const offen = extraktionOffen.has(d.id);
                        return (
                          <div style={{ marginTop: theme.spacing.xs }}>
                            <button
                              style={{ ...styles.docLinkBtn, display: 'inline-flex', alignItems: 'center', gap: 3 }}
                              onClick={() => toggleExtraktion(d.id)}
                              aria-expanded={offen}
                            >
                              <ChevronDownIcon size={12} style={{ transform: offen ? 'rotate(180deg)' : 'none', transition: `transform ${theme.transitions.fast}` }} />
                              {offen ? 'Extrahierte Werte ausblenden' : 'Extrahierte Werte anzeigen'}
                            </button>
                            {offen && (
                              <div style={{ marginTop: theme.spacing.sm }}>
                                <ExtraktionsBaum
                                  {...EXTRAKTION_BAUM_PROPS}
                                  extraktion={d.extraktion}
                                  analyseFallback={d.analyse}
                                  hinweise={pruefschritte.filter((p) => p.quellDokumentId === d.id)}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                  const renderGruppiert = (list, leerText) => {
                    if (list.length === 0) return <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>{leerText}</div>;
                    return groupByDatum(list).map(([datum, docs]) => (
                      <div key={datum}>
                        <div style={styles.docGroupTitle}>{datum}</div>
                        {docs.map(renderDoc)}
                      </div>
                    ));
                  };
                  if (dokumente.length === 0) return <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>Noch keine Dokumente.</div>;
                  return (
                    <>
                      <PanelSection title="Nachweise" count={nachweise.length}>
                        {renderGruppiert(nachweise, 'Keine klassifizierten Nachweise.')}
                      </PanelSection>
                      <PanelSection
                        title="Originaldateien"
                        count={originale.length}
                        action={originale.filter(hatDatei).length > 0
                          ? <button style={styles.docLinkBtn} onClick={() => downloadAlleOriginale(originale.filter(hatDatei))} title="Jede Originaldatei einzeln herunterladen">Alle herunterladen</button>
                          : null}
                      >
                        {renderGruppiert(originale, 'Keine Originaldateien.')}
                      </PanelSection>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {abschlussDialog && (() => {
        const vierAugen = !!detail.vierAugen;
        const finaleGesperrt = vierAugen && role !== 'owner';
        const gesperrt = !abschlussDialog.ergebnis || (finaleGesperrt && FINALE_ERGEBNISSE.includes(abschlussDialog.ergebnis));
        return (
          <div style={styles.previewOverlay} onClick={() => { if (!busy) setAbschlussDialog(null); }}>
            <div style={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
              <div style={styles.confirmTitle}>Vorgang abschließen</div>
              <p style={styles.confirmText}>
                Der Abschluss ist ein Vermerk in dieser Anwendung — den Bescheid erstellt das Fachverfahren.
                Mit dem Abschluss wird die Aufbewahrungsfrist gesetzt.
              </p>
              <label style={styles.modalLabel}>Ergebnis</label>
              <select
                style={styles.input}
                value={abschlussDialog.ergebnis}
                onChange={(e) => setAbschlussDialog({ ...abschlussDialog, ergebnis: e.target.value })}
              >
                <option value="">— bitte wählen —</option>
                {Object.entries(ABSCHLUSS_ERGEBNIS_LABEL).map(([v, l]) => (
                  <option key={v} value={v} disabled={finaleGesperrt && FINALE_ERGEBNISSE.includes(v)}>{l}</option>
                ))}
              </select>
              {finaleGesperrt && (
                <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginTop: theme.spacing.xs }}>
                  Finale Ergebnisse nur durch Freigabeberechtigte (Vier-Augen-Prinzip). Sie können vorbereiten und eine Bemerkung setzen.
                </div>
              )}
              <label style={styles.modalLabel}>Bemerkung</label>
              <textarea
                style={{ ...styles.input, minHeight: 90, resize: 'vertical', marginBottom: theme.spacing.lg }}
                placeholder="Interne Begründung / Hinweise zum Abschluss"
                value={abschlussDialog.bemerkung}
                onChange={(e) => setAbschlussDialog({ ...abschlussDialog, bemerkung: e.target.value })}
              />
              <div style={styles.confirmActions}>
                <button style={styles.btnGhost} onClick={() => setAbschlussDialog(null)} disabled={busy}>Abbrechen</button>
                <button
                  style={styles.btn}
                  onClick={() => speichereStatus({ status: 'abgeschlossen', abschluss: { ergebnis: abschlussDialog.ergebnis, bemerkung: abschlussDialog.bemerkung } })}
                  disabled={busy || gesperrt}
                >
                  {busy ? 'Speichert…' : 'Abschließen'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {notizPanel && (
        <NotizPanel
          label={notizPanel.label}
          notizen={notizen.filter((n) => n.anker === notizPanel.anker)}
          canEdit={canEdit}
          busy={busy}
          onAdd={(text) => addNotiz(notizPanel.anker, text)}
          onDelete={deleteNotiz}
          onClose={() => setNotizPanel(null)}
        />
      )}

      {docToDelete && (
        <div style={styles.previewOverlay} onClick={() => { if (!busy) setDocToDelete(null); }}>
          <div style={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.confirmTitle}>Dokument löschen?</div>
            <p style={styles.confirmText}>
              „{DOKUMENT_TYP_LABEL[docToDelete.typ] || docToDelete.typ}{docToDelete.quelle ? ` · ${docToDelete.quelle}` : ''}" wird aus dem Vorgang entfernt.
              Die Prüfung wird anschließend neu ausgeführt. Dieser Schritt kann nicht rückgängig gemacht werden.
            </p>
            <div style={styles.confirmActions}>
              <button style={styles.btnGhost} onClick={() => setDocToDelete(null)} disabled={busy}>Abbrechen</button>
              <button style={styles.btnDanger} onClick={confirmDeleteDoc} disabled={busy}>{busy ? 'Löscht…' : 'Löschen'}</button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div style={styles.previewOverlay} onClick={closePreview}>
          <div style={styles.previewBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.previewHead}>
              <span style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text }}>{preview.name}</span>
              <div style={{ display: 'flex', gap: theme.spacing.sm, alignItems: 'center' }}>
                <button style={styles.btnSmall} onClick={() => window.open(grundsicherungApi.dokumentDateiUrl(preview.dok.id), '_blank', 'noopener')}>In neuem Tab öffnen</button>
                <button style={styles.iconBtn} onClick={closePreview} title="Schließen" aria-label="Vorschau schließen">
                  <XIcon size={16} color={theme.colors.textMuted} />
                </button>
              </div>
            </div>
            <div style={styles.previewBody}>
              <div style={styles.previewViewer}>
                <SeitenVorschau
                  schluessel={preview.dok.id}
                  titel={preview.name}
                  ladeInfo={() => grundsicherungApi.dokumentVorschau(preview.dok.id)}
                  seiteUrl={(n) => grundsicherungApi.dokumentSeiteUrl(preview.dok.id, n)}
                  hoehe="calc(90vh - 90px)"
                />
              </div>
              {preview.dok && ((preview.dok.extraktion?.felder?.length || 0) > 0 || !!preview.dok.analyse) && (
                <div style={styles.previewPanel}>
                  <div style={styles.previewPanelTitle}>Aus dem Dokument extrahiert</div>
                  <ExtraktionsBaum
                    {...EXTRAKTION_BAUM_PROPS}
                    extraktion={preview.dok.extraktion}
                    analyseFallback={preview.dok.analyse}
                    hinweise={pruefschritte.filter((p) => p.quellDokumentId === preview.dok.id)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
