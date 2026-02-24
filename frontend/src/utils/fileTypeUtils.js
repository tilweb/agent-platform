/**
 * File type detection and color utilities
 *
 * Shared helpers for determining file types from filenames/mimeTypes
 * and their visual representation (colors, labels).
 */

/**
 * Extract file type label from a source filename.
 * @param {string} source — filename like 'document.pdf'
 * @returns {string} — uppercase type like 'PDF', or '?' if unknown
 */
export function getFileType(source) {
  if (!source) return '?';
  const ext = source.split('.').pop()?.toLowerCase();
  const map = {
    pdf: 'PDF', docx: 'DOCX', doc: 'DOC', xlsx: 'XLSX', xls: 'XLS',
    pptx: 'PPTX', ppt: 'PPT', txt: 'TXT', md: 'MD', html: 'HTML',
    htm: 'HTML', csv: 'CSV', json: 'JSON',
    png: 'PNG', jpg: 'JPG', jpeg: 'JPG', webp: 'WEBP', gif: 'GIF',
    svg: 'SVG',
  };
  return map[ext] || ext?.toUpperCase() || '?';
}

/**
 * Get color scheme for a file type.
 * @param {string} type — uppercase type like 'PDF'
 * @returns {{ bg: string, color: string, border: string }}
 */
export function getFileTypeColor(type) {
  const colors = {
    PDF: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
    DOCX: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
    DOC: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
    XLSX: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
    XLS: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
    PPTX: { bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' },
    PPT: { bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' },
    TXT: { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' },
    MD: { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' },
    HTML: { bg: '#fdf4ff', color: '#a855f7', border: '#e9d5ff' },
    CSV: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
    JSON: { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' },
    PNG: { bg: '#fdf4ff', color: '#a855f7', border: '#e9d5ff' },
    JPG: { bg: '#fdf4ff', color: '#a855f7', border: '#e9d5ff' },
    WEBP: { bg: '#fdf4ff', color: '#a855f7', border: '#e9d5ff' },
    GIF: { bg: '#fdf4ff', color: '#a855f7', border: '#e9d5ff' },
    SVG: { bg: '#fdf4ff', color: '#a855f7', border: '#e9d5ff' },
  };
  return colors[type] || { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' };
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'tiff']);

/**
 * Check if a file is an image based on source filename or mimeType.
 * @param {string} [source] — filename
 * @param {string} [mimeType] — MIME type
 * @returns {boolean}
 */
export function isImageFile(source, mimeType) {
  if (mimeType && mimeType.startsWith('image/')) return true;
  if (source) {
    const ext = source.split('.').pop()?.toLowerCase();
    if (ext && IMAGE_EXTENSIONS.has(ext)) return true;
  }
  return false;
}

/**
 * Derive file type info from a MIME type string.
 * @param {string} mimeType
 * @returns {{ type: string, label: string }}
 */
export function getMimeTypeInfo(mimeType) {
  if (!mimeType) return { type: '?', label: 'Unbekannt' };

  const map = {
    'application/pdf': { type: 'PDF', label: 'PDF-Dokument' },
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { type: 'DOCX', label: 'Word-Dokument' },
    'application/msword': { type: 'DOC', label: 'Word-Dokument' },
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { type: 'XLSX', label: 'Excel-Tabelle' },
    'application/vnd.ms-excel': { type: 'XLS', label: 'Excel-Tabelle' },
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': { type: 'PPTX', label: 'PowerPoint' },
    'application/vnd.ms-powerpoint': { type: 'PPT', label: 'PowerPoint' },
    'text/plain': { type: 'TXT', label: 'Textdatei' },
    'text/markdown': { type: 'MD', label: 'Markdown' },
    'text/html': { type: 'HTML', label: 'HTML' },
    'text/csv': { type: 'CSV', label: 'CSV-Tabelle' },
    'application/json': { type: 'JSON', label: 'JSON' },
    'application/vnd.google-apps.document': { type: 'GDOC', label: 'Google Dokument' },
    'application/vnd.google-apps.spreadsheet': { type: 'GSHEET', label: 'Google Tabelle' },
    'application/vnd.google-apps.presentation': { type: 'GSLIDE', label: 'Google Präsentation' },
    'image/png': { type: 'PNG', label: 'Bild' },
    'image/jpeg': { type: 'JPG', label: 'Bild' },
    'image/webp': { type: 'WEBP', label: 'Bild' },
    'image/gif': { type: 'GIF', label: 'Bild' },
    'image/svg+xml': { type: 'SVG', label: 'Vektorgrafik' },
  };

  if (map[mimeType]) return map[mimeType];

  // Fallback: derive from mime prefix
  if (mimeType.startsWith('image/')) return { type: 'IMG', label: 'Bild' };
  if (mimeType.startsWith('text/')) return { type: 'TXT', label: 'Textdatei' };
  if (mimeType.includes('document')) return { type: 'DOC', label: 'Dokument' };
  if (mimeType.includes('spreadsheet')) return { type: 'XLS', label: 'Tabelle' };
  if (mimeType.includes('presentation')) return { type: 'PPT', label: 'Präsentation' };

  return { type: '?', label: mimeType.split('/').pop() || 'Unbekannt' };
}
