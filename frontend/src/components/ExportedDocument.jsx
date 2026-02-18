/**
 * ExportedDocument Component
 * Displays an exported document with download button
 */

import { useState } from 'react';
import { theme } from '../config/theme';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
    maxWidth: '400px',
  },
  iconContainer: {
    width: '48px',
    height: '48px',
    borderRadius: theme.borderRadius.lg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  subtitle: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  downloadButton: {
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    transition: `all ${theme.transitions.fast}`,
    flexShrink: 0,
  },
  downloadButtonHover: {
    backgroundColor: theme.colors.primaryHover,
  },
  errorContainer: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.errorLight,
    borderRadius: theme.borderRadius.lg,
    color: theme.colors.error,
    fontSize: theme.typography.sizes.sm,
  },
};

// Format configurations
const FORMAT_CONFIG = {
  xlsx: {
    label: 'Excel',
    color: '#107C41',
    bgColor: '#E7F5EF',
  },
  pdf: {
    label: 'PDF',
    color: '#E34234',
    bgColor: '#FEEAEA',
  },
  docx: {
    label: 'Word',
    color: '#2B579A',
    bgColor: '#E8F1FC',
  },
};

// Download icon
function DownloadIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export function ExportedDocument({
  title,
  filename,
  format,
  downloadUrl,
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const config = FORMAT_CONFIG[format] || FORMAT_CONFIG.pdf;

  const handleDownload = async () => {
    setIsDownloading(true);
    setHasError(false);

    try {
      // Build full URL
      const fullUrl = downloadUrl.startsWith('http')
        ? downloadUrl
        : `${API_URL}${downloadUrl.replace('/api', '')}`;

      const response = await fetch(fullUrl, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `document.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
      setHasError(true);
    } finally {
      setIsDownloading(false);
    }
  };

  if (hasError) {
    return (
      <div style={styles.errorContainer}>
        Download fehlgeschlagen. Der Link ist moeglicherweise abgelaufen.
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div
        style={{
          ...styles.iconContainer,
          backgroundColor: config.bgColor,
          color: config.color,
        }}
      >
        {format.toUpperCase().slice(0, 3)}
      </div>
      <div style={styles.content}>
        <div style={styles.title} title={title}>
          {title}
        </div>
        <div style={styles.subtitle}>
          {config.label} Dokument
        </div>
      </div>
      <button
        style={{
          ...styles.downloadButton,
          ...(isHovered ? styles.downloadButtonHover : {}),
        }}
        onClick={handleDownload}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        disabled={isDownloading}
      >
        <DownloadIcon size={14} />
        {isDownloading ? 'Laden...' : 'Download'}
      </button>
    </div>
  );
}

export default ExportedDocument;
