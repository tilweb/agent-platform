/**
 * GeneratedImage Component
 * Displays a generated image with hover overlay showing prompt and actions
 */

import { useState, useEffect } from 'react';
import { theme } from '../config/theme';
import { DownloadIcon, PlusIcon } from './Icons';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const styles = {
  container: {
    position: 'relative',
    display: 'inline-block',
    maxWidth: '100%',
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    cursor: 'pointer',
  },
  image: {
    display: 'block',
    maxWidth: '100%',
    maxHeight: '400px',
    objectFit: 'contain',
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surfaceHover,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: theme.spacing.lg,
    opacity: 0,
    transition: `opacity ${theme.transitions.fast}`,
    borderRadius: theme.borderRadius.lg,
  },
  overlayVisible: {
    opacity: 1,
  },
  prompt: {
    color: '#fff',
    fontSize: theme.typography.sizes.sm,
    lineHeight: 1.5,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 4,
    WebkitBoxOrient: 'vertical',
  },
  promptLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: theme.typography.sizes.xs,
    marginBottom: theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  buttonRow: {
    display: 'flex',
    gap: theme.spacing.sm,
    justifyContent: 'flex-end',
  },
  button: {
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
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
  },
  buttonHover: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  buttonPrimary: {
    backgroundColor: theme.colors.primary,
  },
  buttonPrimaryHover: {
    backgroundColor: theme.colors.primaryHover,
  },
  modelInfo: {
    position: 'absolute',
    bottom: theme.spacing.sm,
    left: theme.spacing.sm,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.sm,
  },
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '200px',
    backgroundColor: theme.colors.surfaceHover,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
  },
  loadingSpinner: {
    width: '40px',
    height: '40px',
    border: `3px solid ${theme.colors.border}`,
    borderTopColor: theme.colors.primary,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  errorContainer: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.errorLight,
    borderRadius: theme.borderRadius.lg,
    color: theme.colors.error,
    fontSize: theme.typography.sizes.sm,
  },
};

// Zoom icon SVG
function ZoomIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

export function GeneratedImage({
  imageId,
  url,
  prompt: initialPrompt,
  provider: initialProvider,
  model: initialModel,
  onAddToMaterials,
  onOpenLightbox,
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [hoveredButton, setHoveredButton] = useState(null);
  const [metadata, setMetadata] = useState({
    prompt: initialPrompt,
    provider: initialProvider,
    model: initialModel,
  });

  // Construct full URL
  const imageUrl = url.startsWith('http') ? url : `${API_URL}${url.replace('/api', '')}`;

  // Fetch metadata if not provided
  useEffect(() => {
    if (imageId && (!initialPrompt || !initialModel)) {
      fetch(`${API_URL}/images/generated/${imageId}/metadata`)
        .then(res => res.json())
        .then(data => {
          if (data && !data.error) {
            setMetadata({
              prompt: data.prompt || initialPrompt,
              provider: data.provider || initialProvider,
              model: data.model || initialModel,
            });
          }
        })
        .catch(() => {
          // Keep initial values on error
        });
    }
  }, [imageId, initialPrompt, initialProvider, initialModel]);

  const prompt = metadata.prompt;
  const provider = metadata.provider;
  const model = metadata.model;

  const handleDownload = async (e) => {
    e.stopPropagation();
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

  const handleAddToMaterials = (e) => {
    e.stopPropagation();
    if (onAddToMaterials) {
      onAddToMaterials({
        type: 'generated_image',
        imageId,
        url,
        prompt,
        provider,
        model,
      });
    }
  };

  const handleClick = () => {
    if (onOpenLightbox) {
      onOpenLightbox({
        imageUrl,
        prompt,
        provider,
        model,
        imageId,
      });
    }
  };

  if (hasError) {
    return (
      <div style={styles.errorContainer}>
        Bild konnte nicht geladen werden.
      </div>
    );
  }

  return (
    <div
      style={styles.container}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
      {isLoading && (
        <div style={styles.loadingContainer}>
          <div style={styles.loadingSpinner} />
        </div>
      )}
      <img
        src={imageUrl}
        alt={prompt || 'Generated image'}
        style={{
          ...styles.image,
          display: isLoading ? 'none' : 'block',
        }}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
      />
      <div
        style={{
          ...styles.overlay,
          ...(isHovered ? styles.overlayVisible : {}),
        }}
      >
        <div>
          <div style={styles.promptLabel}>Prompt</div>
          <div style={styles.prompt}>{prompt}</div>
        </div>
        <div style={styles.buttonRow}>
          {onAddToMaterials && (
            <button
              style={{
                ...styles.button,
                ...(hoveredButton === 'material' ? styles.buttonHover : {}),
              }}
              onClick={handleAddToMaterials}
              onMouseEnter={() => setHoveredButton('material')}
              onMouseLeave={() => setHoveredButton(null)}
              title="Zu Materialien hinzufuegen"
            >
              <PlusIcon size={14} /> Material
            </button>
          )}
          <button
            style={{
              ...styles.button,
              ...(hoveredButton === 'download' ? styles.buttonHover : {}),
            }}
            onClick={handleDownload}
            onMouseEnter={() => setHoveredButton('download')}
            onMouseLeave={() => setHoveredButton(null)}
            title="Herunterladen"
          >
            <DownloadIcon size={14} /> Download
          </button>
          <button
            style={{
              ...styles.button,
              ...styles.buttonPrimary,
              ...(hoveredButton === 'zoom' ? styles.buttonPrimaryHover : {}),
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
            onMouseEnter={() => setHoveredButton('zoom')}
            onMouseLeave={() => setHoveredButton(null)}
            title="Vergroessern"
          >
            <ZoomIcon size={14} />
          </button>
        </div>
      </div>
      {!isHovered && model && (
        <div style={styles.modelInfo}>
          {model}
        </div>
      )}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default GeneratedImage;
