/**
 * ItemThumbnail
 *
 * Compact preview component (40×40) for search result items.
 * Shows real image thumbnails for image files, colored file-type
 * badges for everything else.
 */

import { useState } from 'react';
import { theme } from '../config/theme';
import { getContentTypeIcon } from './Icons';
import { getFileType, getFileTypeColor, getMimeTypeInfo, isImageFile } from '../utils/fileTypeUtils';

const SIZE = 40;

const styles = {
  badge: {
    width: SIZE,
    height: SIZE,
    minWidth: SIZE,
    borderRadius: theme.borderRadius.md,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: '0.02em',
    lineHeight: 1,
  },
  image: {
    width: SIZE,
    height: SIZE,
    minWidth: SIZE,
    borderRadius: theme.borderRadius.md,
    objectFit: 'cover',
  },
};

/**
 * Determine the display info for an item: label, colors, and optional image URL.
 */
function resolveItemDisplay(item) {
  const meta = item?.metadata || {};
  const sourceFile = meta.source_file || meta.sourceFile;
  const mimeType = meta.mimeType;

  // Check if this is an image with a viewable thumbnail URL
  const isImage = isImageFile(sourceFile, mimeType);
  let imageUrl = null;
  if (isImage && meta.thumbnailLink) {
    imageUrl = meta.thumbnailLink;
  }

  // Determine file type label and colors
  let fileType = null;
  if (sourceFile) {
    fileType = getFileType(sourceFile);
  } else if (mimeType) {
    const info = getMimeTypeInfo(mimeType);
    fileType = info.type;
  }

  if (fileType && fileType !== '?') {
    const colors = getFileTypeColor(fileType);
    return { label: fileType, colors, imageUrl, isImage };
  }

  // Fallback: source-type based
  const typeColors = {
    chat: { bg: theme.colors.primaryLight, color: theme.colors.primary, border: theme.colors.primaryLight },
    chats: { bg: theme.colors.primaryLight, color: theme.colors.primary, border: theme.colors.primaryLight },
    confluence: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
    gdrive: { bg: '#fefce8', color: '#ca8a04', border: '#fef08a' },
    contract: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
    material: { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' },
  };

  const typeLabels = {
    chat: 'Chat',
    chats: 'Chat',
    confluence: 'Wiki',
    gdrive: 'Drive',
    contract: 'Vertrag',
    material: 'Text',
  };

  const type = item?.type || 'material';
  return {
    label: typeLabels[type] || '?',
    colors: typeColors[type] || { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' },
    imageUrl,
    isImage,
  };
}

/**
 * @param {{ item: object, size?: number }} props
 */
export default function ItemThumbnail({ item, size }) {
  const [imgError, setImgError] = useState(false);
  const dim = size || SIZE;
  const { label, colors, imageUrl, isImage } = resolveItemDisplay(item);

  // Show real image thumbnail if URL is available
  if (imageUrl && !imgError) {
    return (
      <img
        src={imageUrl}
        alt=""
        style={{ ...styles.image, width: dim, height: dim, minWidth: dim }}
        onError={() => setImgError(true)}
      />
    );
  }

  // For image types without a URL, show icon instead of label
  if (isImage) {
    return (
      <div style={{
        ...styles.badge,
        width: dim,
        height: dim,
        minWidth: dim,
        backgroundColor: colors.bg,
        color: colors.color,
        border: `1px solid ${colors.border}`,
      }}>
        {label}
      </div>
    );
  }

  // Source-type fallback: show content type icon for chat/confluence etc.
  const usesIcon = ['chat', 'chats', 'confluence', 'gdrive', 'contract'].includes(item?.type)
    && !item?.metadata?.source_file && !item?.metadata?.mimeType;

  if (usesIcon) {
    return (
      <div style={{
        ...styles.badge,
        width: dim,
        height: dim,
        minWidth: dim,
        backgroundColor: colors.bg,
        color: colors.color,
        border: `1px solid ${colors.border}`,
      }}>
        {getContentTypeIcon(item.type, { size: 18, color: colors.color })}
      </div>
    );
  }

  // Default: file type label badge
  return (
    <div style={{
      ...styles.badge,
      width: dim,
      height: dim,
      minWidth: dim,
      backgroundColor: colors.bg,
      color: colors.color,
      border: `1px solid ${colors.border}`,
    }}>
      {label}
    </div>
  );
}
