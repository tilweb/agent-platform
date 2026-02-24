/**
 * DocumentThumbnail
 *
 * Renders a visual preview of a document, similar to macOS Finder large icons.
 * - Images: displays the actual image
 * - PDFs: renders the first page via pdf.js (cached as data URL)
 * - Other files: falls back to a colored file-type badge
 *
 * Hover over the thumbnail to see a large preview popover.
 */

import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { theme } from '../config/theme';
import { getFileType, getFileTypeColor, getMimeTypeInfo, isImageFile } from '../utils/fileTypeUtils';

// Checkerboard pattern for transparent images (PNG, SVG, WebP, GIF)
const checkerboardBg = `linear-gradient(45deg, ${theme.colors.border}40 25%, transparent 25%), linear-gradient(-45deg, ${theme.colors.border}40 25%, transparent 25%), linear-gradient(45deg, transparent 75%, ${theme.colors.border}40 75%), linear-gradient(-45deg, transparent 75%, ${theme.colors.border}40 75%)`;

const TRANSPARENCY_EXTENSIONS = new Set(['.png', '.svg', '.webp', '.gif']);

function hasTransparency(filename) {
  if (!filename) return false;
  const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
  return ext ? TRANSPARENCY_EXTENSIONS.has(ext) : false;
}

