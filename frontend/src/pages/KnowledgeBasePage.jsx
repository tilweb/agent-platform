import { useState, useEffect, useRef } from 'react';
import { theme } from '../config/theme';
import { apiGet, apiPost, apiPut, apiDelete, apiPostForm, API_URL } from '../utils/apiFetch';
import AccessManager from '../components/AccessManager';
import { formatDate } from '../utils/dateFormat';

// ==========================================
// Helper Functions
// ==========================================

function parseDocumentMeta(rawMarkdown) {
  if (!rawMarkdown) return null;
  const result = {
    title: '', type: '', source: '', pages: '', language: '',
    owner: '', keywords: [], description: '', questions: [],
    confidentiality: '', indexed_date: '', created: '',
  };
  const lines = rawMarkdown.split('\n');
  let inQuestions = false;
  let inDescription = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Section headers
    if (trimmed.startsWith('## Beantwortet Fragen') || trimmed.startsWith('## Fragen') || trimmed.startsWith('## Questions') || trimmed.startsWith('## Mögliche Fragen')) {
      inQuestions = true;
      inDescription = false;
      continue;
    }
    if (trimmed.startsWith('## Inhaltsbeschreibung') || trimmed.startsWith('## Beschreibung') || trimmed.startsWith('## Description')) {
      inDescription = true;
      inQuestions = false;
      continue;
    }
    if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
      inQuestions = false;
      inDescription = false;
      continue;
    }

    // Questions list
    if (inQuestions && trimmed.startsWith('- ')) {
      result.questions.push(trimmed.replace(/^-\s*/, '').trim());
      continue;
    }

    // Free-text description paragraph
    if (inDescription && trimmed && !trimmed.startsWith('**')) {
      result.description = result.description ? result.description + ' ' + trimmed : trimmed;
      continue;
    }

    // Key-Value pairs: "- **Key:** Value" or "**Key:** Value"
    const kvMatch = trimmed.match(/^(?:-\s*)?\*\*(.+?)\*\*:?\s*(.+)$/);
    if (kvMatch) {
      const key = kvMatch[1].toLowerCase().replace(/:$/, '').trim();
      const val = kvMatch[2].trim();
      if (key === 'titel' || key === 'title') result.title = val;
      else if (key === 'typ' || key === 'type') result.type = val;
      else if (key === 'quelle' || key === 'source' || key === 'quelldatei') result.source = val;
      else if (key === 'seiten' || key === 'pages' || key === 'seitenzahl' || key === 'seitenanzahl') result.pages = val;
      else if (key === 'sprache' || key === 'language') result.language = val;
      else if (key === 'owner' || key === 'besitzer') result.owner = val;
      else if (key === 'erstellt' || key === 'created') result.created = val;
      else if (key === 'keywords' || key === 'schlagworte' || key === 'schlüsselwörter') {
        result.keywords = val.split(',').map(k => k.trim()).filter(Boolean);
      }
      else if (key === 'beschreibung' || key === 'description') result.description = val;
      else if (key === 'vertraulichkeit' || key === 'confidentiality') result.confidentiality = val;
      else if (key === 'indiziert' || key === 'indexed' || key === 'indexed_date') result.indexed_date = val;
    }
  }
  return result;
}

function getFileType(source) {
  if (!source) return '?';
  const ext = source.split('.').pop()?.toLowerCase();
  const map = {
    pdf: 'PDF', docx: 'DOCX', doc: 'DOC', xlsx: 'XLSX', xls: 'XLS',
    pptx: 'PPTX', ppt: 'PPT', txt: 'TXT', md: 'MD', html: 'HTML',
    htm: 'HTML', csv: 'CSV', json: 'JSON',
  };
  return map[ext] || ext?.toUpperCase() || '?';
}

