import { useState, useEffect, useRef } from 'react';
import { theme } from '../config/theme';
import { apiGet, apiPost, apiPut, apiDelete, apiPostForm } from '../utils/apiFetch';
import { DocumentIcon, TrashIcon, RefreshIcon, ArrowLeftIcon, SparklesIcon } from '../components/Icons';

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
];

// Heavy-Extraction-Pipeline-Strategien (siehe backend/src/services/extraction/).
const EXTRACTION_STRATEGIES = [
  { value: 'hybrid', label: 'Hybrid — Text + Vision-Fallback (empfohlen)' },
  { value: 'single-pass', label: 'Single-Pass — ein Durchlauf, kurze Dokumente' },
  { value: 'long-text-chunked', label: 'Long-Text — Chunking fuer lange Dokumente' },
  { value: 'vision-per-page', label: 'Vision-per-Page — Scans, Fotos, Handschrift' },
];

// ============== Main Component ==============

export default function ExtractionProjectsPage() {
  const [view, setView] = useState('list'); // list | create | detail
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

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
  }

  if (view === 'create') {
    return <CreateProjectView onBack={goBack} onCreated={(id) => { openProject(id); }} />;
  }

  if (view === 'detail' && selectedProjectId) {
    return <ProjectDetailView projectId={selectedProjectId} onBack={goBack} />;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Dokumenten-Extraktion</h1>
          <p style={styles.subtitle}>Lernende Extraktion — definiere Felder, trainiere durch Korrektur</p>
        </div>
        <button style={styles.primaryBtn} onClick={() => setView('create')}>
          <SparklesIcon size={16} /> Neues Projekt
        </button>
      </div>
      <div style={styles.content}>
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

// ============== Create Project View ==============

function CreateProjectView({ onBack, onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [strategy, setStrategy] = useState('hybrid');
  const [instructions, setInstructions] = useState('');
  const [fields, setFields] = useState([
    { id: '', label: '', type: 'text', required: true, description: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function addField() {
    setFields([...fields, { id: '', label: '', type: 'text', required: false, description: '' }]);
  }

  function removeField(idx) {
    setFields(fields.filter((_, i) => i !== idx));
  }

  function updateField(idx, key, value) {
    const updated = [...fields];
    updated[idx] = { ...updated[idx], [key]: value };
    // Auto-generate ID from label
    if (key === 'label') {
      updated[idx].id = value
        .toLowerCase()
        .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
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
      };
    }

    try {
      const res = await apiPost('/extraction/projects', {
        name: name.trim(),
        description: description.trim(),
        fields: fieldsObj,
        instructions: instructions.trim() || undefined,
        extraction: { strategy },
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
                {field.id && (
                  <div style={{ marginTop: theme.spacing.xs, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
                    ID: {field.id}
                  </div>
                )}
              </div>
            ))}
          </div>

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
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadExamples();
  }, [project.id]);

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
          setEditedValues({ ...result.data });
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

    try {
      const res = await apiPost(`/extraction/projects/${project.id}/extract`, { text: documentText });
      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          setExtractionResult(result.data);
          setDocumentText(result.document_text);
          setEditedValues({ ...result.data });
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
        corrected_extraction: editedValues,
      });

      if (res.ok) {
        const result = await res.json();
        const msg = result.guidelines_updated
          ? 'Beispiel gespeichert — Regeln wurden aktualisiert!'
          : 'Beispiel gespeichert!';
        setStatusMsg(msg);
        setExtractionResult(null);
        setEditedValues({});
        setDocumentText('');
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
          <div style={styles.sectionTitle}>Dokument hochladen</div>
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
              {extracting ? 'Extrahiere...' : 'Datei hierher ziehen oder klicken zum Hochladen'}
            </div>
            <div style={{ marginTop: theme.spacing.xs, color: theme.colors.textMuted, fontSize: theme.typography.sizes.xs }}>
              PDF, Word, Excel, Bilder oder Text
            </div>
          </div>

          {/* Text input alternative */}
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
                {extracting ? 'Extrahiere...' : 'Text extrahieren'}
              </button>
            )}
          </div>
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

          {hasChanges && (
            <div style={{
              padding: theme.spacing.md,
              backgroundColor: theme.colors.warningLight,
              color: theme.colors.warning,
              borderRadius: theme.borderRadius.lg,
              fontSize: theme.typography.sizes.sm,
              marginBottom: theme.spacing.lg,
            }}>
              Du hast Korrekturen vorgenommen — das System lernt daraus!
            </div>
          )}

          <div style={styles.splitView}>
            {/* Left: Document text */}
            <div>
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginBottom: theme.spacing.sm, fontWeight: theme.typography.weights.medium }}>
                DOKUMENTTEXT
              </div>
              <div style={styles.docPanel}>
                {documentText || 'Kein Text verfuegbar'}
              </div>
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

                  return (
                    <div key={fieldId}>
                      <label style={{
                        ...styles.label,
                        color: isChanged ? theme.colors.warning : theme.colors.text,
                      }}>
                        {field.label || fieldId}
                        {field.required && <span style={{ color: theme.colors.error }}> *</span>}
                        {isChanged && <span style={{ fontSize: theme.typography.sizes.xs, marginLeft: theme.spacing.sm }}>(korrigiert)</span>}
                      </label>
                      {field.type === 'boolean' ? (
                        <label style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, fontSize: theme.typography.sizes.sm }}>
                          <input
                            type="checkbox"
                            style={styles.checkbox}
                            checked={!!getInputValue(fieldId, field)}
                            onChange={e => updateEditedValue(fieldId, e.target.checked)}
                          />
                          {getInputValue(fieldId, field) ? 'Ja' : 'Nein'}
                        </label>
                      ) : (
                        <input
                          style={{
                            ...styles.input,
                            borderColor: isChanged ? theme.colors.warning : theme.colors.border,
                          }}
                          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                          value={getInputValue(fieldId, field)}
                          onChange={e => {
                            const val = field.type === 'number'
                              ? (e.target.value === '' ? null : parseFloat(e.target.value))
                              : e.target.value;
                            updateEditedValue(fieldId, val);
                          }}
                          step={field.type === 'number' ? 'any' : undefined}
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

function RulesTab({ project, onProjectUpdated }) {
  const [regenerating, setRegenerating] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  async function handleRegenerate() {
    setRegenerating(true);
    setStatusMsg('');

    try {
      const res = await apiPost(`/extraction/projects/${project.id}/regenerate`);
      if (res.ok) {
        setStatusMsg('Regeln erfolgreich neu generiert!');
        onProjectUpdated();
      } else {
        const err = await res.json();
        setStatusMsg(`Fehler: ${err.error}`);
      }
    } catch (err) {
      setStatusMsg('Netzwerkfehler');
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div>
      <div style={styles.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg }}>
          <div style={styles.sectionTitle}>Gelernte Extraktionsregeln</div>
          <button style={styles.secondaryBtn} onClick={handleRegenerate} disabled={regenerating}>
            <RefreshIcon size={14} />
            {regenerating ? 'Generiere...' : 'Neu generieren'}
          </button>
        </div>

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
            <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>Genauigkeit</div>
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

function SettingsTab({ project, onProjectUpdated, onDeleted }) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [strategy, setStrategy] = useState(project.extraction?.strategy || 'hybrid');
  const [instructions, setInstructions] = useState(project.instructions || '');
  const [fields, setFields] = useState(
    Object.entries(project.fields).map(([id, f]) => ({ id, label: f.label, type: f.type, required: f.required, description: f.description || '' }))
  );
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  function addField() {
    setFields([...fields, { id: '', label: '', type: 'text', required: false, description: '' }]);
  }

  function removeField(idx) {
    setFields(fields.filter((_, i) => i !== idx));
  }

  function updateField(idx, key, value) {
    const updated = [...fields];
    updated[idx] = { ...updated[idx], [key]: value };
    if (key === 'label' && !updated[idx].id) {
      updated[idx].id = value
        .toLowerCase()
        .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
    }
    setFields(updated);
  }

  async function handleSave() {
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
      };
    }

    try {
      const res = await apiPut(`/extraction/projects/${project.id}`, {
        name: name.trim(),
        description: description.trim(),
        fields: fieldsObj,
        instructions: instructions,
        extraction: { ...(project.extraction || {}), strategy },
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
            <div style={{ marginTop: theme.spacing.xs, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
              ID: {field.id}
            </div>
          </div>
        ))}
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
