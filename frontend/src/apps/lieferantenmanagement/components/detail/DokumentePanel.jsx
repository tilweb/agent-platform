import { useState, useEffect, useRef } from 'react';
import { theme } from '../../../../config/theme';
import { useSuppliers } from '../../../../hooks/useSuppliers';

const DOKUMENT_TYPEN = [
  { id: 'zertifizierung_nachweis', label: 'Zertifizierungsnachweis' },
  { id: 'avv_dokument', label: 'AVV-Dokument' },
  { id: 'nda_dokument', label: 'NDA-Dokument' },
  { id: 'rahmenvertrag_dokument', label: 'Rahmenvertrag' },
  { id: 'bonitaetsnachweis', label: 'Bonitaetsnachweis' },
  { id: 'audit_bericht', label: 'Audit-Bericht' },
  { id: 'sonstiges', label: 'Sonstiges' },
];

const DATEITYP_ICONS = {
  'application/pdf': { color: theme.colors.error, label: 'PDF' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { color: theme.colors.primary, label: 'DOCX' },
  'application/msword': { color: theme.colors.primary, label: 'DOC' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { color: theme.colors.success, label: 'XLSX' },
  'image/png': { color: theme.colors.info, label: 'PNG' },
  'image/jpeg': { color: theme.colors.info, label: 'JPG' },
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  toolbar: {
    display: 'flex',
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  filterSelect: {
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    cursor: 'pointer',
  },
  uploadBtn: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
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
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  td: {
    padding: `${theme.spacing.md}`,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    borderBottom: `1px solid ${theme.colors.border}`,
    verticalAlign: 'middle',
  },
  fileInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  fileTypeBadge: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
    padding: `2px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.sm,
    color: '#fff',
    minWidth: 40,
    textAlign: 'center',
  },
  fileName: {
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  fileSize: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  typBadge: {
    fontSize: theme.typography.sizes.xs,
    padding: `2px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  actionBtn: {
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: theme.colors.textMuted,
    borderRadius: theme.borderRadius.sm,
    display: 'inline-flex',
    alignItems: 'center',
  },
  deleteBtn: {
    color: theme.colors.error,
  },
  empty: {
    textAlign: 'center',
    padding: theme.spacing['2xl'],
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
  // Upload modal
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    maxWidth: '500px',
    width: '90%',
    padding: theme.spacing.xl,
  },
  modalTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  formGroup: {
    marginBottom: theme.spacing.lg,
  },
  formLabel: {
    display: 'block',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  input: {
    width: '100%',
    padding: theme.spacing.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: theme.spacing.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    cursor: 'pointer',
    boxSizing: 'border-box',
  },
  dropArea: {
    border: `2px dashed ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    textAlign: 'center',
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    backgroundColor: theme.colors.background,
  },
  dropAreaActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  dropText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
  },
  selectedFile: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceHover,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
  },
  modalActions: {
    display: 'flex',
    gap: theme.spacing.md,
    justifyContent: 'flex-end',
    marginTop: theme.spacing.lg,
  },
  btnPrimary: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  btnSecondary: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
};

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getTypLabel(typ) {
  return DOKUMENT_TYPEN.find((t) => t.id === typ)?.label || typ;
}

export default function DokumentePanel({ supplier }) {
  const { uploadDokument, getDokumente, deleteDokument, downloadDokument } = useSuppliers();
  const [dokumente, setDokumente] = useState([]);
  const [filterTyp, setFilterTyp] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  const loadDokumente = async () => {
    try {
      setIsLoading(true);
      const docs = await getDokumente(supplier.id, filterTyp || undefined);
      setDokumente(docs);
    } catch (err) {
      console.error('Error loading documents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDokumente();
  }, [supplier.id, filterTyp]);

  const handleDelete = async (docId, dateiname) => {
    if (!confirm(`Dokument "${dateiname}" wirklich loeschen?`)) return;
    try {
      await deleteDokument(supplier.id, docId);
      loadDokumente();
    } catch (err) {
      console.error('Error deleting document:', err);
    }
  };

  const handleUploadDone = () => {
    setShowUpload(false);
    loadDokumente();
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>Dokumente</div>
        <div style={styles.toolbar}>
          <select
            style={styles.filterSelect}
            value={filterTyp}
            onChange={(e) => setFilterTyp(e.target.value)}
          >
            <option value="">Alle Typen</option>
            {DOKUMENT_TYPEN.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          <button style={styles.uploadBtn} onClick={() => setShowUpload(true)}>
            <UploadIcon /> Hochladen
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={styles.empty}>Laden...</div>
      ) : dokumente.length === 0 ? (
        <div style={styles.empty}>
          {filterTyp ? 'Keine Dokumente dieses Typs vorhanden.' : 'Noch keine Dokumente hochgeladen.'}
        </div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Datei</th>
              <th style={styles.th}>Typ</th>
              <th style={styles.th}>Hochgeladen</th>
              <th style={styles.th}>Notizen</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {dokumente.map((doc) => {
              const fileType = DATEITYP_ICONS[doc.dateityp] || { color: theme.colors.textMuted, label: '?' };
              return (
                <tr key={doc.id}>
                  <td style={styles.td}>
                    <div style={styles.fileInfo}>
                      <span style={{ ...styles.fileTypeBadge, backgroundColor: fileType.color }}>
                        {fileType.label}
                      </span>
                      <div>
                        <div style={styles.fileName}>{doc.dateiname}</div>
                        <div style={styles.fileSize}>{formatFileSize(doc.dateigroesse)}</div>
                      </div>
                    </div>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.typBadge}>{getTypLabel(doc.typ)}</span>
                  </td>
                  <td style={styles.td}>
                    {formatDate(doc.hochgeladen_am)}
                  </td>
                  <td style={styles.td}>
                    <span style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.xs }}>
                      {doc.notizen || '-'}
                    </span>
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    <button
                      style={styles.actionBtn}
                      title="Herunterladen"
                      onClick={() => downloadDokument(supplier.id, doc.id)}
                    >
                      <DownloadIcon />
                    </button>
                    <button
                      style={{ ...styles.actionBtn, ...styles.deleteBtn }}
                      title="Loeschen"
                      onClick={() => handleDelete(doc.id, doc.dateiname)}
                    >
                      <TrashIcon />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {showUpload && (
        <UploadModal
          supplierId={supplier.id}
          onUpload={uploadDokument}
          onClose={() => setShowUpload(false)}
          onDone={handleUploadDone}
        />
      )}
    </div>
  );
}

// ============== Upload Modal ==============

function UploadModal({ supplierId, onUpload, onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [typ, setTyp] = useState('sonstiges');
  const [notizen, setNotizen] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleSubmit = async () => {
    if (!file) return;
    try {
      setIsUploading(true);
      setError(null);
      await onUpload(supplierId, file, typ, { notizen: notizen || undefined });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalTitle}>Dokument hochladen</div>

        <div style={styles.formGroup}>
          <label style={styles.formLabel}>Datei</label>
          {file ? (
            <div style={styles.selectedFile}>
              <DocumentIcon />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: theme.typography.weights.medium }}>{file.name}</div>
                <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
                  {formatFileSize(file.size)}
                </div>
              </div>
              <button
                style={{ ...styles.actionBtn, ...styles.deleteBtn }}
                onClick={() => setFile(null)}
              >
                <TrashIcon />
              </button>
            </div>
          ) : (
            <div
              style={{ ...styles.dropArea, ...(isDragging ? styles.dropAreaActive : {}) }}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={() => setIsDragging(false)}
            >
              <UploadIcon />
              <div style={styles.dropText}>
                Datei hierher ziehen oder klicken
              </div>
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginTop: theme.spacing.xs }}>
                PDF, DOCX, DOC, XLSX, PNG, JPG (max 50 MB)
              </div>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc,.xlsx,.png,.jpg,.jpeg"
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files[0]) setFile(e.target.files[0]);
            }}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.formLabel}>Dokumenttyp</label>
          <select
            style={styles.select}
            value={typ}
            onChange={(e) => setTyp(e.target.value)}
          >
            {DOKUMENT_TYPEN.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.formLabel}>Notizen (optional)</label>
          <input
            style={styles.input}
            value={notizen}
            onChange={(e) => setNotizen(e.target.value)}
            placeholder="z.B. Zertifikat gueltig bis 2027"
          />
        </div>

        {error && (
          <div style={{
            padding: theme.spacing.sm,
            backgroundColor: theme.colors.errorLight,
            color: theme.colors.error,
            borderRadius: theme.borderRadius.md,
            fontSize: theme.typography.sizes.sm,
            marginBottom: theme.spacing.md,
          }}>
            {error}
          </div>
        )}

        <div style={styles.modalActions}>
          <button style={styles.btnSecondary} onClick={onClose}>Abbrechen</button>
          <button
            style={{ ...styles.btnPrimary, opacity: (!file || isUploading) ? 0.5 : 1 }}
            onClick={handleSubmit}
            disabled={!file || isUploading}
          >
            {isUploading ? 'Hochladen...' : 'Hochladen'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============== Icons ==============

function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
