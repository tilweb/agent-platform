import { useState, useEffect, useRef, Fragment } from 'react';
import { theme } from '../config/theme';
import { apiGet, apiPost, apiPut, apiDelete, apiPostForm, API_URL } from '../utils/apiFetch';
import { DocumentIcon, TrashIcon, RefreshIcon, ArrowLeftIcon, SparklesIcon, HelpCircleIcon, TableIcon, BarChartIcon, FolderOpenIcon } from '../components/Icons';
import ExportDropdown from '../components/ExportDropdown';
import { useProviders } from '../hooks/useProviders';

// ============== Styles ==============

const styles = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: `${theme.spacing.xl} ${theme.spacing['2xl']}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
  },
  content: {
    flex: 1,
    minWidth: 0,
    overflow: 'auto',
    padding: theme.spacing['2xl'],
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.xl,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  cardName: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  cardDesc: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
    lineHeight: theme.typography.lineHeight.normal,
  },
  cardMeta: {
    display: 'flex',
    gap: theme.spacing.lg,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  badge: {
    fontSize: theme.typography.sizes.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
  },
  primaryBtn: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  secondaryBtn: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  dangerBtn: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.error,
    border: `1px solid ${theme.colors.error}30`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.primary,
    cursor: 'pointer',
    marginBottom: theme.spacing.lg,
    border: 'none',
    background: 'none',
    padding: 0,
    fontWeight: theme.typography.weights.medium,
  },
  input: {
    width: '100%',
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
  },
  label: {
    display: 'block',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  tabs: {
    display: 'flex',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
  },
  tab: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  tabActive: {
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
  },
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  dropZone: {
    border: `2px dashed ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing['2xl'],
    textAlign: 'center',
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  dropZoneActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  splitView: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing.lg,
    minHeight: '400px',
  },
  docPanel: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.lg,
    overflow: 'auto',
    maxHeight: '500px',
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    whiteSpace: 'pre-wrap',
    fontFamily: theme.typography.fontMono,
    lineHeight: theme.typography.lineHeight.relaxed,
  },
  formPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  },
  fieldRow: {
    display: 'flex',
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  guidelinesBox: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.lg,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    whiteSpace: 'pre-wrap',
    lineHeight: theme.typography.lineHeight.relaxed,
    minHeight: '120px',
  },
  exampleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    marginBottom: theme.spacing.sm,
  },
  select: {
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
  },
  checkbox: {
    marginRight: theme.spacing.sm,
    accentColor: theme.colors.primary,
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing['3xl'],
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
};

// ============== Field Type Options ==============

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Zahl' },
  { value: 'date', label: 'Datum' },
  { value: 'boolean', label: 'Ja/Nein' },
  { value: 'list', label: 'Liste / Positionen' },
];

// Positions-Spalten sind immer skalar (keine Listen in Listen).
const ITEM_FIELD_TYPES = FIELD_TYPES.filter(t => t.value !== 'list');

