/**
 * ImageLightbox Component
 * Full-screen modal for viewing generated images with download option
 */

import { useEffect, useCallback } from 'react';
import { theme } from '../config/theme';
import { DownloadIcon } from './Icons';

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: theme.spacing.xl,
  },
  container: {
    position: 'relative',
    maxWidth: '90vw',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  imageContainer: {
    position: 'relative',
    maxWidth: '100%',
    maxHeight: 'calc(90vh - 100px)',
    overflow: 'hidden',
    borderRadius: theme.borderRadius.lg,
  },
  image: {
    maxWidth: '100%',
    maxHeight: 'calc(90vh - 100px)',
    objectFit: 'contain',
    borderRadius: theme.borderRadius.lg,
  },
  closeButton: {
    position: 'fixed',
    top: theme.spacing.lg,
    right: theme.spacing.lg,
    width: '40px',
    height: '40px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    border: 'none',
    borderRadius: theme.borderRadius.full,
    color: '#fff',
    fontSize: '24px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: `background-color ${theme.transitions.fast}`,
    zIndex: 10001,
  },
  closeButtonHover: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  infoBar: {
    marginTop: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: theme.borderRadius.lg,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.lg,
    maxWidth: '100%',
  },
  prompt: {
    color: '#fff',
    fontSize: theme.typography.sizes.sm,
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  modelInfo: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: theme.typography.sizes.xs,
    flexShrink: 0,
  },
  downloadButton: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
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
    transition: `background-color ${theme.transitions.fast}`,
    flexShrink: 0,
  },
  downloadButtonHover: {
    backgroundColor: theme.colors.primaryHover,
  },
};

export function ImageLightbox({
  imageUrl,
  prompt,
  provider,
  model,
  imageId,
  onClose,
}) {
  // Handle escape key to close
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    // Prevent body scroll when lightbox is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${imageId || 'generated-image'}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  return (
    <div style={styles.overlay} onClick={handleOverlayClick}>
      <button
        style={styles.closeButton}
        onClick={onClose}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        }}
        title="Schliessen (Esc)"
      >
        &times;
      </button>
      <div style={styles.container}>
        <div style={styles.imageContainer}>
          <img
            src={imageUrl}
            alt={prompt || 'Generated image'}
            style={styles.image}
          />
        </div>
        <div style={styles.infoBar}>
          <div style={styles.prompt} title={prompt}>
            {prompt || 'Generiertes Bild'}
          </div>
          {model && (
            <div style={styles.modelInfo}>
              {model}
              {provider && ` (${provider})`}
            </div>
          )}
          <button
            style={styles.downloadButton}
            onClick={handleDownload}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.primaryHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.primary;
            }}
          >
            <DownloadIcon size={16} /> Download
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImageLightbox;
