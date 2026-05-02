/**
 * VM-ImportPage — Multi-File-Import mit Auto-Detection.
 *
 * Pipeline (Backend siehe vertragsmanagement/import-service.ts):
 *   1+2 file-zu-text (vision/markitdown/xlsx-reorder)
 *   2.5 Klassifikator-LLM-Call (Vertragstyp + Document-Roles)
 *   3   Function-Call-Extraktion mit dynamischem Schema
 *   4   Validation
 *   5   Persistierung mit Multi-Attachment + provenance
 *
 * Nach 'done' navigieren wir zum Detail-View, wo der User den erkannten
 * Vertragstyp (mit Confidence) und die vorgeschlagenen Document-Rollen
 * korrigieren kann.
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../config/theme';
import { API_URL } from '../../utils/apiFetch';
import { ArrowLeftIcon } from '../../components/Icons';

/**
 * Liest einen SSE-Stream aus einer fetch-Response.
 * Yieldet { type, data } pro `event: ...\ndata: ...\n\n`-Block.
 */
async function* sseReader(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';
    for (const block of blocks) {
      if (!block.trim()) continue;
      const ev = { event: 'message', data: '' };
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) ev.event = line.slice(6).trim();
        else if (line.startsWith('data:')) ev.data += line.slice(5).trim();
      }
      if (ev.data) {
        try {
          yield { type: ev.event, data: JSON.parse(ev.data) };
        } catch {
          // ignore malformed event
        }
      }
    }
  }
}

const PHASE_HINTS = {
  vision: 'KI analysiert Bild. Bei eingescannten Vertraegen oft 20–30 Sekunden.',
  markitdown: 'Dokument wird in Markdown konvertiert.',
  classifying: 'Vertragstyp wird automatisch erkannt.',
  extracting: 'Strukturierte Vertragsdaten werden extrahiert. Bei dichten Toolboxen 30+ Sekunden.',
};

const STAGE_LABELS_VERTRAG = {
  started: 'Vorbereitung…',
  combining: 'Texte werden zusammengeführt',
  classifying: 'Vertragstyp wird erkannt',
  classifying_done: 'Vertragstyp erkannt',
  extracting: 'Vertragsdaten werden extrahiert',
  extracting_started: 'Vertragsdaten werden extrahiert',
  extracting_done: 'Validierung läuft',
  validating: 'Validierung läuft',
  storing: 'Vertrag wird gespeichert',
};

// Single-Mode VM-Wizard — fuer PM gibt es ein eigenes ImportPage in projektmanagement/.
const VERTRAG_CONFIG = {
  endpoint: '/apps/vertragsmanagement/contracts/import',
  backLink: '/apps/vertragsmanagement',
  backLabel: 'Vertragsmanagement',
  title: 'Vertrag importieren',
  subtitle: 'Laden Sie Hauptvertrag, Anlagen und Toolbox-Tabellen gleichzeitig hoch — die KI erkennt den Vertragstyp automatisch und extrahiert strukturierte Daten',
  uploadHintExtra: 'Hauptvertrag, Anhaenge und Toolbox-xlsx koennen zusammen in einem Vorgang importiert werden — die KI ordnet die Rolle.',
  doneEvent: 'done',
  doneField: 'contract',
  redirectPath: (id) => `/apps/vertragsmanagement/${id}`,
  incompleteError: 'Import unvollständig — kein Vertrag erstellt',
  stageLabels: STAGE_LABELS_VERTRAG,
};

const ACCEPTED_EXTENSIONS = [
  '.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt',
  '.png', '.jpg', '.jpeg', '.webp', '.txt', '.md',
];

const ACCEPT_STRING = ACCEPTED_EXTENSIONS.join(',');

