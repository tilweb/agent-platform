import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../config/theme';
import { useAppPermission } from '../../components/RequireAppPermission';
import {
  wohngeldApi, WOHNGELDART_LABEL, ANTRAGSART_LABEL, STATUS_LABEL, STATUS_ORDER,
  ACCENT, ACCENT_LIGHT, AKTION_LABEL, APP_ROLE_LABEL, aktionLabel,
} from './api';
import StatusBadge from './components/StatusBadge';
import { ListIcon, ClockIcon, FolderIcon, ClipboardIcon, TimelineIcon, TrashIcon, MailIcon, ScaleIcon } from '../../components/Icons';
import RegelKatalog from './components/RegelKatalog';

const styles = {
  // Volle verfügbare Breite (keine 1100px-Deckelung) — breite Tabellen mit vielen Spalten
  // sollen den ganzen Platz neben der Sidebar nutzen. width:100% + border-box, damit das Padding
  // die Breite nicht sprengt; alle Views sind dadurch gleich (voll) breit.
  container: { width: '100%', boxSizing: 'border-box', padding: `${theme.spacing.xl} ${theme.spacing['2xl']}` },
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
  btnDanger: {
    padding: `6px ${theme.spacing.md}`, backgroundColor: 'transparent', color: theme.colors.error, border: `1px solid ${theme.colors.error}30`,
    borderRadius: theme.borderRadius.md, fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.medium, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  hint: { fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted, marginBottom: theme.spacing.lg, lineHeight: 1.5 },
  toolbar: { display: 'flex', gap: theme.spacing.md, marginBottom: theme.spacing.lg, flexWrap: 'wrap', alignItems: 'center' },
  search: {
    flex: 1, minWidth: 220, padding: `${theme.spacing.md} ${theme.spacing.lg}`, fontSize: theme.typography.sizes.base,
    border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.surface, color: theme.colors.text, outline: 'none',
  },
  filterTabs: { display: 'flex', gap: theme.spacing.xs, flexWrap: 'wrap' },
  zustaendigSelect: { padding: `6px ${theme.spacing.md}`, fontSize: theme.typography.sizes.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.surface, color: theme.colors.text, cursor: 'pointer' },
  filterTab: {
    padding: `6px ${theme.spacing.md}`, backgroundColor: 'transparent', border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.full,
    fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.medium, color: theme.colors.textMuted, cursor: 'pointer',
  },
  filterTabActive: { backgroundColor: ACCENT_LIGHT, color: ACCENT, borderColor: ACCENT_LIGHT },
  viewSwitch: { display: 'flex', gap: theme.spacing.sm, marginBottom: theme.spacing.lg, flexWrap: 'wrap' },
  viewTab: {
    display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs,
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`, backgroundColor: 'transparent', border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.textMuted, cursor: 'pointer',
  },
  viewTabActive: { backgroundColor: ACCENT_LIGHT, color: ACCENT, borderColor: ACCENT_LIGHT },
  backLink: { display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs, fontSize: theme.typography.sizes.sm, color: ACCENT, cursor: 'pointer', marginBottom: theme.spacing.md, border: 'none', background: 'none', padding: 0, fontWeight: theme.typography.weights.medium },
  wvBadge: { fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.semibold, padding: `2px ${theme.spacing.sm}`, borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.errorLight, color: theme.colors.error, marginLeft: theme.spacing.sm },
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
  // Protokoll (GOV-4)
  protoBar: { display: 'flex', gap: theme.spacing.md, marginBottom: theme.spacing.lg, flexWrap: 'wrap', alignItems: 'flex-end' },
  protoField: { display: 'flex', flexDirection: 'column', gap: theme.spacing.xs },
  protoLabel: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, fontWeight: theme.typography.weights.medium },
  protoInput: { padding: `${theme.spacing.sm} ${theme.spacing.md}`, fontSize: theme.typography.sizes.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.surface, color: theme.colors.text, outline: 'none' },
  protoCount: { fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted, marginBottom: theme.spacing.md },
  detailCell: { padding: `${theme.spacing.md} ${theme.spacing.lg}`, color: theme.colors.textSecondary, borderBottom: `1px solid ${theme.colors.borderLight}`, whiteSpace: 'normal', maxWidth: 320 },
};

/** Objekt-Kurzbeschreibung eines Protokolleintrags. */
function objektText(e) {
  const id = e.objektId ? ` ${e.objektId}` : '';
  return `${e.objektTyp}${id}`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return iso.slice(0, 10); }
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso.slice(0, 16); }
}

/**
 * Zuständigkeitsfilter: 'alle' | 'meine' | 'offen' (nicht zugewiesen) | Nutzer-ID.
 * Gilt für Vorgänge und Aufgaben (beide tragen `sachbearbeiterId`).
 */
function passtZustaendigkeit(x, filter, ich) {
  if (filter === 'alle') return true;
  if (filter === 'offen') return !x.sachbearbeiterId;
  if (filter === 'meine') return !!ich && x.sachbearbeiterId === ich;
  return x.sachbearbeiterId === filter;
}

function ZustaendigFilter({ wert, onChange, sachbearbeitung }) {
  const andere = sachbearbeitung.nutzer.filter((n) => n.id !== sachbearbeitung.ich);
  return (
    <select style={styles.zustaendigSelect} value={wert} onChange={(e) => onChange(e.target.value)} aria-label="Nach Sachbearbeitung filtern" title="Nach Sachbearbeitung filtern">
      <option value="alle">Alle Sachbearbeiter/innen</option>
      <option value="meine">Meine</option>
      <option value="offen">Nicht zugewiesen</option>
      {andere.length > 0 && (
        <optgroup label="Kolleginnen und Kollegen">
          {andere.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
        </optgroup>
      )}
    </select>
  );
}

export default function WohngeldPage() {
  const navigate = useNavigate();
  const { role } = useAppPermission();
  const canEdit = role === 'owner' || role === 'editor';
  const isOwner = role === 'owner';

  const [vorgaenge, setVorgaenge] = useState([]);
  const [akten, setAkten] = useState({}); // akteId -> akte
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('alle');
  const [query, setQuery] = useState('');
  // Zuständigkeit: 'alle' | 'meine' | 'offen' (nicht zugewiesen) | <Nutzer-ID>
  const [zustaendigFilter, setZustaendigFilter] = useState('alle');
  const [aufgabenZustaendig, setAufgabenZustaendig] = useState('meine');
  const [sachbearbeitung, setSachbearbeitung] = useState({ nutzer: [], ich: null });

  const [dialog, setDialog] = useState(null); // { name, wohngeldart, antragsart }
  const [saving, setSaving] = useState(false);

  // Ansicht: Vorgangsliste, Wiedervorlage/Fristen (WP7), Akten oder Aufgaben (WP9)
  const [viewMode, setViewMode] = useState('vorgaenge');
  const [wiedervorlage, setWiedervorlage] = useState([]);
  const [wvLoading, setWvLoading] = useState(false);
  const [wvLoaded, setWvLoaded] = useState(false);

  // Akten-Browser (WP9)
  const [selectedAkte, setSelectedAkte] = useState(null);
  const [akteVorgaenge, setAkteVorgaenge] = useState([]);
  const [akteVgLoading, setAkteVgLoading] = useState(false);

  // Aufgaben (WP9)
  const [aufgaben, setAufgaben] = useState([]);
  const [aufgabenLoading, setAufgabenLoading] = useState(false);
  const [aufgabenLoaded, setAufgabenLoaded] = useState(false);

  // Admin/DSB-Protokoll (GOV-4, nur Owner)
  const [protokoll, setProtokoll] = useState([]);
  const [protGesamt, setProtGesamt] = useState(0);
  const [protLoading, setProtLoading] = useState(false);
  const [protLoaded, setProtLoaded] = useState(false);
  const [protExporting, setProtExporting] = useState(false);
  const [protFilter, setProtFilter] = useState({ von: '', bis: '', aktion: '', vorgangId: '' });
  const [akteurQuery, setAkteurQuery] = useState('');

  // Löschfällige Vorgänge (GOV-5, nur Owner)
  const [loeschfaellig, setLoeschfaellig] = useState([]);
  const [lfLoading, setLfLoading] = useState(false);
  const [lfLoaded, setLfLoaded] = useState(false);
  const [lfDeleteTarget, setLfDeleteTarget] = useState(null); // Vorgang für Bestätigungsdialog
  const [lfDeleting, setLfDeleting] = useState(false);

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

  // Wiedervorlage-Liste erst bei Bedarf laden (beim Wechsel in die Ansicht).
  useEffect(() => {
    if (viewMode !== 'wiedervorlage' || wvLoaded) return undefined;
    let cancelled = false;
    (async () => {
      setWvLoading(true);
      try {
        const wv = await wohngeldApi.listWiedervorlage();
        if (!cancelled) { setWiedervorlage(wv); setWvLoaded(true); }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setWvLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [viewMode, wvLoaded]);

  // Auswahlliste der Sachbearbeitung (für Filter „Meine" und je Person).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sb = await wohngeldApi.getSachbearbeitung();
        if (!cancelled) setSachbearbeitung(sb);
      } catch { /* Filter funktioniert dann nur mit „Alle" */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Aufgaben erst bei Bedarf laden (beim Wechsel in die Ansicht).
  useEffect(() => {
    if (viewMode !== 'aufgaben' || aufgabenLoaded) return undefined;
    let cancelled = false;
    (async () => {
      setAufgabenLoading(true);
      try {
        const a = await wohngeldApi.listAufgaben();
        if (!cancelled) { setAufgaben(a); setAufgabenLoaded(true); }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setAufgabenLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [viewMode, aufgabenLoaded]);

  // Serverseitige Protokoll-Filter (Zeitraum/Aktion/Vorgang). Akteur wird lokal gefiltert.
  function buildProtFilter() {
    const f = {};
    if (protFilter.von) f.von = `${protFilter.von}T00:00:00.000Z`;
    if (protFilter.bis) f.bis = `${protFilter.bis}T23:59:59.999Z`;
    if (protFilter.aktion) f.aktion = protFilter.aktion;
    if (protFilter.vorgangId.trim()) f.vorgangId = protFilter.vorgangId.trim();
    return f;
  }

  async function loadProtokoll() {
    setProtLoading(true); setError('');
    try {
      const { eintraege, gesamt } = await wohngeldApi.listAudit(buildProtFilter());
      setProtokoll(eintraege || []);
      setProtGesamt(gesamt ?? (eintraege || []).length);
      setProtLoaded(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setProtLoading(false);
    }
  }

  async function exportProtokoll() {
    setProtExporting(true); setError('');
    try {
      await wohngeldApi.exportAudit(buildProtFilter());
    } catch (e) {
      setError(e.message);
    } finally {
      setProtExporting(false);
    }
  }

  // Protokoll erst bei Bedarf laden (beim ersten Wechsel in die Ansicht).
  useEffect(() => {
    if (viewMode !== 'protokoll' || !isOwner || protLoaded) return;
    loadProtokoll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, isOwner, protLoaded]);

  async function loadLoeschfaellig() {
    setLfLoading(true); setError('');
    try {
      const items = await wohngeldApi.listLoeschfaellig();
      setLoeschfaellig(items || []);
      setLfLoaded(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLfLoading(false);
    }
  }

  // Löschfällige Vorgänge erst bei Bedarf laden (beim ersten Wechsel in die Ansicht).
  useEffect(() => {
    if (viewMode !== 'loeschfaellig' || !isOwner || lfLoaded) return;
    loadLoeschfaellig();
  }, [viewMode, isOwner, lfLoaded]);

  async function confirmLoeschen() {
    if (!lfDeleteTarget) return;
    setLfDeleting(true); setError('');
    try {
      await wohngeldApi.deleteVorgang(lfDeleteTarget.id);
      setLoeschfaellig((list) => list.filter((v) => v.id !== lfDeleteTarget.id));
      setVorgaenge((vs) => vs.filter((v) => v.id !== lfDeleteTarget.id));
      setLfDeleteTarget(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLfDeleting(false);
    }
  }

  // Lokale Akteur-Textsuche über die geladenen Protokolleinträge.
  const protokollGefiltert = useMemo(() => {
    const q = akteurQuery.trim().toLowerCase();
    if (!q) return protokoll;
    return protokoll.filter((e) => (e.akteurName || '').toLowerCase().includes(q));
  }, [protokoll, akteurQuery]);

  function antragstellerName(v) {
    const a = akten[v.akteId];
    return a?.antragstellerName || a?.name || '—';
  }

  const aktenListe = useMemo(
    () => Object.values(akten).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'de')),
    [akten],
  );
  function akteAdresse(a) {
    return [[a.strasse, a.hausnummer].filter(Boolean).join(' '), [a.plz, a.ort].filter(Boolean).join(' ')]
      .filter(Boolean).join(', ') || '—';
  }
  async function openAkte(a) {
    setSelectedAkte(a);
    setAkteVgLoading(true);
    setError('');
    try {
      setAkteVorgaenge(await wohngeldApi.listAkteVorgaenge(a.id));
    } catch (e) {
      setError(e.message);
    } finally {
      setAkteVgLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vorgaenge.filter((v) => {
      if (statusFilter !== 'alle' && v.status !== statusFilter) return false;
      if (!passtZustaendigkeit(v, zustaendigFilter, sachbearbeitung.ich)) return false;
      if (!q) return true;
      const hay = [v.antragsId, v.wohngeldnummer, antragstellerName(v), v.sachbearbeiter, WOHNGELDART_LABEL[v.wohngeldart], ANTRAGSART_LABEL[v.antragsart]]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vorgaenge, akten, statusFilter, query, zustaendigFilter, sachbearbeitung.ich]);

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
          <div style={{ display: 'flex', gap: theme.spacing.sm }}>
            <button style={{ ...styles.btnGhost, display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs }} onClick={() => navigate('/apps/wohngeld/posteingang')}>
              <MailIcon size={15} /> Posteingang
            </button>
            <button style={styles.btn} onClick={() => setDialog({ name: '', wohngeldart: 'mietzuschuss', antragsart: 'erstantrag' })}>
              + Neuer Vorgang
            </button>
          </div>
        )}
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.viewSwitch}>
        <button style={{ ...styles.viewTab, ...(viewMode === 'vorgaenge' ? styles.viewTabActive : {}) }} onClick={() => setViewMode('vorgaenge')}><ListIcon size={15} /> Vorgänge</button>
        <button style={{ ...styles.viewTab, ...(viewMode === 'wiedervorlage' ? styles.viewTabActive : {}) }} onClick={() => setViewMode('wiedervorlage')}><ClockIcon size={15} /> Wiedervorlage / Fristen</button>
        <button style={{ ...styles.viewTab, ...(viewMode === 'akten' ? styles.viewTabActive : {}) }} onClick={() => { setViewMode('akten'); setSelectedAkte(null); }}><FolderIcon size={15} /> Akten</button>
        <button style={{ ...styles.viewTab, ...(viewMode === 'aufgaben' ? styles.viewTabActive : {}) }} onClick={() => setViewMode('aufgaben')}><ClipboardIcon size={15} /> Aufgaben</button>
        <button style={{ ...styles.viewTab, ...(viewMode === 'regeln' ? styles.viewTabActive : {}) }} onClick={() => setViewMode('regeln')}><ScaleIcon size={15} /> Prüfregeln</button>
        {isOwner && (
          <button style={{ ...styles.viewTab, ...(viewMode === 'protokoll' ? styles.viewTabActive : {}) }} onClick={() => setViewMode('protokoll')}><TimelineIcon size={15} /> Protokoll</button>
        )}
        {isOwner && (
          <button style={{ ...styles.viewTab, ...(viewMode === 'loeschfaellig' ? styles.viewTabActive : {}) }} onClick={() => setViewMode('loeschfaellig')}><TrashIcon size={15} /> Löschfällig</button>
        )}
      </div>

      {viewMode === 'vorgaenge' && (
      <>
      <div style={styles.toolbar}>
        <input
          style={styles.search}
          placeholder="Suche nach Vorgangs- oder Wohngeldnummer, Antragsteller, Sachbearbeitung …"
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
        <ZustaendigFilter wert={zustaendigFilter} onChange={setZustaendigFilter} sachbearbeitung={sachbearbeitung} />
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
                  <th style={styles.th}>Vorgangsnr.</th>
                  <th style={styles.th}>Wohngeldnr.</th>
                  <th style={styles.th}>Antragsteller</th>
                  <th style={styles.th}>Wohngeldart</th>
                  <th style={styles.th}>Antragsart</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Sachbearbeitung</th>
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
                    <td style={styles.td}>{v.wohngeldnummer || '—'}</td>
                    <td style={styles.td}>{antragstellerName(v)}</td>
                    <td style={styles.td}>{WOHNGELDART_LABEL[v.wohngeldart] || v.wohngeldart}</td>
                    <td style={styles.td}>{ANTRAGSART_LABEL[v.antragsart] || v.antragsart}</td>
                    <td style={styles.td}><StatusBadge status={v.status} /></td>
                    <td style={styles.td}>{v.sachbearbeiter || <span style={{ color: theme.colors.textMuted }}>nicht zugewiesen</span>}</td>
                    <td style={{ ...styles.td, color: theme.colors.textMuted }}>{fmtDate(v.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </>
      )}

      {viewMode === 'wiedervorlage' && (
        wvLoading ? (
          <div style={styles.empty}>Lädt…</div>
        ) : wiedervorlage.length === 0 ? (
          <div style={styles.empty}>Keine offenen Wiedervorlagen oder Fristen.</div>
        ) : (
          <div style={styles.tableWrap}>
            <div style={styles.tableScroll}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Vorgangsnr.</th>
                    <th style={styles.th}>Antragsteller</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Wiedervorlage</th>
                    <th style={styles.th}>Frist</th>
                  </tr>
                </thead>
                <tbody>
                  {wiedervorlage.map((w) => (
                    <tr
                      key={w.id}
                      style={{ ...styles.row, ...(w.ueberfaellig ? { backgroundColor: theme.colors.errorLight } : {}) }}
                      onClick={() => navigate(`/apps/wohngeld/vorgang/${w.id}`)}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = w.ueberfaellig ? theme.colors.errorLight : theme.colors.surfaceHover; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = w.ueberfaellig ? theme.colors.errorLight : 'transparent'; }}
                    >
                      <td style={{ ...styles.td, fontWeight: theme.typography.weights.medium }}>{w.antragsId}</td>
                      <td style={styles.td}>{w.antragsteller}</td>
                      <td style={styles.td}><StatusBadge status={w.status} /></td>
                      <td style={{ ...styles.td, ...(w.ueberfaellig ? { color: theme.colors.error, fontWeight: theme.typography.weights.semibold } : {}) }}>
                        {fmtDate(w.wiedervorlage)}
                        {w.ueberfaellig && <span style={styles.wvBadge}>überfällig</span>}
                      </td>
                      <td style={{ ...styles.td, color: theme.colors.textMuted }}>{fmtDate(w.frist)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {viewMode === 'akten' && (
        selectedAkte ? (
          <>
            <button style={styles.backLink} onClick={() => { setSelectedAkte(null); setAkteVorgaenge([]); }}>‹ Alle Akten</button>
            <div style={{ marginBottom: theme.spacing.lg }}>
              <div style={{ fontSize: theme.typography.sizes.lg, fontWeight: theme.typography.weights.semibold, color: theme.colors.text }}>
                {selectedAkte.antragstellerName || selectedAkte.name}
              </div>
              <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>{akteAdresse(selectedAkte)}</div>
            </div>
            {akteVgLoading ? (
              <div style={styles.empty}>Lädt…</div>
            ) : akteVorgaenge.length === 0 ? (
              <div style={styles.empty}>Keine Vorgänge in dieser Akte.</div>
            ) : (
              <div style={styles.tableWrap}>
                <div style={styles.tableScroll}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Vorgangsnr.</th>
                        <th style={styles.th}>Wohngeldart</th>
                        <th style={styles.th}>Antragsart</th>
                        <th style={styles.th}>Status</th>
                        <th style={styles.th}>Letzte Änderung</th>
                      </tr>
                    </thead>
                    <tbody>
                      {akteVorgaenge.map((v) => (
                        <tr
                          key={v.id}
                          style={styles.row}
                          onClick={() => navigate(`/apps/wohngeld/vorgang/${v.id}`)}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surfaceHover; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <td style={{ ...styles.td, fontWeight: theme.typography.weights.medium }}>{v.antragsId}</td>
                          <td style={styles.td}>{WOHNGELDART_LABEL[v.wohngeldart] || v.wohngeldart}</td>
                          <td style={styles.td}>{ANTRAGSART_LABEL[v.antragsart] || v.antragsart}</td>
                          <td style={styles.td}><StatusBadge status={v.status} /></td>
                          <td style={{ ...styles.td, color: theme.colors.textMuted }}>{fmtDate(v.updated_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          loading ? (
            <div style={styles.empty}>Lädt…</div>
          ) : aktenListe.length === 0 ? (
            <div style={styles.empty}>Noch keine Akten.</div>
          ) : (
            <div style={styles.tableWrap}>
              <div style={styles.tableScroll}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Akte</th>
                      <th style={styles.th}>Antragsteller</th>
                      <th style={styles.th}>Adresse</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aktenListe.map((a) => (
                      <tr
                        key={a.id}
                        style={styles.row}
                        onClick={() => openAkte(a)}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surfaceHover; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <td style={{ ...styles.td, fontWeight: theme.typography.weights.medium }}>{a.name}</td>
                        <td style={styles.td}>{a.antragstellerName || '—'}</td>
                        <td style={{ ...styles.td, color: theme.colors.textMuted }}>{akteAdresse(a)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )
      )}

      {viewMode === 'regeln' && <RegelKatalog />}

      {viewMode === 'aufgaben' && (
        <div style={{ ...styles.toolbar, justifyContent: 'flex-end' }}>
          <ZustaendigFilter wert={aufgabenZustaendig} onChange={setAufgabenZustaendig} sachbearbeitung={sachbearbeitung} />
        </div>
      )}
      {viewMode === 'aufgaben' && (() => {
        const aufgabenGefiltert = aufgaben.filter((t) => passtZustaendigkeit(t, aufgabenZustaendig, sachbearbeitung.ich));
        return aufgabenLoading ? (
          <div style={styles.empty}>Lädt…</div>
        ) : aufgabenGefiltert.length === 0 ? (
          <div style={styles.empty}>{aufgaben.length === 0 ? 'Keine offenen Aufgaben oder Fristen.' : 'Keine Aufgaben für diese Auswahl.'}</div>
        ) : (
          <div style={styles.tableWrap}>
            <div style={styles.tableScroll}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Art</th>
                    <th style={styles.th}>Vorgangsnr.</th>
                    <th style={styles.th}>Antragsteller</th>
                    <th style={styles.th}>Aufgabe</th>
                    <th style={styles.th}>Sachbearbeitung</th>
                    <th style={styles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {aufgabenGefiltert.map((t, i) => {
                    const ueberfaellig = t.art === 'frist' && t.ueberfaellig;
                    return (
                      <tr
                        key={`${t.art}-${t.vorgangId}-${t.todoId || i}`}
                        style={{ ...styles.row, ...(ueberfaellig ? { backgroundColor: theme.colors.errorLight } : {}) }}
                        onClick={() => navigate(`/apps/wohngeld/vorgang/${t.vorgangId}`)}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = ueberfaellig ? theme.colors.errorLight : theme.colors.surfaceHover; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ueberfaellig ? theme.colors.errorLight : 'transparent'; }}
                      >
                        <td style={styles.td}>{t.art === 'todo' ? 'Todo' : 'Wiedervorlage'}</td>
                        <td style={{ ...styles.td, fontWeight: theme.typography.weights.medium }}>{t.antragsId}</td>
                        <td style={styles.td}>{t.antragsteller}</td>
                        <td style={{ ...styles.td, whiteSpace: 'normal', ...(ueberfaellig ? { color: theme.colors.error, fontWeight: theme.typography.weights.semibold } : {}) }}>
                          {t.art === 'todo' ? t.text : fmtDate(t.wiedervorlage)}
                          {ueberfaellig && <span style={styles.wvBadge}>überfällig</span>}
                        </td>
                        <td style={styles.td}>{t.sachbearbeiter || <span style={{ color: theme.colors.textMuted }}>nicht zugewiesen</span>}</td>
                        <td style={styles.td}><StatusBadge status={t.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {viewMode === 'protokoll' && isOwner && (
        <>
          <p style={{ ...styles.subtitle, marginTop: 0, marginBottom: theme.spacing.md }}>
            Datenschutz-/Revisionssicht: alle protokollierten Aktionen inklusive Lesezugriffen (Fall geöffnet) und Exporten.
            Nur für die Rolle Owner (DSB/Revision) sichtbar.
          </p>
          <div style={styles.protoBar}>
            <div style={styles.protoField}>
              <span style={styles.protoLabel}>Von</span>
              <input type="date" style={styles.protoInput} value={protFilter.von} onChange={(e) => setProtFilter({ ...protFilter, von: e.target.value })} />
            </div>
            <div style={styles.protoField}>
              <span style={styles.protoLabel}>Bis</span>
              <input type="date" style={styles.protoInput} value={protFilter.bis} onChange={(e) => setProtFilter({ ...protFilter, bis: e.target.value })} />
            </div>
            <div style={styles.protoField}>
              <span style={styles.protoLabel}>Aktion</span>
              <select style={{ ...styles.protoInput, cursor: 'pointer' }} value={protFilter.aktion} onChange={(e) => setProtFilter({ ...protFilter, aktion: e.target.value })}>
                <option value="">Alle Aktionen</option>
                {Object.entries(AKTION_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div style={styles.protoField}>
              <span style={styles.protoLabel}>Vorgang (ID)</span>
              <input style={styles.protoInput} placeholder="vorgang-…" value={protFilter.vorgangId} onChange={(e) => setProtFilter({ ...protFilter, vorgangId: e.target.value })} />
            </div>
            <div style={styles.protoField}>
              <span style={styles.protoLabel}>Akteur</span>
              <input style={styles.protoInput} placeholder="Name filtern…" value={akteurQuery} onChange={(e) => setAkteurQuery(e.target.value)} />
            </div>
            <button style={styles.btn} onClick={loadProtokoll} disabled={protLoading}>
              {protLoading ? 'Lädt…' : 'Filtern'}
            </button>
            <button style={styles.btnGhost} onClick={exportProtokoll} disabled={protExporting || protLoading}>
              {protExporting ? 'Exportiert…' : 'Als CSV exportieren'}
            </button>
          </div>

          {protLoading ? (
            <div style={styles.empty}>Lädt…</div>
          ) : protokollGefiltert.length === 0 ? (
            <div style={styles.empty}>Keine Protokolleinträge für diesen Filter.</div>
          ) : (
            <>
              <div style={styles.protoCount}>
                {protokollGefiltert.length} angezeigt
                {protGesamt > protokoll.length ? ` · ${protGesamt} gesamt (Limit erreicht — Filter verfeinern)` : ''}
              </div>
              <div style={styles.tableWrap}>
                <div style={styles.tableScroll}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Zeit</th>
                        <th style={styles.th}>Akteur</th>
                        <th style={styles.th}>Rolle</th>
                        <th style={styles.th}>Aktion</th>
                        <th style={styles.th}>Objekt</th>
                        <th style={styles.th}>Vorgang</th>
                        <th style={styles.th}>Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {protokollGefiltert.map((e) => (
                        <tr key={e.id}>
                          <td style={{ ...styles.td, color: theme.colors.textMuted }}>{fmtDateTime(e.timestamp)}</td>
                          <td style={styles.td}>{e.akteurName || '—'}</td>
                          <td style={styles.td}>{e.akteurRolle ? (APP_ROLE_LABEL[e.akteurRolle] || e.akteurRolle) : '—'}</td>
                          <td style={styles.td}>{aktionLabel(e.aktion)}</td>
                          <td style={styles.td}>{objektText(e)}</td>
                          <td
                            style={{ ...styles.td, ...(e.vorgangId ? { color: ACCENT, cursor: 'pointer' } : { color: theme.colors.textMuted }) }}
                            onClick={e.vorgangId ? () => navigate(`/apps/wohngeld/vorgang/${e.vorgangId}`) : undefined}
                          >
                            {e.vorgangId || '—'}
                          </td>
                          <td style={styles.detailCell}>{e.detail || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {viewMode === 'loeschfaellig' && isOwner && (
        <>
          <p style={styles.hint}>
            Vorgänge, deren gesetzliche Aufbewahrungsfrist abgelaufen ist und für die kein Legal Hold besteht.
            Die Löschung erfolgt manuell und muss bestätigt werden — es gibt keine automatische Löschung.
          </p>
          {lfLoading ? (
            <div style={styles.empty}>Lädt…</div>
          ) : loeschfaellig.length === 0 ? (
            <div style={styles.empty}>Keine löschfälligen Vorgänge.</div>
          ) : (
            <div style={styles.tableWrap}>
              <div style={styles.tableScroll}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Vorgangsnr.</th>
                      <th style={styles.th}>Antragsteller</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Aufbewahrung bis</th>
                      <th style={styles.th}>Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loeschfaellig.map((v) => (
                      <tr key={v.id}>
                        <td
                          style={{ ...styles.td, fontWeight: theme.typography.weights.medium, color: ACCENT, cursor: 'pointer' }}
                          onClick={() => navigate(`/apps/wohngeld/vorgang/${v.id}`)}
                        >
                          {v.antragsId}
                        </td>
                        <td style={styles.td}>{v.antragsteller}</td>
                        <td style={styles.td}><StatusBadge status={v.status} /></td>
                        <td style={{ ...styles.td, color: theme.colors.error, fontWeight: theme.typography.weights.semibold }}>{fmtDate(v.aufbewahrungBis)}</td>
                        <td style={styles.td}>
                          <button style={styles.btnDanger} onClick={() => setLfDeleteTarget(v)}>Löschen</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {lfDeleteTarget && (
        <div style={styles.overlay} onClick={() => !lfDeleting && setLfDeleteTarget(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>Vorgang endgültig löschen?</div>
            <p style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text, marginBottom: theme.spacing.md, lineHeight: 1.6 }}>
              Der Vorgang <strong>{lfDeleteTarget.antragsId}</strong> ({lfDeleteTarget.antragsteller}) und alle zugehörigen
              Personen, Dokumente, Prüfschritte und Schreiben werden unwiderruflich gelöscht.
            </p>
            <p style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted, marginBottom: theme.spacing.lg, lineHeight: 1.6 }}>
              Aufbewahrungsfrist abgelaufen am {fmtDate(lfDeleteTarget.aufbewahrungBis)}. Diese Aktion wird protokolliert.
            </p>
            <div style={styles.modalActions}>
              <button style={styles.btnGhost} onClick={() => setLfDeleteTarget(null)} disabled={lfDeleting}>Abbrechen</button>
              <button
                style={{ ...styles.btn, backgroundColor: theme.colors.error }}
                onClick={confirmLoeschen}
                disabled={lfDeleting}
              >
                {lfDeleting ? 'Löscht…' : 'Endgültig löschen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {dialog && (
        <div style={styles.overlay} onClick={() => !saving && setDialog(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>Neuer Vorgang</div>
            <p style={styles.hint}>
              Für Fälle ohne Unterlagen, etwa nach einer Vorsprache. Liegt ein Antrag vor, genügt es, ihn danach im
              Vorgang unter „Dokumente" hochzuladen oder über den Posteingang zu erfassen: Antragsdatum, Adresse, Miete
              und Haushalt werden dann aus dem Antrag übernommen. Der Vorgang wird Ihnen zugewiesen.
            </p>

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
