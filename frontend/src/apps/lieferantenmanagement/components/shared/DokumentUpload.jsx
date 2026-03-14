import { useState, useRef } from 'react';
import { theme } from '../../../../config/theme';

const styles = {
  container: {
    display: 'flex',
    gap: theme.spacing.sm,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  btn: {
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    backgroundColor: 'transparent',
    color: theme.colors.primary,
    border: `1px solid ${theme.colors.primary}30`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  linkBtn: {
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    backgroundColor: 'transparent',
    color: theme.colors.textSecondary,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  uploading: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  success: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.success,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
};

/**
 * Inline document upload button for RegulatorikForm
 * @param {Object} props
 * @param {string} props.supplierId
 * @param {string} props.dokumentTyp - e.g. 'avv_dokument', 'nda_dokument', 'rahmenvertrag_dokument'
 * @param {function} props.onUpload - async (supplierId, file, typ, options) => DokumentMeta
 * @param {function} [props.onLinkContract] - () => void - opens contract picker
 */
export default function DokumentUpload({ supplierId, dokumentTyp, onUpload, onLinkContract }) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setError(null);
      await onUpload(supplierId, file, dokumentTyp, {});
      setUploaded(true);
      setTimeout(() => setUploaded(false), 3000);
    } catch (err) {
      console.error('Upload failed:', err);
      setError('Upload fehlgeschlagen');
      setTimeout(() => setError(null), 4000);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (isUploading) {
    return <div style={styles.uploading}>Hochladen...</div>;
  }

  if (error) {
    return (
      <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.error }}>
        {error}
      </div>
    );
  }

  if (uploaded) {
    return (
      <div style={styles.success}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={theme.colors.success} strokeWidth="3">
          <path d="M20 6L9 17l-5-5" />
        </svg>
        Hochgeladen
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <button style={styles.btn} onClick={() => fileInputRef.current?.click()}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        Dokument
      </button>
      {onLinkContract && (
        <button style={styles.linkBtn} onClick={onLinkContract}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          Vertrag
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.doc,.xlsx,.png,.jpg,.jpeg"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
}
