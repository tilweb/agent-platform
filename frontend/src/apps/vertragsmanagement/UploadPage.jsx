/**
 * UploadPage
 * Contract upload and analysis page
 */

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../config/theme';
import { useContracts } from '../../hooks/useContracts';
import { ArrowLeftIcon } from '../../components/Icons';
import Select from '../../components/Select';

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
  // File preview
  filePreview: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.lg,
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    marginBottom: theme.spacing.xl,
  },
  fileIcon: {
    width: '48px',
    height: '48px',
    borderRadius: theme.borderRadius.lg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.colors.text,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  fileSize: {
    fontSize: theme.typography.sizes.sm,
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
  },
  // Options
  optionsSection: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  selectWrapper: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    display: 'block',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  hint: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.sm,
  },
  // Actions
  actions: {
    display: 'flex',
    gap: theme.spacing.md,
  },
  analyzeButton: {
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
    marginTop: theme.spacing.xl,
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
    marginTop: theme.spacing.lg,
  },
};

function UploadPage() {
  const navigate = useNavigate();
  const { schemas, uploadContract } = useContracts();
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [contractType, setContractType] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  // Supported file types
  const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.txt', '.md'];
  const ACCEPTED_MIME_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
  ];

  const isValidFileType = (file) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    return ACCEPTED_EXTENSIONS.includes(ext) || ACCEPTED_MIME_TYPES.includes(file.type);
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

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && isValidFileType(droppedFile)) {
      setFile(droppedFile);
      setError(null);
    } else {
      setError('Bitte laden Sie eine PDF, Word, Text oder Markdown-Datei hoch.');
    }
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (isValidFileType(selectedFile)) {
        setFile(selectedFile);
        setError(null);
      } else {
        setError('Bitte laden Sie eine PDF, Word, Text oder Markdown-Datei hoch.');
      }
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleSubmit = async () => {
    if (!file) {
      setError('Bitte laden Sie eine Datei hoch.');
      return;
    }

    setIsAnalyzing(true);
    setProgress(10);
    setError(null);

    try {
      // Simulate progress
      setProgress(30);
      await new Promise((r) => setTimeout(r, 500));
      setProgress(50);

      const contract = await uploadContract(file, contractType || undefined);

      setProgress(100);
      await new Promise((r) => setTimeout(r, 300));

      // Navigate to contract detail
      navigate(`/apps/vertragsmanagement/${contract.id}`);
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err.message || 'Fehler beim Hochladen des Vertrags');
      setIsAnalyzing(false);
      setProgress(0);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button
          style={styles.backLink}
          onClick={() => navigate('/apps/vertragsmanagement')}
        >
          <ArrowLeftIcon size={16} /> Vertragsmanagement
        </button>
        <h1 style={styles.title}>Vertrag hochladen</h1>
        <p style={styles.subtitle}>
          Laden Sie einen Vertrag hoch und lassen Sie ihn automatisch analysieren
        </p>
      </div>

      <div style={styles.content}>
        {/* File Upload */}
        {!file ? (
          <div
            style={{
              ...styles.uploadArea,
              ...(isDragging ? styles.uploadAreaActive : {}),
              ...(isAnalyzing ? styles.uploadAreaDisabled : {}),
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isAnalyzing && fileInputRef.current?.click()}
          >
            <div style={styles.uploadIcon}>
              <UploadIcon size={48} />
            </div>
            <div style={styles.uploadTitle}>Vertragsdatei hier ablegen</div>
            <p style={styles.uploadText}>PDF, Word, Text oder Markdown</p>
            <button
              style={styles.uploadButton}
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              disabled={isAnalyzing}
            >
              Datei auswählen
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc,.txt,.md"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </div>
        ) : (
          <div style={styles.filePreview}>
            <div style={{
              ...styles.fileIcon,
              backgroundColor: getFileTypeColor(file.name),
            }}>
              <DocumentIcon size={24} />
            </div>
            <div style={styles.fileInfo}>
              <div style={styles.fileName}>{file.name}</div>
              <div style={styles.fileSize}>{formatFileSize(file.size)}</div>
            </div>
            {!isAnalyzing && (
              <button
                style={styles.removeButton}
                onClick={handleRemoveFile}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <CloseIcon size={20} />
              </button>
            )}
          </div>
        )}

        {/* Contract Type Selection */}
        <div style={styles.optionsSection}>
          <h3 style={styles.sectionTitle}>Optionen</h3>
          <div style={styles.selectWrapper}>
            <label style={styles.label}>Vertragstyp (optional)</label>
            <Select
              value={contractType}
              onChange={(e) => setContractType(e.target.value)}
              disabled={isAnalyzing}
            >
              <option value="">Automatisch erkennen</option>
              {schemas.map((schema) => (
                <option key={schema.id} value={schema.id}>
                  {schema.name}
                </option>
              ))}
            </Select>
            <p style={styles.hint}>
              Lassen Sie das Feld leer für automatische Erkennung des Vertragstyps.
            </p>
          </div>
        </div>

        {/* Progress */}
        {isAnalyzing && (
          <div style={styles.progress}>
            <div style={styles.progressBar}>
              <div
                style={{ ...styles.progressFill, width: `${progress}%` }}
              />
            </div>
            <p style={styles.progressText}>
              {progress < 30
                ? 'Vertrag wird hochgeladen...'
                : progress < 50
                ? 'Dokument wird konvertiert...'
                : progress < 80
                ? 'Vertrag wird analysiert...'
                : 'Metadaten werden extrahiert...'}
            </p>
          </div>
        )}

        {/* Error */}
        {error && <div style={styles.error}>{error}</div>}

        {/* Actions */}
        {!isAnalyzing && (
          <div style={styles.actions}>
            <button
              style={styles.cancelButton}
              onClick={() => navigate('/apps/vertragsmanagement')}
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
              style={{
                ...styles.analyzeButton,
                opacity: !file ? 0.5 : 1,
                cursor: !file ? 'not-allowed' : 'pointer',
              }}
              onClick={handleSubmit}
              disabled={!file}
              onMouseEnter={(e) => {
                if (file) {
                  e.currentTarget.style.backgroundColor = theme.colors.primaryHover;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.primary;
              }}
            >
              <SparklesIcon size={16} />
              Analysieren & Speichern
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to get file type color
function getFileTypeColor(filename) {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return theme.colors.errorLight;
    case 'docx':
    case 'doc':
      return theme.colors.primaryLight;
    case 'txt':
    case 'md':
      return theme.colors.successLight;
    default:
      return theme.colors.surfaceHover;
  }
}

// Icons
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

export default UploadPage;