const MAX_FILES = 10;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const styles = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: `${theme.spacing.xl} ${theme.spacing['2xl']}`,
    borderBottom: `1px solid ${theme.colors.border}`,
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
    padding: theme.spacing['2xl'],
    overflow: 'auto',
    maxWidth: '800px',
  },
  // Upload area
  uploadArea: {
    border: `2px dashed ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing['3xl'],
    textAlign: 'center',
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    backgroundColor: theme.colors.surface,
  },
  uploadAreaActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  uploadAreaDisabled: {
    cursor: 'not-allowed',
    opacity: 0.6,
  },
  uploadIcon: {
    marginBottom: theme.spacing.lg,
    color: theme.colors.textMuted,
  },
  uploadTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  uploadText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.lg,
  },
  uploadButton: {
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
  // File list
  fileList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  fileCard: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.lg,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
  },
  fileIcon: {
    width: '40px',
    height: '40px',
    borderRadius: theme.borderRadius.md,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.colors.text,
    flexShrink: 0,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  fileSize: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  removeButton: {
    padding: theme.spacing.sm,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: theme.borderRadius.md,
    cursor: 'pointer',
    color: theme.colors.textMuted,
    transition: `all ${theme.transitions.fast}`,
    flexShrink: 0,
  },
  // Add more files link
  addMoreArea: {
    border: `1px dashed ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    textAlign: 'center',
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
  },
  // Actions
  actions: {
    display: 'flex',
    gap: theme.spacing.md,
  },
  importButton: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  cancelButton: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  // Progress
  progress: {
    marginBottom: theme.spacing.xl,
  },
  progressBar: {
    height: '4px',
    backgroundColor: theme.colors.border,
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
    marginBottom: theme.spacing.md,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    transition: 'width 0.3s ease',
  },
  progressText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  // Granularer Progress
  progressContainer: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
  },
  progressHeading: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  fileList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.lg,
  },
  fileRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    fontSize: theme.typography.sizes.sm,
  },
  fileRowActive: {
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.borderRadius.md,
  },
  fileStatusIcon: {
    fontSize: theme.typography.sizes.base,
    width: '20px',
    textAlign: 'center',
    flexShrink: 0,
  },
  fileName: {
    color: theme.colors.text,
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  fileNameMuted: {
    color: theme.colors.textMuted,
  },
  fileTime: {
    color: theme.colors.primary,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: theme.typography.weights.medium,
    flexShrink: 0,
    fontSize: theme.typography.sizes.sm,
  },
  phaseHint: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
    lineHeight: '1.4',
  },
  stageLine: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    fontWeight: theme.typography.weights.medium,
    marginBottom: theme.spacing.md,
  },
  progressMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    fontVariantNumeric: 'tabular-nums',
  },
  // Error
  error: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.errorLight,
    borderRadius: theme.borderRadius.lg,
    color: theme.colors.error,
    fontSize: theme.typography.sizes.sm,
    marginBottom: theme.spacing.lg,
  },
  // Result
  result: {
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.successLight,
    borderRadius: theme.borderRadius.lg,
    color: theme.colors.success,
    fontSize: theme.typography.sizes.sm,
    marginBottom: theme.spacing.xl,
  },
  resultTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    marginBottom: theme.spacing.sm,
  },
};