function getFileTypeColor(type) {
  const colors = {
    PDF: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
    DOCX: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
    DOC: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
    XLSX: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
    XLS: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
    PPTX: { bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' },
    PPT: { bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' },
    TXT: { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' },
    MD: { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' },
    HTML: { bg: '#fdf4ff', color: '#a855f7', border: '#e9d5ff' },
    CSV: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  };
  return colors[type] || { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' };
}

// formatDate is imported from utils/dateFormat

// ==========================================
// Styles
// ==========================================

const styles = {
  container: {
    width: '100%',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.xl,
  },
  headerContent: {},
  title: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textMuted,
  },
  // Stats bar
  statsBar: {
    display: 'flex',
    gap: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  statValue: {
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    fontSize: theme.typography.sizes.lg,
  },
  // Card Grid
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    outline: 'none',
  },
  cardHover: {
    borderColor: theme.colors.primary,
    boxShadow: theme.shadows.md,
  },
  cardStatic: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  cardTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  cardDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.lineHeight.relaxed,
    marginBottom: theme.spacing.md,
  },
  cardMeta: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.sm,
  },
  badge: {
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    backgroundColor: `${theme.colors.primary}15`,
    color: theme.colors.primary,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  tagContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  tag: {
    padding: `2px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.full,
    fontSize: theme.typography.sizes.xs,
    backgroundColor: theme.colors.background,
    color: theme.colors.textMuted,
    border: `1px solid ${theme.colors.border}`,
  },
  // Breadcrumb / Back
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
  // Detail header
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.xl,
  },
  detailTitle: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  detailDescription: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
  },
  detailMeta: {
    display: 'flex',
    gap: theme.spacing.lg,
    alignItems: 'center',
  },
  // Document Table
  tableContainer: {
    overflow: 'hidden',
  },
  tableHeader: {
    display: 'grid',
    gridTemplateColumns: '60px 1fr 120px 60px 60px 80px',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    borderBottom: `2px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.background,
    borderRadius: `${theme.borderRadius.md} ${theme.borderRadius.md} 0 0`,
  },
  tableHeaderCell: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    cursor: 'pointer',
    userSelect: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '60px 1fr 120px 60px 60px 80px',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.md}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    cursor: 'pointer',
    transition: `background ${theme.transitions.fast}`,
    alignItems: 'center',
  },
  tableRowHover: {
    backgroundColor: theme.colors.background,
  },
  tableRowExpanded: {
    backgroundColor: `${theme.colors.primary}05`,
    borderBottom: 'none',
  },
  tableCell: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  tableCellMuted: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
  },
  typeBadge: {
    display: 'inline-block',
    padding: `2px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    textAlign: 'center',
  },
  // Debug Panel
  debugPanel: {
    margin: `0 ${theme.spacing.md} ${theme.spacing.md}`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  debugTabs: {
    display: 'flex',
    borderBottom: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.background,
  },
  debugTab: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    cursor: 'pointer',
    border: 'none',
    background: 'none',
    borderBottom: '2px solid transparent',
    transition: `all ${theme.transitions.fast}`,
  },
  debugTabActive: {
    color: theme.colors.primary,
    borderBottomColor: theme.colors.primary,
    backgroundColor: theme.colors.surface,
  },
  debugContent: {
    padding: theme.spacing.lg,
    maxHeight: '500px',
    overflowY: 'auto',
    backgroundColor: theme.colors.surface,
  },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: '140px 1fr',
    gap: `${theme.spacing.sm} ${theme.spacing.md}`,
    fontSize: theme.typography.sizes.sm,
  },
  metaLabel: {
    color: theme.colors.textMuted,
    fontWeight: theme.typography.weights.medium,
  },
  metaValue: {
    color: theme.colors.text,
  },
  keywordBadge: {
    display: 'inline-block',
    padding: `2px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.full,
    fontSize: theme.typography.sizes.xs,
    backgroundColor: `${theme.colors.primary}10`,
    color: theme.colors.primary,
    border: `1px solid ${theme.colors.primary}30`,
    marginRight: '4px',
    marginBottom: '4px',
  },
  questionItem: {
    padding: `${theme.spacing.xs} 0`,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    borderBottom: `1px solid ${theme.colors.borderLight}`,
  },
  preContent: {
    whiteSpace: 'pre-wrap',
    fontFamily: 'monospace',
    fontSize: theme.typography.sizes.xs,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    border: `1px solid ${theme.colors.border}`,
    maxHeight: '400px',
    overflowY: 'auto',
    color: theme.colors.textSecondary,
    margin: 0,
  },
  // Upload progress stepper
  stepper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.lg} 0`,
  },
  stepperStep: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  stepperStepActive: {
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.semibold,
  },
  stepperStepDone: {
    color: '#10b981',
    fontWeight: theme.typography.weights.medium,
  },
  stepperDivider: {
    width: '24px',
    height: '2px',
    backgroundColor: theme.colors.border,
  },
  stepperDividerDone: {
    backgroundColor: '#10b981',
  },
  // Search / toolbar
  toolbar: {
    display: 'flex',
    gap: theme.spacing.md,
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  searchInput: {
    flex: 1,
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
  },
  // Form elements
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },
  label: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  input: {
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
  },
  select: {
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
  },
  button: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  buttonSecondary: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: 'transparent',
    color: theme.colors.textSecondary,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  buttonSmall: {
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    backgroundColor: 'transparent',
    color: theme.colors.textSecondary,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  buttonRow: {
    display: 'flex',
    gap: theme.spacing.md,
    justifyContent: 'flex-end',
  },
  uploadArea: {
    border: `2px dashed ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing['2xl'],
    textAlign: 'center',
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    backgroundColor: theme.colors.background,
  },
  uploadAreaActive: {
    borderColor: theme.colors.primary,
    backgroundColor: `${theme.colors.primary}08`,
  },
  uploadText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.md,
  },
  uploadFileName: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    fontWeight: theme.typography.weights.medium,
    marginTop: theme.spacing.sm,
  },
  statusMessage: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    marginBottom: theme.spacing.lg,
  },
  statusSuccess: {
    backgroundColor: '#10b98115',
    color: '#10b981',
    border: '1px solid #10b98130',
  },
  statusError: {
    backgroundColor: '#ef444415',
    color: '#ef4444',
    border: '1px solid #ef444430',
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing['3xl'],
    color: theme.colors.textMuted,
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: theme.spacing.md,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.medium,
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    fontSize: theme.typography.sizes.sm,
  },
  deleteButton: {
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    backgroundColor: 'transparent',
    color: theme.colors.textMuted,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.xs,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  deleteButtonHover: {
    borderColor: '#ef4444',
    color: '#ef4444',
  },
};

// ==========================================
// Upload Progress Steps
// ==========================================
const UPLOAD_STEPS = [
  { key: 'upload', label: 'Upload' },
  { key: 'convert', label: 'Konvertierung' },
  { key: 'meta', label: 'Metadaten' },
  { key: 'index', label: 'Index' },
];

function UploadStepper({ currentStep }) {
  const stepIndex = UPLOAD_STEPS.findIndex(s => s.key === currentStep);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: `${theme.spacing.md} 0` }}>
      {UPLOAD_STEPS.map((step, i) => {
        const isDone = i < stepIndex;
        const isActive = i === stepIndex;
        return (
          <div key={step.key} style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing.sm,
            fontSize: theme.typography.sizes.xs,
            color: isDone ? '#10b981' : isActive ? theme.colors.primary : theme.colors.textMuted,
            fontWeight: isActive ? theme.typography.weights.semibold : theme.typography.weights.medium,
          }}>
            <span style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '9px',
              fontWeight: 600,
              flexShrink: 0,
              backgroundColor: isDone ? '#10b981' : isActive ? theme.colors.primary : theme.colors.border,
              color: isDone || isActive ? '#fff' : theme.colors.textMuted,
            }}>
              {isDone ? '\u2713' : i + 1}
            </span>
            {step.label}
            {isActive && <span style={{ marginLeft: 'auto', opacity: 0.7 }}>...</span>}
          </div>
        );
      })}
    </div>
  );
}

// ==========================================
// Main Component
// ==========================================