const styles = {
  container: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    backgroundColor: theme.colors.background,
    border: `1px solid ${theme.colors.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    cursor: 'pointer',
  },
  containerCheckerboard: {
    backgroundImage: checkerboardBg,
    backgroundSize: '12px 12px',
    backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
  },
  image: {
    objectFit: 'contain',
    display: 'block',
  },
  badge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: theme.typography.weights.bold,
    letterSpacing: '0.02em',
    lineHeight: 1,
  },
  preview: {
    position: 'fixed',
    zIndex: 2000,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
    boxShadow: theme.shadows.xl,
    padding: theme.spacing.sm,
    pointerEvents: 'none',
    maxWidth: 400,
    maxHeight: 500,
  },
  previewImage: {
    display: 'block',
    maxWidth: '100%',
    maxHeight: 480,
    borderRadius: theme.borderRadius.md,
    objectFit: 'contain',
  },
  previewFilename: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
};

// Lazy-loaded pdf.js module
let pdfjsPromise = null;

function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
      ).toString();
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

// Global cache: url → data URL (persists across re-renders and remounts)
const thumbnailCache = new Map();
// Separate high-res cache for preview popover
const previewCache = new Map();

/**
 * Render a PDF page to a data URL at a given pixel size.
 */
async function renderPdfPage(url, targetSize) {
  const cacheKey = `${url}@${targetSize}`;
  if (previewCache.has(cacheKey)) return previewCache.get(cacheKey);
  if (targetSize <= 128 && thumbnailCache.has(url)) return thumbnailCache.get(url);

  const pdfjs = await loadPdfJs();
  const pdf = await pdfjs.getDocument({ url, withCredentials: true, verbosity: 0 }).promise;
  const page = await pdf.getPage(1);

  const viewport = page.getViewport({ scale: 1 });
  const scale = (targetSize * 2) / Math.max(viewport.width, viewport.height);
  const scaledViewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = scaledViewport.width;
  canvas.height = scaledViewport.height;

  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;

  const result = canvas.toDataURL('image/png');

  if (targetSize <= 128) {
    thumbnailCache.set(url, result);
  } else {
    previewCache.set(cacheKey, result);
  }

  return result;
}

/**
 * Renders the first page of a PDF as a cached image.
 */
const PdfThumbnail = memo(function PdfThumbnail({ url, size }) {
  const [dataUrl, setDataUrl] = useState(() => thumbnailCache.get(url) || null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (dataUrl || error) return;
    let cancelled = false;

    renderPdfPage(url, size).then((result) => {
      if (!cancelled) setDataUrl(result);
    }).catch(() => {
      if (!cancelled) setError(true);
    });

    return () => { cancelled = true; };
  }, [url, size, dataUrl, error]);

  if (error || !dataUrl) return null;

  return (
    <img
      src={dataUrl}
      alt=""
      style={{ ...styles.image, width: size, height: size }}
    />
  );
});

/**
 * Colored file-type badge fallback.
 */
function FileTypeBadge({ filename, mimeType, size }) {
  let fileType = null;
  if (filename) {
    fileType = getFileType(filename);
  }
  if ((!fileType || fileType === '?') && mimeType) {
    const info = getMimeTypeInfo(mimeType);
    fileType = info.type;
  }

  const label = fileType && fileType !== '?' ? fileType : '?';
  const colors = getFileTypeColor(label);
  const fontSize = size <= 32 ? theme.typography.sizes.xs : theme.typography.sizes.sm;

  return (
    <div style={{
      ...styles.badge,
      ...styles.container,
      width: size,
      height: size,
      backgroundColor: colors.bg,
      color: colors.color,
      fontSize,
    }}>
      {label}
    </div>
  );
}

/**
 * Hover preview popover — renders a large version of the document via portal.
 */
function PreviewPopover({ url, filename, mimeType, isPdf, isTransparent, anchorRect }) {
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(() => previewCache.get(`${url}@400`) || null);
  const popoverRef = useRef(null);
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (!isPdf || pdfPreviewUrl) return;
    let cancelled = false;

    renderPdfPage(url, 400).then((result) => {
      if (!cancelled) setPdfPreviewUrl(result);
    }).catch(() => {});

    return () => { cancelled = true; };
  }, [url, isPdf, pdfPreviewUrl]);

  // Reposition whenever the popover content changes size
  useEffect(() => {
    const el = popoverRef.current;
    if (!el || !anchorRect) return;

    const reposition = () => {
      const rect = el.getBoundingClientRect();
      const gap = 12;
      const left = anchorRect.left - rect.width - gap > 0
        ? anchorRect.left - rect.width - gap
        : anchorRect.right + gap;
      const top = Math.max(16, Math.min(
        anchorRect.top + (anchorRect.height / 2) - (rect.height / 2),
        window.innerHeight - rect.height - 16,
      ));
      setPos({ left, top });
    };

    // Observe size changes (e.g. when the image loads)
    const observer = new ResizeObserver(reposition);
    observer.observe(el);
    reposition();

    return () => observer.disconnect();
  }, [anchorRect, pdfPreviewUrl]);

  const previewSrc = isPdf ? pdfPreviewUrl : url;
  if (!previewSrc) return null;

  return createPortal(
    <div
      ref={popoverRef}
      style={{
        ...styles.preview,
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        opacity: pos ? 1 : 0,
      }}
    >
      <img src={previewSrc} alt="" style={{
        ...styles.previewImage,
        ...(isTransparent ? {
          backgroundImage: checkerboardBg,
          backgroundSize: '16px 16px',
          backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
        } : {}),
      }} />
      {filename && <div style={styles.previewFilename}>{filename}</div>}
    </div>,
    document.body,
  );
}

/**
 * @param {{ url: string, filename?: string, mimeType?: string, size?: number }} props
 */
export default memo(function DocumentThumbnail({ url, filename, mimeType, size = 48 }) {
  const [imgError, setImgError] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const [hovered, setHovered] = useState(false);
  const ref = useRef(null);

  const isImage = isImageFile(filename, mimeType);
  const isPdf = mimeType === 'application/pdf' || filename?.toLowerCase().endsWith('.pdf');
  const hasPreview = (isImage || isPdf) && url && !imgError && !pdfError;

  const handleMouseEnter = useCallback(() => setHovered(true), []);
  const handleMouseLeave = useCallback(() => setHovered(false), []);

  const anchorRect = hovered && ref.current ? ref.current.getBoundingClientRect() : null;

  const isTransparent = hasTransparency(filename);

  // Image: show directly
  if (isImage && url && !imgError) {
    return (
      <>
        <div
          ref={ref}
          style={{ ...styles.container, ...(isTransparent ? styles.containerCheckerboard : {}), width: size, height: size }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <img
            src={url}
            alt=""
            style={{ ...styles.image, width: size, height: size }}
            onError={() => setImgError(true)}
          />
        </div>
        {hovered && anchorRect && (
          <PreviewPopover url={url} filename={filename} mimeType={mimeType} isPdf={false} isTransparent={isTransparent} anchorRect={anchorRect} />
        )}
      </>
    );
  }

  // PDF: render first page (cached as data URL)
  if (isPdf && url && !pdfError) {
    return (
      <>
        <div
          ref={ref}
          style={{ ...styles.container, width: size, height: size }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <PdfThumbnail url={url} size={size} />
        </div>
        {hovered && anchorRect && (
          <PreviewPopover url={url} filename={filename} mimeType={mimeType} isPdf={true} anchorRect={anchorRect} />
        )}
      </>
    );
  }

  // Fallback: colored file-type badge (no hover preview)
  return <FileTypeBadge filename={filename} mimeType={mimeType} size={size} />;
});
