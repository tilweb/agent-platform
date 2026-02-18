/**
 * File Validation Utilities
 *
 * Client-side validation for file uploads before sending to server.
 * This provides early feedback to users and reduces unnecessary network traffic.
 * Server-side validation is still performed as the authoritative check.
 */

// Maximum file sizes (in bytes)
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB for documents/images
export const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25 MB for audio

// Allowed MIME types
export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
  'text/html',
];

export const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

export const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'audio/webm',
  'audio/ogg',
  'audio/flac',
  'video/webm',  // MediaRecorder sometimes reports video/webm for audio-only
  'video/ogg',   // Some browsers report video/ogg for audio
];

export const ALL_ALLOWED_TYPES = [
  ...ALLOWED_DOCUMENT_TYPES,
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_AUDIO_TYPES,
];

/**
 * Format file size for display
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Validate a single file
 *
 * @param {File} file - The file to validate
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateFile(file) {
  if (!file) {
    return { valid: false, error: 'Keine Datei angegeben' };
  }

  // Normalize MIME type by removing codec parameters (e.g., "audio/webm;codecs=opus" -> "audio/webm")
  const baseMimeType = (file.type || '').split(';')[0].trim();

  // Check file type
  const isAudio = ALLOWED_AUDIO_TYPES.includes(baseMimeType);
  const isDocument = ALLOWED_DOCUMENT_TYPES.includes(baseMimeType);
  const isImage = ALLOWED_IMAGE_TYPES.includes(baseMimeType);

  if (!isAudio && !isDocument && !isImage) {
    return {
      valid: false,
      error: `Dateityp "${baseMimeType || 'unbekannt'}" wird nicht unterstützt`,
    };
  }

  // Check file size based on type
  const maxSize = isAudio ? MAX_AUDIO_SIZE : MAX_FILE_SIZE;
  const maxSizeMB = isAudio ? 25 : 50;

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `Datei "${file.name}" ist zu groß (${formatFileSize(file.size)}). Maximum: ${maxSizeMB} MB`,
    };
  }

  // Check for empty files
  if (file.size === 0) {
    return {
      valid: false,
      error: `Datei "${file.name}" ist leer`,
    };
  }

  return { valid: true };
}

/**
 * Validate multiple files
 *
 * @param {File[]} files - Array of files to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateFiles(files) {
  if (!files || files.length === 0) {
    return { valid: true, errors: [] };
  }

  const errors = [];

  for (const file of files) {
    const result = validateFile(file);
    if (!result.valid) {
      errors.push(result.error);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get human-readable list of allowed file types
 */
export function getAllowedTypesDescription() {
  return {
    documents: 'PDF, Word, Excel, PowerPoint, Text, Markdown, HTML',
    images: 'PNG, JPEG, GIF, WebP, SVG',
    audio: 'MP3, WAV, M4A, WebM, OGG, FLAC',
  };
}
