/**
 * ImportPage
 * Multi-file document import for Projektauftrag creation
 */

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../config/theme';
import { apiPostForm } from '../../utils/apiFetch';
import { ArrowLeftIcon } from '../../components/Icons';

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
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState(null);

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
    setProgress(10);
    setProgressText('Dateien werden hochgeladen...');
    setError(null);

    try {
      const formData = new FormData();
      for (const file of files) {
        formData.append('files', file);
      }

      setProgress(25);
      setProgressText('Dokumente werden verarbeitet...');

      // Small delay so user sees the status
      await new Promise((r) => setTimeout(r, 300));
      setProgress(40);
      setProgressText('Daten werden extrahiert...');

      const response = await apiPostForm('/apps/projektmanagement/projektauftraege/import', formData);

      setProgress(80);
      setProgressText('Projektauftrag wird erstellt...');

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Import fehlgeschlagen');
      }

      const data = await response.json();

      setProgress(100);
      setProgressText('Fertig!');

      // Brief pause to show completion, then navigate
      await new Promise((r) => setTimeout(r, 500));
      navigate(`/apps/projektmanagement/${data.projektauftrag.id}`);
    } catch (err) {
      console.error('Import failed:', err);
      setError(err.message || 'Fehler beim Import');
      setIsImporting(false);
      setProgress(0);
      setProgressText('');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button
          style={styles.backLink}
          onClick={() => navigate('/apps/projektmanagement')}
        >
          <ArrowLeftIcon size={16} /> Projektmanagement
        </button>
        <h1 style={styles.title}>Projektauftrag importieren</h1>
        <p style={styles.subtitle}>
          Laden Sie Projektdokumente hoch und erstellen Sie automatisch einen vorausgefüllten Projektauftrag
        </p>
      </div>

      <div style={styles.content}>
        {/* Error */}
        {error && <div style={styles.error}>{error}</div>}

        {/* File Upload Area / File List */}
        {files.length === 0 ? (
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
        ) : (
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
        )}

        {/* Progress */}
        {isImporting && (
          <div style={styles.progress}>
            <div style={styles.progressBar}>
              <div style={{ ...styles.progressFill, width: `${progress}%` }} />
            </div>
            <p style={styles.progressText}>{progressText}</p>
          </div>
        )}

        {/* Actions */}
        {!isImporting && files.length > 0 && (
          <div style={styles.actions}>
            <button
              style={styles.cancelButton}
              onClick={() => navigate('/apps/projektmanagement')}
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