function ImportPage() {
  const cfg = VERTRAG_CONFIG;
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState(null);

  // Phase-2: Klassifikator-Confirmation-Step nach dem Auto-Import. Statt direkt
  // zum Detail zu navigieren, zeigen wir das erkannte Ergebnis und lassen den
  // User den Vertragstyp bestätigen oder eine Re-Extraktion mit anderem Schema
  // anstoßen.
  const [phase, setPhase] = useState('upload'); // 'upload' | 'importing' | 'confirming' | 'reextracting'
  const [importedContract, setImportedContract] = useState(null);
  const [schemas, setSchemas] = useState([]);
  const [overrideType, setOverrideType] = useState('');

  // Schemas einmal laden — wird im Confirmation-Step für das Override-Dropdown
  // gebraucht.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/apps/vertragsmanagement/schemas`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setSchemas(data.schemas ?? []);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Granularer Progress-State (statt fake-Progress).
  // stage = aktuelle Top-Level-Phase, perFileStatus = Map filename → 'pending'|'running'|'done'|'failed'
  // activePhase = 'vision'|'markitdown'|'extracting'|null, activeElapsedMs = Millisekunden seit Phase-Start
  const [stage, setStage] = useState(null);
  const [perFileStatus, setPerFileStatus] = useState({});
  const [activeFile, setActiveFile] = useState(null);
  const [activePhase, setActivePhase] = useState(null);
  const [activeElapsedMs, setActiveElapsedMs] = useState(0);
  const [filesProcessed, setFilesProcessed] = useState(0);
  const [filesTotal, setFilesTotal] = useState(0);

  // Frontend-internal Heartbeat (alle 200ms): laesst den Sekunden-Counter
  // smooth weiterlaufen zwischen den Backend-Heartbeats (alle 3s). Bei jedem
  // Backend-Event wird activeElapsedMs hart gesetzt, der Timer fuehrt von dort weiter.
  useEffect(() => {
    if (!activePhase) return;
    const startedAt = Date.now() - activeElapsedMs;
    const id = setInterval(() => {
      setActiveElapsedMs(Date.now() - startedAt);
    }, 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePhase, activeFile]);

  const isValidFileType = (file) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    return ACCEPTED_EXTENSIONS.includes(ext);
  };

  const addFiles = (newFiles) => {
    const validFiles = [];
    for (const file of newFiles) {
      if (files.length + validFiles.length >= MAX_FILES) {
        setError(`Maximal ${MAX_FILES} Dateien erlaubt`);
        break;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError(`"${file.name}" ist zu groß (max. 50 MB)`);
        continue;
      }
      if (!isValidFileType(file)) {
        setError(`"${file.name}" hat ein nicht unterstütztes Format`);
        continue;
      }
      // Check for duplicates
      if (files.some((f) => f.name === file.name && f.size === file.size)) {
        continue;
      }
      validFiles.push(file);
    }
    if (validFiles.length > 0) {
      setFiles((prev) => [...prev, ...validFiles]);
      setError(null);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  const handleFileSelect = (e) => {
    if (e.target.files?.length) {
      addFiles(Array.from(e.target.files));
      // Reset input so the same file can be re-selected
      e.target.value = '';
    }
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleImport = async () => {
    if (files.length === 0) return;

    setIsImporting(true);
    setStage('started');
    setPerFileStatus(Object.fromEntries(files.map((f) => [f.name, 'pending'])));
    setFilesTotal(files.length);
    setFilesProcessed(0);
    setActiveFile(null);
    setActivePhase(null);
    setActiveElapsedMs(0);
    setError(null);

    try {
      const formData = new FormData();
      for (const file of files) {
        formData.append('files', file);
      }

      const response = await fetch(`${API_URL}${cfg.endpoint}`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok || !response.body) {
        // Fallback: kein Stream verfuegbar — versuche JSON-Error zu lesen.
        let errMsg = 'Import fehlgeschlagen';
        try {
          const data = await response.json();
          errMsg = data.error || errMsg;
        } catch { /* ignore */ }
        throw new Error(errMsg);
      }

      let resultId = null;
      let importErrorMessage = null;

      for await (const ev of sseReader(response)) {
        switch (ev.type) {
          case 'started':
            setStage('started');
            break;
          case 'file_started':
            setPerFileStatus((p) => ({ ...p, [ev.data.filename]: 'running' }));
            setActiveFile(ev.data.filename);
            setActivePhase(ev.data.kind === 'image' ? 'vision' : ev.data.kind === 'document' ? 'markitdown' : null);
            setActiveElapsedMs(0);
            setStage(null);
            break;
          case 'file_progress':
            setActiveElapsedMs(ev.data.elapsedMs);
            break;
          case 'file_done':
            setPerFileStatus((p) => ({ ...p, [ev.data.filename]: 'done' }));
            setFilesProcessed(ev.data.index);
            setActivePhase(null);
            setActiveFile(null);
            break;
          case 'file_failed':
            setPerFileStatus((p) => ({ ...p, [ev.data.filename]: 'failed' }));
            setFilesProcessed(ev.data.index);
            setActivePhase(null);
            setActiveFile(null);
            break;
          case 'combining':
            setStage('combining');
            setActivePhase(null);
            break;
          case 'extracting_started':
            setStage('extracting');
            setActivePhase('extracting');
            setActiveElapsedMs(0);
            break;
          case 'extracting_progress':
            setActiveElapsedMs(ev.data.elapsedMs);
            break;
          case 'extracting_done':
            setStage('extracting_done');
            setActivePhase(null);
            break;
          case 'validating':
            setStage('validating');
            break;
          case 'creating':
          case 'storing':
            setStage('storing');
            break;
          case 'classifying':
            setStage('classifying');
            setActivePhase('classifying');
            break;
          case 'classifying_progress':
            // heartbeat — UI behaelt aktuelle Phase
            break;
          case 'classifying_done':
            setStage('classifying_done');
            setActivePhase(null);
            break;
          case 'done':
            if (ev.type === cfg.doneEvent) {
              resultId = ev.data[cfg.doneField]?.id ?? null;
              // Vollstaendiges Contract-Objekt fuer den Confirmation-Step zwischenspeichern.
              const contractData = ev.data[cfg.doneField];
              if (contractData) {
                setImportedContract(contractData);
                setOverrideType(contractData.contract_type ?? '');
              }
            }
            break;
          case 'error':
            importErrorMessage = ev.data.message ?? 'Import fehlgeschlagen';
            break;
          default:
            break;
        }
      }

      if (importErrorMessage) {
        throw new Error(importErrorMessage);
      }

      if (resultId) {
        // Statt direkter Navigation: Confirmation-Step zeigen, damit der User
        // den erkannten Vertragstyp bestaetigen oder korrigieren kann.
        setPhase('confirming');
        setIsImporting(false);
        setStage(null);
        setActivePhase(null);
      } else {
        throw new Error(cfg.incompleteError);
      }
    } catch (err) {
      console.error('Import failed:', err);
      setError(err.message || 'Fehler beim Import');
      setIsImporting(false);
      setStage(null);
      setActivePhase(null);
    }
  };

  /**
   * Re-Extraktion mit dem im Override-Dropdown gewaehlten Vertragstyp.
   * Markdown ist schon im Backend gecached, Phase 1+2 wird NICHT wiederholt.
   * Alter Stand wird in extracted_history archiviert.
   */
  const handleReextract = async () => {
    if (!importedContract || !overrideType || overrideType === importedContract.contract_type) return;
    setError(null);
    setPhase('reextracting');
    try {
      const response = await fetch(
        `${API_URL}/apps/vertragsmanagement/contracts/${importedContract.id}/reextract`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contractType: overrideType }),
        },
      );
      if (!response.ok) {
        const txt = await response.text();
        throw new Error(`Re-Extraktion fehlgeschlagen (${response.status}): ${txt.substring(0, 200)}`);
      }
      // SSE-Stream konsumieren — wir warten nur auf Ende, brauchen die Events
      // hier nicht (die Progress-Phase 'reextracting' reicht der UI als Indikator).
      let updatedContract = null;
      for await (const ev of sseReader(response)) {
        if (ev.type === 'done') {
          updatedContract = ev.data.contract ?? null;
        } else if (ev.type === 'error') {
          throw new Error(ev.data.message ?? 'Re-Extraktion fehlgeschlagen');
        }
      }
      if (updatedContract) {
        setImportedContract(updatedContract);
        setOverrideType(updatedContract.contract_type ?? '');
      }
      setPhase('confirming');
    } catch (err) {
      console.error('Re-Extraktion fehlgeschlagen:', err);
      setError(err.message || 'Re-Extraktion fehlgeschlagen');
      setPhase('confirming');
    }
  };

  const handleConfirm = () => {
    if (importedContract?.id) {
      navigate(cfg.redirectPath(importedContract.id));
    }
  };

  const computedProgress = (() => {
    if (!isImporting) return 0;
    const fileShare = filesTotal > 0 ? (filesProcessed / filesTotal) * 35 : 0;
    if (stage === 'combining') return 40;
    if (stage === 'classifying') return 50;
    if (stage === 'classifying_done') return 60;
    if (stage === 'extracting') return 75;
    if (stage === 'extracting_done' || stage === 'validating') return 90;
    if (stage === 'storing' || stage === 'creating') return 95;
    if (stage === 'done') return 100;
    // Wenn aktive File-Phase laeuft: Basis 5% + bisheriger File-Anteil.
    return Math.min(40, 5 + fileShare);
  })();

  const formatSeconds = (ms) => {
    if (!ms) return '';
    const s = Math.floor(ms / 1000);
    return `${s}s`;
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button
          style={styles.backLink}
          onClick={() => navigate(cfg.backLink)}
        >
          <ArrowLeftIcon size={16} /> {cfg.backLabel}
        </button>
        <h1 style={styles.title}>{cfg.title}</h1>
        <p style={styles.subtitle}>{cfg.subtitle}</p>
      </div>

      <div style={styles.content}>
        {/* Error */}
        {error && <div style={styles.error}>{error}</div>}

        {/* File Upload Area / File List — nur in 'upload'-Phase rendern */}
        {phase === 'upload' && files.length === 0 ? (
          <div
            style={{
              ...styles.uploadArea,
              ...(isDragging ? styles.uploadAreaActive : {}),
              ...(isImporting ? styles.uploadAreaDisabled : {}),
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isImporting && fileInputRef.current?.click()}
          >
            <div style={styles.uploadIcon}>
              <UploadIcon size={48} />
            </div>
            <div style={styles.uploadTitle}>Projektdokumente hier ablegen</div>
            <p style={styles.uploadText}>
              PDF, Word, Excel, PowerPoint, Bilder oder Textdateien (max. {MAX_FILES} Dateien)
              {cfg.uploadHintExtra && (
                <>
                  <br />
                  {cfg.uploadHintExtra}
                </>
              )}
            </p>
            <button
              style={styles.uploadButton}
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              disabled={isImporting}
            >
              Dateien auswählen
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_STRING}
              multiple
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </div>
        ) : phase === 'upload' && files.length > 0 ? (
          <>
            <div style={styles.fileList}>
              {files.map((file, index) => (
                <div key={`${file.name}-${index}`} style={styles.fileCard}>
                  <div style={{
                    ...styles.fileIcon,
                    backgroundColor: getFileTypeColor(file.name),
                  }}>
                    {getFileTypeIcon(file.name)}
                  </div>
                  <div style={styles.fileInfo}>
                    <div style={styles.fileName}>{file.name}</div>
                    <div style={styles.fileSize}>{formatFileSize(file.size)}</div>
                  </div>
                  {!isImporting && (
                    <button
                      style={styles.removeButton}
                      onClick={() => removeFile(index)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <CloseIcon size={18} />
                    </button>
                  )}
                </div>
              ))}

              {/* Add more files */}
              {!isImporting && files.length < MAX_FILES && (
                <div
                  style={styles.addMoreArea}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  + Weitere Dateien hinzufügen
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_STRING}
              multiple
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </>
        ) : null}

        {/* Phase-2: Confirmation-Step nach erfolgreichem Auto-Import */}
        {(phase === 'confirming' || phase === 'reextracting') && importedContract && (() => {
          const confidence = importedContract.type_detection?.confidence ?? 0;
          const detectedSchema = schemas.find((s) => s.id === importedContract.contract_type);
          const lowConfidence = confidence < 0.7;
          return (
            <div style={{
              backgroundColor: theme.colors.surface,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.borderRadius.xl,
              padding: theme.spacing['2xl'],
            }}>
              <div style={{
                fontSize: theme.typography.sizes.lg,
                fontWeight: theme.typography.weights.semibold,
                color: theme.colors.text,
                marginBottom: theme.spacing.sm,
              }}>
                Vertragstyp bestätigen
              </div>
              <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted, marginBottom: theme.spacing.lg }}>
                Der Import ist abgeschlossen. Bestätigen Sie den erkannten Vertragstyp oder wählen Sie einen anderen — bei Korrektur werden die Vertragsdaten mit dem neuen Schema neu extrahiert.
              </div>

              <div style={{
                padding: theme.spacing.lg,
                backgroundColor: lowConfidence ? theme.colors.warningLight : theme.colors.surfaceHover,
                borderRadius: theme.borderRadius.lg,
                marginBottom: theme.spacing.lg,
              }}>
                <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted, marginBottom: theme.spacing.xs }}>
                  Erkannt
                </div>
                <div style={{ fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold, color: theme.colors.text }}>
                  {detectedSchema?.name ?? importedContract.contract_type}
                  {' '}
                  <span style={{
                    fontSize: theme.typography.sizes.xs,
                    fontWeight: theme.typography.weights.medium,
                    padding: `2px ${theme.spacing.sm}`,
                    borderRadius: theme.borderRadius.full,
                    backgroundColor: lowConfidence ? theme.colors.warning : theme.colors.success,
                    color: '#fff',
                    marginLeft: theme.spacing.sm,
                  }}>
                    {Math.round(confidence * 100)}% sicher
                  </span>
                </div>
                {lowConfidence && (
                  <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.warning, marginTop: theme.spacing.sm }}>
                    Niedrige Sicherheit — bitte überprüfen Sie den Vertragstyp.
                    {(importedContract.type_detection?.alternatives?.length ?? 0) > 0 && (
                      <>
                        {' '}Alternativen:{' '}
                        {importedContract.type_detection.alternatives
                          .map((a) => `${schemas.find((s) => s.id === a.type)?.name ?? a.type} (${Math.round(a.confidence * 100)}%)`)
                          .join(', ')}
                      </>
                    )}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: theme.spacing.lg }}>
                <label style={{
                  display: 'block',
                  fontSize: theme.typography.sizes.sm,
                  fontWeight: theme.typography.weights.medium,
                  color: theme.colors.text,
                  marginBottom: theme.spacing.sm,
                }}>
                  Vertragstyp
                </label>
                <select
                  value={overrideType}
                  onChange={(e) => setOverrideType(e.target.value)}
                  disabled={phase === 'reextracting'}
                  style={{
                    width: '100%',
                    padding: theme.spacing.md,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.borderRadius.lg,
                    fontSize: theme.typography.sizes.sm,
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                  }}
                >
                  {schemas.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: theme.spacing.md,
              }}>
                {overrideType !== importedContract.contract_type && (
                  <button
                    type="button"
                    onClick={handleReextract}
                    disabled={phase === 'reextracting'}
                    style={{
                      padding: `${theme.spacing.md} ${theme.spacing.xl}`,
                      backgroundColor: 'transparent',
                      color: theme.colors.text,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: theme.borderRadius.lg,
                      fontSize: theme.typography.sizes.sm,
                      fontWeight: theme.typography.weights.medium,
                      cursor: phase === 'reextracting' ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {phase === 'reextracting' ? 'Re-Extraktion läuft…' : 'Mit gewähltem Typ neu extrahieren'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={phase === 'reextracting'}
                  style={{
                    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
                    backgroundColor: theme.colors.primary,
                    color: '#fff',
                    border: 'none',
                    borderRadius: theme.borderRadius.lg,
                    fontSize: theme.typography.sizes.sm,
                    fontWeight: theme.typography.weights.medium,
                    cursor: phase === 'reextracting' ? 'not-allowed' : 'pointer',
                  }}
                >
                  Diesen Typ bestätigen
                </button>
              </div>
            </div>
          );
        })()}

        {/* Progress */}
        {isImporting && (
          <div style={styles.progressContainer}>
            <div style={styles.progressHeading}>Vertrag wird importiert</div>

            {/* Per-File-Liste mit Status-Icons */}
            <div style={styles.fileList}>
              {files.map((f) => {
                const status = perFileStatus[f.name] ?? 'pending';
                const isActive = activeFile === f.name;
                let icon = '◌';
                if (status === 'running') icon = '⟳';
                else if (status === 'done') icon = '✓';
                else if (status === 'failed') icon = '✗';
                const iconColor = status === 'done' ? theme.colors.success
                  : status === 'failed' ? theme.colors.error
                  : status === 'running' ? theme.colors.primary
                  : theme.colors.textMuted;
                return (
                  <div
                    key={f.name}
                    style={{ ...styles.fileRow, ...(isActive ? styles.fileRowActive : {}) }}
                  >
                    <span style={{ ...styles.fileStatusIcon, color: iconColor }}>{icon}</span>
                    <span style={status === 'pending' ? { ...styles.fileName, ...styles.fileNameMuted } : styles.fileName}>
                      {f.name}
                    </span>
                    {isActive && activeElapsedMs > 0 && (
                      <span style={styles.fileTime}>{formatSeconds(activeElapsedMs)}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Aktiver Phase-Hinweis */}
            {(activePhase || stage) && (
              <div style={styles.stageLine}>
                {activePhase === 'vision' && `Bildanalyse${activeElapsedMs > 0 ? ` (${formatSeconds(activeElapsedMs)})` : ''}`}
                {activePhase === 'markitdown' && `Dokument-Konvertierung${activeElapsedMs > 0 ? ` (${formatSeconds(activeElapsedMs)})` : ''}`}
                {activePhase === 'extracting' && `Daten-Extraktion${activeElapsedMs > 0 ? ` (${formatSeconds(activeElapsedMs)})` : ''}`}
                {!activePhase && stage && (cfg.stageLabels[stage] ?? stage)}
              </div>
            )}

            {/* Phase-Hinweis-Box (was passiert + erwartete Dauer) */}
            {activePhase && PHASE_HINTS[activePhase] && (
              <div style={styles.phaseHint}>
                {PHASE_HINTS[activePhase]}
              </div>
            )}

            {/* Progressbar — basiert auf realen Stages, nicht hardcoded */}
            <div style={styles.progressBar}>
              <div style={{ ...styles.progressFill, width: `${computedProgress}%` }} />
            </div>
            <div style={styles.progressMeta}>
              <span>{Math.round(computedProgress)}%</span>
              {filesTotal > 0 && (
                <span>{filesProcessed} von {filesTotal} Datei{filesTotal === 1 ? '' : 'en'}</span>
              )}
            </div>
          </div>
        )}

        {/* Actions — nur in upload-Phase mit ausgewählten Dateien */}
        {phase === 'upload' && files.length > 0 && (
          <div style={styles.actions}>
            <button
              style={styles.cancelButton}
              onClick={() => navigate(cfg.backLink)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              Abbrechen
            </button>
            <button
              style={styles.importButton}
              onClick={handleImport}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.primaryHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.primary;
              }}
            >
              <SparklesIcon size={16} />
              Import starten ({files.length} {files.length === 1 ? 'Datei' : 'Dateien'})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============== Helper functions ==============

function getFileTypeColor(filename) {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return theme.colors.errorLight;
    case 'docx':
    case 'doc':
      return theme.colors.primaryLight;
    case 'xlsx':
    case 'xls':
      return theme.colors.successLight;
    case 'pptx':
    case 'ppt':
      return theme.colors.warningLight;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'webp':
      return theme.colors.infoLight;
    default:
      return theme.colors.surfaceHover;
  }
}

function getFileTypeIcon(filename) {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
    return <ImageIcon size={20} />;
  }
  if (['xlsx', 'xls'].includes(ext)) {
    return <TableIcon size={20} />;
  }
  if (['pptx', 'ppt'].includes(ext)) {
    return <SlidesIcon size={20} />;
  }
  return <DocumentIcon size={20} />;
}

// ============== Icons ==============

function UploadIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function DocumentIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function ImageIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function TableIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  );
}

function SlidesIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function CloseIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SparklesIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path d="M19 13l.5 1.5L21 15l-1.5.5L19 17l-.5-1.5L17 15l1.5-.5L19 13z" />
      <path d="M5 17l.5 1.5L7 19l-1.5.5L5 21l-.5-1.5L3 19l1.5-.5L5 17z" />
    </svg>
  );
}

export default ImportPage;
