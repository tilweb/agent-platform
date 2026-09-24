import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { theme } from '../../config/theme';
import { ArrowLeftIcon, UploadIcon, ChatIcon, CopyIcon, PanelRightIcon, ChevronDownIcon, InfoIcon, PlusIcon, TrashIcon, SearchIcon, CheckIcon, XIcon, ClockIcon, EyeIcon, DownloadIcon, ArchiveIcon } from '../../components/Icons';
import { useAppPermission } from '../../components/RequireAppPermission';
import {
  wohngeldApi,
  WOHNGELDART_LABEL, ANTRAGSART_LABEL, STATUS_LABEL, STATUS_ORDER,
  PRIORITAET_LABEL, ROLLE_LABEL, DOKUMENT_TYP_LABEL, SCHREIBEN_ART_LABEL,
  VERFUEGUNG_ENTSCHEIDUNG_LABEL, APP_ROLE_LABEL, aktionLabel, kiZweckLabel,
  ACCENT, ACCENT_LIGHT,
} from './api';
import StatusBadge from './components/StatusBadge';
import SektionCard, { FeldGrid } from './components/SektionCard';
import PersonCard from './components/PersonCard';
import PruefschrittItem from './components/PruefschrittItem';
import PanelSection from './components/PanelSection';
import FallChat from './components/FallChat';
import { FeldStatusDot, FeldStatusFreigabe } from './components/FeldStatusMark';
import { buildFeldStatusMap, fsKey } from './feldStatusMap';
import NotizPanel from './components/NotizPanel';
import ExtraktionsBaum from './components/ExtraktionsBaum';