/** Label → Feld-ID (identische Slug-Logik wie im Backend/createProject). */
function slugifyFieldLabel(label) {
  return label
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/** item_fields-Objekt (API) → Array-Form für den Editor. */
function itemFieldsToArray(obj) {
  return Object.entries(obj || {}).map(([id, f]) => ({
    id,
    label: f.label || id,
    type: f.type || 'text',
    required: !!f.required,
    description: f.description || '',
    catalog: f.catalog || null,
  }));
}

/** Editor-Array → item_fields-Objekt (API). Leere Labels werden verworfen. */
function itemFieldsToObject(arr) {
  const obj = {};
  for (const f of (arr || []).filter(f => f.label && f.label.trim())) {
    const id = f.id || slugifyFieldLabel(f.label);
    obj[id] = {
      type: f.type,
      label: f.label,
      ...(f.required ? { required: true } : {}),
      ...(f.description ? { description: f.description } : {}),
      ...(f.catalog ? { catalog: f.catalog } : {}),
    };
  }
  return obj;
}

// Heavy-Extraction-Pipeline-Strategien (siehe backend/src/services/extraction/).
const EXTRACTION_STRATEGIES = [
  { value: 'hybrid', label: 'Hybrid — Text + Vision-Fallback (empfohlen)' },
  { value: 'single-pass', label: 'Single-Pass — ein Durchlauf, kurze Dokumente' },
  { value: 'long-text-chunked', label: 'Long-Text — Chunking fuer lange Dokumente' },
  { value: 'vision-per-page', label: 'Vision-per-Page — Scans, Fotos, Handschrift' },
];

// ============== Main Component ==============

export default function ExtractionProjectsPage() {
  const [view, setView] = useState('list'); // list | create | detail | inbox
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  const [inboxOpenCount, setInboxOpenCount] = useState(0);
  const importInputRef = useRef(null);

  useEffect(() => {
    loadProjects();
    loadInboxCount();
  }, []);

  // Zähler „offene Posteingang-Posten": laufende Uploads + unzugeordnete Teile.
  async function loadInboxCount() {
    try {
      const res = await apiGet('/extraction/inbox');
      if (res.ok) {
        const uploads = await res.json();
        let count = 0;
        for (const u of uploads) {
          if (u.status === 'processing') count += 1;
          count += (u.parts || []).filter(p => p.status === 'unassigned').length;
        }
        setInboxOpenCount(count);
      }
    } catch { /* ignore */ }
  }

  async function handleImportFile(file) {
    if (!file) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const text = await file.text();
      let bundle;
      try { bundle = JSON.parse(text); }
      catch { setImportMsg({ ok: false, text: 'Datei ist kein gültiges JSON.' }); return; }
      const res = await apiPost('/extraction/projects/import', bundle);
      if (res.ok) {
        const proj = await res.json();
        await loadProjects();
        setImportMsg({ ok: true, text: `Importiert: „${proj.name}".` });
        openProject(proj.id);
      } else {
        const err = await res.json().catch(() => ({}));
        setImportMsg({ ok: false, text: `Fehler: ${err.error || res.status}` });
      }
    } catch {
      setImportMsg({ ok: false, text: 'Netzwerkfehler beim Import.' });
    } finally {
      setImporting(false);
    }
  }

  async function loadProjects() {
    try {
      const res = await apiGet('/extraction/projects');
      if (res.ok) {
        setProjects(await res.json());
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  }

  function openProject(id) {
    setSelectedProjectId(id);
    setView('detail');
  }

  function goBack() {
    setView('list');
    setSelectedProjectId(null);
    loadProjects();
    loadInboxCount();
  }

  if (view === 'create') {
    return <CreateProjectView onBack={goBack} onCreated={(id) => { openProject(id); }} />;
  }

  if (view === 'detail' && selectedProjectId) {
    return <ProjectDetailView projectId={selectedProjectId} onBack={goBack} />;
  }

  if (view === 'inbox') {
    return <InboxView projects={projects} onBack={goBack} onOpenProject={openProject} />;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Dokumenten-Extraktion</h1>
          <p style={styles.subtitle}>Lernende Extraktion — definiere Felder, trainiere durch Korrektur</p>
        </div>
        <div style={{ display: 'flex', gap: theme.spacing.md, alignItems: 'center' }}>
          <button style={styles.secondaryBtn} onClick={() => setView('inbox')}>
            <FolderOpenIcon size={16} />
            Posteingang{inboxOpenCount > 0 ? ` (${inboxOpenCount})` : ''}
          </button>
          <button style={styles.secondaryBtn} onClick={() => importInputRef.current?.click()} disabled={importing}>
            {importing ? <Spinner size={14} /> : <DocumentIcon size={16} />}
            {importing ? 'Importiere…' : 'Importieren'}
          </button>
          <input
            ref={importInputRef} type="file" hidden accept=".json,application/json"
            onChange={(e) => { handleImportFile(e.target.files?.[0]); e.target.value = ''; }}
          />
          <button style={styles.primaryBtn} onClick={() => setView('create')}>
            <SparklesIcon size={16} /> Neues Projekt
          </button>
        </div>
      </div>
      <div style={styles.content}>
        {importMsg && (
          <div style={{
            marginBottom: theme.spacing.lg, padding: theme.spacing.md,
            borderRadius: theme.borderRadius.lg, fontSize: theme.typography.sizes.sm,
            backgroundColor: importMsg.ok ? theme.colors.successLight : theme.colors.errorLight,
            color: importMsg.ok ? theme.colors.success : theme.colors.error,
          }}>{importMsg.text}</div>
        )}
        {loading ? (
          <div style={styles.emptyState}>Laden...</div>
        ) : projects.length === 0 ? (
          <div style={styles.emptyState}>
            Noch keine Extraktionsprojekte vorhanden. Erstelle ein neues Projekt, um zu beginnen.
          </div>
        ) : (
          <div style={styles.grid}>
            {projects.map(p => (
              <div
                key={p.id}
                style={styles.card}
                onClick={() => openProject(p.id)}
                onMouseEnter={e => { e.currentTarget.style.borderColor = theme.colors.primary; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = theme.colors.border; }}
              >
                <div style={styles.cardName}>{p.name}</div>
                <div style={styles.cardDesc}>{p.description || 'Keine Beschreibung'}</div>
                <div style={styles.cardMeta}>
                  <span>{p.field_count} Felder</span>
                  <span>{p.learning?.total_examples || 0} Beispiele</span>
                  {p.learning?.accuracy_estimate > 0 && (
                    <span style={{
                      ...styles.badge,
                      backgroundColor: p.learning.accuracy_estimate >= 80 ? theme.colors.successLight : theme.colors.warningLight,
                      color: p.learning.accuracy_estimate >= 80 ? theme.colors.success : theme.colors.warning,
                    }}>
                      ~{p.learning.accuracy_estimate}% Genauigkeit
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============== Modell-Override-Selektor (analog zu Agenten) ==============

/**
 * Optionaler Modell-Override für ein Extraktionsprojekt. value ist
 * `{ provider_id, model_id }` oder null (= System-Standard). Listet die aktiven
 * Chat-/Vision-Modelle; Vision-fähige sind markiert (vision-Strategien brauchen
 * ein vision-fähiges Modell).
 */
function ModelOverrideSelect({ value, onChange }) {
  const { enabledProviders, getExtendedCapabilities, isLoading } = useProviders();

  const options = [];
  for (const p of enabledProviders) {
    for (const m of (p.models || [])) {
      if (m.type !== 'llm' && m.type !== 'vllm') continue;
      const caps = getExtendedCapabilities(m);
      options.push({
        key: `${p.id}|${m.id}`,
        label: `${m.name || m.id}${caps.vision ? ' · Vision' : ''} — ${p.name}`,
      });
    }
  }

  const current = value?.provider_id && value?.model_id ? `${value.provider_id}|${value.model_id}` : '';
  // Aktuell gesetztes Modell erhalten, auch wenn es (noch) nicht in der Provider-Liste ist.
  if (current && !options.some(o => o.key === current)) {
    options.unshift({ key: current, label: `${value.model_id} (aktuell, nicht in Provider-Liste)` });
  }

  return (
    <select
      style={{ ...styles.select, width: '100%' }}
      value={current}
      disabled={isLoading}
      onChange={(e) => {
        const v = e.target.value;
        if (!v) { onChange(null); return; }
        const [provider_id, model_id] = v.split('|');
        onChange({ provider_id, model_id });
      }}
    >
      <option value="">System-Standard verwenden</option>
      {options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
    </select>
  );
}

// ============== Listen-Felder: Spalten-Editor + Positions-Tabelle ==============

/**
 * Subeditor für die Positions-Spalten eines list-Felds (Schema-Definition).
 * `itemFields` ist die Array-Form ([{id,label,type,required,description}]),
 * `onChange` bekommt das aktualisierte Array.
 */
/**
 * Tabellen-Liste (für Wertelisten aus einer Tabellenspalte). Modul-weit
 * zwischengespeichert — der Feld-Editor rendert viele Katalog-Editoren, die
 * sollen nicht je einen eigenen Request auslösen.
 */
let tablesCache = null;
function useTables() {
  const [tables, setTables] = useState(tablesCache || []);
  useEffect(() => {
    if (tablesCache) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet('/tables');
        if (!res.ok) return;
        const json = await res.json();
        tablesCache = json.tables || [];
        if (!cancelled) setTables(tablesCache);
      } catch {
        /* Tabellen sind optional — ohne sie bleibt die statische Liste */
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return tables;
}

/** Werteliste ⇄ Textarea: eine Zeile je Wert, Synonyme nach `=` und Komma. */
function catalogValuesToText(values) {
  return (values || [])
    .map(v => (v.synonyms?.length ? `${v.value} = ${v.synonyms.join(', ')}` : v.value))
    .join('\n');
}

function textToCatalogValues(text) {
  return String(text || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [value, syn] = line.split('=');
      const synonyms = (syn || '').split(',').map(s => s.trim()).filter(Boolean);
      return { value: value.trim(), ...(synonyms.length ? { synonyms } : {}) };
    })
    .filter(v => v.value);
}

/**
 * Kontrollierte Werteliste eines Feldes (Welle 6): Quelle, Werte/Synonyme,
 * automatisches Angleichen und Wirkung eines Ausreißers.
 */
function CatalogEditor({ catalog, onChange, compact = false }) {
  const tables = useTables();
  const source = catalog?.source || 'none';
  const table = tables.find(t => t.id === catalog?.table_id);

  /**
   * Der Rohtext der Werteliste lebt lokal — würde das Textfeld bei jedem
   * Tastendruck aus den geparsten Werten neu gerendert, käme das Getippte
   * normalisiert zurück: `trim()` frisst das Leerzeichen am Wortende, und eine
   * gerade begonnene (noch leere) Zeile verschwindet sofort wieder. Nach außen
   * gehen weiterhin die geparsten Werte.
   */
  const [valueText, setValueText] = useState(() => catalogValuesToText(catalog?.values));
  const lastEmitted = useRef(valueText);

  // Von außen gesetzte Werte übernehmen (Projektwechsel, Feldvorschlag aus einem
  // Beispieldokument) — aber niemals die eigene, gerade getippte Eingabe.
  useEffect(() => {
    const incoming = catalogValuesToText(catalog?.values);
    if (incoming !== catalogValuesToText(textToCatalogValues(lastEmitted.current))) {
      lastEmitted.current = incoming;
      setValueText(incoming);
    }
  }, [catalog?.values]);

  function handleValueText(text) {
    lastEmitted.current = text;
    setValueText(text);
    onChange({ ...catalog, values: textToCatalogValues(text) });
  }

  function setSource(next) {
    if (next === 'none') return onChange(null);
    if (next === 'list') return onChange({ source: 'list', values: catalog?.values || [] });
    return onChange({ source: 'table', table_id: catalog?.table_id || tables[0]?.id || '', column_id: '' });
  }

  const labelStyle = { ...styles.label, fontSize: theme.typography.sizes.xs };

  return (
    <div style={{ marginTop: theme.spacing.sm }}>
      <div style={{ display: 'flex', gap: theme.spacing.md, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ width: compact ? 180 : 220 }}>
          <label style={labelStyle}>Zulässige Werte</label>
          <select style={{ ...styles.select, width: '100%' }} value={source} onChange={e => setSource(e.target.value)}>
            <option value="none">— beliebig —</option>
            <option value="list">Feste Liste</option>
            <option value="table" disabled={tables.length === 0}>Aus Tabellenspalte</option>
          </select>
        </div>

        {source === 'table' && (
          <>
            <div style={{ flex: 1, minWidth: 150 }}>
              <label style={labelStyle}>Tabelle</label>
              <select
                style={{ ...styles.select, width: '100%' }}
                value={catalog.table_id || ''}
                onChange={e => onChange({ ...catalog, table_id: e.target.value, column_id: '' })}
              >
                <option value="">— wählen —</option>
                {tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 150 }}>
              <label style={labelStyle}>Spalte</label>
              <select
                style={{ ...styles.select, width: '100%' }}
                value={catalog.column_id || ''}
                onChange={e => onChange({ ...catalog, column_id: e.target.value })}
              >
                <option value="">— wählen —</option>
                {(table?.columns || []).map(col => <option key={col.id} value={col.id}>{col.name}</option>)}
              </select>
            </div>
          </>
        )}

        {source !== 'none' && (
          <>
            <div style={{ width: 170 }}>
              <label style={labelStyle}>Abweichung</label>
              <select
                style={{ ...styles.select, width: '100%' }}
                value={catalog.severity || 'error'}
                onChange={e => onChange({ ...catalog, severity: e.target.value })}
              >
                <option value="error">Zu prüfen erzwingen</option>
                <option value="warn">Nur Hinweis</option>
              </select>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', paddingBottom: theme.spacing.sm, fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input
                type="checkbox"
                style={styles.checkbox}
                checked={catalog.auto_map !== false}
                onChange={e => onChange({ ...catalog, auto_map: e.target.checked })}
              />
              automatisch angleichen
            </label>
          </>
        )}
      </div>

      {source === 'list' && (
        <div style={{ marginTop: theme.spacing.sm }}>
          <textarea
            style={{ ...styles.input, minHeight: 90, resize: 'vertical', fontFamily: 'inherit' }}
            value={valueText}
            onChange={e => handleValueText(e.target.value)}
            placeholder={'Ein Wert je Zeile. Schreibvarianten nach "=":\nAcme AG = acme, ACME Aktiengesellschaft\nMuster Bau GmbH'}
          />
          <div style={{ marginTop: theme.spacing.xs, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
            Die Werte gehen in den Extraktions-Prompt; eindeutig zuordenbare Treffer (Groß-/Kleinschreibung,
            Umlaute, Synonyme, knappe Tippfehler) werden auf die hier hinterlegte Schreibweise angeglichen.
          </div>
        </div>
      )}

      {/* Der Tabellen-Fall braucht eine eigene Erklärung: hier gehen die Werte
          bewusst NICHT in den Prompt (Tabellen können tausende Zeilen haben). */}
      {source === 'table' && (
        <div style={{ marginTop: theme.spacing.xs, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
          Die Spaltenwerte werden beim Angleichen und Prüfen verwendet, gehen aber <strong>nicht</strong> in
          den Extraktions-Prompt — dafür können Tabellen zu groß sein. Wer die Werte auch der KI vorgeben
          will, pflegt sie als feste Liste. Ändert sich die Tabelle, gilt der neue Stand sofort.
        </div>
      )}

      {source !== 'none' && (
        <div style={{ marginTop: theme.spacing.xs, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
          <strong>Abweichung:</strong> „Zu prüfen erzwingen" hebt das Dokument im Verarbeiten-Tab ins Review —
          unabhängig davon, wie sicher sich die KI war. „Nur Hinweis" zeigt den Befund an, ohne das Review auszulösen.
          {' '}<strong>Automatisch angleichen:</strong> {catalog.auto_map !== false
            ? 'an — eindeutige Treffer werden auf die Katalog-Schreibweise gesetzt und protokolliert (der Rohwert bleibt im Protokoll sichtbar).'
            : 'aus — der extrahierte Wert bleibt unverändert stehen, die Abweichung wird nur gemeldet.'}
        </div>
      )}
    </div>
  );
}

function ItemFieldsEditor({ itemFields, onChange }) {
  const list = itemFields || [];

  function update(idx, key, value) {
    const updated = [...list];
    updated[idx] = { ...updated[idx], [key]: value };
    if (key === 'label') {
      updated[idx].id = slugifyFieldLabel(value);
    }
    onChange(updated);
  }

  return (
    <div style={{
      marginTop: theme.spacing.md,
      paddingLeft: theme.spacing.lg,
      borderLeft: `1px solid ${theme.colors.border}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.sm }}>
        <span style={{ fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.medium, color: theme.colors.textMuted }}>
          POSITIONS-SPALTEN
        </span>
        <button
          style={{ ...styles.secondaryBtn, padding: `${theme.spacing.xs} ${theme.spacing.md}` }}
          onClick={() => onChange([...list, { id: '', label: '', type: 'text', required: false, description: '' }])}
        >
          + Spalte
        </button>
      </div>
      {list.length === 0 && (
        <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginBottom: theme.spacing.sm }}>
          Noch keine Spalten — eine Liste braucht mindestens eine Spalte (z.B. Bezeichnung, Menge, Preis).
        </div>
      )}
      {list.map((itf, idx) => (
        <div key={idx} style={{ marginBottom: theme.spacing.md }}>
        <div style={{ display: 'flex', gap: theme.spacing.sm, alignItems: 'center' }}>
          <input
            style={{ ...styles.input, flex: 1 }}
            value={itf.label}
            onChange={e => update(idx, 'label', e.target.value)}
            placeholder="Spalten-Label, z.B. Bezeichnung"
          />
          <select
            style={{ ...styles.select, width: '110px' }}
            value={itf.type}
            onChange={e => update(idx, 'type', e.target.value)}
          >
            {ITEM_FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input
            style={{ ...styles.input, flex: 1 }}
            value={itf.description}
            onChange={e => update(idx, 'description', e.target.value)}
            placeholder="Hinweis (optional)"
          />
          <label style={{ display: 'flex', alignItems: 'center', fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input
              type="checkbox"
              style={styles.checkbox}
              checked={itf.required}
              onChange={e => update(idx, 'required', e.target.checked)}
            />
            Pflicht
          </label>
          <button
            style={{ ...styles.dangerBtn, padding: theme.spacing.sm }}
            onClick={() => onChange(list.filter((_, i) => i !== idx))}
            title="Spalte entfernen"
          >
            <TrashIcon size={14} />
          </button>
        </div>
        {/* Kontrollierte Werteliste je Spalte (Welle 6), z.B. Einheiten */}
        <CatalogEditor
          catalog={itf.catalog}
          onChange={value => update(idx, 'catalog', value)}
          compact
        />
        </div>
      ))}
    </div>
  );
}

const listItemsTh = {
  padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
  fontWeight: theme.typography.weights.medium,
  fontSize: theme.typography.sizes.xs,
  color: theme.colors.textMuted,
  textAlign: 'left',
  whiteSpace: 'nowrap',
};
const listItemsTd = {
  padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
  verticalAlign: 'top',
};

/**
 * Positions-Tabelle für den Wert eines list-Felds (Training-Korrektur bzw.
 * read-only in der Batch-Detailansicht). `value` = Array der Positionen,
 * `itemFields` = item_fields-Objekt aus project.fields.
 */
function ListItemsEditor({ value, itemFields, onChange, readOnly = false }) {
  const items = Array.isArray(value) ? value : [];
  const itemEntries = Object.entries(itemFields || {});

  function updateCell(rowIdx, itemId, cellValue) {
    const updated = items.map((it, i) =>
      i === rowIdx ? { ...(it && typeof it === 'object' ? it : {}), [itemId]: cellValue } : it,
    );
    onChange(updated);
  }

  function addRow() {
    const empty = {};
    for (const [iid] of itemEntries) empty[iid] = null;
    onChange([...items, empty]);
  }

  if (itemEntries.length === 0) {
    return <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>Keine Spalten definiert.</div>;
  }

  return (
    <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: theme.typography.sizes.sm, width: '100%' }}>
        <thead>
          <tr>
            {itemEntries.map(([iid, itf]) => (
              <th key={iid} style={listItemsTh}>
                {itf.label || iid}
                {itf.required && <span style={{ color: theme.colors.error }}> *</span>}
              </th>
            ))}
            {!readOnly && <th style={{ ...listItemsTh, width: 34 }} />}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td colSpan={itemEntries.length + (readOnly ? 0 : 1)} style={{ ...listItemsTd, color: theme.colors.textMuted }}>
                Keine Positionen{readOnly ? '' : ' — mit „+ Position" hinzufügen'}.
              </td>
            </tr>
          )}
          {items.map((item, rowIdx) => {
            const rec = item && typeof item === 'object' ? item : {};
            return (
              <tr key={rowIdx} style={{ borderTop: `1px solid ${theme.colors.border}` }}>
                {itemEntries.map(([iid, itf]) => {
                  const v = rec[iid];
                  if (readOnly) {
                    return (
                      <td key={iid} style={{ ...listItemsTd, color: v != null ? theme.colors.text : theme.colors.textMuted }}>
                        {fmtValue(v) || '—'}
                      </td>
                    );
                  }
                  if (itf.type === 'boolean') {
                    return (
                      <td key={iid} style={listItemsTd}>
                        <input
                          type="checkbox"
                          style={styles.checkbox}
                          checked={!!v}
                          onChange={e => updateCell(rowIdx, iid, e.target.checked)}
                        />
                      </td>
                    );
                  }
                  return (
                    <td key={iid} style={listItemsTd}>
                      <input
                        style={{ ...styles.input, minWidth: 90, padding: theme.spacing.sm }}
                        type={itf.type === 'number' ? 'number' : itf.type === 'date' ? 'date' : 'text'}
                        step={itf.type === 'number' ? 'any' : undefined}
                        value={v === null || v === undefined ? '' : String(v)}
                        onChange={e => {
                          const cellValue = itf.type === 'number'
                            ? (e.target.value === '' ? null : parseFloat(e.target.value))
                            : e.target.value;
                          updateCell(rowIdx, iid, cellValue);
                        }}
                      />
                    </td>
                  );
                })}
                {!readOnly && (
                  <td style={listItemsTd}>
                    <button
                      style={{ ...styles.dangerBtn, padding: theme.spacing.xs }}
                      onClick={() => onChange(items.filter((_, i) => i !== rowIdx))}
                      title="Position entfernen"
                    >
                      <TrashIcon size={12} />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {!readOnly && (
        <button
          style={{ ...styles.secondaryBtn, padding: `${theme.spacing.xs} ${theme.spacing.md}`, marginTop: theme.spacing.sm }}
          onClick={addRow}
        >
          + Position
        </button>
      )}
    </div>
  );
}

/**
 * Typgerechter Eingabe-Baustein für Skalarfelder (boolean/number/date/text).
 * Gemeinsam genutzt vom Training-Korrektur-Formular und dem Batch-Review.
 */
function FieldInputControl({ field, value, onChange, isChanged = false }) {
  if (field.type === 'boolean') {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, fontSize: theme.typography.sizes.sm }}>
        <input
          type="checkbox"
          style={styles.checkbox}
          checked={!!value}
          onChange={e => onChange(e.target.checked)}
        />
        {value ? 'Ja' : 'Nein'}
      </label>
    );
  }
  return (
    <input
      style={{
        ...styles.input,
        borderColor: isChanged ? theme.colors.warning : theme.colors.border,
      }}
      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
      value={value === null || value === undefined ? '' : String(value)}
      onChange={e => {
        const val = field.type === 'number'
          ? (e.target.value === '' ? null : parseFloat(e.target.value))
          : e.target.value;
        onChange(val);
      }}
      step={field.type === 'number' ? 'any' : undefined}
    />
  );
}

// Review-Triage (Welle 3)
const REVIEW_LABELS = { auto_ok: 'Auto-OK', needs_review: 'Zu prüfen', reviewed: 'Geprüft' };

function ReviewBadge({ status }) {
  if (!status) return <span style={{ color: theme.colors.textMuted }}>—</span>;
  const colors = {
    auto_ok: { bg: theme.colors.successLight, fg: theme.colors.success },
    needs_review: { bg: theme.colors.warningLight, fg: theme.colors.warning },
    reviewed: { bg: theme.colors.primaryLight, fg: theme.colors.primary },
  }[status] || { bg: theme.colors.surfaceHover, fg: theme.colors.textMuted };
  return (
    <span style={{
      fontSize: theme.typography.sizes.xs,
      padding: `${theme.spacing.xs} ${theme.spacing.md}`,
      borderRadius: theme.borderRadius.full,
      fontWeight: theme.typography.weights.medium,
      backgroundColor: colors.bg,
      color: colors.fg,
      whiteSpace: 'nowrap',
    }}>
      {REVIEW_LABELS[status] || status}
    </span>
  );
}

// ============== Posteingang (Welle 4) ==============

const INBOX_STATUS = {
  processing: { label: 'Wird verarbeitet…', bg: theme.colors.primaryLight, fg: theme.colors.primary },
  ready: { label: 'Bereit', bg: theme.colors.successLight, fg: theme.colors.success },
  failed: { label: 'Fehler', bg: theme.colors.errorLight, fg: theme.colors.error },
};

/**
 * Befunde der fachlichen Prüfregeln (Welle 5) — rot blockiert (erzwingt „Zu prüfen"),
 * gelb ist nur ein Hinweis (z. B. Stammdaten-Tabelle nicht erreichbar).
 */
function ValidationIssues({ issues, style = {} }) {
  if (!issues || issues.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs, ...style }}>
      {issues.map((issue, idx) => {
        // info = Protokoll (z.B. Angleichung an einen Katalogwert) — neutral,
        // blockiert nichts; warn = Hinweis; alles andere ist ein echter Verstoß.
        const tone = issue.severity === 'info'
          ? { bg: theme.colors.surfaceHover, fg: theme.colors.textSecondary, prefix: 'Angeglichen: ' }
          : issue.severity === 'warn'
            ? { bg: theme.colors.warningLight, fg: theme.colors.warning, prefix: 'Hinweis: ' }
            : { bg: theme.colors.errorLight, fg: theme.colors.error, prefix: 'Prüfregel verletzt: ' };
        return (
          <div
            key={`${issue.rule_id || 'issue'}-${idx}`}
            style={{
              padding: theme.spacing.md,
              backgroundColor: tone.bg,
              color: tone.fg,
              borderRadius: theme.borderRadius.lg,
              fontSize: theme.typography.sizes.sm,
            }}
          >
            <strong>{tone.prefix}</strong>
            {issue.message}
          </div>
        );
      })}
    </div>
  );
}

function InboxStatusBadge({ status }) {
  const s = INBOX_STATUS[status] || INBOX_STATUS.processing;
  return (
    <span style={{
      fontSize: theme.typography.sizes.xs,
      padding: `${theme.spacing.xs} ${theme.spacing.md}`,
      borderRadius: theme.borderRadius.full,
      fontWeight: theme.typography.weights.medium,
      backgroundColor: s.bg,
      color: s.fg,
      whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  );
}

/**
 * Posteingang: Sammel-Scans hochladen → automatisch splitten, klassifizieren
 * und (bei sicherer Zuordnung) in die Projekte routen; Rest manuell zuordnen.
 */
function InboxView({ projects, onBack, onOpenProject }) {
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [routing, setRouting] = useState({});       // partId -> true
  const [partTargets, setPartTargets] = useState({}); // partId -> project_id
  const fileInputRef = useRef(null);

  const projectName = (id) => projects.find(p => p.id === id)?.name || id;
  const anyProcessing = uploads.some(u => u.status === 'processing');

  useEffect(() => { loadUploads(); /* eslint-disable-next-line */ }, []);

  // Polling solange etwas verarbeitet wird.
  useEffect(() => {
    if (!anyProcessing) return;
    const t = setTimeout(() => loadUploads(), 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [uploads]);

  async function loadUploads() {
    try {
      const res = await apiGet('/extraction/inbox');
      if (res.ok) setUploads(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function handleFiles(files) {
    const list = Array.from(files || []).filter(Boolean);
    if (list.length === 0) return;
    setUploading(true);
    setStatusMsg('');
    try {
      const formData = new FormData();
      for (const f of list) formData.append('files', f);
      const res = await apiPostForm('/extraction/inbox', formData);
      if (res.ok) {
        await loadUploads();
      } else {
        const err = await res.json().catch(() => ({}));
        setStatusMsg(`Fehler: ${err.error || res.status}`);
      }
    } catch {
      setStatusMsg('Netzwerkfehler beim Hochladen');
    } finally {
      setUploading(false);
    }
  }

  async function handleRoute(uploadId, part, target) {
    if (!target) return;
    setRouting(prev => ({ ...prev, [part.id]: true }));
    setStatusMsg('');
    try {
      const res = await apiPost(`/extraction/inbox/${uploadId}/parts/${part.id}/route`, { project_id: target });
      if (res.ok) {
        await loadUploads();
      } else {
        const err = await res.json().catch(() => ({}));
        setStatusMsg(`Fehler: ${err.error || res.status}`);
      }
    } catch {
      setStatusMsg('Netzwerkfehler bei der Zuordnung');
    } finally {
      setRouting(prev => ({ ...prev, [part.id]: false }));
    }
  }

  async function handleDelete(uploadId, e) {
    e.stopPropagation();
    if (!confirm('Diesen Posteingang-Eintrag inkl. Teil-Dokumenten löschen?')) return;
    try {
      await apiDelete(`/extraction/inbox/${uploadId}`);
      loadUploads();
    } catch { /* ignore */ }
  }

  function classificationLine(part) {
    const c = part.classification;
    if (!c) return <span style={{ color: theme.colors.textMuted }}>Keine Klassifikation</span>;
    if (!c.project_id) {
      return <span style={{ color: theme.colors.textMuted }}>Kein Projekt erkannt{c.alternatives?.length ? ` — vielleicht: ${c.alternatives.map(a => `${projectName(a.project_id)} (${Math.round(a.confidence * 100)}%)`).join(', ')}` : ''}</span>;
    }
    return (
      <span>
        <span style={{ color: theme.colors.text, fontWeight: theme.typography.weights.medium }}>
          {projectName(c.project_id)}
        </span>
        <span style={{ color: theme.colors.textMuted }}> · {Math.round(c.confidence * 100)}% sicher</span>
        {c.alternatives?.length > 0 && (
          <span style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.xs }}>
            {' '}(Alternativen: {c.alternatives.map(a => `${projectName(a.project_id)} ${Math.round(a.confidence * 100)}%`).join(', ')})
          </span>
        )}
      </span>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <button style={styles.backLink} onClick={onBack}>
            <ArrowLeftIcon size={14} /> Projekte
          </button>
          <h1 style={styles.title}>Posteingang</h1>
          <p style={styles.subtitle}>
            Gemischte Scans hochladen — Dokumente werden automatisch getrennt, klassifiziert und
            bei sicherer Zuordnung direkt verarbeitet
          </p>
        </div>
      </div>
      <div style={styles.content}>
        {/* Upload */}
        <div style={styles.section}>
          <div
            onDragOver={e => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={e => { e.preventDefault(); setDragActive(false); handleFiles(e.dataTransfer?.files); }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragActive ? theme.colors.primary : theme.colors.border}`,
              borderRadius: theme.borderRadius.lg,
              padding: theme.spacing['2xl'],
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: dragActive ? theme.colors.primaryLight : theme.colors.surface,
              transition: `all ${theme.transitions.fast}`,
            }}
          >
            <input
              ref={fileInputRef} type="file" hidden multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
              onChange={e => { handleFiles(e.target.files); e.target.value = ''; }}
            />
            <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm }}>
              {uploading ? <Spinner size={16} /> : <FolderOpenIcon size={18} />}
              {uploading ? 'Lade hoch…' : 'Dateien hierher ziehen oder klicken (PDF, Bilder — auch Sammel-Scans)'}
            </div>
            <div style={{ marginTop: theme.spacing.xs, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
              Mehrseitige PDFs werden auf Dokumentgrenzen geprüft und getrennt · max. 50 MB je Datei
            </div>
          </div>
          {statusMsg && (
            <div style={{ marginTop: theme.spacing.md, fontSize: theme.typography.sizes.sm, color: theme.colors.error }}>{statusMsg}</div>
          )}
        </div>

        {/* Upload-Liste */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Eingänge ({uploads.length})</div>
          {loading ? (
            <div style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm }}>Lade…</div>
          ) : uploads.length === 0 ? (
            <div style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm }}>
              Noch keine Eingänge. Lade oben Dokumente hoch.
            </div>
          ) : (
            uploads.map(u => {
              const open = expandedId === u.id;
              const unassigned = (u.parts || []).filter(p => p.status === 'unassigned').length;
              return (
                <div key={u.id} style={{
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borderRadius.lg,
                  marginBottom: theme.spacing.md,
                  backgroundColor: theme.colors.surface,
                }}>
                  <div
                    onClick={() => setExpandedId(open ? null : u.id)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: `${theme.spacing.md} ${theme.spacing.lg}`, cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md, minWidth: 0 }}>
                      <InboxStatusBadge status={u.status} />
                      <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={u.filename}>
                        {u.filename}
                      </span>
                      <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, whiteSpace: 'nowrap' }}>
                        {u.pageCount ? `${u.pageCount} Seite(n)` : ''}
                        {u.parts?.length > 1 ? ` · ${u.parts.length} Dokumente erkannt` : ''}
                        {unassigned > 0 ? ` · ${unassigned} zuzuordnen` : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
                      <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
                        {new Date(u.createdAt).toLocaleString('de-DE')}
                      </span>
                      <button onClick={(e) => handleDelete(u.id, e)} title="Löschen"
                        style={{ ...styles.dangerBtn, padding: theme.spacing.sm }}>
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  </div>

                  {(u.error || u.note) && (
                    <div style={{
                      padding: `0 ${theme.spacing.lg} ${theme.spacing.md}`,
                      fontSize: theme.typography.sizes.xs,
                      color: u.error ? theme.colors.error : theme.colors.textMuted,
                    }}>
                      {u.error || u.note}
                    </div>
                  )}

                  {open && (u.parts || []).length > 0 && (
                    <div style={{ borderTop: `1px solid ${theme.colors.border}`, padding: theme.spacing.lg }}>
                      {u.parts.map(part => (
                        <div key={part.id} style={{
                          display: 'flex', gap: theme.spacing.lg, alignItems: 'flex-start',
                          padding: `${theme.spacing.md} 0`,
                          borderBottom: `1px solid ${theme.colors.border}`,
                        }}>
                          {part.previewDataUri ? (
                            <img src={part.previewDataUri} alt="" style={{
                              width: 72, borderRadius: theme.borderRadius.md,
                              border: `1px solid ${theme.colors.border}`, flexShrink: 0,
                            }} />
                          ) : (
                            <div style={{
                              width: 72, height: 96, borderRadius: theme.borderRadius.md,
                              border: `1px solid ${theme.colors.border}`, flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: theme.colors.textMuted, backgroundColor: theme.colors.background,
                            }}>
                              <DocumentIcon size={22} />
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.text }}>
                              {part.filename}
                              <span style={{ color: theme.colors.textMuted, fontWeight: theme.typography.weights.normal }}>
                                {' '}· Seiten {part.pageFrom}–{part.pageTo}
                              </span>
                            </div>
                            <div style={{ fontSize: theme.typography.sizes.sm, marginTop: theme.spacing.xs }}>
                              {classificationLine(part)}
                            </div>
                            <div style={{ marginTop: theme.spacing.sm }}>
                              {part.status === 'unassigned' ? (
                                <div style={{ display: 'flex', gap: theme.spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
                                  <select
                                    style={{ ...styles.select, minWidth: 220 }}
                                    value={partTargets[part.id] || part.classification?.project_id || ''}
                                    onChange={e => setPartTargets(prev => ({ ...prev, [part.id]: e.target.value }))}
                                  >
                                    <option value="">Projekt wählen…</option>
                                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                  </select>
                                  <button
                                    style={styles.primaryBtn}
                                    disabled={routing[part.id] || !(partTargets[part.id] || part.classification?.project_id)}
                                    onClick={() => handleRoute(u.id, part, partTargets[part.id] || part.classification?.project_id)}
                                  >
                                    {routing[part.id] ? <Spinner size={14} /> : null}
                                    Zuordnen & verarbeiten
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => onOpenProject(part.targetProjectId)}
                                  style={{ ...styles.backLink, marginBottom: 0 }}
                                >
                                  → {projectName(part.targetProjectId)} · Lauf gestartet
                                  {part.status === 'auto_routed' ? ' (automatisch)' : ''}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ============== Create Project View ==============

function CreateProjectView({ onBack, onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [strategy, setStrategy] = useState('hybrid');
  const [modelOverride, setModelOverride] = useState(null);
  const [instructions, setInstructions] = useState('');
  const [fields, setFields] = useState([
    { id: '', label: '', type: 'text', required: true, description: '', item_fields: [] },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [inferring, setInferring] = useState(false);
  const [inferMsg, setInferMsg] = useState('');
  const [inferDrag, setInferDrag] = useState(false);
  const inferInputRef = useRef(null);

  /**
   * Feldvorschlag aus einem Beispieldokument (Welle 5). Der Vorschlag ersetzt
   * den Feld-Editor-Stand — bearbeitet wird er hier, angelegt erst per Button.
   */
  async function handleInferSchema(file) {
    if (!file) return;
    setInferring(true);
    setInferMsg('');
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiPostForm('/extraction/projects/infer-schema', formData);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Feldvorschlag fehlgeschlagen');
        return;
      }
      const proposed = Object.entries(json.fields || {}).map(([id, f]) => ({
        id,
        label: f.label,
        type: f.type,
        required: !!f.required,
        description: f.description || '',
        item_fields: itemFieldsToArray(f.item_fields),
      catalog: f.catalog || null,
        catalog: f.catalog || null,
      }));
      if (proposed.length === 0) {
        setError('Kein verwertbarer Feldvorschlag — bitte Felder manuell anlegen.');
        return;
      }
      setFields(proposed);
      if (!name.trim() && json.name) setName(json.name);
      if (!description.trim() && json.description) setDescription(json.description);
      setInferMsg(`${proposed.length} Felder vorgeschlagen — bitte prüfen und anpassen.`);
    } catch {
      setError('Netzwerkfehler beim Feldvorschlag');
    } finally {
      setInferring(false);
    }
  }

  function addField() {
    setFields([...fields, { id: '', label: '', type: 'text', required: false, description: '', item_fields: [] }]);
  }

  function removeField(idx) {
    setFields(fields.filter((_, i) => i !== idx));
  }

  function updateField(idx, key, value) {
    const updated = [...fields];
    updated[idx] = { ...updated[idx], [key]: value };
    // Auto-generate ID from label
    if (key === 'label') {
      updated[idx].id = slugifyFieldLabel(value);
    }
    // Typwechsel weg von Liste verwirft die Spalten-Definition.
    if (key === 'type' && value !== 'list') {
      updated[idx].item_fields = [];
    }
    setFields(updated);
  }

  async function handleCreate() {
    if (!name.trim()) {
      setError('Name ist erforderlich');
      return;
    }
    const validFields = fields.filter(f => f.label.trim());
    if (validFields.length === 0) {
      setError('Mindestens ein Feld erforderlich');
      return;
    }
    const badList = validFields.find(f => f.type === 'list' && Object.keys(itemFieldsToObject(f.item_fields)).length === 0);
    if (badList) {
      setError(`Liste "${badList.label}" braucht mindestens eine Positions-Spalte`);
      return;
    }

    setSaving(true);
    setError('');

    const fieldsObj = {};
    for (const f of validFields) {
      const fieldId = f.id || f.label.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      fieldsObj[fieldId] = {
        type: f.type,
        required: f.required,
        label: f.label,
        description: f.description || undefined,
        ...(f.type === 'list'
          ? { item_fields: itemFieldsToObject(f.item_fields) }
          : (f.catalog ? { catalog: f.catalog } : {})),
      };
    }

    try {
      const res = await apiPost('/extraction/projects', {
        name: name.trim(),
        description: description.trim(),
        fields: fieldsObj,
        instructions: instructions.trim() || undefined,
        extraction: { strategy, ...(modelOverride ? { model_override: modelOverride } : {}) },
      });
      if (res.ok) {
        const project = await res.json();
        onCreated(project.id);
      } else {
        const err = await res.json();
        setError(err.error || 'Fehler beim Erstellen');
      }
    } catch (err) {
      setError('Netzwerkfehler');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <button style={styles.backLink} onClick={onBack}>
            <ArrowLeftIcon size={14} /> Projekte
          </button>
          <h1 style={styles.title}>Neues Extraktionsprojekt</h1>
          <p style={styles.subtitle}>Definiere die Felder, die aus Dokumenten extrahiert werden sollen</p>
        </div>
      </div>
      <div style={styles.content}>
        <div style={{ maxWidth: '700px' }}>
          {/* Project Info */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Projekt</div>
            <div style={{ marginBottom: theme.spacing.lg }}>
              <label style={styles.label}>Name</label>
              <input
                style={styles.input}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="z.B. Rechnungen - Basisdaten"
              />
            </div>
            <div style={{ marginBottom: theme.spacing.lg }}>
              <label style={styles.label}>Beschreibung</label>
              <input
                style={styles.input}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="z.B. Lieferant, Rechnungsnummer und Bruttobetrag aus Rechnungen"
              />
            </div>
            <div style={{ marginBottom: theme.spacing.lg }}>
              <label style={styles.label}>Extraktions-Strategie</label>
              <select
                style={{ ...styles.select, width: '100%' }}
                value={strategy}
                onChange={e => setStrategy(e.target.value)}
              >
                {EXTRACTION_STRATEGIES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: theme.spacing.lg }}>
              <label style={styles.label}>KI-Modell (optional)</label>
              <ModelOverrideSelect value={modelOverride} onChange={setModelOverride} />
              <div style={{ marginTop: theme.spacing.xs, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
                Überschreibt das System-Standardmodell für dieses Projekt. Vision-Strategien brauchen ein vision-fähiges Modell.
              </div>
            </div>
            <div>
              <label style={styles.label}>Domänen-Anweisungen (optional)</label>
              <textarea
                style={{ ...styles.input, minHeight: '120px', resize: 'vertical', fontFamily: 'inherit' }}
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                placeholder="Stabile Hinweise an die KI (Format-Regeln, Umgang mit Versatz/Unterschrift, Dokumenttyp …). Wird nicht vom Lernen überschrieben."
              />
            </div>
          </div>

          {/* Fields */}
          <div style={styles.section}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg }}>
              <div style={styles.sectionTitle}>Felder</div>
              <button style={styles.secondaryBtn} onClick={addField}>+ Feld</button>
            </div>

            {/* Feldvorschlag aus Beispieldokument (Welle 5) */}
            <div
              onDragOver={e => { e.preventDefault(); setInferDrag(true); }}
              onDragLeave={() => setInferDrag(false)}
              onDrop={e => {
                e.preventDefault();
                setInferDrag(false);
                handleInferSchema(e.dataTransfer.files?.[0]);
              }}
              onClick={() => !inferring && inferInputRef.current?.click()}
              style={{
                border: `1px dashed ${inferDrag ? theme.colors.primary : theme.colors.border}`,
                borderRadius: theme.borderRadius.lg,
                padding: theme.spacing.lg,
                marginBottom: theme.spacing.lg,
                textAlign: 'center',
                cursor: inferring ? 'default' : 'pointer',
                backgroundColor: inferDrag ? theme.colors.primaryLight : 'transparent',
              }}
            >
              <input
                ref={inferInputRef}
                type="file"
                style={{ display: 'none' }}
                accept=".pdf,.png,.jpg,.jpeg,.txt,.md,.docx,.xlsx"
                onChange={e => { handleInferSchema(e.target.files?.[0]); e.target.value = ''; }}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm, fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary }}>
                {inferring ? <Spinner size={14} /> : <SparklesIcon size={14} />}
                {inferring ? 'Analysiere Beispieldokument…' : 'Felder aus Beispieldokument vorschlagen (Datei hierher ziehen)'}
              </div>
              <div style={{ marginTop: theme.spacing.xs, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
                Die KI liest ein typisches Dokument und schlägt die Feldliste vor — inklusive Positionstabelle.
                Der Vorschlag ersetzt die Felder unten und ist frei bearbeitbar.
              </div>
            </div>

            {inferMsg && (
              <div style={{
                padding: theme.spacing.md,
                marginBottom: theme.spacing.md,
                backgroundColor: theme.colors.successLight,
                color: theme.colors.success,
                borderRadius: theme.borderRadius.lg,
                fontSize: theme.typography.sizes.sm,
              }}>
                {inferMsg}
              </div>
            )}

            {fields.map((field, idx) => (
              <div key={idx} style={{
                padding: theme.spacing.lg,
                backgroundColor: theme.colors.background,
                borderRadius: theme.borderRadius.lg,
                marginBottom: theme.spacing.md,
              }}>
                <div style={{ display: 'flex', gap: theme.spacing.md, marginBottom: theme.spacing.md }}>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Label</label>
                    <input
                      style={styles.input}
                      value={field.label}
                      onChange={e => updateField(idx, 'label', e.target.value)}
                      placeholder="z.B. Lieferantenname"
                    />
                  </div>
                  <div style={{ width: '120px' }}>
                    <label style={styles.label}>Typ</label>
                    <select
                      style={{ ...styles.select, width: '100%' }}
                      value={field.type}
                      onChange={e => updateField(idx, 'type', e.target.value)}
                    >
                      {FIELD_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: theme.spacing.xs }}>
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      <input
                        type="checkbox"
                        style={styles.checkbox}
                        checked={field.required}
                        onChange={e => updateField(idx, 'required', e.target.checked)}
                      />
                      Pflicht
                    </label>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: theme.spacing.xs }}>
                    <button
                      style={{ ...styles.dangerBtn, padding: theme.spacing.sm }}
                      onClick={() => removeField(idx)}
                      title="Feld entfernen"
                    >
                      <TrashIcon size={14} />
                    </button>
                  </div>
                </div>
                <div>
                  <label style={styles.label}>Beschreibung (optional)</label>
                  <input
                    style={styles.input}
                    value={field.description}
                    onChange={e => updateField(idx, 'description', e.target.value)}
                    placeholder="z.B. Name des Lieferanten/Absenders der Rechnung"
                  />
                </div>
                {field.type === 'list' ? (
                  <ItemFieldsEditor
                    itemFields={field.item_fields}
                    onChange={arr => updateField(idx, 'item_fields', arr)}
                  />
                ) : (
                  /* Kontrollierte Werteliste (Welle 6) */
                  <CatalogEditor
                    catalog={field.catalog}
                    onChange={value => updateField(idx, 'catalog', value)}
                  />
                )}
                {field.id && (
                  <div style={{ marginTop: theme.spacing.xs, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
                    ID: {field.id}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Was hier bewusst NICHT steht, sollte man wissen, bevor man es sucht. */}
          <InfoBox style={{ marginBottom: theme.spacing.lg }}>
            <strong>Nach dem Anlegen</strong> kommen in den <strong>Einstellungen</strong> die
            <strong> Prüfregeln</strong> dazu (Summen-Check über Positionen, Stammdaten-Abgleich gegen eine
            Tabelle) sowie ein <strong>Webhook</strong> für Ergebnis-Meldungen. Im Tab <strong>Training</strong>
            lernst du das Projekt an Beispieldokumenten an — ab drei Korrekturen leitet es eigene Regeln ab.
          </InfoBox>

          {error && (
            <div style={{ color: theme.colors.error, fontSize: theme.typography.sizes.sm, marginBottom: theme.spacing.lg }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: theme.spacing.md }}>
            <button style={styles.secondaryBtn} onClick={onBack}>Abbrechen</button>
            <button style={styles.primaryBtn} onClick={handleCreate} disabled={saving}>
              {saving ? 'Erstelle...' : 'Projekt erstellen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============== Project Detail View ==============

function ProjectDetailView({ projectId, onBack }) {
  const [project, setProject] = useState(null);
  const [activeTab, setActiveTab] = useState('training');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProject();
  }, [projectId]);

  async function loadProject() {
    try {
      const res = await apiGet(`/extraction/projects/${projectId}`);
      if (res.ok) {
        setProject(await res.json());
      }
    } catch (err) {
      console.error('Failed to load project:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div style={styles.emptyState}>Laden...</div>;
  if (!project) return <div style={styles.emptyState}>Projekt nicht gefunden</div>;

  const tabs = [
    { id: 'training', label: 'Training' },
    { id: 'batch', label: 'Verarbeiten' },
    { id: 'rules', label: 'Regeln' },
    { id: 'settings', label: 'Einstellungen' },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <button style={styles.backLink} onClick={onBack}>
            <ArrowLeftIcon size={14} /> Projekte
          </button>
          <h1 style={styles.title}>{project.name}</h1>
          <p style={styles.subtitle}>{project.description}</p>
        </div>
        <div style={styles.cardMeta}>
          <span>{Object.keys(project.fields).length} Felder</span>
          <span>{project.learning?.total_examples || 0} Beispiele</span>
          {project.learning?.accuracy_estimate > 0 && (
            <span>~{project.learning.accuracy_estimate}% Genauigkeit</span>
          )}
        </div>
      </div>
      <div style={styles.content}>
        {/* Tabs */}
        <div style={styles.tabs}>
          {tabs.map(t => (
            <button
              key={t.id}
              style={{ ...styles.tab, ...(activeTab === t.id ? styles.tabActive : {}) }}
              onClick={() => setActiveTab(t.id)}
              onMouseEnter={e => { if (activeTab !== t.id) e.currentTarget.style.backgroundColor = theme.colors.surfaceHover; }}
              onMouseLeave={e => { if (activeTab !== t.id) e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'training' && (
          <TrainingTab project={project} onProjectUpdated={loadProject} />
        )}
        {activeTab === 'batch' && (
          <BatchTab project={project} onProjectUpdated={loadProject} />
        )}
        {activeTab === 'rules' && (
          <RulesTab project={project} onProjectUpdated={loadProject} />
        )}
        {activeTab === 'settings' && (
          <SettingsTab project={project} onProjectUpdated={loadProject} onDeleted={onBack} />
        )}
      </div>
    </div>
  );
}

// ============== Helpers: Spinner + Dokument-Vorschau ==============

function Spinner({ size = 18 }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: `2px solid ${theme.colors.border}`,
        borderTopColor: theme.colors.primary,
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
    />
  );
}

function DocumentPreview({ url, kind, filename, height = 460 }) {
  if (!url) return null;
  const frame = {
    width: '100%',
    height,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.background,
  };
  if (kind === 'pdf') {
    return <object data={`${url}#toolbar=0`} type="application/pdf" style={frame} aria-label={filename}>
      <div style={{ padding: theme.spacing.lg, color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm }}>
        PDF-Vorschau wird vom Browser nicht angezeigt. <a href={url} target="_blank" rel="noreferrer" style={{ color: theme.colors.primary }}>In neuem Tab öffnen</a>
      </div>
    </object>;
  }
  if (kind === 'image') {
    return <div style={{ ...frame, height: 'auto', maxHeight: height, overflow: 'auto', display: 'flex', justifyContent: 'center', padding: theme.spacing.sm }}>
      <img src={url} alt={filename} style={{ maxWidth: '100%', objectFit: 'contain', borderRadius: theme.borderRadius.md }} />
    </div>;
  }
  return <div style={{ ...frame, height: 'auto', padding: theme.spacing.lg, color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm }}>
    Keine Vorschau für diesen Dateityp ({filename}).
  </div>;
}

function InfoBox({ children, style = {} }) {
  return (
    <div style={{
      display: 'flex',
      gap: theme.spacing.sm,
      alignItems: 'flex-start',
      padding: theme.spacing.md,
      backgroundColor: theme.colors.primaryLight,
      borderRadius: theme.borderRadius.lg,
      fontSize: theme.typography.sizes.xs,
      color: theme.colors.textSecondary,
      lineHeight: 1.6,
      ...style,
    }}>
      <HelpCircleIcon size={16} color={theme.colors.primary} style={{ flexShrink: 0, marginTop: 1 }} />
      <div>{children}</div>
    </div>
  );
}

function BoxOverlay({ pageImages, boxes, data, fields, activeField, onHoverField, onBoxClick, scrollToField }) {
  const boxRefs = useRef({});
  useEffect(() => {
    if (!scrollToField) return;
    const el = boxRefs.current[scrollToField];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }, [scrollToField]);
  return (
    <div>
      <style>{`@keyframes boxpulse { 0%,100%{box-shadow:0 0 0 0 ${theme.colors.primary}00} 50%{box-shadow:0 0 0 5px ${theme.colors.primary}99} }`}</style>
      {pageImages.map(img => (
        <div key={img.page} style={{
          position: 'relative', display: 'block', width: '100%',
          marginBottom: theme.spacing.md,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.borderRadius.lg, overflow: 'hidden',
        }}>
          {/* Ausgelagerte Seitenbilder (Welle 5) kommen ueber die Seiten-Route;
              Laeufe vor der Auslagerung tragen weiterhin einen inline-dataUri. */}
          <img
            src={img.url ? `${API_URL}${img.url}` : img.dataUri}
            alt={`Seite ${img.page}`}
            style={{ display: 'block', width: '100%' }}
          />
          {Object.entries(boxes).filter(([, b]) => b.page === img.page).map(([fieldId, b]) => {
            const active = fieldId === activeField;
            const pulsing = fieldId === scrollToField;
            return (
              <div
                key={fieldId}
                ref={el => { boxRefs.current[fieldId] = el; }}
                onMouseEnter={() => onHoverField(fieldId)}
                onMouseLeave={() => onHoverField(null)}
                onClick={() => onBoxClick && onBoxClick(fieldId)}
                title={`${fields[fieldId]?.label || fieldId}: ${data[fieldId] ?? ''} — klicken zum Bearbeiten`}
                style={{
                  position: 'absolute',
                  left: `${b.x * 100}%`, top: `${b.y * 100}%`,
                  width: `${b.w * 100}%`, height: `${b.h * 100}%`,
                  border: `2px solid ${(active || pulsing) ? theme.colors.primary : `${theme.colors.primary}66`}`,
                  backgroundColor: (active || pulsing) ? `${theme.colors.primary}22` : 'transparent',
                  borderRadius: 2, boxSizing: 'border-box', cursor: 'pointer',
                  zIndex: (active || pulsing) ? 3 : 1,
                  animation: pulsing ? 'boxpulse 0.6s ease-in-out 2' : undefined,
                }}
              >
                {(active || pulsing) && (
                  <span style={{
                    position: 'absolute', top: -16, left: 0, fontSize: 10,
                    background: theme.colors.primary, color: '#fff',
                    padding: '0 3px', whiteSpace: 'nowrap', borderRadius: 2,
                  }}>
                    {fields[fieldId]?.label || fieldId}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function fileToPreviewKind(file) {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const isImg = (file.type || '').startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(file.name);
  return isPdf ? 'pdf' : isImg ? 'image' : 'other';
}

// ============== Verarbeiten Tab (Batch) ==============

const BATCH_STATUS = {
  pending:    { label: 'Wartet',  bg: theme.colors.surfaceHover, fg: theme.colors.textMuted },
  processing: { label: 'Läuft',   bg: theme.colors.warningLight, fg: theme.colors.warning },
  completed:  { label: 'Fertig',  bg: theme.colors.successLight, fg: theme.colors.success },
  failed:     { label: 'Fehler',  bg: theme.colors.errorLight,   fg: theme.colors.error },
};

function StatusBadge({ status }) {
  const s = BATCH_STATUS[status] || BATCH_STATUS.pending;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs,
      fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.medium,
      padding: `2px ${theme.spacing.sm}`, borderRadius: theme.borderRadius.full,
      backgroundColor: s.bg, color: s.fg, whiteSpace: 'nowrap',
    }}>
      {status === 'processing' && <Spinner size={10} />}
      {s.label}
    </span>
  );
}

/** Stringifiziert einen Feldwert für Anzeige/CSV. */
function fmtValue(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'Ja' : 'Nein';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function avgConfidence(conf) {
  if (!conf) return null;
  const vals = Object.values(conf).filter(v => typeof v === 'number');
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function triggerDownload(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

function csvCell(value) {
  const s = fmtValue(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function BatchTab({ project, onProjectUpdated }) {
  const fieldEntries = Object.entries(project.fields);
  const [reviewFilter, setReviewFilter] = useState('all'); // all | needs_review | auto_ok | reviewed

  const [queue, setQueue] = useState([]);          // ausgewählte Dateien vor dem Start
  const [dragActive, setDragActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const [runs, setRuns] = useState([]);            // Lauf-Historie
  const [activeRun, setActiveRun] = useState(null); // { run, files }
  const [expandedId, setExpandedId] = useState(null);
  const [details, setDetails] = useState({});       // fileId -> detail
  const [loadingFormat, setLoadingFormat] = useState(null);
  const [tableMsg, setTableMsg] = useState(null);

  const fileInputRef = useRef(null);
  const base = `/extraction/projects/${project.id}/batches`;
  const runStatus = activeRun?.run?.status;
  const isActive = runStatus === 'pending' || runStatus === 'processing';

  useEffect(() => { loadRuns(); /* eslint-disable-next-line */ }, [project.id]);

  // Polling, solange der aktive Lauf läuft.
  useEffect(() => {
    if (!activeRun || !isActive) return;
    const t = setTimeout(() => pollRun(activeRun.run.id), 2000);
    return () => clearTimeout(t);
  }, [activeRun, isActive]);

  async function loadRuns() {
    try {
      const res = await apiGet(base);
      if (res.ok) setRuns(await res.json());
    } catch { /* ignore */ }
  }

  async function pollRun(runId) {
    try {
      const res = await apiGet(`${base}/${runId}`);
      if (res.ok) {
        const data = await res.json();
        setActiveRun(data);
        if (data.run.status === 'completed' || data.run.status === 'failed') loadRuns();
      }
    } catch { /* ignore */ }
  }

  function addFiles(fileList) {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;
    setQueue(prev => {
      const seen = new Set(prev.map(f => f.name + f.size));
      return [...prev, ...incoming.filter(f => !seen.has(f.name + f.size))];
    });
  }

  async function startBatch() {
    if (!queue.length) return;
    setStarting(true);
    setStatusMsg('');
    try {
      const formData = new FormData();
      queue.forEach(f => formData.append('files', f));
      const res = await apiPostForm(base, formData);
      if (res.ok) {
        const { runId } = await res.json();
        setQueue([]);
        setExpandedId(null);
        setDetails({});
        await pollRun(runId);
        loadRuns();
      } else {
        const err = await res.json().catch(() => ({}));
        setStatusMsg(`Fehler: ${err.error || res.status}`);
      }
    } catch {
      setStatusMsg('Netzwerkfehler beim Start');
    } finally {
      setStarting(false);
    }
  }

  async function openRun(runId) {
    setExpandedId(null);
    setDetails({});
    setTableMsg(null);
    await pollRun(runId);
  }

  async function removeRun(runId, e) {
    e.stopPropagation();
    try {
      await apiDelete(`${base}/${runId}`);
      if (activeRun?.run?.id === runId) setActiveRun(null);
      loadRuns();
    } catch { /* ignore */ }
  }

  async function toggleExpand(fileId) {
    if (expandedId === fileId) { setExpandedId(null); return; }
    setExpandedId(fileId);
    if (!details[fileId]) {
      try {
        const res = await apiGet(`${base}/${activeRun.run.id}/files/${fileId}`);
        if (res.ok) {
          const det = await res.json();
          setDetails(prev => ({ ...prev, [fileId]: det }));
        }
      } catch { /* ignore */ }
    }
  }

  /**
   * Batch-Korrektur als Trainingsbeispiel übernehmen (Welle 3). Aktualisiert
   * danach Datei-Zeile + Detail lokal (data=corrected, Status „Geprüft").
   */
  async function learnFile(fileId, corrected) {
    const res = await apiPost(`${base}/${activeRun.run.id}/files/${fileId}/learn`, { corrected });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Lernen fehlgeschlagen');
    }
    const result = await res.json();
    setDetails(prev => ({
      ...prev,
      [fileId]: { ...(prev[fileId] || {}), data: corrected, reviewStatus: 'reviewed' },
    }));
    setActiveRun(prev => prev ? {
      ...prev,
      files: prev.files.map(f => f.id === fileId ? { ...f, data: corrected, reviewStatus: 'reviewed' } : f),
    } : prev);
    onProjectUpdated?.(); // Lern-Zähler/Eval-Status im Projekt aktualisieren
    return result;
  }

  function exportCsv() {
    const header = ['Datei', 'Status', ...fieldEntries.map(([, f]) => f.label || '')];
    const lines = [header.map(csvCell).join(';')];
    for (const file of activeRun.files) {
      lines.push([
        csvCell(file.filename),
        csvCell(BATCH_STATUS[file.status]?.label || file.status),
        ...fieldEntries.map(([fid]) => csvCell(file.data?.[fid])),
      ].join(';'));
    }
    triggerDownload(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }), `batch-${activeRun.run.id}.csv`);
  }

  function exportJson() {
    const payload = activeRun.files.map(f => ({
      filename: f.filename, status: f.status,
      data: f.data, fieldConfidences: f.fieldConfidences, error: f.error,
    }));
    triggerDownload(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), `batch-${activeRun.run.id}.json`);
  }

  async function exportXlsx() {
    const res = await apiGet(`${base}/${activeRun.run.id}/export.xlsx`);
    if (res.ok) triggerDownload(await res.blob(), `batch-${activeRun.run.id}.xlsx`);
  }

  async function handleExport(format) {
    setLoadingFormat(format);
    try {
      if (format === 'csv') exportCsv();
      else if (format === 'json') exportJson();
      else if (format === 'xlsx') await exportXlsx();
    } finally {
      setLoadingFormat(null);
    }
  }

  async function writeToTable() {
    setTableMsg({ loading: true });
    try {
      const res = await apiPost(`${base}/${activeRun.run.id}/to-table`, {});
      if (res.ok) {
        const { tableName, rowCount, tableId } = await res.json();
        setTableMsg({ ok: true, text: `${rowCount} Zeile(n) in „${tableName}" geschrieben.`, tableId });
      } else {
        const err = await res.json().catch(() => ({}));
        setTableMsg({ ok: false, text: `Fehler: ${err.error || res.status}` });
      }
    } catch {
      setTableMsg({ ok: false, text: 'Netzwerkfehler' });
    }
  }

  const doneCount = activeRun ? (activeRun.run.completedCount + activeRun.run.failedCount) : 0;

  return (
    <div>
      {/* Upload */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Dokumente verarbeiten</div>
        <InfoBox>
          Lade mehrere Dokumente hoch und lass sie durch dieses Projekt extrahieren. Der Lauf wird
          serverseitig gespeichert — du kannst die Seite verlassen und später zurückkommen.
        </InfoBox>
        <div
          style={{ ...styles.dropZone, ...(dragActive ? styles.dropZoneActive : {}), marginTop: theme.spacing.lg }}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => { e.preventDefault(); setDragActive(false); addFiles(e.dataTransfer.files); }}
        >
          <DocumentIcon size={28} color={theme.colors.textMuted} />
          <div style={{ marginTop: theme.spacing.sm, fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary }}>
            Dateien hierher ziehen oder klicken (PDF, Bilder, mehrere möglich)
          </div>
          <input
            ref={fileInputRef} type="file" multiple hidden
            accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.doc,.docx"
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
          />
        </div>

        {queue.length > 0 && (
          <div style={{ marginTop: theme.spacing.lg }}>
            {queue.map((f, i) => (
              <div key={f.name + i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: `${theme.spacing.sm} ${theme.spacing.md}`, fontSize: theme.typography.sizes.sm,
                color: theme.colors.text, borderBottom: `1px solid ${theme.colors.border}`,
              }}>
                <span>{f.name}</span>
                <button
                  onClick={() => setQueue(prev => prev.filter((_, idx) => idx !== i))}
                  style={{ ...styles.backLink, marginBottom: 0, color: theme.colors.textMuted }}
                >Entfernen</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: theme.spacing.md, marginTop: theme.spacing.lg, alignItems: 'center' }}>
              <button style={styles.primaryBtn} onClick={startBatch} disabled={starting}>
                {starting ? <Spinner size={14} /> : <SparklesIcon size={14} />}
                {starting ? 'Starte…' : `Extraktion starten (${queue.length})`}
              </button>
              <button style={styles.secondaryBtn} onClick={() => setQueue([])} disabled={starting}>Liste leeren</button>
            </div>
          </div>
        )}
        {statusMsg && <div style={{ marginTop: theme.spacing.md, fontSize: theme.typography.sizes.sm, color: theme.colors.error }}>{statusMsg}</div>}
      </div>

      {/* Lauf-Historie */}
      {runs.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Läufe</div>
          {runs.map(r => {
            const sel = activeRun?.run?.id === r.id;
            return (
              <div
                key={r.id}
                onClick={() => openRun(r.id)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: `${theme.spacing.md} ${theme.spacing.lg}`, marginBottom: theme.spacing.sm,
                  borderRadius: theme.borderRadius.lg, cursor: 'pointer',
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: sel ? theme.colors.primaryLight : theme.colors.surface,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
                  <StatusBadge status={r.status} />
                  <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text }}>
                    {r.fileCount} Dokument(e)
                  </span>
                  <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
                    {new Date(r.createdAt).toLocaleString('de-DE')}
                    {r.failedCount > 0 ? ` · ${r.failedCount} Fehler` : ''}
                  </span>
                  {r.webhook && (
                    <span
                      title={r.webhook.error ? `${r.webhook.url} — ${r.webhook.error}` : r.webhook.url}
                      style={{
                        fontSize: theme.typography.sizes.xs,
                        padding: `${theme.spacing.xs} ${theme.spacing.md}`,
                        borderRadius: theme.borderRadius.full,
                        fontWeight: theme.typography.weights.medium,
                        whiteSpace: 'nowrap',
                        backgroundColor: r.webhook.status === 'delivered' ? theme.colors.successLight
                          : r.webhook.status === 'failed' ? theme.colors.errorLight : theme.colors.surfaceHover,
                        color: r.webhook.status === 'delivered' ? theme.colors.success
                          : r.webhook.status === 'failed' ? theme.colors.error : theme.colors.textMuted,
                      }}
                    >
                      {r.webhook.status === 'delivered' ? 'Webhook zugestellt'
                        : r.webhook.status === 'failed' ? `Webhook fehlgeschlagen (${r.webhook.attempts} Versuche)`
                        : 'Webhook offen'}
                    </span>
                  )}
                </div>
                <button onClick={(e) => removeRun(r.id, e)} title="Lauf löschen"
                  style={{ ...styles.backLink, marginBottom: 0, color: theme.colors.textMuted }}>
                  <TrashIcon size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Ergebnis-Tabelle */}
      {activeRun && (
        <div style={styles.section}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg }}>
            <div style={{ ...styles.sectionTitle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
              Ergebnisse
              <StatusBadge status={activeRun.run.status} />
              {isActive && (
                <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>
                  {doneCount}/{activeRun.run.fileCount}
                </span>
              )}
              {!isActive && activeRun.files.some(f => f.reviewStatus === 'needs_review') && (
                <ReviewBadge status="needs_review" />
              )}
              {!isActive && activeRun.files.some(f => f.reviewStatus === 'needs_review') && (
                <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>
                  {activeRun.files.filter(f => f.reviewStatus === 'needs_review').length} Datei(en)
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: theme.spacing.md, alignItems: 'center' }}>
              <button style={styles.secondaryBtn} onClick={writeToTable} disabled={tableMsg?.loading}>
                <TableIcon size={14} /> In Tabelle schreiben
              </button>
              <ExportDropdown
                formats={['xlsx', 'csv', 'json']}
                onExport={handleExport}
                isLoading={!!loadingFormat}
                loadingFormat={loadingFormat}
              />
            </div>
          </div>

          {tableMsg && !tableMsg.loading && (
            <div style={{
              marginBottom: theme.spacing.lg, fontSize: theme.typography.sizes.sm,
              color: tableMsg.ok ? theme.colors.success : theme.colors.error,
            }}>{tableMsg.text}</div>
          )}

          {/* Review-Filter (Welle 3) */}
          {activeRun.files.some(f => f.reviewStatus) && (
            <div style={{ display: 'flex', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
              {[
                { id: 'all', label: `Alle (${activeRun.files.length})` },
                { id: 'needs_review', label: `Zu prüfen (${activeRun.files.filter(f => f.reviewStatus === 'needs_review').length})` },
                { id: 'auto_ok', label: `Auto-OK (${activeRun.files.filter(f => f.reviewStatus === 'auto_ok').length})` },
                { id: 'reviewed', label: `Geprüft (${activeRun.files.filter(f => f.reviewStatus === 'reviewed').length})` },
              ].map(chip => (
                <button
                  key={chip.id}
                  onClick={() => setReviewFilter(chip.id)}
                  style={{
                    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
                    backgroundColor: reviewFilter === chip.id ? theme.colors.primaryLight : 'transparent',
                    color: reviewFilter === chip.id ? theme.colors.primary : theme.colors.textMuted,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.borderRadius.full,
                    fontSize: theme.typography.sizes.xs,
                    fontWeight: theme.typography.weights.medium,
                    cursor: 'pointer',
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}

          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginBottom: theme.spacing.sm }}>
            Zeile anklicken zum Prüfen & Korrigieren · horizontal scrollbar bei vielen Feldern
          </div>
          <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: theme.typography.sizes.sm }}>
              <thead>
                <tr style={{ textAlign: 'left', color: theme.colors.textMuted }}>
                  <th style={{ ...batchTh, ...batchStickyCol, zIndex: 3 }}>Datei</th>
                  <th style={batchTh}>Status</th>
                  <th style={batchTh}>Prüfung</th>
                  {fieldEntries.map(([fid, f]) => <th key={fid} style={batchTh}>{f.label || fid}</th>)}
                  <th style={batchTh}>Ø</th>
                </tr>
              </thead>
              <tbody>
                {activeRun.files.filter(f => reviewFilter === 'all' || f.reviewStatus === reviewFilter).map(file => {
                  const conf = avgConfidence(file.fieldConfidences);
                  const open = expandedId === file.id;
                  const hasDetail = file.status === 'completed';
                  return (
                    <Fragment key={file.id}>
                      <tr
                        onClick={() => hasDetail && toggleExpand(file.id)}
                        style={{ borderTop: `1px solid ${theme.colors.border}`, cursor: hasDetail ? 'pointer' : 'default' }}
                      >
                        <td style={batchStickyCol} title={file.filename}>{file.filename}</td>
                        <td style={batchTd}><StatusBadge status={file.status} /></td>
                        <td style={batchTd}><ReviewBadge status={file.reviewStatus} /></td>
                        {fieldEntries.map(([fid, f]) => {
                          const raw = file.data?.[fid];
                          // Listen kompakt als Zähler — die Positionen zeigt die Detailansicht.
                          const val = f.type === 'list'
                            ? (Array.isArray(raw) && raw.length > 0 ? `${raw.length} Positionen` : '')
                            : fmtValue(raw);
                          const hasValue = f.type === 'list' ? Array.isArray(raw) && raw.length > 0 : raw != null;
                          return (
                            <td key={fid} title={val} style={{ ...batchTdField, color: hasValue ? theme.colors.text : theme.colors.textMuted }}>
                              {val || '—'}
                            </td>
                          );
                        })}
                        <td style={{ ...batchTd, color: theme.colors.textMuted }}>{conf != null ? `${Math.round(conf * 100)}%` : '—'}</td>
                      </tr>
                      {open && (
                        <tr>
                          <td colSpan={fieldEntries.length + 4} style={{ ...batchTd, backgroundColor: theme.colors.background }}>
                            <BatchFileDetail
                              detail={details[file.id]}
                              fields={project.fields}
                              onLearn={corrected => learnFile(file.id, corrected)}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const batchTh = {
  padding: `${theme.spacing.sm} ${theme.spacing.md}`,
  fontWeight: theme.typography.weights.medium,
  fontSize: theme.typography.sizes.xs,
  whiteSpace: 'nowrap',
};
const batchTd = {
  padding: `${theme.spacing.sm} ${theme.spacing.md}`,
  verticalAlign: 'top',
};
// Feldwert-Zelle: einzeilig mit Ellipsis, damit die Tabelle bei vielen Feldern
// kompakt bleibt und horizontal scrollt statt das Layout zu sprengen.
const batchTdField = {
  ...batchTd,
  maxWidth: 180,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};
// Erste Spalte (Datei) fixiert beim horizontalen Scrollen.
const batchStickyCol = {
  position: 'sticky',
  left: 0,
  zIndex: 2,
  backgroundColor: theme.colors.surface,
  maxWidth: 200,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

/**
 * Batch-Datei-Detail — seit Welle 3 ein Review-Formular: Werte korrigierbar,
 * „Übernehmen & lernen" macht die Korrektur zum Trainingsbeispiel.
 */
function BatchFileDetail({ detail, fields, onLearn }) {
  const [edited, setEdited] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, text }

  // Bei Datei-/Statuswechsel den Korrektur-State neu aufsetzen (tiefe Kopie!).
  useEffect(() => {
    setEdited(detail?.data ? structuredClone(detail.data) : null);
    setMsg(null);
    // eslint-disable-next-line
  }, [detail?.id, detail?.reviewStatus]);

  if (!detail) return <div style={{ padding: theme.spacing.md, color: theme.colors.textMuted }}>Lade Detail…</div>;
  if (detail.error) return <div style={{ padding: theme.spacing.md, color: theme.colors.error }}>{detail.error}</div>;

  const hasBoxes = detail.pageImages && detail.pageImages.length > 0;
  const canLearn = !!onLearn && detail.status === 'completed' && !!detail.documentText;
  const isReviewed = detail.reviewStatus === 'reviewed';
  const values = edited || detail.data || {};
  const hasChanges = edited && JSON.stringify(edited) !== JSON.stringify(detail.data);

  async function handleLearn() {
    if (!edited) return;
    setSaving(true);
    setMsg(null);
    try {
      const r = await onLearn(edited);
      setMsg({
        ok: true,
        text: r?.guidelines_update === 'started'
          ? 'Korrektur gelernt — Regeln werden im Hintergrund geprüft (Tab „Regeln").'
          : 'Korrektur als Trainingsbeispiel gespeichert.',
      });
    } catch (err) {
      setMsg({ ok: false, text: err.message || 'Lernen fehlgeschlagen' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: hasBoxes ? '1fr 1fr' : '1fr', gap: theme.spacing.lg, padding: theme.spacing.md }}>
      {hasBoxes && (
        <div style={{ maxHeight: 420, overflow: 'auto' }}>
          <BoxOverlay
            pageImages={detail.pageImages}
            boxes={detail.boxes || {}}
            data={detail.data || {}}
            fields={fields}
            activeField={null}
            onHoverField={() => {}}
          />
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
        {detail.audit && (
          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
            Strategie {detail.audit.strategy || detail.strategy || '—'} · Modell {detail.audit.model} · Regeln v{detail.audit.guideline_version}
          </div>
        )}
        <ValidationIssues issues={detail.validations} />
        {Object.entries(fields).map(([fid, f]) => {
          const conf = detail.fieldConfidences?.[fid];
          const isChanged = edited && JSON.stringify(values[fid]) !== JSON.stringify(detail.data?.[fid]);
          const label = (
            <span style={{ color: isChanged ? theme.colors.warning : theme.colors.textMuted }}>
              {f.label || fid}
              {typeof conf === 'number' && (
                <span style={{ marginLeft: theme.spacing.xs, fontSize: theme.typography.sizes.xs }}>
                  {Math.round(conf * 100)}%
                </span>
              )}
              {isChanged && <span style={{ fontSize: theme.typography.sizes.xs, marginLeft: theme.spacing.xs }}>(korrigiert)</span>}
            </span>
          );
          if (f.type === 'list') {
            return (
              <div key={fid} style={{ fontSize: theme.typography.sizes.sm }}>
                <div style={{ marginBottom: theme.spacing.xs }}>
                  {label}
                  {' '}<span style={{ color: theme.colors.textMuted }}>({Array.isArray(values[fid]) ? values[fid].length : 0} Positionen)</span>
                </div>
                <ListItemsEditor
                  value={values[fid]}
                  itemFields={f.item_fields}
                  onChange={arr => setEdited(prev => ({ ...(prev || {}), [fid]: arr }))}
                  readOnly={!canLearn || isReviewed}
                />
              </div>
            );
          }
          return (
            <div key={fid} style={{ display: 'flex', gap: theme.spacing.md, alignItems: 'center', fontSize: theme.typography.sizes.sm }}>
              <span style={{ minWidth: 140 }}>{label}</span>
              {canLearn && !isReviewed ? (
                <div style={{ flex: 1, maxWidth: 360 }}>
                  <FieldInputControl
                    field={f}
                    value={values[fid]}
                    onChange={val => setEdited(prev => ({ ...(prev || {}), [fid]: val }))}
                    isChanged={!!isChanged}
                  />
                </div>
              ) : (
                <span style={{ color: values[fid] != null ? theme.colors.text : theme.colors.textMuted }}>
                  {fmtValue(values[fid]) || '—'}
                </span>
              )}
            </div>
          );
        })}

        {/* Review-Aktion (Welle 3) */}
        <div style={{ marginTop: theme.spacing.md, display: 'flex', alignItems: 'center', gap: theme.spacing.md, flexWrap: 'wrap' }}>
          {isReviewed ? (
            <ReviewBadge status="reviewed" />
          ) : canLearn ? (
            <button style={styles.primaryBtn} onClick={handleLearn} disabled={saving}>
              {saving ? <Spinner size={14} /> : <SparklesIcon size={14} />}
              {hasChanges ? 'Korrektur übernehmen & lernen' : 'Als korrekt bestätigen & lernen'}
            </button>
          ) : detail.status === 'completed' ? (
            <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
              Älterer Lauf ohne gespeicherten Dokumenttext — zum Lernen bitte neu verarbeiten.
            </span>
          ) : null}
          {msg && (
            <span style={{ fontSize: theme.typography.sizes.sm, color: msg.ok ? theme.colors.success : theme.colors.error }}>
              {msg.text}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============== Training Tab ==============

function TrainingTab({ project, onProjectUpdated }) {
  const [extractionResult, setExtractionResult] = useState(null);
  const [documentText, setDocumentText] = useState('');
  const [sourceFilename, setSourceFilename] = useState('');
  const [editedValues, setEditedValues] = useState({});
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [examples, setExamples] = useState([]);
  const [statusMsg, setStatusMsg] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewKind, setPreviewKind] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [showRawText, setShowRawText] = useState(false);
  const [boxes, setBoxes] = useState({});
  const [fieldConfidences, setFieldConfidences] = useState({});
  const [pageImages, setPageImages] = useState([]);
  const [validations, setValidations] = useState([]);
  const [activeField, setActiveField] = useState(null);
  const [scrollToField, setScrollToField] = useState(null);
  const fileInputRef = useRef(null);
  const fieldRowRefs = useRef({});

  // Box anklicken → zum Feld scrollen + Eingabe fokussieren (zum Korrigieren).
  function focusFieldFromBox(fieldId) {
    const row = fieldRowRefs.current[fieldId];
    if (!row) return;
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const input = row.querySelector('input, textarea');
    if (input) input.focus({ preventScroll: true });
    setActiveField(fieldId);
  }

  // Feld/◉ anklicken → Dokument zur Box scrollen + kurz aufblitzen.
  function locateOnDoc(fieldId) {
    if (!boxes[fieldId]) return;
    setActiveField(fieldId);
    setScrollToField(fieldId);
    setTimeout(() => setScrollToField(null), 900);
  }

  useEffect(() => {
    loadExamples();
  }, [project.id]);

  // Elapsed-Timer waehrend der Extraktion (ehrliches Lebenszeichen, da kein Live-Stream).
  useEffect(() => {
    if (!extracting) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, [extracting]);

  // Object-URL der Vorschau beim Unmount/Wechsel freigeben.
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  function setPreviewFromFile(file) {
    setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return file ? URL.createObjectURL(file) : null; });
    setPreviewKind(file ? fileToPreviewKind(file) : null);
  }

  function clearPreview() {
    setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
    setPreviewKind(null);
    setShowRawText(false);
    setBoxes({});
    setFieldConfidences({});
    setPageImages([]);
    setValidations([]);
    setActiveField(null);
    setScrollToField(null);
  }

  async function loadExamples() {
    try {
      const res = await apiGet(`/extraction/projects/${project.id}/examples`);
      if (res.ok) {
        setExamples(await res.json());
      }
    } catch (err) {
      console.error('Failed to load examples:', err);
    }
  }

  async function handleExtract(file) {
    setExtracting(true);
    setExtractionResult(null);
    setStatusMsg('');
    setSourceFilename(file ? file.name : 'text-eingabe');
    if (file) setPreviewFromFile(file);

    try {
      let res;
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        res = await apiPostForm(`/extraction/projects/${project.id}/extract`, formData);
      } else {
        return;
      }

      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          setExtractionResult(result.data);
          setDocumentText(result.document_text);
          // Tiefe Kopie: Listen-Werte (Arrays) dürfen keine Referenzen mit
          // extractionResult teilen, sonst erkennt der hasChanges-Vergleich
          // Zell-Änderungen nie.
          setEditedValues(structuredClone(result.data));
          setBoxes(result.boxes ?? {});
          setFieldConfidences(result.fieldConfidences ?? {});
          setPageImages(result.pageImages ?? []);
          setValidations(result.validations ?? []);
        } else {
          setStatusMsg(`Fehler: ${result.error}`);
        }
      } else {
        const err = await res.json();
        setStatusMsg(`Fehler: ${err.error}`);
      }
    } catch (err) {
      setStatusMsg('Netzwerkfehler bei der Extraktion');
    } finally {
      setExtracting(false);
    }
  }

  async function handleTextExtract() {
    if (!documentText.trim()) return;
    setExtracting(true);
    setExtractionResult(null);
    setStatusMsg('');
    setSourceFilename('text-eingabe');
    clearPreview();

    try {
      const res = await apiPost(`/extraction/projects/${project.id}/extract`, { text: documentText });
      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          setExtractionResult(result.data);
          setDocumentText(result.document_text);
          // Tiefe Kopie: Listen-Werte (Arrays) dürfen keine Referenzen mit
          // extractionResult teilen, sonst erkennt der hasChanges-Vergleich
          // Zell-Änderungen nie.
          setEditedValues(structuredClone(result.data));
          setBoxes(result.boxes ?? {});
          setFieldConfidences(result.fieldConfidences ?? {});
          setPageImages(result.pageImages ?? []);
          setValidations(result.validations ?? []);
        } else {
          setStatusMsg(`Fehler: ${result.error}`);
        }
      }
    } catch (err) {
      setStatusMsg('Netzwerkfehler');
    } finally {
      setExtracting(false);
    }
  }

  async function handleConfirmAndLearn() {
    setSaving(true);
    setStatusMsg('');

    try {
      const res = await apiPost(`/extraction/projects/${project.id}/train`, {
        source_filename: sourceFilename,
        document_text: documentText,
        initial_extraction: extractionResult,
        field_confidences: fieldConfidences, // speist die Konfidenz-Kalibrierung
        corrected_extraction: editedValues,
      });

      if (res.ok) {
        const result = await res.json();
        const msg = result.guidelines_update === 'started'
          ? 'Beispiel gespeichert — Regeln werden im Hintergrund geprüft (Tab „Regeln").'
          : 'Beispiel gespeichert!';
        setStatusMsg(msg);
        setExtractionResult(null);
        setEditedValues({});
        setDocumentText('');
        clearPreview();
        loadExamples();
        onProjectUpdated();
      } else {
        const err = await res.json();
        setStatusMsg(`Fehler: ${err.error}`);
      }
    } catch (err) {
      setStatusMsg('Netzwerkfehler');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteExample(exId) {
    try {
      await apiDelete(`/extraction/projects/${project.id}/examples/${exId}`);
      loadExamples();
      onProjectUpdated();
    } catch (err) {
      console.error('Failed to delete example:', err);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleExtract(file);
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) handleExtract(file);
  }

  function updateEditedValue(fieldId, value) {
    setEditedValues(prev => ({ ...prev, [fieldId]: value }));
  }

  function getInputValue(fieldId, field) {
    const val = editedValues[fieldId];
    if (val === null || val === undefined) return '';
    if (field.type === 'boolean') return val;
    return String(val);
  }

  const hasChanges = extractionResult && JSON.stringify(extractionResult) !== JSON.stringify(editedValues);

  return (
    <div>
      {/* Upload / Extract */}
      {!extractionResult && (
        <div style={styles.section}>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={styles.sectionTitle}>Dokument hochladen</div>

          {extracting ? (
            <div style={{
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.borderRadius.lg,
              padding: theme.spacing.xl,
              backgroundColor: theme.colors.surface,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
                <Spinner size={20} />
                <div>
                  <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.text }}>
                    Extrahiere „{sourceFilename}" …
                  </div>
                  <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginTop: 2 }}>
                    Vision-KI liest das Dokument · läuft seit {elapsed}s
                  </div>
                </div>
              </div>
              <ol style={{ margin: `${theme.spacing.lg} 0 0`, paddingLeft: theme.spacing.xl, color: theme.colors.textMuted, fontSize: theme.typography.sizes.xs, lineHeight: 1.9 }}>
                <li>Dokument hochladen & Seiten als Bild rendern</li>
                <li>Vision-Extraktion pro Seite</li>
                <li>Felder zusammenführen & prüfen</li>
              </ol>
              <div style={{ marginTop: theme.spacing.sm, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
                Bei mehrseitigen Scans kann das bis ~40 s dauern.
              </div>
            </div>
          ) : (
            <div
              style={{ ...styles.dropZone, ...(dragActive ? styles.dropZoneActive : {}) }}
              onDragOver={e => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: 'none' }}
                accept=".pdf,.doc,.docx,.xlsx,.xls,.png,.jpg,.jpeg,.txt,.md"
                onChange={handleFileChange}
              />
              <DocumentIcon size={32} color={theme.colors.textMuted} />
              <div style={{ marginTop: theme.spacing.md, color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm }}>
                Datei hierher ziehen oder klicken zum Hochladen
              </div>
              <div style={{ marginTop: theme.spacing.xs, color: theme.colors.textMuted, fontSize: theme.typography.sizes.xs }}>
                PDF, Word, Excel, Bilder oder Text
              </div>
            </div>
          )}

          {/* Vorschau des hochgeladenen Dokuments */}
          {previewUrl && (
            <div style={{ marginTop: theme.spacing.lg }}>
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginBottom: theme.spacing.sm, fontWeight: theme.typography.weights.medium }}>
                VORSCHAU · {sourceFilename}
              </div>
              <DocumentPreview url={previewUrl} kind={previewKind} filename={sourceFilename} />
            </div>
          )}

          {/* Text-Eingabe als Alternative — nur ohne Datei und ohne laufende Extraktion */}
          {!previewUrl && !extracting && (
            <div style={{ marginTop: theme.spacing.lg }}>
              <label style={styles.label}>Oder Text direkt eingeben</label>
              <textarea
                style={{ ...styles.input, minHeight: '100px', resize: 'vertical', fontFamily: theme.typography.fontMono }}
                value={documentText}
                onChange={e => setDocumentText(e.target.value)}
                placeholder="Dokumenttext hier einfuegen..."
              />
              {documentText.trim() && (
                <button
                  style={{ ...styles.primaryBtn, marginTop: theme.spacing.md }}
                  onClick={handleTextExtract}
                  disabled={extracting}
                >
                  Text extrahieren
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Extraction Result — Split View */}
      {extractionResult && (
        <div style={styles.section}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg }}>
            <div style={styles.sectionTitle}>Extraktion pruefen & korrigieren</div>
            <div style={{ display: 'flex', gap: theme.spacing.md }}>
              <button style={styles.secondaryBtn} onClick={() => { setExtractionResult(null); setEditedValues({}); setDocumentText(''); }}>
                Abbrechen
              </button>
              <button style={styles.primaryBtn} onClick={handleConfirmAndLearn} disabled={saving}>
                {saving ? 'Speichere...' : 'Bestaetigen & Lernen'}
              </button>
            </div>
          </div>

          <ValidationIssues issues={validations} style={{ marginBottom: theme.spacing.md }} />

          {hasChanges && (
            <div style={{
              padding: theme.spacing.md,
              backgroundColor: theme.colors.warningLight,
              color: theme.colors.warning,
              borderRadius: theme.borderRadius.lg,
              fontSize: theme.typography.sizes.sm,
              marginBottom: theme.spacing.md,
            }}>
              Du hast Korrekturen vorgenommen — das System lernt daraus!
            </div>
          )}

          <InfoBox style={{ marginBottom: theme.spacing.lg }}>
            <strong>Was beim „Bestätigen & Lernen" passiert:</strong> Dieses Dokument
            wird als Beispiel gespeichert (mit deinen Korrekturen). Bei künftigen
            Extraktionen wird es als <strong>Few-Shot-Beispiel</strong> mitgegeben — und
            ab <strong>3 Beispielen mit Korrekturen</strong> leitet das System daraus
            allgemeine <strong>Regeln</strong> ab (Tab „Regeln"). Es wird nichts am
            Modell trainiert — das Wissen fließt nur in den Prompt ein.
          </InfoBox>

          <div style={styles.splitView}>
            {/* Left: Dokument mit Bounding-Boxes (Fallback: Vorschau/Roh-Text) */}
            <div>
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginBottom: theme.spacing.sm, fontWeight: theme.typography.weights.medium }}>
                DOKUMENT{pageImages.length > 0 ? ' · Markierung anklicken zum Bearbeiten' : ''}
              </div>
              {pageImages.length > 0 ? (
                <BoxOverlay
                  pageImages={pageImages}
                  boxes={boxes}
                  data={editedValues}
                  fields={project.fields}
                  activeField={activeField}
                  onHoverField={setActiveField}
                  onBoxClick={focusFieldFromBox}
                  scrollToField={scrollToField}
                />
              ) : previewUrl ? (
                <DocumentPreview url={previewUrl} kind={previewKind} filename={sourceFilename} height={560} />
              ) : (
                <div style={styles.docPanel}>{documentText || 'Keine Vorschau verfügbar'}</div>
              )}
              {previewUrl && documentText && (
                <div style={{ marginTop: theme.spacing.sm }}>
                  <button
                    onClick={() => setShowRawText(s => !s)}
                    style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: theme.colors.primary, fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.medium }}
                  >
                    {showRawText ? 'Erkannten Roh-Text ausblenden' : 'Erkannten Roh-Text anzeigen (oft unzuverlässig)'}
                  </button>
                  {showRawText && (
                    <div style={{ ...styles.docPanel, marginTop: theme.spacing.sm, maxHeight: 200 }}>{documentText}</div>
                  )}
                </div>
              )}
            </div>

            {/* Right: Editable form */}
            <div>
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginBottom: theme.spacing.sm, fontWeight: theme.typography.weights.medium }}>
                EXTRAHIERTE FELDER
              </div>
              <div style={styles.formPanel}>
                {Object.entries(project.fields).map(([fieldId, field]) => {
                  const initialVal = extractionResult[fieldId];
                  const currentVal = editedValues[fieldId];
                  const isChanged = JSON.stringify(initialVal) !== JSON.stringify(currentVal);

                  const hasBox = !!boxes[fieldId];
                  return (
                    <div
                      key={fieldId}
                      ref={el => { fieldRowRefs.current[fieldId] = el; }}
                      onMouseEnter={() => hasBox && setActiveField(fieldId)}
                      onMouseLeave={() => hasBox && setActiveField(null)}
                      style={{
                        borderRadius: theme.borderRadius.md,
                        padding: theme.spacing.xs,
                        margin: `0 -${theme.spacing.xs}`,
                        backgroundColor: activeField === fieldId ? theme.colors.primaryLight : 'transparent',
                        transition: `background-color ${theme.transitions.fast}`,
                      }}
                    >
                      <label style={{
                        ...styles.label,
                        color: isChanged ? theme.colors.warning : theme.colors.text,
                      }}>
                        {field.label || fieldId}
                        {field.required && <span style={{ color: theme.colors.error }}> *</span>}
                        {hasBox && (
                          <span
                            title="Im Dokument zeigen"
                            onClick={() => locateOnDoc(fieldId)}
                            style={{ color: theme.colors.primary, marginLeft: theme.spacing.xs, fontSize: theme.typography.sizes.xs, cursor: 'pointer' }}
                          >◉</span>
                        )}
                        {field.type === 'list' && (
                          <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginLeft: theme.spacing.sm }}>
                            ({Array.isArray(currentVal) ? currentVal.length : 0} Positionen)
                          </span>
                        )}
                        {isChanged && <span style={{ fontSize: theme.typography.sizes.xs, marginLeft: theme.spacing.sm }}>(korrigiert)</span>}
                      </label>
                      {field.type === 'list' ? (
                        <ListItemsEditor
                          value={currentVal}
                          itemFields={field.item_fields}
                          onChange={arr => updateEditedValue(fieldId, arr)}
                        />
                      ) : (
                        <FieldInputControl
                          field={field}
                          value={currentVal}
                          onChange={val => updateEditedValue(fieldId, val)}
                          isChanged={isChanged}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Message */}
      {statusMsg && (
        <div style={{
          padding: theme.spacing.md,
          backgroundColor: statusMsg.startsWith('Fehler') ? theme.colors.errorLight : theme.colors.successLight,
          color: statusMsg.startsWith('Fehler') ? theme.colors.error : theme.colors.success,
          borderRadius: theme.borderRadius.lg,
          fontSize: theme.typography.sizes.sm,
          marginBottom: theme.spacing.lg,
        }}>
          {statusMsg}
        </div>
      )}

      {/* Training Examples List */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Trainingsbeispiele ({examples.length})</div>
        <InfoBox style={{ marginBottom: theme.spacing.lg }}>
          Diese Beispiele fließen als <strong>Few-Shot</strong> in künftige Extraktionen
          ein (es werden bis zu 5 ausgewählt — Korrekturen zuerst, dann die neuesten).
          Je mehr korrigierte Beispiele pro Rezepttyp, desto treffsicherer die Extraktion.
        </InfoBox>
        {examples.length === 0 ? (
          <div style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm }}>
            Noch keine Trainingsbeispiele. Lade ein Dokument hoch, um zu beginnen.
          </div>
        ) : (
          examples.map(ex => (
            <div key={ex.id} style={styles.exampleRow}>
              <div>
                <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.text }}>
                  {ex.source_filename}
                </div>
                <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
                  {new Date(ex.created).toLocaleString('de-DE')}
                  {' — '}
                  {ex.confirmed_correct ? (
                    <span style={{ color: theme.colors.success }}>Korrekt extrahiert</span>
                  ) : (
                    <span style={{ color: theme.colors.warning }}>{ex.corrections_count} Korrektur(en)</span>
                  )}
                </div>
              </div>
              <button
                style={{ ...styles.dangerBtn, padding: theme.spacing.sm }}
                onClick={() => handleDeleteExample(ex.id)}
                title="Beispiel loeschen"
              >
                <TrashIcon size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============== Rules Tab ==============

/** Prozentwert deutsch formatieren (1 Nachkommastelle, ohne unnötige Null). */
function fmtPct(v) {
  if (v === null || v === undefined) return '—';
  return `${String(Math.round(v * 10) / 10).replace('.', ',')}%`;
}

const EVAL_ACTION_LABELS = {
  accepted: 'Regeln übernommen',
  rejected: 'Regel-Update verworfen',
  measured: 'Voll-Eval',
  initial: 'Erste Messung',
  error: 'Eval-Fehler',
};

function RulesTab({ project, onProjectUpdated }) {
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const evalState = project.learning?.eval || null;
  // Stale-Schutz: 'running' älter als 10 min (z.B. nach Backend-Crash) ignorieren.
  const evalRunning = !!(
    evalState?.status === 'running' &&
    evalState.started_at &&
    Date.now() - new Date(evalState.started_at).getTime() < 10 * 60 * 1000
  );
  const champion = evalState?.champion || null;
  const lastRun = evalState?.last_run || null;

  // Solange ein Eval läuft: Projekt regelmäßig neu laden (Muster BatchTab-Polling).
  useEffect(() => {
    if (!evalRunning) return;
    const t = setTimeout(() => onProjectUpdated(), 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [evalRunning, project]);

  async function startAction(path, startMsg) {
    setBusy(true);
    setStatusMsg('');
    try {
      const res = await apiPost(`/extraction/projects/${project.id}/${path}`);
      if (res.ok) {
        const r = await res.json();
        setStatusMsg(r.started === false ? 'Es läuft bereits eine Prüfung — bitte warten.' : startMsg);
        onProjectUpdated();
      } else {
        const err = await res.json();
        setStatusMsg(`Fehler: ${err.error}`);
      }
    } catch (err) {
      setStatusMsg('Netzwerkfehler');
    } finally {
      setBusy(false);
    }
  }

  function lastRunText(run) {
    if (!run) return null;
    const label = EVAL_ACTION_LABELS[run.action] || run.action;
    if (run.action === 'rejected' && run.challenger_overall != null && run.champion_overall != null) {
      const delta = Math.round((run.challenger_overall - run.champion_overall) * 10) / 10;
      return `${label}: ${String(delta).replace('.', ',').replace('-', '−')} Pp auf ${run.examples} Beispielen — bestehende Regeln bleiben aktiv.`;
    }
    if ((run.action === 'accepted') && run.champion_overall != null) {
      return `${label}: ${fmtPct(run.champion_overall)} → ${fmtPct(run.challenger_overall)} auf ${run.examples} Beispielen.`;
    }
    if (run.action === 'accepted' || run.action === 'initial') {
      return `${label}: ${fmtPct(run.challenger_overall)} auf ${run.examples} Beispielen.`;
    }
    if (run.action === 'measured') {
      return `${label}: ${fmtPct(run.champion_overall)} auf ${run.examples} Beispielen.`;
    }
    return `${label}${run.message ? `: ${run.message}` : ''}`;
  }

  const lastRunColor =
    lastRun?.action === 'rejected' ? theme.colors.warning
    : lastRun?.action === 'error' ? theme.colors.error
    : theme.colors.success;

  return (
    <div>
      {/* Qualität (gemessen) */}
      <div style={styles.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg }}>
          <div style={styles.sectionTitle}>Qualität (gemessen)</div>
          <button
            style={styles.secondaryBtn}
            onClick={() => startAction('evaluate', 'Voll-Eval gestartet — läuft im Hintergrund.')}
            disabled={busy || evalRunning || !(project.learning?.total_examples > 0)}
          >
            <BarChartIcon size={14} />
            Voll-Eval starten
          </button>
        </div>

        <InfoBox style={{ marginBottom: theme.spacing.lg }}>
          Jede Regel-Änderung wird automatisch gegen die Trainingsbeispiele <strong>gemessen</strong>
          (Champion/Challenger): Die Beispiele werden mit den Kandidaten-Regeln neu extrahiert und
          Feld für Feld mit deinen bestätigten Werten verglichen. Nur Regeln, die mindestens so gut
          sind wie die aktuellen, werden übernommen. Gemessen wird text-basiert, ohne Few-Shot.
        </InfoBox>

        {evalRunning && (
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md, marginBottom: theme.spacing.lg }}>
            <Spinner size={16} />
            <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>
              Eval läuft — Regeln werden geprüft… (Seite aktualisiert sich automatisch)
            </span>
          </div>
        )}

        {champion ? (
          <div>
            <div style={{ display: 'flex', gap: theme.spacing['2xl'], alignItems: 'baseline', marginBottom: theme.spacing.lg }}>
              <div>
                <div style={{ fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, color: theme.colors.text }}>
                  {fmtPct(champion.overall)}
                </div>
                <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>
                  gemessene Genauigkeit
                </div>
              </div>
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
                auf {champion.examples} Beispielen · Regeln v{champion.guideline_version} · Modell {champion.model}
                <br />
                {new Date(champion.at).toLocaleString('de-DE')}
              </div>
            </div>

            {/* Feld-Accuracy */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: theme.spacing.sm }}>
              {Object.entries(project.fields).map(([fid, f]) => {
                const pct = champion.by_field?.[fid];
                const color = pct == null ? theme.colors.textMuted
                  : pct >= 90 ? theme.colors.success
                  : pct >= 60 ? theme.colors.warning
                  : theme.colors.error;
                return (
                  <div key={fid} style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing.md, fontSize: theme.typography.sizes.sm, padding: `${theme.spacing.xs} ${theme.spacing.sm}`, backgroundColor: theme.colors.background, borderRadius: theme.borderRadius.md }}>
                    <span style={{ color: theme.colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.label || fid}>
                      {f.label || fid}
                    </span>
                    <span style={{ color, fontWeight: theme.typography.weights.medium }}>{fmtPct(pct)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          !evalRunning && (
            <div style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm }}>
              Noch keine Messung. Ab dem dritten korrigierten Trainingsbeispiel wird automatisch
              gemessen — oder starte jetzt einen Voll-Eval.
            </div>
          )
        )}

        {lastRun && (
          <div style={{ marginTop: theme.spacing.lg, fontSize: theme.typography.sizes.sm, color: lastRunColor }}>
            {lastRunText(lastRun)}
            <span style={{ color: theme.colors.textMuted }}> · {new Date(lastRun.at).toLocaleString('de-DE')}</span>
          </div>
        )}

        {evalState?.history?.length > 1 && (
          <div style={{ marginTop: theme.spacing.lg }}>
            <div style={{ fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.medium, color: theme.colors.textMuted, marginBottom: theme.spacing.sm }}>
              VERLAUF
            </div>
            {evalState.history.slice(0, 8).map((h, i) => (
              <div key={i} style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginBottom: 2 }}>
                {new Date(h.at).toLocaleString('de-DE')} — {EVAL_ACTION_LABELS[h.action] || h.action}
                {h.challenger != null && ` · Kandidat ${fmtPct(h.challenger)}`}
                {h.champion != null && ` · Champion ${fmtPct(h.champion)}`}
                {h.version != null && ` · v${h.version}`}
              </div>
            ))}
          </div>
        )}

        {/* Konfidenz-Kalibrierung (Welle 3): sagt die Konfidenz echte Fehler voraus? */}
        {(project.learning?.calibration?.samples ?? 0) >= 10 && (
          <div style={{ marginTop: theme.spacing.lg }}>
            <div style={{ fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.medium, color: theme.colors.textMuted, marginBottom: theme.spacing.sm }}>
              KONFIDENZ-KALIBRIERUNG ({project.learning.calibration.samples} Stichproben aus Korrekturen)
            </div>
            {project.learning.calibration.buckets.map((b, i) => {
              if (!b.total) return null;
              const observed = Math.round((b.correct / b.total) * 100);
              const lo = i * 20;
              const hi = i * 20 + 20;
              // Überkonfident: beobachtete Korrektheit deutlich unter dem Konfidenz-Bereich.
              const off = observed < lo - 10;
              return (
                <div key={i} style={{ display: 'flex', gap: theme.spacing.md, fontSize: theme.typography.sizes.sm, marginBottom: 2 }}>
                  <span style={{ width: 130, color: theme.colors.textMuted }}>Konfidenz {lo}–{hi}%</span>
                  <span style={{ color: off ? theme.colors.warning : theme.colors.text }}>
                    {observed}% tatsächlich korrekt
                  </span>
                  <span style={{ color: theme.colors.textMuted }}>({b.total})</span>
                </div>
              );
            })}
            <div style={{ marginTop: theme.spacing.xs, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
              Liegt die tatsächliche Korrektheit deutlich unter dem Konfidenz-Bereich, ist das Modell
              überkonfident — dann die Review-Schwelle in den Einstellungen erhöhen.
            </div>
          </div>
        )}
      </div>

      <div style={styles.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg }}>
          <div style={styles.sectionTitle}>Gelernte Extraktionsregeln</div>
          <button
            style={styles.secondaryBtn}
            onClick={() => startAction('regenerate', 'Regel-Update gestartet — Kandidat wird generiert und gemessen.')}
            disabled={busy || evalRunning}
          >
            <RefreshIcon size={14} />
            {evalRunning ? 'Prüfung läuft…' : 'Neu ableiten & messen'}
          </button>
        </div>

        <InfoBox style={{ marginBottom: theme.spacing.lg }}>
          Diese Regeln werden <strong>automatisch</strong> aus deinen Korrekturen
          abgeleitet (ab 3 Beispielen mit Korrekturen; „Neu generieren" stößt es manuell
          an). Sie sind etwas anderes als die festen <strong>Domänen-Anweisungen</strong>
          unter „Einstellungen" — die schreibst du selbst und sie werden vom Lernen nie
          überschrieben. Im Extraktions-Prompt kommen beide zusammen: erst deine
          Anweisungen, dann diese gelernten Regeln, dann die Few-Shot-Beispiele.
        </InfoBox>

        <div style={styles.guidelinesBox}>
          {project.guidelines ? project.guidelines : (
            <span style={{ fontStyle: 'italic' }}>
              Noch keine Regeln generiert. Regeln werden automatisch nach 3 Trainingsbeispielen mit Korrekturen erstellt.
            </span>
          )}
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Lernfortschritt</div>
        <div style={{ display: 'flex', gap: theme.spacing['2xl'] }}>
          <div>
            <div style={{ fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, color: theme.colors.text }}>
              {project.learning?.total_examples || 0}
            </div>
            <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>Beispiele</div>
          </div>
          <div>
            <div style={{ fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, color: theme.colors.text }}>
              ~{project.learning?.accuracy_estimate || 0}%
            </div>
            <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>ohne Korrektur (Schätzung)</div>
          </div>
          <div>
            <div style={{ fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, color: theme.colors.text }}>
              v{project.learning?.guideline_version || 0}
            </div>
            <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>Regelversion</div>
          </div>
        </div>
      </div>

      {statusMsg && (
        <div style={{
          padding: theme.spacing.md,
          backgroundColor: statusMsg.startsWith('Fehler') ? theme.colors.errorLight : theme.colors.successLight,
          color: statusMsg.startsWith('Fehler') ? theme.colors.error : theme.colors.success,
          borderRadius: theme.borderRadius.lg,
          fontSize: theme.typography.sizes.sm,
        }}>
          {statusMsg}
        </div>
      )}
    </div>
  );
}

// ============== Settings Tab ==============

/**
 * Editor für die fachlichen Prüfregeln (Welle 5). Zwei Regeltypen:
 * Summen-Check (Positions-Spalte → Zielfeld) und Stammdaten-Abgleich (Tabelle/Spalte).
 * Die Feld-Auswahl kommt aus dem aktuellen Editor-Stand, damit gerade angelegte
 * Felder sofort referenzierbar sind.
 */
function RulesEditor({ rules, fields, onChange }) {
  const [tables, setTables] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet('/tables');
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setTables(json.tables || []);
      } catch {
        /* Tabellen sind optional — ohne sie bleibt nur die Summen-Regel nutzbar */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const named = fields.filter(f => f.label.trim());
  // Nur Listen mit einer Zahl-Spalte taugen für einen Summen-Check — sonst
  // liesse sich die Regel anlegen, aber nie vollständig ausfüllen.
  const numberColumns = f => (f.item_fields || []).filter(c => c.type === 'number' && c.label?.trim());
  const listFields = named.filter(f => f.type === 'list' && numberColumns(f).length > 0);
  const numberFields = named.filter(f => f.type === 'number');
  const scalarFields = named.filter(f => f.type !== 'list');

  function update(idx, patch) {
    onChange(rules.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function addRule(type) {
    const id = `rule_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
    // Sinnvoll vorbelegen: eine frisch angelegte Regel ist damit sofort gültig
    // und muss nicht erst durch drei Dropdowns komplettiert werden.
    onChange([
      ...rules,
      type === 'sum'
        ? {
            id,
            type: 'sum',
            list_field: listFields[0]?.id || '',
            item_field: numberColumns(listFields[0] || {})[0]?.id || '',
            target_field: numberFields[0]?.id || '',
          }
        : {
            id,
            type: 'lookup',
            field: scalarFields[0]?.id || '',
            table_id: tables[0]?.id || '',
            column_id: tables[0]?.columns?.[0]?.id || '',
            severity: 'error',
          },
    ]);
  }

  // Eine Regel braucht Felder, auf die sie zeigen kann. Fehlen die, wird der
  // Button gesperrt — dann muss aber SICHTBAR sein warum: Inline-Styles kennen
  // kein `:disabled`, ein gesperrter Button sieht sonst aus wie ein klickbarer,
  // der nichts tut.
  const sumBlocked = listFields.length === 0
    ? 'Ein Summen-Check braucht ein Listen-Feld (Positionen) mit einer Zahl-Spalte — lege oben ein Feld vom Typ „Liste / Positionen" an.'
    : numberFields.length === 0
      ? 'Ein Summen-Check braucht ein Zahl-Feld als Ziel (z. B. „Gesamtbetrag") — lege oben ein Feld vom Typ „Zahl" an.'
      : '';
  const lookupBlocked = scalarFields.length === 0
    ? 'Ein Stammdaten-Abgleich braucht mindestens ein einfaches Feld (kein Listen-Feld).'
    : tables.length === 0
      ? 'Ein Stammdaten-Abgleich prüft gegen eine Tabellenspalte — es existiert noch keine Tabelle (Verwaltung → Tabellen).'
      : '';

  const selectStyle = { ...styles.select, width: '100%' };
  const blockedBtnStyle = { ...styles.secondaryBtn, opacity: 0.45, cursor: 'not-allowed' };

  return (
    <div style={styles.section}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg }}>
        <div style={styles.sectionTitle}>Prüfregeln</div>
        <div style={{ display: 'flex', gap: theme.spacing.sm }}>
          <button
            style={sumBlocked ? blockedBtnStyle : styles.secondaryBtn}
            onClick={() => addRule('sum')}
            disabled={!!sumBlocked}
            title={sumBlocked || 'Positions-Spalte muss auf ein Zielfeld summieren'}
          >
            + Summen-Check
          </button>
          <button
            style={lookupBlocked ? blockedBtnStyle : styles.secondaryBtn}
            onClick={() => addRule('lookup')}
            disabled={!!lookupBlocked}
            title={lookupBlocked || 'Feldwert muss in einer Tabellenspalte vorkommen'}
          >
            + Stammdaten-Abgleich
          </button>
        </div>
      </div>

      <InfoBox>
        Prüfregeln bewerten die <strong>fachliche Plausibilität</strong> — unabhängig von der Konfidenz.
        Ein verletzter Summen-Check oder ein unbekannter Stammdaten-Wert hebt das Dokument im
        Verarbeiten-Tab auf „Zu prüfen" und wird dort im Klartext angezeigt.
      </InfoBox>

      {/* Warum ein Button gesperrt ist, gehört sichtbar neben den Button — nicht
          nur in einen Tooltip, den niemand sucht. */}
      {(sumBlocked || lookupBlocked) && (
        <div style={{ marginTop: theme.spacing.md, display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
          {[sumBlocked, lookupBlocked].filter(Boolean).map((reason, i) => (
            <div key={i} style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>
              {reason}
            </div>
          ))}
        </div>
      )}

      {rules.length === 0 && !sumBlocked && !lookupBlocked && (
        <div style={{ marginTop: theme.spacing.lg, fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>
          Keine Prüfregeln definiert.
        </div>
      )}

      {rules.map((rule, idx) => {
        const listField = listFields.find(f => f.id === rule.list_field);
        const table = tables.find(t => t.id === rule.table_id);
        return (
          <div key={rule.id || idx} style={{
            padding: theme.spacing.lg,
            backgroundColor: theme.colors.background,
            borderRadius: theme.borderRadius.lg,
            marginTop: theme.spacing.md,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md }}>
              <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.text }}>
                {rule.type === 'sum' ? 'Summen-Check' : 'Stammdaten-Abgleich'}
              </div>
              <button
                style={{ ...styles.dangerBtn, padding: theme.spacing.sm }}
                onClick={() => onChange(rules.filter((_, i) => i !== idx))}
                title="Regel entfernen"
              >
                <TrashIcon size={14} />
              </button>
            </div>

            {rule.type === 'sum' ? (
              <div style={{ display: 'flex', gap: theme.spacing.md, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={styles.label}>Positionen</label>
                  <select
                    style={selectStyle}
                    value={rule.list_field}
                    onChange={e => update(idx, { list_field: e.target.value, item_field: '' })}
                  >
                    <option value="">— wählen —</option>
                    {listFields.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={styles.label}>Spalte (Zahl)</label>
                  <select
                    style={selectStyle}
                    value={rule.item_field}
                    onChange={e => update(idx, { item_field: e.target.value })}
                  >
                    <option value="">— wählen —</option>
                    {(listField?.item_fields || [])
                      .filter(col => col.type === 'number' && col.label.trim())
                      .map(col => <option key={col.id} value={col.id}>{col.label}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={styles.label}>muss ergeben</label>
                  <select
                    style={selectStyle}
                    value={rule.target_field}
                    onChange={e => update(idx, { target_field: e.target.value })}
                  >
                    <option value="">— wählen —</option>
                    {numberFields.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                </div>
                <div style={{ width: 120 }}>
                  <label style={styles.label}>Toleranz</label>
                  <input
                    style={styles.input}
                    type="number"
                    min="0"
                    step="0.01"
                    value={rule.tolerance ?? ''}
                    onChange={e => update(idx, { tolerance: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                    placeholder="0.01"
                  />
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: theme.spacing.md, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={styles.label}>Feld</label>
                  <select style={selectStyle} value={rule.field} onChange={e => update(idx, { field: e.target.value })}>
                    <option value="">— wählen —</option>
                    {scalarFields.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={styles.label}>Tabelle</label>
                  <select
                    style={selectStyle}
                    value={rule.table_id}
                    onChange={e => update(idx, { table_id: e.target.value, column_id: '' })}
                  >
                    <option value="">— wählen —</option>
                    {tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={styles.label}>Spalte</label>
                  <select style={selectStyle} value={rule.column_id} onChange={e => update(idx, { column_id: e.target.value })}>
                    <option value="">— wählen —</option>
                    {(table?.columns || []).map(col => <option key={col.id} value={col.id}>{col.name}</option>)}
                  </select>
                </div>
                <div style={{ width: 160 }}>
                  <label style={styles.label}>Wirkung</label>
                  <select
                    style={selectStyle}
                    value={rule.severity || 'error'}
                    onChange={e => update(idx, { severity: e.target.value })}
                  >
                    <option value="error">Zu prüfen erzwingen</option>
                    <option value="warn">Nur Hinweis</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SettingsTab({ project, onProjectUpdated, onDeleted }) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [strategy, setStrategy] = useState(project.extraction?.strategy || 'hybrid');
  const [modelOverride, setModelOverride] = useState(project.extraction?.model_override || null);
  const [reviewThreshold, setReviewThreshold] = useState(
    project.extraction?.review_threshold != null ? String(project.extraction.review_threshold) : ''
  );
  const [instructions, setInstructions] = useState(project.instructions || '');
  const [fields, setFields] = useState(
    Object.entries(project.fields).map(([id, f]) => ({
      id,
      label: f.label,
      type: f.type,
      required: f.required,
      description: f.description || '',
      item_fields: itemFieldsToArray(f.item_fields),
      catalog: f.catalog || null,
    }))
  );
  const [rules, setRules] = useState(project.rules || []);
  const [webhookUrl, setWebhookUrl] = useState(project.webhook?.url || '');
  const [webhookSecret, setWebhookSecret] = useState(project.webhook?.secret || '');
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [exportWithExamples, setExportWithExamples] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await apiGet(`/extraction/projects/${project.id}/export?examples=${exportWithExamples}`);
      if (res.ok) {
        const blob = await res.blob();
        triggerDownload(blob, `${project.id}${exportWithExamples ? '-mit-beispielen' : ''}.extraction.json`);
      } else {
        setStatusMsg('Fehler: Export fehlgeschlagen');
      }
    } catch {
      setStatusMsg('Netzwerkfehler beim Export');
    } finally {
      setExporting(false);
    }
  }

  function addField() {
    setFields([...fields, { id: '', label: '', type: 'text', required: false, description: '', item_fields: [] }]);
  }

  function removeField(idx) {
    setFields(fields.filter((_, i) => i !== idx));
  }

  function updateField(idx, key, value) {
    const updated = [...fields];
    updated[idx] = { ...updated[idx], [key]: value };
    if (key === 'label' && !updated[idx].id) {
      updated[idx].id = slugifyFieldLabel(value);
    }
    // Typwechsel weg von Liste verwirft die Spalten-Definition.
    if (key === 'type' && value !== 'list') {
      updated[idx].item_fields = [];
    }
    setFields(updated);
  }

  async function handleSave() {
    const badList = fields.filter(f => f.label.trim()).find(
      f => f.type === 'list' && Object.keys(itemFieldsToObject(f.item_fields)).length === 0,
    );
    if (badList) {
      setStatusMsg(`Fehler: Liste "${badList.label}" braucht mindestens eine Positions-Spalte`);
      return;
    }

    setSaving(true);
    setStatusMsg('');

    const fieldsObj = {};
    for (const f of fields.filter(f => f.label.trim())) {
      const fieldId = f.id || f.label.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      fieldsObj[fieldId] = {
        type: f.type,
        required: f.required,
        label: f.label,
        description: f.description || undefined,
        ...(f.type === 'list'
          ? { item_fields: itemFieldsToObject(f.item_fields) }
          : (f.catalog ? { catalog: f.catalog } : {})),
      };
    }

    try {
      const res = await apiPut(`/extraction/projects/${project.id}`, {
        name: name.trim(),
        description: description.trim(),
        fields: fieldsObj,
        instructions: instructions,
        rules,
        webhook: webhookUrl.trim()
          ? { url: webhookUrl.trim(), ...(webhookSecret.trim() ? { secret: webhookSecret.trim() } : {}) }
          : null,
        extraction: {
          ...(project.extraction || {}),
          strategy,
          model_override: modelOverride,
          // leer = Standard (confidence_threshold bzw. 0.6); undefined entfernt den Key im JSON
          review_threshold: reviewThreshold === '' ? undefined : Math.min(1, Math.max(0, parseFloat(reviewThreshold))),
        },
      });

      if (res.ok) {
        setStatusMsg('Gespeichert!');
        onProjectUpdated();
      } else {
        const err = await res.json();
        setStatusMsg(`Fehler: ${err.error}`);
      }
    } catch (err) {
      setStatusMsg('Netzwerkfehler');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Projekt "${project.name}" wirklich loeschen? Alle Trainingsbeispiele gehen verloren.`)) return;

    try {
      const res = await apiDelete(`/extraction/projects/${project.id}`);
      if (res.ok) {
        onDeleted();
      }
    } catch (err) {
      setStatusMsg('Fehler beim Loeschen');
    }
  }

  return (
    <div>
      {/* Project Info */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Projekt</div>
        <div style={{ marginBottom: theme.spacing.lg }}>
          <label style={styles.label}>Name</label>
          <input style={styles.input} value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div style={{ marginBottom: theme.spacing.lg }}>
          <label style={styles.label}>Beschreibung</label>
          <input style={styles.input} value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <div style={{ marginBottom: theme.spacing.lg }}>
          <label style={styles.label}>Extraktions-Strategie</label>
          <select
            style={{ ...styles.select, width: '100%' }}
            value={strategy}
            onChange={e => setStrategy(e.target.value)}
          >
            {EXTRACTION_STRATEGIES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: theme.spacing.lg }}>
          <label style={styles.label}>KI-Modell (optional)</label>
          <ModelOverrideSelect value={modelOverride} onChange={setModelOverride} />
          <div style={{ marginTop: theme.spacing.xs, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
            Überschreibt das System-Standardmodell für dieses Projekt. Vision-Strategien brauchen ein vision-fähiges Modell.
          </div>
        </div>
        <div style={{ marginBottom: theme.spacing.lg }}>
          <label style={styles.label}>Review-Schwelle (Konfidenz, optional)</label>
          <input
            style={{ ...styles.input, maxWidth: 160 }}
            type="number"
            min="0"
            max="1"
            step="0.05"
            value={reviewThreshold}
            onChange={e => setReviewThreshold(e.target.value)}
            placeholder="0.6 (Standard)"
          />
          <div style={{ marginTop: theme.spacing.xs, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
            Batch-Dateien mit einer Feld-Konfidenz unter dieser Schwelle werden als „Zu prüfen" markiert.
            Leer = Standard (Pipeline-Schwelle bzw. 0.6).
          </div>
        </div>
        <div>
          <label style={styles.label}>Domänen-Anweisungen (optional)</label>
          <textarea
            style={{ ...styles.input, minHeight: '120px', resize: 'vertical', fontFamily: 'inherit' }}
            value={instructions}
            onChange={e => setInstructions(e.target.value)}
            placeholder="Stabile Hinweise an die KI (Format-Regeln, Umgang mit Versatz/Unterschrift, Dokumenttyp …). Wird nicht vom Lernen überschrieben."
          />
        </div>
      </div>

      {/* Fields */}
      <div style={styles.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg }}>
          <div style={styles.sectionTitle}>Felder</div>
          <button style={styles.secondaryBtn} onClick={addField}>+ Feld</button>
        </div>

        {fields.map((field, idx) => (
          <div key={idx} style={{
            padding: theme.spacing.lg,
            backgroundColor: theme.colors.background,
            borderRadius: theme.borderRadius.lg,
            marginBottom: theme.spacing.md,
          }}>
            <div style={{ display: 'flex', gap: theme.spacing.md, marginBottom: theme.spacing.md }}>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Label</label>
                <input
                  style={styles.input}
                  value={field.label}
                  onChange={e => updateField(idx, 'label', e.target.value)}
                />
              </div>
              <div style={{ width: '120px' }}>
                <label style={styles.label}>Typ</label>
                <select
                  style={{ ...styles.select, width: '100%' }}
                  value={field.type}
                  onChange={e => updateField(idx, 'type', e.target.value)}
                >
                  {FIELD_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: theme.spacing.xs }}>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox"
                    style={styles.checkbox}
                    checked={field.required}
                    onChange={e => updateField(idx, 'required', e.target.checked)}
                  />
                  Pflicht
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: theme.spacing.xs }}>
                <button
                  style={{ ...styles.dangerBtn, padding: theme.spacing.sm }}
                  onClick={() => removeField(idx)}
                  title="Feld entfernen"
                >
                  <TrashIcon size={14} />
                </button>
              </div>
            </div>
            <div>
              <label style={styles.label}>Beschreibung</label>
              <input
                style={styles.input}
                value={field.description}
                onChange={e => updateField(idx, 'description', e.target.value)}
              />
            </div>
            {field.type === 'list' ? (
              <ItemFieldsEditor
                itemFields={field.item_fields}
                onChange={arr => updateField(idx, 'item_fields', arr)}
              />
            ) : (
              /* Kontrollierte Werteliste (Welle 6) */
              <CatalogEditor
                catalog={field.catalog}
                onChange={value => updateField(idx, 'catalog', value)}
              />
            )}
            <div style={{ marginTop: theme.spacing.xs, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
              ID: {field.id}
            </div>
          </div>
        ))}
      </div>

      {/* Prüfregeln (Welle 5) */}
      <RulesEditor rules={rules} fields={fields} onChange={setRules} />

      {/* Integration / Webhook (Welle 5) */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Integration</div>
        <InfoBox>
          Läufe dieses Projekts können ihr Ergebnis an eine URL melden — auch die per API
          (<code>extraktion/batch.create</code>) gestarteten. Jede Zustellung trägt den Header
          <strong> X-Workplace-Signature</strong> (HMAC-SHA256 über den Rumpf, mit dem Schlüssel unten);
          der Empfänger prüft damit die Herkunft. 3 Zustellversuche, danach steht der Fehlschlag am Lauf.
        </InfoBox>
        <div style={{ marginTop: theme.spacing.lg, marginBottom: theme.spacing.lg }}>
          <label style={styles.label}>Webhook-URL (optional)</label>
          <input
            style={styles.input}
            value={webhookUrl}
            onChange={e => setWebhookUrl(e.target.value)}
            placeholder="https://example.com/workplace/extraktion"
          />
        </div>
        <div>
          <label style={styles.label}>Signaturschlüssel</label>
          <div style={{ display: 'flex', gap: theme.spacing.md }}>
            <input
              style={{ ...styles.input, fontFamily: 'monospace' }}
              value={webhookSecret}
              onChange={e => setWebhookSecret(e.target.value)}
              placeholder="Noch kein Schlüssel gesetzt"
            />
            <button
              style={{ ...styles.secondaryBtn, whiteSpace: 'nowrap' }}
              onClick={async () => {
                const res = await apiPost('/extraction/projects/webhook-secret', {});
                if (res.ok) setWebhookSecret((await res.json()).secret);
              }}
            >
              <RefreshIcon size={14} /> Neu erzeugen
            </button>
          </div>
          <div style={{ marginTop: theme.spacing.xs, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
            Ohne Schlüssel wird unsigniert zugestellt. Ein neuer Schlüssel macht alte Signaturen ungültig —
            beim Empfänger mit austauschen.
          </div>
        </div>
      </div>

      {/* Export / Weitergabe */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Export & Weitergabe</div>
        <InfoBox>
          Exportiere dieses Projekt als Paket (.json), um es auf einer anderen Workplace-Instanz zu
          importieren — z. B. eine bewährte Vorlage für andere Kunden. Schema, Domänen-Anweisungen und
          gelernte Regeln sind immer enthalten.
        </InfoBox>
        <label style={{ display: 'flex', alignItems: 'center', marginTop: theme.spacing.lg, fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary, cursor: 'pointer' }}>
          <input
            type="checkbox" style={styles.checkbox}
            checked={exportWithExamples}
            onChange={(e) => setExportWithExamples(e.target.checked)}
          />
          Trainingsbeispiele einschließen (enthält Originaldokumente — ggf. personenbezogene Daten)
        </label>
        <div style={{ marginTop: theme.spacing.lg }}>
          <button style={styles.secondaryBtn} onClick={handleExport} disabled={exporting}>
            {exporting ? <Spinner size={14} /> : <DocumentIcon size={14} />}
            {exporting ? 'Exportiere…' : 'Projekt exportieren'}
          </button>
        </div>
      </div>

      {statusMsg && (
        <div style={{
          padding: theme.spacing.md,
          backgroundColor: statusMsg.startsWith('Fehler') ? theme.colors.errorLight : theme.colors.successLight,
          color: statusMsg.startsWith('Fehler') ? theme.colors.error : theme.colors.success,
          borderRadius: theme.borderRadius.lg,
          fontSize: theme.typography.sizes.sm,
          marginBottom: theme.spacing.lg,
        }}>
          {statusMsg}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button style={styles.dangerBtn} onClick={handleDelete}>
          <TrashIcon size={14} /> Projekt loeschen
        </button>
        <button style={styles.primaryBtn} onClick={handleSave} disabled={saving}>
          {saving ? 'Speichere...' : 'Aenderungen speichern'}
        </button>
      </div>
    </div>
  );
}
