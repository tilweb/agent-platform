import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../config/theme';
import { ArrowLeftIcon, TrashIcon, SparklesIcon, PenIcon } from '../../components/Icons';
import ConfirmModal from '../../components/ConfirmModal';
import DocumentTypeModal from './components/DocumentTypeModal';
import IncotermModal from './components/IncotermModal';
import {
  listDocumentTypes, createDocumentType, updateDocumentType, deleteDocumentType,
  listIncoterms, createIncoterm, updateIncoterm, deleteIncoterm,
  listMappings, replaceMappingsForKey,
} from './hooks/useVorgangsmappe';

const GESCHAEFTSARTEN = [
  { id: 'lager', label: 'Lager' },
  { id: 'strecke', label: 'Strecke' },
];
const BEREICHE = ['einkauf', 'verkauf', 'produktion', 'sonstiges'];
const BEREICH_LABELS = { einkauf: 'Einkauf', verkauf: 'Verkauf', produktion: 'Produktion', sonstiges: 'Sonstiges' };

const styles = {
  container: { height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: theme.colors.background },
  header: { padding: `${theme.spacing.xl} ${theme.spacing['2xl']}`, borderBottom: `1px solid ${theme.colors.border}` },
  backLink: {
    display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs,
    fontSize: theme.typography.sizes.sm, color: theme.colors.primary,
    cursor: 'pointer', marginBottom: theme.spacing.lg,
    border: 'none', background: 'none', padding: 0, fontWeight: theme.typography.weights.medium,
  },
  title: { fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, color: theme.colors.text },
  subtitle: { marginTop: theme.spacing.sm, fontSize: theme.typography.sizes.base, color: theme.colors.textSecondary },
  tabs: { display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.lg },
  tab: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent', border: 'none',
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted, cursor: 'pointer',
  },
  tabActive: { backgroundColor: theme.colors.primaryLight, color: theme.colors.primary },
  body: { flex: 1, minHeight: 0, overflow: 'auto', padding: theme.spacing['2xl'] },

  toolbar: { display: 'flex', gap: theme.spacing.md, marginBottom: theme.spacing.lg, alignItems: 'center' },
  filterInput: {
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
    minWidth: '260px',
  },
  primaryBtn: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.primary,
    color: '#fff', border: 'none',
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs,
  },
  iconBtn: {
    padding: theme.spacing.xs,
    backgroundColor: 'transparent',
    color: theme.colors.textMuted,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28,
  },
  iconBtnDanger: { color: theme.colors.error, borderColor: `${theme.colors.error}30` },

  table: { width: '100%', borderCollapse: 'collapse', fontSize: theme.typography.sizes.sm },
  th: {
    textAlign: 'left',
    padding: theme.spacing.sm,
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.background,
    position: 'sticky', top: 0, zIndex: 1,
  },
  td: { padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}`, color: theme.colors.text, verticalAlign: 'middle' },
  idCell: { fontFamily: 'monospace', fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted },
  matchCell: { fontFamily: 'monospace', fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted },
  actionCell: { width: 100, textAlign: 'right', whiteSpace: 'nowrap' },
  actionCellInner: { display: 'inline-flex', gap: theme.spacing.xs },

  bereichBadge: {
    display: 'inline-block',
    padding: `2px ${theme.spacing.sm}`,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.text,
  },

  // Matrix
  matrixWrapper: { overflow: 'auto', border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md },
  matrixTable: { borderCollapse: 'collapse', minWidth: '100%' },
  matrixHeader: {
    position: 'sticky', top: 0, zIndex: 2,
    backgroundColor: theme.colors.surface,
    borderBottom: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.sm,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    minWidth: 110,
    textAlign: 'center',
  },
  matrixCellLabel: {
    position: 'sticky', left: 0, zIndex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.sm,
    borderBottom: `1px solid ${theme.colors.border}`,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    minWidth: 280,
  },
  matrixCheckCell: {
    padding: theme.spacing.sm,
    textAlign: 'center',
    borderBottom: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.surface,
  },
  matrixGroupRow: {
    backgroundColor: theme.colors.surfaceHover,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: theme.spacing.sm,
  },
  errorBox: {
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    marginBottom: theme.spacing.md,
  },
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('document-types');

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backLink} onClick={() => navigate('/apps/vorgangsmappe')}>
          <ArrowLeftIcon /> Vorgangsmappe
        </button>
        <h1 style={styles.title}>Einstellungen</h1>
        <p style={styles.subtitle}>
          Dokumententypen, Incoterms und Pflicht-Mappings pflegen.
        </p>
        <div style={styles.tabs}>
          <button
            style={{ ...styles.tab, ...(tab === 'document-types' ? styles.tabActive : {}) }}
            onClick={() => setTab('document-types')}
          >Dokumententypen</button>
          <button
            style={{ ...styles.tab, ...(tab === 'incoterms' ? styles.tabActive : {}) }}
            onClick={() => setTab('incoterms')}
          >Incoterms</button>
          <button
            style={{ ...styles.tab, ...(tab === 'mappings' ? styles.tabActive : {}) }}
            onClick={() => setTab('mappings')}
          >Pflicht-Mapping</button>
        </div>
      </div>
      <div style={styles.body}>
        {tab === 'document-types' && <DocumentTypesTab />}
        {tab === 'incoterms' && <IncotermsTab />}
        {tab === 'mappings' && <MappingsTab />}
      </div>
    </div>
  );
}

/* =================== Document Types Tab =================== */

function DocumentTypesTab() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');
  const [bereichFilter, setBereichFilter] = useState('');

  // Form-Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [editTarget, setEditTarget] = useState(null);

  // Delete-Modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const reload = async () => {
    try { setRows(await listDocumentTypes()); setError(null); }
    catch (err) { setError(err.message); }
  };
  useEffect(() => { reload(); }, []);

  const visible = useMemo(() => {
    let v = rows;
    if (bereichFilter) v = v.filter((r) => r.bereich === bereichFilter);
    if (filter) {
      const f = filter.toLowerCase();
      v = v.filter((r) =>
        r.id.toLowerCase().includes(f) ||
        r.label.toLowerCase().includes(f) ||
        (r.matchAny || []).some((m) => m.toLowerCase().includes(f)),
      );
    }
    return v;
  }, [rows, filter, bereichFilter]);

  const openCreate = () => { setModalMode('create'); setEditTarget(null); setModalOpen(true); };
  const openEdit = (row) => { setModalMode('edit'); setEditTarget(row); setModalOpen(true); };

  const handleSave = async (payload) => {
    if (modalMode === 'create') {
      await createDocumentType(payload);
    } else {
      const { id, ...patch } = payload;
      await updateDocumentType(editTarget.id, patch);
    }
    await reload();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDocumentType(deleteTarget.id);
      setDeleteTarget(null);
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      {error && <div style={styles.errorBox}>{error}</div>}
      <div style={styles.toolbar}>
        <input style={styles.filterInput} placeholder="Filter (Label / ID / Match-Wert)" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <select style={styles.filterInput} value={bereichFilter} onChange={(e) => setBereichFilter(e.target.value)}>
          <option value="">Alle Bereiche</option>
          {BEREICHE.map((b) => <option key={b} value={b}>{BEREICH_LABELS[b]}</option>)}
        </select>
        <button style={styles.primaryBtn} onClick={openCreate}><SparklesIcon size={14} color="#fff" />Neuer Doc-Type</button>
        <span style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.xs, marginLeft: 'auto' }}>
          {visible.length} / {rows.length} Eintraege
        </span>
      </div>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Label</th>
            <th style={styles.th}>Bereich</th>
            <th style={styles.th}>Match-Werte</th>
            <th style={styles.th}>Statusgebend</th>
            <th style={styles.th}>ID</th>
            <th style={styles.th}></th>
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => (
            <tr key={r.id}>
              <td style={styles.td}>{r.label}</td>
              <td style={styles.td}><span style={styles.bereichBadge}>{BEREICH_LABELS[r.bereich] || r.bereich}</span></td>
              <td style={{ ...styles.td, ...styles.matchCell }}>{(r.matchAny || []).join(', ') || '—'}</td>
              <td style={styles.td}>
                {r.statusgebend
                  ? <span style={{ ...styles.bereichBadge, backgroundColor: theme.colors.primaryLight, color: theme.colors.primary }}>Ja</span>
                  : <span style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.xs }}>—</span>}
              </td>
              <td style={{ ...styles.td, ...styles.idCell }}>{r.id}</td>
              <td style={{ ...styles.td, ...styles.actionCell }}>
                <div style={styles.actionCellInner}>
                  <button style={styles.iconBtn} onClick={() => openEdit(r)} title="Bearbeiten"><PenIcon size={12} /></button>
                  <button style={{ ...styles.iconBtn, ...styles.iconBtnDanger }} onClick={() => setDeleteTarget(r)} title="Loeschen"><TrashIcon size={12} /></button>
                </div>
              </td>
            </tr>
          ))}
          {visible.length === 0 && (
            <tr>
              <td colSpan={6} style={{ ...styles.td, textAlign: 'center', color: theme.colors.textMuted, padding: theme.spacing.xl }}>
                Keine Eintraege fuer diesen Filter.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <DocumentTypeModal
        open={modalOpen}
        mode={modalMode}
        initial={editTarget}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
      <ConfirmModal
        open={!!deleteTarget}
        title="Dokumententyp loeschen?"
        message={deleteTarget ? <>„{deleteTarget.label}" wird geloescht. Vorhandene Pflicht-Mappings mit diesem Typ werden ebenfalls entfernt.</> : ''}
        confirmLabel="Loeschen"
        destructive
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

/* =================== Incoterms Tab =================== */

function IncotermsTab() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [editTarget, setEditTarget] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const reload = async () => {
    try { setRows(await listIncoterms()); setError(null); }
    catch (err) { setError(err.message); }
  };
  useEffect(() => { reload(); }, []);

  const openCreate = () => { setModalMode('create'); setEditTarget(null); setModalOpen(true); };
  const openEdit = (row) => { setModalMode('edit'); setEditTarget(row); setModalOpen(true); };

  const handleSave = async (payload) => {
    if (modalMode === 'create') {
      await createIncoterm(payload);
    } else {
      const { code, ...patch } = payload;
      await updateIncoterm(editTarget.code, patch);
    }
    await reload();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteIncoterm(deleteTarget.code);
      setDeleteTarget(null);
      await reload();
    } catch (err) { setError(err.message); }
    finally { setDeleting(false); }
  };

  return (
    <div>
      {error && <div style={styles.errorBox}>{error}</div>}
      <div style={styles.toolbar}>
        <button style={styles.primaryBtn} onClick={openCreate}><SparklesIcon size={14} color="#fff" />Neuer Incoterm</button>
        <span style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.xs, marginLeft: 'auto' }}>
          {rows.length} Incoterms
        </span>
      </div>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Code</th>
            <th style={styles.th}>Label</th>
            <th style={styles.th}>Beschreibung</th>
            <th style={styles.th}>Sort</th>
            <th style={styles.th}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code}>
              <td style={{ ...styles.td, fontWeight: theme.typography.weights.bold, fontFamily: 'monospace' }}>{r.code}</td>
              <td style={styles.td}>{r.label}</td>
              <td style={{ ...styles.td, color: theme.colors.textMuted }}>{r.description || '—'}</td>
              <td style={{ ...styles.td, color: theme.colors.textMuted }}>{r.sortOrder}</td>
              <td style={{ ...styles.td, ...styles.actionCell }}>
                <div style={styles.actionCellInner}>
                  <button style={styles.iconBtn} onClick={() => openEdit(r)} title="Bearbeiten"><PenIcon size={12} /></button>
                  <button style={{ ...styles.iconBtn, ...styles.iconBtnDanger }} onClick={() => setDeleteTarget(r)} title="Loeschen"><TrashIcon size={12} /></button>
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} style={{ ...styles.td, textAlign: 'center', color: theme.colors.textMuted, padding: theme.spacing.xl }}>
                Noch keine Incoterms angelegt.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <IncotermModal
        open={modalOpen}
        mode={modalMode}
        initial={editTarget}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
      <ConfirmModal
        open={!!deleteTarget}
        title="Incoterm loeschen?"
        message={deleteTarget ? <>Incoterm „{deleteTarget.code}" wird geloescht. Vorhandene Pflicht-Mappings mit diesem Incoterm werden ebenfalls entfernt.</> : ''}
        confirmLabel="Loeschen"
        destructive
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

/* =================== Mappings Tab (Matrix-Editor) =================== */

function MappingsTab() {
  const [docTypes, setDocTypes] = useState([]);
  const [incoterms, setIncoterms] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [error, setError] = useState(null);
  const [incotermFilter, setIncotermFilter] = useState('');

  const reload = async () => {
    try {
      const [d, i, m] = await Promise.all([listDocumentTypes(), listIncoterms(), listMappings()]);
      setDocTypes(d);
      setIncoterms(i);
      setMappings(m);
      setError(null);
    } catch (err) { setError(err.message); }
  };
  useEffect(() => { reload(); }, []);

  const incotermsToShow = incotermFilter
    ? incoterms.filter((ic) => ic.code === incotermFilter)
    : incoterms;

  const lookup = useMemo(() => {
    const map = new Map();
    for (const m of mappings) {
      map.set(`${m.incoterm}|${m.geschaeftsart}|${m.documentTypeId}`, true);
    }
    return map;
  }, [mappings]);
  const isSet = (i, g, d) => lookup.has(`${i}|${g}|${d}`);

  const toggle = async (incoterm, geschaeftsart, documentTypeId) => {
    const current = mappings
      .filter((m) => m.incoterm === incoterm && m.geschaeftsart === geschaeftsart)
      .map((m) => m.documentTypeId);
    const next = isSet(incoterm, geschaeftsart, documentTypeId)
      ? current.filter((id) => id !== documentTypeId)
      : [...current, documentTypeId];
    try {
      await replaceMappingsForKey(incoterm, geschaeftsart, next);
      await reload();
    } catch (err) { setError(err.message); }
  };

  const grouped = useMemo(() => {
    const g = {};
    for (const dt of docTypes) {
      g[dt.bereich] = g[dt.bereich] || [];
      g[dt.bereich].push(dt);
    }
    return g;
  }, [docTypes]);

  return (
    <div>
      {error && <div style={styles.errorBox}>{error}</div>}
      <div style={styles.toolbar}>
        <select style={styles.filterInput} value={incotermFilter} onChange={(e) => setIncotermFilter(e.target.value)}>
          <option value="">Alle Incoterms anzeigen</option>
          {incoterms.map((ic) => <option key={ic.code} value={ic.code}>{ic.code}</option>)}
        </select>
        <span style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.xs, marginLeft: 'auto' }}>
          {mappings.length} Pflicht-Eintraege gesamt
        </span>
      </div>

      <div style={styles.matrixWrapper}>
        <table style={styles.matrixTable}>
          <thead>
            <tr>
              <th style={{ ...styles.matrixHeader, textAlign: 'left' }}>Dokumententyp</th>
              {incotermsToShow.map((ic) => GESCHAEFTSARTEN.map((ga) => (
                <th key={`${ic.code}-${ga.id}`} style={styles.matrixHeader}>
                  <div>{ic.code}</div>
                  <div style={{ fontWeight: theme.typography.weights.normal, marginTop: 2 }}>{ga.label}</div>
                </th>
              )))}
            </tr>
          </thead>
          <tbody>
            {BEREICHE.flatMap((bereich) => {
              const dts = grouped[bereich] || [];
              if (dts.length === 0) return [];
              return [
                <tr key={`group-${bereich}`}>
                  <td colSpan={1 + incotermsToShow.length * GESCHAEFTSARTEN.length} style={styles.matrixGroupRow}>
                    {BEREICH_LABELS[bereich]}
                  </td>
                </tr>,
                ...dts.map((dt) => (
                  <tr key={dt.id}>
                    <td style={styles.matrixCellLabel}>
                      {dt.label}
                      <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginTop: 2, fontFamily: 'monospace' }}>{dt.id}</div>
                    </td>
                    {incotermsToShow.map((ic) => GESCHAEFTSARTEN.map((ga) => (
                      <td key={`${ic.code}-${ga.id}`} style={styles.matrixCheckCell}>
                        <input
                          type="checkbox"
                          checked={isSet(ic.code, ga.id, dt.id)}
                          onChange={() => toggle(ic.code, ga.id, dt.id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                    )))}
                  </tr>
                )),
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