const MAIN_TABS = [
  { id: 'uebersicht', label: 'Übersicht' },
  { id: 'schreiben', label: 'Schreiben' },
  { id: 'plausibilitaet', label: 'Plausibilitätsprüfung' },
  { id: 'prognose', label: 'Einkommensprognose' },
  { id: 'verfuegung', label: 'Verfügung' },
  { id: 'protokoll', label: 'Protokoll' },
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
// Anzeige der angenommenen §16-Abzugskategorien.
const ABZUG_KAT_LABEL = { kvPv: 'KV/PV', steuern: 'Steuern', rv: 'RV' };
function abzugKatText(kat) {
  const on = Object.entries(ABZUG_KAT_LABEL).filter(([k]) => kat?.[k]).map(([, l]) => l);
  return on.length ? on.join(' + ') : 'keine';
}

const styles = {
  page: { width: '100%' },
  chatFab: { position: 'fixed', bottom: theme.spacing.xl, right: theme.spacing.xl, display: 'inline-flex', alignItems: 'center', gap: theme.spacing.sm, padding: `${theme.spacing.md} ${theme.spacing.lg}`, backgroundColor: ACCENT, color: '#fff', border: 'none', borderRadius: theme.borderRadius.full, fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, cursor: 'pointer', boxShadow: '0 8px 20px rgba(0, 0, 0, 0.18)', zIndex: 1100 },
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
  ekResult: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: theme.spacing.md, padding: `${theme.spacing.md} 0`, borderTop: `1px solid ${theme.colors.border}`, marginTop: theme.spacing.md, flexWrap: 'wrap' },
  ekResultLabel: { fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text },
  ekResultValue: { fontSize: theme.typography.sizes.lg, fontWeight: theme.typography.weights.bold, color: theme.colors.text },
  ekResultSub: { fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted, fontWeight: theme.typography.weights.normal },
  ekHint: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginTop: theme.spacing.xs },
  ekToggle: { display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs, fontSize: theme.typography.sizes.xs, color: ACCENT, background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginTop: theme.spacing.sm },
  ekHerleitung: { fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary, backgroundColor: theme.colors.surfaceHover, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginTop: theme.spacing.sm, lineHeight: 1.7 },
  ekRow: { display: 'flex', justifyContent: 'space-between', gap: theme.spacing.md },
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
  verfRow: { display: 'grid', gridTemplateColumns: 'minmax(140px, 220px) 1fr', rowGap: theme.spacing.md, columnGap: theme.spacing.lg, alignItems: 'start', marginBottom: theme.spacing.lg },
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
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAppPermission();
  const canEditRole = role === 'owner' || role === 'editor';
  const isOwner = role === 'owner';

  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [mainTab, setMainTab] = useState('uebersicht');
  const [sideTab, setSideTab] = useState('details');
  const [chatOpen, setChatOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const dokUploadRef = useRef(null);

  // Dateivorschau (WP10): { url, contentType, name, dok } — objectURL wird beim Wechsel/Unmount freigegeben
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  // Dokument-Löschung mit Sicherheits-Modal: das zu löschende Dokument (oder null).
  const [docToDelete, setDocToDelete] = useState(null);
  // Extraktions-Transparenz: aufgeklappte Dokument-Kacheln (Set von Dokument-IDs)
  const [extraktionOffen, setExtraktionOffen] = useState(() => new Set());

  // Verfügung (WP11): lokaler Formzustand, initial aus vorgang.verfuegung
  const [verfForm, setVerfForm] = useState(null);

  // § 13-Einkommen (read-only)
  const [einkommen, setEinkommen] = useState(null);
  const [herleitungOffen, setHerleitungOffen] = useState({}); // personId -> bool

  // UX: Antrags-ID kopieren, Seitenleiste ein-/ausklappen, Dokument-Sprung
  const [copied, setCopied] = useState(false);
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const [highlightDocId, setHighlightDocId] = useState(null);
  const docRefs = useRef({});

  // Übersicht-Bearbeitung pro Block (U1): Set von Block-Keys ('allgemein'|'wohnung'|'bwz')
  const [editBlocks, setEditBlocks] = useState(() => new Set());
  const [form, setForm] = useState(null);

  // Prüfschritte
  const [pruefFilter, setPruefFilter] = useState('alle');
  const [neueAnforderung, setNeueAnforderung] = useState('');

  // Schreiben-Editor (id -> {betreff, frist, body, version})
  const [schreibenEdit, setSchreibenEdit] = useState({});
  // Textbausteine (WP6): globale Snippet-Liste + Picker/Verwaltung
  const [textbausteine, setTextbausteine] = useState([]);
  const [tbOpenFor, setTbOpenFor] = useState(null); // schreiben-id, für das der Picker offen ist
  const [tbQuery, setTbQuery] = useState('');
  const [tbManage, setTbManage] = useState(false);
  const [tbForm, setTbForm] = useState({ kategorie: 'Allgemein', titel: '', text: '' });
  const bodyRefs = useRef({});

  // Notizen-Panel (WP4): { anker, label } oder null
  const [notizPanel, setNotizPanel] = useState(null);

  // Todos & Labels (WP8)
  const [neuerTodo, setNeuerTodo] = useState('');
  const [neuesLabel, setNeuesLabel] = useState('');

  // Fall-Protokoll (GOV-1): welche Einträge ihren Vorher/Nachher-Diff aufgeklappt zeigen
  const [protokollOffen, setProtokollOffen] = useState({});
  // KI-Nutzung je Vorgang (GOV-3): Transparenz über eingesetzte KI-Assistenz
  const [kiNutzung, setKiNutzung] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await wohngeldApi.getVorgangDetail(id);
        if (!cancelled) setDetail(d);
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
      try {
        const ek = await wohngeldApi.getEinkommen(id);
        if (!cancelled) setEinkommen(ek);
      } catch { /* Einkommen optional — Übersicht funktioniert auch ohne */ }
      try {
        const tb = await wohngeldApi.listTextbausteine();
        if (!cancelled) setTextbausteine(tb);
      } catch { /* Textbausteine optional */ }
      try {
        const ki = await wohngeldApi.getKiNutzung(id);
        if (!cancelled) setKiNutzung(ki);
      } catch { /* KI-Nutzung optional — Übersicht funktioniert auch ohne */ }
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

  async function reload() {
    try { setDetail(await wohngeldApi.getVorgangDetail(id)); }
    catch (e) { setError(e.message); }
    try { setEinkommen(await wohngeldApi.getEinkommen(id)); }
    catch { /* ignore */ }
  }

  // ── Dateivorschau / Download / Ablage (WP10) ──
  async function openPreview(d) {
    setPreviewLoading(true); setError('');
    try {
      const { url, contentType } = await wohngeldApi.loadDokumentDatei(d.id);
      setPreview({ url, contentType, name: DOKUMENT_TYP_LABEL[d.typ] || d.typ, dok: d });
    } catch (e) {
      setError(e.message || 'Vorschau nicht verfügbar');
    } finally {
      setPreviewLoading(false);
    }
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
    try { await wohngeldApi.downloadDokumentDatei(d.id, d.quelle || `${DOKUMENT_TYP_LABEL[d.typ] || 'dokument'}`); }
    catch (e) { setError(e.message); }
  }
  async function downloadAlleOriginale(originale) {
    // Vereinfachung: sequentieller Einzel-Download je Datei (kein ZIP — keine neue Dependency).
    setError('');
    for (const d of originale) {
      try { await wohngeldApi.downloadDokumentDatei(d.id, d.quelle || `original-${d.id}`); }
      catch { /* best-effort: einzelne Fehler überspringen */ }
    }
  }
  async function ablegen(d) {
    setBusy(true); setError('');
    try { await wohngeldApi.ablegenDokument(d.id); await reload(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  // Nachweis einer Person zuordnen (oder dem Haushalt): speichern → neu prüfen → neu laden.
  // Der Hinweis „Person nicht eindeutig zuordenbar" entfällt mit der Entscheidung.
  async function zuordnenPerson(d, personId) {
    setBusy(true); setError('');
    try {
      await wohngeldApi.updateDokument(d.id, {
        personId: personId || null,
        flags: (d.flags || []).filter((f) => f.code !== 'person-unklar'),
        expectedVersion: d.version,
      });
      try { await wohngeldApi.pruefen(id); } catch { /* Prüfung best-effort */ }
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
      await wohngeldApi.deleteDokument(docToDelete.id);
      // Nachweis entfernt → Prüfung neu ausführen, damit offene Anforderungen wieder erscheinen.
      try { await wohngeldApi.pruefen(id); } catch { /* Prüfung best-effort */ }
      setDocToDelete(null);
      await reload();
    } catch (e) {
      setError(e.message || 'Dokument konnte nicht gelöscht werden');
    } finally {
      setBusy(false);
    }
  }

  // ── Verfügung (WP11) ──
  async function saveVerfuegung(vfState) {
    setBusy(true); setError('');
    try {
      const updated = await wohngeldApi.saveVerfuegung(id, { entscheidung: vfState.entscheidung, bemerkung: vfState.bemerkung, expectedVersion: vorgang.version });
      setDetail((d) => ({ ...d, vorgang: updated }));
      setVerfForm(null);
      await reload();
    } catch (e) {
      if (e.status === 409) { setError('Konflikt: Der Vorgang wurde parallel geändert. Die Ansicht wird neu geladen.'); await reload(); setVerfForm(null); }
      else setError(e.message);
    } finally { setBusy(false); }
  }

  function copyAntragsId(antragsId) {
    navigator.clipboard?.writeText(antragsId).then(() => {
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
      await wohngeldApi.uploadVorgangDokument(id, files);
      await reload();
    } catch (e) {
      setError(e.message || 'Upload fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  if (!detail) {
    return <div style={{ padding: theme.spacing['2xl'] }}>{error ? <div style={styles.error}>{error}</div> : 'Lädt…'}</div>;
  }

  const { vorgang, akte, personen, dokumente, pruefschritte, schreiben } = detail;
  // GOV-5 / Art. 18: bei eingeschränkter Verarbeitung sind alle Bearbeiten-Aktionen gesperrt (nur lesend).
  const eingeschraenkt = !!vorgang.eingeschraenkt;
  const canEdit = canEditRole && !eingeschraenkt;
  const protokoll = detail.protokoll || [];
  const feldStatus = detail.feldStatus || [];
  const notizen = detail.notizen || [];
  const feldStatusMap = buildFeldStatusMap(feldStatus);
  const offeneFelder = Object.values(feldStatusMap);
  const notizCount = (anker) => notizen.filter((n) => n.anker === anker).length;
  const antragsteller = personen.find((p) => p.rolle === 'antragsteller');
  const antragstellerName = antragsteller
    ? [antragsteller.vorname, antragsteller.nachname].filter(Boolean).join(' ')
    : (akte?.antragstellerName || akte?.name || '—');

  const dokLabel = (docId) => {
    const d = dokumente.find((x) => x.id === docId);
    return d ? (DOKUMENT_TYP_LABEL[d.typ] || d.typ) : 'Beleg-Dokument';
  };

  // ── Ampel-Zählung: offene Prüfschritte grob je Sektion (personId/Kategorie/Stichwort). ──
  const offen = pruefschritte.filter((p) => p.status === 'offen');
  const matches = (p, re) => re.test(`${p.titel || ''} ${p.belegtext || ''}`);
  const countAllgemein = offen.filter((p) => !p.personId && p.kategorie === 'vollstaendigkeit').length;
  const countPersonen = offen.filter((p) => p.personId).length;
  const countWohnung = offen.filter((p) => matches(p, /miet|wohn|heiz|warmwasser|fläche|flaeche/i)).length;
  const countEinkommen = offen.filter((p) => matches(p, /einkomm|einkünf|einkuenf|gehalt|lohn|rente|verdienst|abzug/i)).length;
  const countZahlung = offen.filter((p) => matches(p, /iban|zahlung|bewilligung|konto/i)).length;
  // Klick auf eine „n offen"-Pill → rechte Seitenleiste öffnet die offenen Prüfschritte.
  const zeigeOffene = () => { setSideTab('pruefschritte'); setPruefFilter('offen'); };

  // ── Übersicht-Bearbeitung pro Block (U1) ──
  function num(v) { return v === '' || v == null ? undefined : Number(v); }
  // Vollständiges Form-Objekt aus dem Vorgang (alle editierbaren Vorgang-Felder).
  function fullForm() {
    const w = vorgang.wohnung || {};
    return {
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
    };
  }
  // Frische Feld-Defaults eines Blocks (für Start und Verwerfen).
  function blockDefaults(block) {
    const f = fullForm();
    if (block === 'allgemein') return { antragsdatum: f.antragsdatum, wohngeldart: f.wohngeldart, antragsart: f.antragsart };
    if (block === 'wohnung') return { wohnung: f.wohnung };
    if (block === 'bwz') return { bwz_start: f.bwz_start, bwz_ende: f.bwz_ende, iban: f.iban };
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
    if (block === 'allgemein') return {
      antragsdatum: form.antragsdatum || undefined,
      wohngeldart: form.wohngeldart,
      antragsart: form.antragsart,
    };
    if (block === 'wohnung') return {
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
    };
    if (block === 'bwz') return {
      bwz_start: form.bwz_start || undefined,
      bwz_ende: form.bwz_ende || undefined,
      iban: form.iban || undefined,
    };
    return {};
  }
  async function saveBlock(block) {
    setBusy(true); setError('');
    try {
      const updated = await wohngeldApi.updateVorgang(id, { ...blockPayload(block), expectedVersion: vorgang.version });
      setDetail((d) => ({ ...d, vorgang: updated }));
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

  // ── GOV-5: Legal Hold & Verarbeitungs-Einschränkung (Art. 18) ──
  async function toggleLegalHold() {
    setBusy(true); setError('');
    try {
      const updated = await wohngeldApi.setLegalHold(id, !vorgang.legalHold, vorgang.version);
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
      const updated = await wohngeldApi.setEinschraenkung(id, setzen, vorgang.version);
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

  async function neuErzeugen(s) {
    if (!window.confirm('„Neu erzeugen" überschreibt den aktuellen Entwurf dieses Schreibens mit den aktuellen offenen Prüfschritten. Fortfahren?')) return;
    setBusy(true); setError('');
    try {
      await wohngeldApi.generiereSchreiben(id, { schreibenId: s.id, art: s.art });
      setSchreibenEdit((m) => { const n = { ...m }; delete n[s.id]; return n; });
      await reload();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  // ── Textbausteine (WP6): einfügen an Cursorposition + Verwaltung ──
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
      await wohngeldApi.createTextbaustein({ kategorie: (tbForm.kategorie || 'Allgemein').trim(), titel: tbForm.titel.trim(), text: tbForm.text.trim() });
      setTbForm({ kategorie: 'Allgemein', titel: '', text: '' });
      setTextbausteine(await wohngeldApi.listTextbausteine());
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function deleteTextbaustein(tb) {
    setBusy(true); setError('');
    try { await wohngeldApi.deleteTextbaustein(tb.id); setTextbausteine(await wohngeldApi.listTextbausteine()); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  // ── Feld-Status (WP3): KI-Vorschläge bestätigen/verwerfen ──
  async function bestaetigeFeld(fs) {
    setBusy(true); setError('');
    try { await wohngeldApi.bestaetigeFeld(id, fs.id); await reload(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function verwerfeFeld(fs) {
    setBusy(true); setError('');
    try { await wohngeldApi.verwerfeFeld(id, fs.id); await reload(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function bestaetigeAlleFelder() {
    setBusy(true); setError('');
    try { await wohngeldApi.bestaetigeAlleFelder(id); await reload(); }
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

  // ── Personen-Listen (WP5): strukturierte Angaben speichern (data-Merge) ──
  async function savePersonData(personId, patch) {
    const person = detail.personen.find((x) => x.id === personId);
    if (!person) return;
    setBusy(true); setError('');
    try {
      const updated = await wohngeldApi.updatePerson(personId, { ...patch, expectedVersion: person.version });
      setDetail((d) => ({ ...d, personen: d.personen.map((x) => (x.id === updated.id ? updated : x)) }));
      try { setEinkommen(await wohngeldApi.getEinkommen(id)); } catch { /* ignore */ }
    } catch (e) {
      if (e.status === 409) { setError('Konflikt: Die Person wurde parallel geändert. Die Ansicht wird neu geladen.'); await reload(); }
      else setError(e.message);
    } finally { setBusy(false); }
  }

  // ── Bewilligungszeitraum-Vorschlag übernehmen (WP5) ──
  async function bwzVorschlagUebernehmen() {
    setBusy(true); setError('');
    try {
      const updated = await wohngeldApi.bwzVorschlagUebernehmen(id);
      setDetail((d) => ({ ...d, vorgang: updated }));
      await reload();
    } catch (e) {
      if (e.status === 409) { setError('Konflikt: Der Vorgang wurde parallel geändert. Die Ansicht wird neu geladen.'); await reload(); }
      else setError(e.message);
    } finally { setBusy(false); }
  }

  // ── Notizen (WP4) ──
  async function addNotiz(anker, text) {
    setBusy(true); setError('');
    try { await wohngeldApi.addNotiz(id, { anker, text }); await reload(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function deleteNotiz(n) {
    setBusy(true); setError('');
    try { await wohngeldApi.deleteNotiz(n.id); await reload(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  // ── Vorgang-data speichern (Merge, Optimistic Locking) — Basis für Todos/Labels (WP8) ──
  async function saveVorgangData(patch) {
    setBusy(true); setError('');
    try {
      const updated = await wohngeldApi.updateVorgang(id, { ...patch, expectedVersion: vorgang.version });
      setDetail((d) => ({ ...d, vorgang: updated }));
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

  // ── Schreiben als versendet markieren (WP7) ──
  async function markVersendet(s) {
    if (!window.confirm('Schreiben als versendet markieren? Der Vorgang wird auf „Wartet auf Rückmeldung" gesetzt; die Wiedervorlage wird auf Frist + 3 Tage vorbelegt.')) return;
    setBusy(true); setError('');
    try {
      await wohngeldApi.markSchreibenVersendet(id, s.id);
      await reload();
    } catch (e) {
      if (e.status === 409) { setError('Konflikt: Der Vorgang wurde parallel geändert. Die Ansicht wird neu geladen.'); await reload(); }
      else setError(e.message);
    } finally { setBusy(false); }
  }

  // ── Sektionen der Übersicht ──
  // Unbestätigte KI-Vorschläge je Block → Headline-Punkt an der SektionCard.
  const unbestAllgemein = ['antragsdatum', 'wohngeldart', 'antragsart'].some(vfsExists);
  const unbestWohnung = ['wohnung.strasse', 'wohnung.hausnummer', 'wohnung.plz', 'wohnung.ort', 'wohnung.wohnflaeche_qm', 'wohnung.miete', 'wohnung.heizkosten', 'wohnung.warmwasser'].some(vfsExists);
  const unbestBwz = ['iban', 'bwz_start', 'bwz_ende'].some(vfsExists);
  const unbestPersonen = Object.keys(feldStatusMap).some((k) => k.startsWith('person:'));
  const w = vorgang.wohnung || {};
  const adresse = [w.strasse, w.hausnummer].filter(Boolean).join(' ');
  const ortZeile = [w.plz, w.ort].filter(Boolean).join(' ');
  // Bewilligungszeitraum: Liste ist führend, sonst Legacy-Felder.
  const bwzListe = (vorgang.bwz && vorgang.bwz.length)
    ? vorgang.bwz
    : ((vorgang.bwz_start || vorgang.bwz_ende) ? [{ id: 'legacy', start: vorgang.bwz_start, ende: vorgang.bwz_ende }] : []);
  const bwzVorschlagOffen = pruefschritte.some((p) => p.regelId === 'bwz-vorschlag-pruefen' && p.status === 'offen');

  // ── Todos & Labels (WP8) ──
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

  // Frist/Wiedervorlage (WP7)
  const fristUeberfaellig = istUeberfaellig(vorgang.frist);
  const wvUeberfaellig = istUeberfaellig(vorgang.wiedervorlage);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button style={styles.backLink} onClick={() => navigate('/apps/wohngeld')}><ArrowLeftIcon /> Wohngeld</button>
        <div style={styles.crumb}>Vorgänge › {vorgang.antragsId}</div>
        <div style={styles.headRow}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
              <h1 style={styles.title}>{vorgang.antragsId}</h1>
              <button
                style={{ ...styles.iconBtn, position: 'relative' }}
                onClick={() => copyAntragsId(vorgang.antragsId)}
                title="Antrags-ID kopieren"
                aria-label="Antrags-ID kopieren"
              >
                <CopyIcon size={16} color={theme.colors.textMuted} />
                {copied && <span style={styles.copiedHint}>kopiert</span>}
              </button>
            </div>
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
                title="Allgemein"
                offenCount={countAllgemein} onOffenClick={zeigeOffene}
                collapsible
                unbestaetigt={unbestAllgemein}
                notizCount={notizCount('sektion:allgemein')}
                onNotizClick={() => setNotizPanel({ anker: 'sektion:allgemein', label: 'Allgemein' })}
                action={blockAction('allgemein')}
              >
                {isBlockEdit('allgemein') ? (
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
                    { label: 'Antragsdatum', value: fmtDate(vorgang.antragsdatum), dot: vfsDot('antragsdatum'), mark: vfsFreigabe('antragsdatum') },
                    { label: 'Wohngeldart', value: WOHNGELDART_LABEL[vorgang.wohngeldart], dot: vfsDot('wohngeldart'), mark: vfsFreigabe('wohngeldart') },
                    { label: 'Antragsart', value: ANTRAGSART_LABEL[vorgang.antragsart], dot: vfsDot('antragsart'), mark: vfsFreigabe('antragsart') },
                    { label: 'Antragsteller', value: antragstellerName },
                  ]} />
                )}
              </SektionCard>

              <SektionCard
                title="Personen"
                offenCount={countPersonen} onOffenClick={zeigeOffene}
                collapsible
                unbestaetigt={unbestPersonen}
                notizCount={notizCount('sektion:personen')}
                onNotizClick={() => setNotizPanel({ anker: 'sektion:personen', label: 'Personen' })}
              >
                {personen.length === 0
                  ? <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>Noch keine Personen erfasst.</div>
                  : personen.map((p) => (
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
                title="Wohnung & Miete"
                offenCount={countWohnung} onOffenClick={zeigeOffene}
                collapsible
                unbestaetigt={unbestWohnung}
                notizCount={notizCount('sektion:wohnung')}
                onNotizClick={() => setNotizPanel({ anker: 'sektion:wohnung', label: 'Wohnung & Miete' })}
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
                    { label: 'Adresse', value: adresse || '—', dot: vfsDot('wohnung.strasse') || vfsDot('wohnung.hausnummer'), mark: vfsFreigabe('wohnung.strasse') || vfsFreigabe('wohnung.hausnummer') },
                    { label: 'PLZ / Ort', value: ortZeile || '—', dot: vfsDot('wohnung.plz') || vfsDot('wohnung.ort'), mark: vfsFreigabe('wohnung.plz') || vfsFreigabe('wohnung.ort') },
                    { label: 'Wohnfläche', value: w.wohnflaeche_qm != null ? `${w.wohnflaeche_qm} m²` : '—', dot: vfsDot('wohnung.wohnflaeche_qm'), mark: vfsFreigabe('wohnung.wohnflaeche_qm') },
                    { label: 'Miete (Bruttokalt)', value: eur(w.miete), dot: vfsDot('wohnung.miete'), mark: vfsFreigabe('wohnung.miete') },
                    { label: 'Heizkosten', value: eur(w.heizkosten) },
                    { label: 'Warmwasser', value: eur(w.warmwasser) },
                  ]} />
                )}
              </SektionCard>

              <SektionCard
                title="Einkommen & Abzugsbeträge"
                offenCount={countEinkommen} onOffenClick={zeigeOffene}
                collapsible
                notizCount={notizCount('sektion:einkommen')}
                onNotizClick={() => setNotizPanel({ anker: 'sektion:einkommen', label: 'Einkommen & Abzugsbeträge' })}
              >
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

                {einkommen && (
                  <>
                    <div style={styles.ekResult}>
                      <span style={styles.ekResultLabel}>Anrechenbares Gesamteinkommen (§13 WoGG)</span>
                      <span style={styles.ekResultValue}>
                        {eur(einkommen.gesamteinkommenMonat)} / Mon.
                        <span style={styles.ekResultSub}> · {eur(einkommen.gesamteinkommenJahr)} / Jahr</span>
                      </span>
                    </div>
                    <div style={styles.ekHint}>
                      Read-only. §16-Abzugskategorien sind angenommen — bitte prüfen. Keine Wohngeldbetrag-Berechnung (§19).
                    </div>
                    {(einkommen.proPerson || []).map((z) => {
                      const offen = !!herleitungOffen[z.personId];
                      return (
                        <div key={z.personId} style={{ marginTop: theme.spacing.sm }}>
                          <button
                            style={styles.ekToggle}
                            onClick={() => setHerleitungOffen((m) => ({ ...m, [z.personId]: !m[z.personId] }))}
                            aria-expanded={offen}
                          >
                            <ChevronDownIcon size={12} style={{ transform: offen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: `transform ${theme.transitions.fast}` }} />
                            Herleitung {z.name}
                          </button>
                          {offen && (
                            <div style={styles.ekHerleitung}>
                              <div style={styles.ekRow}>
                                <span>Jahreseinkommen (§14 nach §16-Abzug · {abzugKatText(z.abzugskategorien)})</span>
                                <span>{eur(z.jahreseinkommen)}</span>
                              </div>
                              <div style={styles.ekRow}>
                                <span>− Freibeträge (§17)</span>
                                <span>{eur(z.freibetraege)}</span>
                              </div>
                              <div style={{ ...styles.ekRow, fontWeight: theme.typography.weights.semibold, color: theme.colors.text, borderTop: `1px solid ${theme.colors.border}`, marginTop: theme.spacing.xs, paddingTop: theme.spacing.xs }}>
                                <span>Anrechenbar (Jahr)</span>
                                <span>{eur(Math.max(0, z.jahreseinkommen - z.freibetraege))}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div style={{ ...styles.ekHerleitung, marginTop: theme.spacing.md }}>
                      <div style={styles.ekRow}>
                        <span>Summe Jahreseinkommen (Haushalt)</span>
                        <span>{eur(einkommen.summeJahreseinkommen)}</span>
                      </div>
                      <div style={styles.ekRow}>
                        <span>− Freibeträge gesamt (§17)</span>
                        <span>{eur(einkommen.summeFreibetraege)}</span>
                      </div>
                      <div style={styles.ekRow}>
                        <span>− Unterhaltsabzüge (§18)</span>
                        <span>{eur(einkommen.unterhaltsabzuege)}</span>
                      </div>
                      <div style={{ ...styles.ekRow, fontWeight: theme.typography.weights.semibold, color: theme.colors.text, borderTop: `1px solid ${theme.colors.border}`, marginTop: theme.spacing.xs, paddingTop: theme.spacing.xs }}>
                        <span>Gesamteinkommen (§13, Jahr)</span>
                        <span>{eur(einkommen.gesamteinkommenJahr)}</span>
                      </div>
                    </div>
                  </>
                )}
              </SektionCard>

              <SektionCard
                title="Bewilligungszeitraum & Zahlung"
                offenCount={countZahlung} onOffenClick={zeigeOffene}
                collapsible
                unbestaetigt={unbestBwz}
                action={blockAction('bwz', canEdit && bwzVorschlagOffen && !isBlockEdit('bwz') ? (
                  <button style={styles.btnSmall} onClick={bwzVorschlagUebernehmen} disabled={busy} title="12 Monate ab Antragsmonat übernehmen">
                    {busy ? 'Übernimmt…' : 'Vorschlag übernehmen'}
                  </button>
                ) : null)}
              >
                {isBlockEdit('bwz') ? (
                  <div style={styles.editRow}>
                    <span style={styles.editLabel}>Zeitraum von</span>
                    <input type="date" style={styles.input} value={form.bwz_start} onChange={(e) => setForm({ ...form, bwz_start: e.target.value })} />
                    <span style={styles.editLabel}>Zeitraum bis</span>
                    <input type="date" style={styles.input} value={form.bwz_ende} onChange={(e) => setForm({ ...form, bwz_ende: e.target.value })} />
                    <span style={styles.editLabel}>IBAN</span>
                    <input style={styles.input} value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} />
                  </div>
                ) : (
                  <>
                    <div style={styles.sideTitle}>Bewilligungszeiträume</div>
                    {bwzListe.length === 0 ? (
                      <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted, marginBottom: theme.spacing.sm }}>
                        Noch kein Bewilligungszeitraum erfasst.{bwzVorschlagOffen ? ' Vorschlag: 12 Monate ab Antragsmonat (§22/§25).' : ''}
                      </div>
                    ) : (
                      bwzListe.map((b) => (
                        <div key={b.id} style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text, padding: '2px 0' }}>
                          {fmtDate(b.start)} – {fmtDate(b.ende)}
                        </div>
                      ))
                    )}
                    <div style={{ marginTop: theme.spacing.sm }}>
                      <FeldGrid felder={[{ label: 'IBAN', value: vorgang.iban || '—' }]} />
                    </div>
                  </>
                )}
              </SektionCard>
            </>
          )}

          {mainTab === 'schreiben' && (
            <SektionCard
              title="Schreiben"
              action={canEdit && (
                <div style={{ display: 'flex', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
                  <button style={styles.btnSmall} onClick={() => setTbManage((v) => !v)}>Textbausteine verwalten</button>
                  <button style={styles.btn} onClick={generiereSchreiben} disabled={busy}>{busy ? 'Erstellt…' : 'Anforderungsschreiben generieren'}</button>
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
                  Noch keine Schreiben. Aus den offenen Anforderungen lässt sich ein Nachforderungsschreiben erzeugen.
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
                          <button style={styles.btnSmall} onClick={() => wohngeldApi.exportSchreiben(s.id, 'pdf').catch((e) => setError(e.message))}>Als PDF herunterladen</button>
                          <button style={styles.btnSmall} onClick={() => wohngeldApi.exportSchreiben(s.id, 'docx').catch((e) => setError(e.message))}>Als Word-Datei herunterladen</button>
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

          {mainTab === 'plausibilitaet' && (
            <SektionCard title="Plausibilitätsprüfung">
              {(() => {
                const list = pruefschritte.filter((p) => p.kategorie === 'plausibilitaet');
                if (list.length === 0) return <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>Keine Plausibilitäts-Prüfschritte. Starte rechts „Neu prüfen".</div>;
                return list.map((p) => (
                  <PruefschrittItem key={p.id} pruefschritt={p} canEdit={canEdit} busy={busy} onStatus={(s) => setPruefStatus(p, s)} onOpenDokument={jumpToDokument} dokumentLabel={dokLabel(p.quellDokumentId)} />
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

          {mainTab === 'verfuegung' && (() => {
            const vf = vorgang.verfuegung || {};
            const vfState = verfForm ?? { entscheidung: vf.entscheidung || 'offen', bemerkung: vf.bemerkung || '' };
            const vierAugen = !!detail.vierAugen;
            const darfEntscheiden = !vierAugen || role === 'owner';
            const FINALE_ENTSCHEIDUNGEN = ['bewilligt', 'abgelehnt', 'teilweise'];
            const finaleGesperrt = vierAugen && !darfEntscheiden;
            const saveGesperrt = finaleGesperrt && FINALE_ENTSCHEIDUNGEN.includes(vfState.entscheidung);
            return (
              <SektionCard title="Verfügung">
                <div style={styles.info}>
                  Zusammenfassung aus Vorgangsdaten (Personen, Einkommen §13, Miete, Prüfstatus) zur Entscheidungsfindung.
                  Keine Betragsfestsetzung (§19) und keine rechtsverbindliche Bescheidvorlage.
                </div>
                <div style={styles.verfRow}>
                  <span style={styles.editLabel}>Entscheidung</span>
                  <select
                    style={{ ...styles.input, maxWidth: 280 }}
                    value={vfState.entscheidung}
                    disabled={!canEdit || busy}
                    onChange={(e) => setVerfForm({ ...vfState, entscheidung: e.target.value })}
                  >
                    {Object.entries(VERFUEGUNG_ENTSCHEIDUNG_LABEL).map(([v, l]) => (
                      <option key={v} value={v} disabled={finaleGesperrt && FINALE_ENTSCHEIDUNGEN.includes(v)}>{l}</option>
                    ))}
                  </select>
                  {finaleGesperrt && (
                    <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginTop: theme.spacing.xs }}>
                      Finale Entscheidung nur durch Freigabeberechtigte (Vier-Augen-Prinzip). Sie können vorbereiten und eine Bemerkung setzen.
                    </div>
                  )}
                  <span style={styles.editLabel}>Bemerkung</span>
                  <textarea
                    style={{ ...styles.input, minHeight: 100, resize: 'vertical' }}
                    placeholder="Interne Begründung / Hinweise zur Entscheidung"
                    value={vfState.bemerkung}
                    disabled={!canEdit || busy}
                    onChange={(e) => setVerfForm({ ...vfState, bemerkung: e.target.value })}
                  />
                </div>
                <div style={{ display: 'flex', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
                  {canEdit && <button style={styles.btn} onClick={() => saveVerfuegung(vfState)} disabled={busy || saveGesperrt}>{busy ? 'Speichert…' : 'Speichern'}</button>}
                  <button style={styles.btnGhost} onClick={() => wohngeldApi.exportVerfuegung(id, 'pdf').catch((e) => setError(e.message))}>Verfügung als PDF herunterladen</button>
                  <button style={styles.btnGhost} onClick={() => wohngeldApi.exportVerfuegung(id, 'docx').catch((e) => setError(e.message))}>Als Word herunterladen</button>
                </div>
                {vf.erstelltAm && (
                  <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginTop: theme.spacing.md }}>
                    Zuletzt gespeichert: {fmtDateTime(vf.erstelltAm)}
                  </div>
                )}
              </SektionCard>
            );
          })()}

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
                  <KvRows rows={[
                    { label: 'Sachbearbeiter', value: vorgang.sachbearbeiter || '—' },
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

                {/* GOV-5 — Aufbewahrung, Legal Hold & Verarbeitungs-Einschränkung */}
                <PanelSection title="Aufbewahrung & Schutz">
                  <div style={{ ...styles.govRow, borderBottom: `1px solid ${theme.colors.borderLight}` }}>
                    <span style={styles.govLabel}>Aufbewahrung bis</span>
                    <span style={styles.govValue}>{vorgang.aufbewahrungBis ? fmtDate(vorgang.aufbewahrungBis) : 'Bei Abschluss'}</span>
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

                <PanelSection title="KI-Nutzung" count={kiNutzung.length > 0 ? kiNutzung.length : undefined}>
                  <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginBottom: theme.spacing.sm, lineHeight: 1.5 }}>
                    KI wird nur assistierend eingesetzt (Prüfung/Aufbereitung). Die Entscheidung trifft ein Mensch.
                  </div>
                  {kiNutzung.length === 0
                    ? <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>Für diesen Fall wurde noch keine KI-Assistenz genutzt.</div>
                    : kiNutzung.map((e, i) => (
                        <div key={`${e.timestamp}-${i}`} style={styles.activity}>
                          <div style={styles.protoAktion}>{kiZweckLabel(e)}</div>
                          <div style={styles.protoMeta}>
                            {fmtDateTime(e.timestamp)}
                            {e.modelId ? ` · Modell: ${e.modelId}` : ''}
                            {e.totalTokens != null ? ` · ${e.totalTokens} Tokens` : ''}
                          </div>
                          {(e.promptVersion || e.rechtStand) && (
                            <div style={styles.protoMeta}>
                              {e.promptVersion ? `Prompt-Stand: ${e.promptVersion}` : ''}
                              {e.promptVersion && e.rechtStand ? ' · ' : ''}
                              {e.rechtStand ? `Rechtsstand: ${e.rechtStand}` : ''}
                            </div>
                          )}
                        </div>
                      ))}
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
                      ref={dokUploadRef} type="file" multiple accept="application/pdf"
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
                                <option value="">Haushalt (keine Person)</option>
                                {personen.map((p) => <option key={p.id} value={p.id}>{label(p)}</option>)}
                              </select>
                            ) : (
                              <span style={{ fontSize: '0.7rem', color: theme.colors.text }}>{person ? label(person) : 'Haushalt'}</span>
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
                            <button style={styles.iconAction} onClick={() => openPreview(d)} disabled={previewLoading} title="Vorschau" aria-label="Vorschau"><EyeIcon size={15} /></button>
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

      {/* Fall-Chat: schwebender Trigger + Panel */}
      {!chatOpen && (
        <button
          style={styles.chatFab}
          onClick={() => setChatOpen(true)}
          title="Assistent zum Vorgang"
          aria-label="Assistent zum Vorgang öffnen"
        >
          <ChatIcon size={20} color="#fff" />
          <span>Assistent</span>
        </button>
      )}
      {chatOpen && (
        <FallChat
          vorgang={{ id: vorgang.id, antragsId: vorgang.antragsId }}
          onClose={() => setChatOpen(false)}
          onOpenDokument={(docId) => { if (docId) jumpToDokument(docId); else { setSideCollapsed(false); setSideTab('dokumente'); } }}
          canEdit={canEdit}
          onDidMutate={reload}
        />
      )}

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
                <button style={styles.btnSmall} onClick={() => window.open(preview.url, '_blank', 'noopener')}>In neuem Tab öffnen</button>
                <button style={styles.iconBtn} onClick={closePreview} title="Schließen" aria-label="Vorschau schließen">
                  <XIcon size={16} color={theme.colors.textMuted} />
                </button>
              </div>
            </div>
            <div style={styles.previewBody}>
              <div style={styles.previewViewer}>
                {(preview.contentType.includes('pdf') || preview.contentType.startsWith('image/') || preview.contentType.startsWith('text/')) ? (
                  <iframe src={preview.url} style={styles.previewFrame} title={preview.name} />
                ) : (
                  <div style={styles.previewFallback}>
                    <div>Für diesen Dateityp ist keine Inline-Vorschau möglich.</div>
                    <button style={styles.btn} onClick={() => window.open(preview.url, '_blank', 'noopener')}>In neuem Tab öffnen</button>
                  </div>
                )}
              </div>
              {preview.dok && ((preview.dok.extraktion?.felder?.length || 0) > 0 || !!preview.dok.analyse) && (
                <div style={styles.previewPanel}>
                  <div style={styles.previewPanelTitle}>Aus dem Dokument extrahiert</div>
                  <ExtraktionsBaum
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