function KnowledgeBasePage() {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Navigation
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [collectionDetail, setCollectionDetail] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Create collection form
  const [newCollection, setNewCollection] = useState({
    id: '', name: '', description: '', activate_when: '', never_activate_when: '',
  });

  // Upload form
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadOwner, setUploadOwner] = useState('');
  const [uploadConfidentiality, setUploadConfidentiality] = useState('internal');
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);

  // Document table state
  const [sortField, setSortField] = useState('title');
  const [sortDirection, setSortDirection] = useState('asc');
  const [searchFilter, setSearchFilter] = useState('');
  const [documentMetaCache, setDocumentMetaCache] = useState({});

  // Debug panel
  const [expandedDocId, setExpandedDocId] = useState(null);
  const [activeDebugTab, setActiveDebugTab] = useState('meta');
  const [docContent, setDocContent] = useState(null);
  const [docIndex, setDocIndex] = useState(null);
  const [expandedDocRawMeta, setExpandedDocRawMeta] = useState(null);

  // Hover states
  const [hoveredCard, setHoveredCard] = useState(null);
  const [hoveredDoc, setHoveredDoc] = useState(null);
  const [hoveredDelete, setHoveredDelete] = useState(null);

  // Delete collection modal
  const [showDeleteCollectionModal, setShowDeleteCollectionModal] = useState(false);
  const [deletingCollection, setDeletingCollection] = useState(false);

  // Right panel tabs (collection detail view)
  const [activeDetailTab, setActiveDetailTab] = useState('upload');

  // Editable collection fields
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editActivateWhen, setEditActivateWhen] = useState('');
  const [editNeverActivateWhen, setEditNeverActivateWhen] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    loadCollections();
  }, []);

  // ==========================================
  // Data Loading
  // ==========================================

  async function loadCollections() {
    setLoading(true);
    try {
      const res = await apiGet('/knowledge/collections');
      const data = await res.json();
      setCollections(data.collections || []);
    } catch (err) {
      console.error('Error loading collections:', err);
    }
    setLoading(false);
  }

  async function loadCollectionDetail(collectionId) {
    try {
      const res = await apiGet(`/knowledge/collections/${collectionId}`);
      if (res.ok) {
        const data = await res.json();
        setCollectionDetail(data);
        setSelectedCollection(collectionId);

        // Initialize edit fields from collections list (has activate_when etc.)
        const colInfo = collections.find(c => c.id === collectionId);
        setEditName(data.collection_name || '');
        setEditDescription(data.description || '');
        setEditActivateWhen((colInfo?.activate_when || []).join(', '));
        setEditNeverActivateWhen((colInfo?.never_activate_when || []).join(', '));
        setDocumentMetaCache({});
        // Auto-load all document metas in background
        if (data.documents?.length > 0) {
          Promise.all(
            data.documents.map(doc => loadDocumentMetaForCache(doc.document_id, collectionId))
          ).catch(() => {});
        }
      }
    } catch (err) {
      console.error('Error loading collection detail:', err);
    }
  }

  // Separate function to avoid stale closure over documentMetaCache
  async function loadDocumentMetaForCache(docId, collectionId = selectedCollection) {
    try {
      const res = await apiGet(`/knowledge/documents/${docId}?collection_id=${collectionId}`);
      if (res.ok) {
        const data = await res.json();
        const parsed = parseDocumentMeta(data.meta);
        const cacheEntry = { raw: data.meta, parsed, hasContent: data.hasContent, hasIndex: data.hasIndex };
        setDocumentMetaCache(prev => ({ ...prev, [docId]: cacheEntry }));
        return cacheEntry;
      }
    } catch (err) {
      console.error('Error loading document meta:', err);
    }
    return null;
  }

  async function loadDocumentMeta(docId) {
    if (documentMetaCache[docId]) return documentMetaCache[docId];
    return loadDocumentMetaForCache(docId);
  }

  async function loadDocContent(docId) {
    try {
      const res = await apiGet(`/knowledge/documents/${docId}/content?collection_id=${selectedCollection}`);
      if (res.ok) {
        const data = await res.json();
        setDocContent(data.content);
      } else {
        setDocContent('(Kein Content verfuegbar)');
      }
    } catch {
      setDocContent('(Fehler beim Laden)');
    }
  }

  async function loadDocIndex(docId) {
    try {
      const res = await apiGet(`/knowledge/documents/${docId}/index?collection_id=${selectedCollection}`);
      if (res.ok) {
        const data = await res.json();
        setDocIndex(data.index);
      } else {
        setDocIndex('(Kein Index verfuegbar)');
      }
    } catch {
      setDocIndex('(Fehler beim Laden)');
    }
  }

  // ==========================================
  // Document Expansion
  // ==========================================

  async function handleExpandDoc(docId) {
    if (expandedDocId === docId) {
      setExpandedDocId(null);
      setDocContent(null);
      setDocIndex(null);
      setExpandedDocRawMeta(null);
      return;
    }

    setExpandedDocId(docId);
    setActiveDebugTab('meta');
    setDocContent(null);
    setDocIndex(null);

    const cached = await loadDocumentMeta(docId);
    if (cached) {
      setExpandedDocRawMeta(cached.raw);
    }
  }

  async function handleDebugTabChange(tab, docId) {
    setActiveDebugTab(tab);
    if (tab === 'content' && docContent === null) {
      await loadDocContent(docId);
    } else if (tab === 'index' && docIndex === null) {
      await loadDocIndex(docId);
    }
  }

  // ==========================================
  // Sorting & Filtering
  // ==========================================

  function handleSort(field) {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  function getSortedDocuments() {
    if (!collectionDetail?.documents) return [];
    let docs = [...collectionDetail.documents];

    // Filter
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      docs = docs.filter(doc => {
        const title = (doc.title || doc.document_id).toLowerCase();
        const sourceFile = (doc.source_file || '').toLowerCase();
        const type = doc.source_file ? getFileType(doc.source_file).toLowerCase() : '';
        return title.includes(q) || sourceFile.includes(q) || type.includes(q) || doc.document_id.toLowerCase().includes(q);
      });
    }

    // Sort
    docs.sort((a, b) => {
      let valA, valB;
      const cacheA = documentMetaCache[a.document_id]?.parsed;
      const cacheB = documentMetaCache[b.document_id]?.parsed;

      switch (sortField) {
        case 'type':
          valA = (a.source_file || cacheA?.source) ? getFileType(a.source_file || cacheA?.source) : '';
          valB = (b.source_file || cacheB?.source) ? getFileType(b.source_file || cacheB?.source) : '';
          break;
        case 'title':
          valA = (a.source_file || cacheA?.source || cacheA?.title || a.title || a.document_id).toLowerCase();
          valB = (b.source_file || cacheB?.source || cacheB?.title || b.title || b.document_id).toLowerCase();
          break;
        case 'date':
          valA = a.indexed_date || '';
          valB = b.indexed_date || '';
          break;
        case 'pages':
          valA = parseInt(cacheA?.pages) || 0;
          valB = parseInt(cacheB?.pages) || 0;
          break;
        case 'language':
          valA = cacheA?.language || '';
          valB = cacheB?.language || '';
          break;
        default:
          valA = '';
          valB = '';
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return docs;
  }

  // ==========================================
  // Actions
  // ==========================================

  async function handleCreateCollection(e) {
    e.preventDefault();
    try {
      const res = await apiPost('/knowledge/collections', {
        id: newCollection.id,
        name: newCollection.name,
        description: newCollection.description,
        activate_when: newCollection.activate_when
          ? newCollection.activate_when.split(',').map((s) => s.trim())
          : [],
        never_activate_when: newCollection.never_activate_when
          ? newCollection.never_activate_when.split(',').map((s) => s.trim())
          : [],
      });

      if (res.ok) {
        setStatusMessage({ type: 'success', text: `Collection "${newCollection.name}" erstellt` });
        setNewCollection({ id: '', name: '', description: '', activate_when: '', never_activate_when: '' });
        setShowCreateForm(false);
        loadCollections();
      } else {
        const err = await res.json();
        setStatusMessage({ type: 'error', text: err.error || 'Fehler beim Erstellen' });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  }

  async function handleSaveCollectionDetails() {
    if (!selectedCollection) return;

    setSavingDetails(true);
    try {
      const res = await apiPut(`/knowledge/collections/${selectedCollection}`, {
        name: editName,
        description: editDescription,
        activate_when: editActivateWhen
          ? editActivateWhen.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        never_activate_when: editNeverActivateWhen
          ? editNeverActivateWhen.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
      });

      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'Collection aktualisiert' });
        loadCollections();
        loadCollectionDetail(selectedCollection);
      } else {
        const err = await res.json();
        setStatusMessage({ type: 'error', text: err.error || 'Fehler beim Speichern' });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    }
    setSavingDetails(false);
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!uploadFile || !selectedCollection) return;

    setUploading(true);
    setStatusMessage(null);
    setUploadProgress('upload');

    // Simulate progress steps while backend processes
    const stepTimers = [];
    stepTimers.push(setTimeout(() => setUploadProgress('convert'), 1500));
    stepTimers.push(setTimeout(() => setUploadProgress('meta'), 4000));
    stepTimers.push(setTimeout(() => setUploadProgress('index'), 7000));

    try {
      const formData = new FormData();
      formData.append('document', uploadFile);
      formData.append('collection_id', selectedCollection);
      if (uploadTitle) formData.append('title', uploadTitle);
      if (uploadOwner) formData.append('owner', uploadOwner);
      formData.append('confidentiality', uploadConfidentiality);

      const res = await apiPostForm('/knowledge/index', formData);

      const result = await res.json();

      // Clear timers
      stepTimers.forEach(clearTimeout);

      if (res.ok && result.success) {
        setUploadProgress(null);
        setStatusMessage({
          type: 'success',
          text: `"${result.title}" erfolgreich indiziert (${result.document_id})`,
        });
        setUploadFile(null);
        setUploadTitle('');
        setUploadOwner('');
        loadCollections();
        loadCollectionDetail(selectedCollection);
      } else {
        setUploadProgress(null);
        setStatusMessage({ type: 'error', text: result.error || 'Fehler beim Indizieren' });
      }
    } catch (err) {
      stepTimers.forEach(clearTimeout);
      setUploadProgress(null);
      setStatusMessage({ type: 'error', text: err.message });
    }

    setUploading(false);
  }

  async function handleDeleteDocument(docId) {
    if (!confirm(`Dokument "${docId}" wirklich loeschen?`)) return;

    try {
      const res = await apiDelete(
        `/knowledge/documents/${docId}?collection_id=${selectedCollection}`
      );

      if (res.ok) {
        setStatusMessage({ type: 'success', text: `Dokument "${docId}" geloescht` });
        if (expandedDocId === docId) {
          setExpandedDocId(null);
          setDocContent(null);
          setDocIndex(null);
        }
        setDocumentMetaCache(prev => {
          const next = { ...prev };
          delete next[docId];
          return next;
        });
        loadCollections();
        loadCollectionDetail(selectedCollection);
      } else {
        const err = await res.json();
        setStatusMessage({ type: 'error', text: err.error || 'Fehler beim Loeschen' });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  }

  async function handleDeleteCollection() {
    setDeletingCollection(true);
    try {
      // Always delete documents with the collection (orphaned docs are inaccessible)
      const res = await apiDelete(`/knowledge/collections/${selectedCollection}?delete_documents=true`);

      if (res.ok) {
        const result = await res.json();
        const deletedCount = result.documents_deleted?.length || 0;
        setStatusMessage({
          type: 'success',
          text: `Collection "${collectionDetail?.collection_name}" geloescht${deletedCount > 0 ? ` (${deletedCount} Dokumente entfernt)` : ''}`,
        });
        setShowDeleteCollectionModal(false);
        handleBackToOverview();
        loadCollections();
      } else {
        const err = await res.json();
        setStatusMessage({ type: 'error', text: err.error || 'Fehler beim Loeschen' });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    }
    setDeletingCollection(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setUploadFile(e.dataTransfer.files[0]);
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave() {
    setDragActive(false);
  }

  function handleBackToOverview() {
    setSelectedCollection(null);
    setCollectionDetail(null);
    setExpandedDocId(null);
    setDocContent(null);
    setDocIndex(null);
    setExpandedDocRawMeta(null);
    setStatusMessage(null);
    setHoveredCard(null);
    setSearchFilter('');
    setDocumentMetaCache({});
  }

  // ==========================================
  // Render: Debug Panel
  // ==========================================

  function renderDebugPanel(docId) {
    const cached = documentMetaCache[docId];
    const parsed = cached?.parsed;
    const tabs = [
      { key: 'meta', label: 'Metadaten' },
      { key: 'content', label: 'Content' },
      { key: 'index', label: 'Index' },
      { key: 'raw', label: 'Raw' },
    ];

    return (
      <div style={styles.debugPanel}>
        {/* Tab Navigation */}
        <div style={styles.debugTabs}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              style={{
                ...styles.debugTab,
                ...(activeDebugTab === tab.key ? styles.debugTabActive : {}),
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleDebugTabChange(tab.key, docId);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={styles.debugContent}>
          {activeDebugTab === 'meta' && parsed && (
            <div>
              <div style={styles.metaGrid}>
                {parsed.title && (<><div style={styles.metaLabel}>Titel</div><div style={styles.metaValue}>{parsed.title}</div></>)}
                {parsed.type && (<><div style={styles.metaLabel}>Typ</div><div style={styles.metaValue}>{parsed.type}</div></>)}
                {parsed.source && (<><div style={styles.metaLabel}>Quelle</div><div style={styles.metaValue}>{parsed.source}</div></>)}
                {parsed.pages && (<><div style={styles.metaLabel}>Seiten</div><div style={styles.metaValue}>{parsed.pages}</div></>)}
                {parsed.language && (<><div style={styles.metaLabel}>Sprache</div><div style={styles.metaValue}>{parsed.language}</div></>)}
                {parsed.owner && (<><div style={styles.metaLabel}>Owner</div><div style={styles.metaValue}>{parsed.owner}</div></>)}
                {parsed.created && (<><div style={styles.metaLabel}>Erstellt</div><div style={styles.metaValue}>{parsed.created}</div></>)}
                {parsed.confidentiality && (<><div style={styles.metaLabel}>Vertraulichkeit</div><div style={styles.metaValue}>{parsed.confidentiality}</div></>)}
                {parsed.description && (<><div style={styles.metaLabel}>Beschreibung</div><div style={styles.metaValue}>{parsed.description}</div></>)}
              </div>

              {parsed.keywords.length > 0 && (
                <div style={{ marginTop: theme.spacing.lg }}>
                  <div style={{ ...styles.metaLabel, marginBottom: theme.spacing.sm }}>Keywords</div>
                  <div>
                    {parsed.keywords.map((kw, i) => (
                      <span key={i} style={styles.keywordBadge}>{kw}</span>
                    ))}
                  </div>
                </div>
              )}

              {parsed.questions.length > 0 && (
                <div style={{ marginTop: theme.spacing.lg }}>
                  <div style={{ ...styles.metaLabel, marginBottom: theme.spacing.sm }}>Fragen</div>
                  {parsed.questions.map((q, i) => (
                    <div key={i} style={styles.questionItem}>{q}</div>
                  ))}
                </div>
              )}

              {!parsed.title && !parsed.type && (
                <div style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm }}>
                  Keine strukturierten Metadaten gefunden.
                </div>
              )}
            </div>
          )}

          {activeDebugTab === 'meta' && !parsed && (
            <div style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm }}>
              Lade Metadaten...
            </div>
          )}

          {activeDebugTab === 'content' && (
            <pre style={styles.preContent}>
              {docContent === null ? 'Lade Content...' : (docContent.length > 5000 ? docContent.substring(0, 5000) + '\n\n... (gekuerzt auf 5000 Zeichen)' : docContent)}
            </pre>
          )}

          {activeDebugTab === 'index' && (
            <pre style={styles.preContent}>
              {docIndex === null ? 'Lade Index...' : docIndex}
            </pre>
          )}

          {activeDebugTab === 'raw' && (
            <pre style={styles.preContent}>
              {expandedDocRawMeta || cached?.raw || 'Lade...'}
            </pre>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: Collection Detail View
  // ==========================================
  if (selectedCollection && collectionDetail) {
    const sortedDocs = getSortedDocuments();
    const totalDocs = collectionDetail.documents?.length || 0;
    const metasLoaded = Object.keys(documentMetaCache).length;

    const sortIndicator = (field) => {
      if (sortField !== field) return '';
      return sortDirection === 'asc' ? ' \u2191' : ' \u2193';
    };

    return (
      <div style={styles.container}>
        {/* Back Link */}
        <button style={styles.backLink} onClick={handleBackToOverview}>
          <ArrowLeftIcon /> Knowledge Base
        </button>

        {/* Detail Header */}
        <div style={styles.detailHeader}>
          <div>
            <h1 style={styles.detailTitle}>{collectionDetail.collection_name}</h1>
            <p style={styles.detailDescription}>{collectionDetail.description}</p>
          </div>
          <div style={styles.detailMeta}>
            <span style={styles.badge}>
              {totalDocs} {totalDocs === 1 ? 'Dokument' : 'Dokumente'}
            </span>
            {collectionDetail.last_updated && (
              <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
                Aktualisiert: {formatDate(collectionDetail.last_updated)}
              </span>
            )}
          </div>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div
            style={{
              ...styles.statusMessage,
              ...(statusMessage.type === 'success' ? styles.statusSuccess : styles.statusError),
            }}
          >
            {statusMessage.text}
          </div>
        )}

        {/* Two-Column Layout: 2/3 Document List, 1/3 Details Panel with Tabs */}
        <div style={{ display: 'flex', gap: theme.spacing.xl, alignItems: 'flex-start' }}>

          {/* ===== LEFT (2/3): Document File List ===== */}
          <div style={{ flex: 2, minWidth: 0 }}>
            <div style={styles.cardStatic}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>Dokumente</h2>
                <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
                  {totalDocs} {totalDocs === 1 ? 'Datei' : 'Dateien'}
                  {metasLoaded < totalDocs && ` · Lade Details...`}
                </span>
              </div>

              {/* Search */}
              {totalDocs > 0 && (
                <div style={{ marginBottom: theme.spacing.md }}>
                  <input
                    style={styles.searchInput}
                    placeholder="Dokumente suchen..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                  />
                </div>
              )}

              {totalDocs === 0 ? (
                <div style={styles.emptyState}>
                  <div style={styles.emptyIcon}>
                    <KnowledgeIcon color={theme.colors.textMuted} size={48} />
                  </div>
                  <div style={styles.emptyTitle}>Keine Dokumente vorhanden</div>
                  <div style={styles.emptyText}>
                    Lade ein Dokument ueber das Upload-Formular rechts hoch.
                  </div>
                </div>
              ) : (
                <div style={styles.tableContainer}>
                  {/* Table Header */}
                  <div style={styles.tableHeader}>
                    <div style={styles.tableHeaderCell} onClick={() => handleSort('type')}>
                      Typ{sortIndicator('type')}
                    </div>
                    <div style={styles.tableHeaderCell} onClick={() => handleSort('title')}>
                      Dokument{sortIndicator('title')}
                    </div>
                    <div style={styles.tableHeaderCell} onClick={() => handleSort('date')}>
                      Indiziert{sortIndicator('date')}
                    </div>
                    <div style={styles.tableHeaderCell} onClick={() => handleSort('pages')}>
                      Seiten{sortIndicator('pages')}
                    </div>
                    <div style={styles.tableHeaderCell} onClick={() => handleSort('language')}>
                      Spr.{sortIndicator('language')}
                    </div>
                    <div style={{ ...styles.tableHeaderCell, cursor: 'default' }}>
                    </div>
                  </div>

                  {/* Table Rows */}
                  {sortedDocs.map((doc) => {
                    const cached = documentMetaCache[doc.document_id]?.parsed;
                    const sourceFile = doc.source_file || cached?.source;
                    const fileType = sourceFile ? getFileType(sourceFile) : null;
                    const typeColor = fileType ? getFileTypeColor(fileType) : null;
                    const isExpanded = expandedDocId === doc.document_id;
                    const displayName = doc.source_file || cached?.source || cached?.title || doc.title || doc.document_id;
                    const subtitle = cached?.title && cached.title !== displayName ? cached.title : null;

                    return (
                      <div key={doc.document_id}>
                        <div
                          style={{
                            ...styles.tableRow,
                            ...(hoveredDoc === doc.document_id && !isExpanded ? styles.tableRowHover : {}),
                            ...(isExpanded ? styles.tableRowExpanded : {}),
                          }}
                          onMouseEnter={() => setHoveredDoc(doc.document_id)}
                          onMouseLeave={() => setHoveredDoc(null)}
                          onClick={() => handleExpandDoc(doc.document_id)}
                        >
                          {/* Type Badge */}
                          <div>
                            {fileType ? (
                              <span
                                style={{
                                  ...styles.typeBadge,
                                  backgroundColor: typeColor.bg,
                                  color: typeColor.color,
                                  border: `1px solid ${typeColor.border}`,
                                }}
                              >
                                {fileType}
                              </span>
                            ) : (
                              <span style={{ ...styles.tableCellMuted, fontSize: theme.typography.sizes.xs }}>-</span>
                            )}
                          </div>

                          {/* Document name */}
                          <div style={{ ...styles.tableCell, whiteSpace: 'normal' }}>
                            <div>{displayName}</div>
                            {subtitle && (
                              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginTop: '1px' }}>
                                {subtitle}
                              </div>
                            )}
                          </div>

                          {/* Indexed Date */}
                          <div style={styles.tableCellMuted}>
                            {formatDate(doc.indexed_date)}
                          </div>

                          {/* Pages */}
                          <div style={styles.tableCellMuted}>
                            {cached?.pages || '-'}
                          </div>

                          {/* Language */}
                          <div style={styles.tableCellMuted}>
                            {cached?.language || '-'}
                          </div>

                          {/* Actions */}
                          <div>
                            <button
                              style={{
                                ...styles.deleteButton,
                                ...(hoveredDelete === doc.document_id ? styles.deleteButtonHover : {}),
                              }}
                              onMouseEnter={() => setHoveredDelete(doc.document_id)}
                              onMouseLeave={() => setHoveredDelete(null)}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteDocument(doc.document_id);
                              }}
                            >
                              Loeschen
                            </button>
                          </div>
                        </div>

                        {/* Debug Panel */}
                        {isExpanded && renderDebugPanel(doc.document_id)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ===== RIGHT (1/3): Tabbed Details Panel ===== */}
          <div style={{
            flex: 1,
            minWidth: 0,
            backgroundColor: theme.colors.surface,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.borderRadius.lg,
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 'calc(100vh - 240px)',
          }}>
            {/* Tab Navigation */}
            <div style={{
              display: 'flex',
              gap: theme.spacing.sm,
              padding: `${theme.spacing.md} ${theme.spacing.lg}`,
              borderBottom: `1px solid ${theme.colors.border}`,
              flexShrink: 0,
            }}>
              {[
                { id: 'upload', label: 'Upload' },
                { id: 'details', label: 'Details' },
                { id: 'access', label: 'Berechtigungen' },
              ].map((tab) => {
                const isActive = activeDetailTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    style={{
                      padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                      backgroundColor: isActive ? `${theme.colors.primary}15` : 'transparent',
                      border: 'none',
                      borderRadius: theme.borderRadius.md,
                      fontSize: theme.typography.sizes.sm,
                      fontWeight: theme.typography.weights.medium,
                      color: isActive ? theme.colors.primary : theme.colors.textMuted,
                      cursor: 'pointer',
                      transition: `all ${theme.transitions.fast}`,
                    }}
                    onClick={() => setActiveDetailTab(tab.id)}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            <div style={{
              flex: 1,
              overflow: 'auto',
              padding: theme.spacing.lg,
            }}>
              {/* Upload Tab */}
              {activeDetailTab === 'upload' && (
                <form style={{ ...styles.form, gap: theme.spacing.md }} onSubmit={handleUpload}>
                  <div
                    style={{
                      ...styles.uploadArea,
                      padding: theme.spacing.lg,
                      ...(dragActive ? styles.uploadAreaActive : {}),
                    }}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <UploadIcon color={theme.colors.textMuted} />
                    <div style={styles.uploadText}>
                      Datei hierher ziehen oder klicken
                    </div>
                    <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginTop: theme.spacing.xs }}>
                      PDF, Word, Excel, PowerPoint, Text, Markdown (max. 50 MB)
                    </div>
                    {uploadFile && (
                      <div style={styles.uploadFileName}>{uploadFile.name}</div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      style={{ display: 'none' }}
                      accept=".pdf,.docx,.doc,.xlsx,.pptx,.txt,.md,.html"
                      onChange={(e) => {
                        if (e.target.files[0]) setUploadFile(e.target.files[0]);
                      }}
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Titel (optional)</label>
                    <input
                      style={styles.input}
                      placeholder="Aus Dateiname abgeleitet"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Owner (optional)</label>
                    <input
                      style={styles.input}
                      placeholder="z.B. IT-Abteilung"
                      value={uploadOwner}
                      onChange={(e) => setUploadOwner(e.target.value)}
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Vertraulichkeit</label>
                    <select
                      style={styles.select}
                      value={uploadConfidentiality}
                      onChange={(e) => setUploadConfidentiality(e.target.value)}
                    >
                      <option value="public">Public</option>
                      <option value="internal">Internal</option>
                      <option value="confidential">Confidential</option>
                      <option value="secret">Secret</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    style={{
                      ...styles.button,
                      width: '100%',
                      opacity: uploading || !uploadFile ? 0.5 : 1,
                    }}
                    disabled={uploading || !uploadFile}
                  >
                    {uploading ? 'Indiziere...' : 'Indizieren'}
                  </button>

                  {uploadProgress && <UploadStepper currentStep={uploadProgress} />}
                </form>
              )}

              {/* Details Tab */}
              {activeDetailTab === 'details' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
                  {/* Editable fields that affect collection discovery */}
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Name</label>
                    <input
                      style={styles.input}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Collection Name"
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Beschreibung</label>
                    <input
                      style={styles.input}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Worum geht es in dieser Collection?"
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Relevant bei (komma-getrennt)</label>
                    <input
                      style={styles.input}
                      value={editActivateWhen}
                      onChange={(e) => setEditActivateWhen(e.target.value)}
                      placeholder="z.B. Compliance-Fragen, Richtlinien"
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Nicht relevant bei (komma-getrennt)</label>
                    <input
                      style={styles.input}
                      value={editNeverActivateWhen}
                      onChange={(e) => setEditNeverActivateWhen(e.target.value)}
                      placeholder="z.B. Smalltalk, Technische Fragen"
                    />
                  </div>

                  <button
                    style={{
                      ...styles.button,
                      width: '100%',
                      opacity: savingDetails ? 0.6 : 1,
                    }}
                    onClick={handleSaveCollectionDetails}
                    disabled={savingDetails}
                  >
                    {savingDetails ? 'Speichere...' : 'Speichern'}
                  </button>

                  {/* Read-only info section */}
                  <div style={{ marginTop: theme.spacing.md, paddingTop: theme.spacing.lg, borderTop: `1px solid ${theme.colors.border}` }}>
                    <div style={{ display: 'flex', gap: theme.spacing.xl, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
                      <div>
                        <span style={{ opacity: 0.7 }}>ID: </span>
                        <span style={{ fontFamily: 'monospace' }}>{selectedCollection}</span>
                      </div>
                      {collectionDetail.last_updated && (
                        <div>
                          <span style={{ opacity: 0.7 }}>Aktualisiert: </span>
                          <span>{formatDate(collectionDetail.last_updated)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Delete Collection Button */}
                  <div style={{ marginTop: theme.spacing.lg, paddingTop: theme.spacing.lg, borderTop: `1px solid ${theme.colors.border}` }}>
                    <button
                      style={{
                        ...styles.buttonSmall,
                        width: '100%',
                        color: '#ef4444',
                        borderColor: '#ef444430',
                      }}
                      onClick={() => setShowDeleteCollectionModal(true)}
                    >
                      Collection loeschen
                    </button>
                  </div>
                </div>
              )}

              {/* Access Tab */}
              {activeDetailTab === 'access' && (
                <AccessManager
                  resourceType="collection"
                  resourceId={selectedCollection}
                  resourceName={collectionDetail.collection_name}
                />
              )}
            </div>
          </div>
        </div>

        {/* Delete Collection Modal */}
        {showDeleteCollectionModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}>
            <div style={{
              backgroundColor: theme.colors.surface,
              borderRadius: theme.borderRadius.lg,
              padding: theme.spacing.xl,
              width: '400px',
              maxWidth: '90vw',
              boxShadow: theme.shadows.lg,
            }}>
              <h3 style={{
                fontSize: theme.typography.sizes.lg,
                fontWeight: theme.typography.weights.semibold,
                color: theme.colors.text,
                marginBottom: theme.spacing.md,
              }}>
                Collection loeschen?
              </h3>

              <p style={{
                fontSize: theme.typography.sizes.sm,
                color: theme.colors.textSecondary,
                marginBottom: theme.spacing.lg,
                lineHeight: theme.typography.lineHeight.relaxed,
              }}>
                Die Collection <strong>"{collectionDetail?.collection_name}"</strong> wird unwiderruflich geloescht.
                {collectionDetail?.documents?.length > 0 && (
                  <> Dokumente, die nur in dieser Collection sind, werden ebenfalls geloescht. Dokumente, die auch in anderen Collections verwendet werden, bleiben erhalten.</>
                )}
              </p>

              <div style={{ display: 'flex', gap: theme.spacing.md, justifyContent: 'flex-end' }}>
                <button
                  style={styles.buttonSecondary}
                  onClick={() => setShowDeleteCollectionModal(false)}
                  disabled={deletingCollection}
                >
                  Abbrechen
                </button>
                <button
                  style={{
                    ...styles.button,
                    backgroundColor: '#ef4444',
                    opacity: deletingCollection ? 0.6 : 1,
                  }}
                  onClick={handleDeleteCollection}
                  disabled={deletingCollection}
                >
                  {deletingCollection ? 'Loesche...' : 'Loeschen'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // RENDER: Collections Overview (Default)
  // ==========================================
  const totalCollections = collections.length;
  const totalDocuments = collections.reduce((sum, c) => sum + (c.document_count || 0), 0);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <h1 style={styles.title}>Knowledge Base</h1>
          <p style={styles.subtitle}>
            Wissensdatenbank verwalten - Collections, Dokumente und Indizierung
          </p>
        </div>
        <button
          style={showCreateForm ? styles.buttonSecondary : styles.button}
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          {showCreateForm ? 'Abbrechen' : 'Neue Collection'}
        </button>
      </div>

      {/* Stats Bar */}
      {!loading && collections.length > 0 && (
        <div style={styles.statsBar}>
          <div style={styles.statItem}>
            <span style={styles.statValue}>{totalCollections}</span>
            <span>{totalCollections === 1 ? 'Collection' : 'Collections'}</span>
          </div>
          <div style={styles.statItem}>
            <span style={styles.statValue}>{totalDocuments}</span>
            <span>{totalDocuments === 1 ? 'Dokument' : 'Dokumente'}</span>
          </div>
        </div>
      )}

      {/* Status Message */}
      {statusMessage && (
        <div
          style={{
            ...styles.statusMessage,
            ...(statusMessage.type === 'success' ? styles.statusSuccess : styles.statusError),
          }}
        >
          {statusMessage.text}
        </div>
      )}

      {/* Create Collection Form (inline toggle) */}
      {showCreateForm && (
        <div style={{ ...styles.cardStatic, marginBottom: theme.spacing.xl }}>
          <h2 style={{ ...styles.cardTitle, marginBottom: theme.spacing.lg }}>
            Neue Collection erstellen
          </h2>
          <form style={styles.form} onSubmit={handleCreateCollection}>
            <div style={{ display: 'flex', gap: theme.spacing.lg }}>
              <div style={{ ...styles.formGroup, flex: 1 }}>
                <label style={styles.label}>Collection-ID</label>
                <input
                  style={styles.input}
                  placeholder="z.B. compliance"
                  value={newCollection.id}
                  onChange={(e) =>
                    setNewCollection({ ...newCollection, id: e.target.value })
                  }
                  required
                />
              </div>
              <div style={{ ...styles.formGroup, flex: 1 }}>
                <label style={styles.label}>Name</label>
                <input
                  style={styles.input}
                  placeholder="z.B. Compliance & Richtlinien"
                  value={newCollection.name}
                  onChange={(e) =>
                    setNewCollection({ ...newCollection, name: e.target.value })
                  }
                  required
                />
              </div>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Beschreibung</label>
              <input
                style={styles.input}
                placeholder="Worum geht es in dieser Collection?"
                value={newCollection.description}
                onChange={(e) =>
                  setNewCollection({ ...newCollection, description: e.target.value })
                }
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>
                Relevant bei (komma-getrennt)
              </label>
              <input
                style={styles.input}
                placeholder="z.B. Compliance-Fragen, Richtlinien-Anfragen, SLA-Themen"
                value={newCollection.activate_when}
                onChange={(e) =>
                  setNewCollection({ ...newCollection, activate_when: e.target.value })
                }
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>
                Nicht relevant bei (komma-getrennt, optional)
              </label>
              <input
                style={styles.input}
                placeholder="z.B. Allgemeiner Smalltalk, Technische Fragen"
                value={newCollection.never_activate_when}
                onChange={(e) =>
                  setNewCollection({ ...newCollection, never_activate_when: e.target.value })
                }
              />
            </div>
            <div style={styles.buttonRow}>
              <button type="submit" style={styles.button}>
                Collection erstellen
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Collections Card Grid */}
      {loading ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyText}>Lade Collections...</div>
        </div>
      ) : collections.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>
            <KnowledgeIcon color={theme.colors.textMuted} size={48} />
          </div>
          <div style={styles.emptyTitle}>Keine Collections vorhanden</div>
          <div style={styles.emptyText}>
            Erstelle eine Collection, um Dokumente zu organisieren.
          </div>
        </div>
      ) : (
        <div style={styles.cardGrid}>
          {collections.map((col) => (
            <div
              key={col.id}
              style={{
                ...styles.card,
                ...(hoveredCard === col.id ? styles.cardHover : {}),
              }}
              onMouseEnter={() => setHoveredCard(col.id)}
              onMouseLeave={() => setHoveredCard(prev => prev === col.id ? null : prev)}
              onClick={() => { setHoveredCard(null); loadCollectionDetail(col.id); }}
            >
              <div style={{ marginBottom: theme.spacing.sm }}>
                <h3 style={{ ...styles.cardTitle, marginBottom: theme.spacing.xs }}>{col.name}</h3>
                <span style={styles.badge}>
                  {col.document_count} {col.document_count === 1 ? 'Dokument' : 'Dokumente'}
                </span>
              </div>
              <p style={styles.cardDescription}>{col.description}</p>
              {col.last_updated && (
                <div style={styles.cardMeta}>
                  Aktualisiert: {formatDate(col.last_updated)}
                </div>
              )}
              {col.activate_when && col.activate_when.length > 0 && (
                <div style={styles.tagContainer}>
                  {col.activate_when.map((tag, i) => (
                    <span key={i} style={{ ...styles.tag, backgroundColor: `${theme.colors.primary}10`, color: theme.colors.primary, borderColor: `${theme.colors.primary}30` }}>{tag}</span>
                  ))}
                </div>
              )}
              {col.never_activate_when && col.never_activate_when.length > 0 && (
                <div style={{ ...styles.tagContainer, marginTop: theme.spacing.xs }}>
                  {col.never_activate_when.map((tag, i) => (
                    <span key={i} style={{ ...styles.tag, backgroundColor: '#ef444410', color: '#ef4444', borderColor: '#ef444430' }}>{tag}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==========================================
// Icons
// ==========================================

function KnowledgeIcon({ color, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <line x1="8" y1="7" x2="16" y2="7" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

function UploadIcon({ color }) {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

export default KnowledgeBasePage;
