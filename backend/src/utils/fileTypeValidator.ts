/**
 * File Type Validator
 *
 * Validates file types using magic bytes (file signatures) instead of
 * trusting client-provided MIME types which can be spoofed.
 */

/**
 * File signature (magic bytes) definitions
 */
interface FileSignature {
  mimeType: string;
  extension: string;
  signatures: Array<{
    bytes: number[];
    offset?: number;
  }>;
}

/**
 * Known file signatures
 * Reference: https://en.wikipedia.org/wiki/List_of_file_signatures
 */
const FILE_SIGNATURES: FileSignature[] = [
  // Images
  {
    mimeType: 'image/png',
    extension: 'png',
    signatures: [{ bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] }],
  },
  {
    mimeType: 'image/jpeg',
    extension: 'jpg',
    signatures: [
      { bytes: [0xFF, 0xD8, 0xFF, 0xE0] },
      { bytes: [0xFF, 0xD8, 0xFF, 0xE1] },
      { bytes: [0xFF, 0xD8, 0xFF, 0xE2] },
      { bytes: [0xFF, 0xD8, 0xFF, 0xE3] },
      { bytes: [0xFF, 0xD8, 0xFF, 0xE8] },
      { bytes: [0xFF, 0xD8, 0xFF, 0xDB] },
    ],
  },
  {
    mimeType: 'image/gif',
    extension: 'gif',
    signatures: [
      { bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] }, // GIF87a
      { bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] }, // GIF89a
    ],
  },
  // Note: WebP also uses RIFF magic bytes — disambiguation happens in detectFromMagicBytes via RIFF subtype check
  {
    mimeType: 'image/bmp',
    extension: 'bmp',
    signatures: [{ bytes: [0x42, 0x4D] }], // BM
  },

  // Documents
  {
    mimeType: 'application/pdf',
    extension: 'pdf',
    signatures: [{ bytes: [0x25, 0x50, 0x44, 0x46, 0x2D] }], // %PDF-
  },

  // Office documents (ZIP-based, need content inspection for exact type)
  {
    mimeType: 'application/zip', // Base for Office Open XML
    extension: 'zip',
    signatures: [{ bytes: [0x50, 0x4B, 0x03, 0x04] }], // PK..
  },

  // Legacy Office formats
  {
    mimeType: 'application/msword', // Also used for xls, ppt
    extension: 'doc',
    signatures: [{ bytes: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1] }], // OLE Compound
  },

  // Audio
  {
    mimeType: 'audio/mpeg',
    extension: 'mp3',
    signatures: [
      { bytes: [0xFF, 0xFB] }, // MP3 frame sync
      { bytes: [0xFF, 0xFA] },
      { bytes: [0xFF, 0xF3] },
      { bytes: [0xFF, 0xF2] },
      { bytes: [0x49, 0x44, 0x33] }, // ID3 tag
    ],
  },
  {
    mimeType: 'audio/wav',
    extension: 'wav',
    signatures: [{ bytes: [0x52, 0x49, 0x46, 0x46] }], // RIFF
  },
  {
    mimeType: 'audio/ogg',
    extension: 'ogg',
    signatures: [{ bytes: [0x4F, 0x67, 0x67, 0x53] }], // OggS
  },
  {
    mimeType: 'audio/flac',
    extension: 'flac',
    signatures: [{ bytes: [0x66, 0x4C, 0x61, 0x43] }], // fLaC
  },
  {
    mimeType: 'audio/webm',
    extension: 'webm',
    signatures: [{ bytes: [0x1A, 0x45, 0xDF, 0xA3] }], // WebM/Matroska
  },
  {
    mimeType: 'audio/mp4',
    extension: 'm4a',
    signatures: [
      // MP4/M4A files start with a box: [4 bytes size][4 bytes "ftyp"]
      // Check for "ftyp" at offset 4 regardless of box size
      { bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }, // ftyp at offset 4
      // Also check common full signatures for compatibility
      { bytes: [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70] }, // 32-byte ftyp box
      { bytes: [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70] }, // 24-byte ftyp box
      { bytes: [0x00, 0x00, 0x00, 0x1C, 0x66, 0x74, 0x79, 0x70] }, // 28-byte ftyp box
      { bytes: [0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70] }, // 20-byte ftyp box
    ],
  },
];

/**
 * Text-based file types (no magic bytes, validated by extension)
 */
const TEXT_EXTENSIONS: Record<string, string> = {
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.csv': 'text/csv',
  '.svg': 'image/svg+xml',
};

/**
 * Office Open XML content types (inside ZIP)
 */
const OFFICE_CONTENT_TYPES: Record<string, string> = {
  'word/': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'xl/': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'ppt/': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

export interface FileTypeResult {
  isValid: boolean;
  detectedMimeType?: string;
  detectedExtension?: string;
  claimedMimeType?: string;
  mismatch: boolean;
  error?: string;
}

/**
 * Check if buffer starts with signature bytes
 */
function matchesSignature(buffer: Buffer, signature: { bytes: number[]; offset?: number }): boolean {
  const offset = signature.offset || 0;

  if (buffer.length < offset + signature.bytes.length) {
    return false;
  }

  for (let i = 0; i < signature.bytes.length; i++) {
    if (buffer[offset + i] !== signature.bytes[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Detect file type from buffer using magic bytes
 */
function detectFromMagicBytes(buffer: Buffer): { mimeType: string; extension: string } | null {
  for (const fileSig of FILE_SIGNATURES) {
    for (const signature of fileSig.signatures) {
      if (matchesSignature(buffer, signature)) {
        // RIFF container: disambiguate WAV vs WEBP via subtype at bytes 8-11
        if (fileSig.mimeType === 'audio/wav' && buffer.length >= 12) {
          const riffType = buffer.toString('ascii', 8, 12);
          if (riffType === 'WEBP') {
            return { mimeType: 'image/webp', extension: 'webp' };
          }
        }

        return {
          mimeType: fileSig.mimeType,
          extension: fileSig.extension,
        };
      }
    }
  }

  return null;
}

/**
 * Check if file content looks like valid UTF-8 text
 */
function isLikelyText(buffer: Buffer): boolean {
  // Check first 1000 bytes for text characteristics
  const sampleSize = Math.min(buffer.length, 1000);
  let textChars = 0;
  let binaryChars = 0;

  for (let i = 0; i < sampleSize; i++) {
    const byte = buffer[i]!;

    // Common text characters (printable ASCII, newlines, tabs)
    if ((byte >= 0x20 && byte <= 0x7E) || byte === 0x09 || byte === 0x0A || byte === 0x0D) {
      textChars++;
    }
    // UTF-8 continuation bytes are okay
    else if (byte >= 0x80 && byte <= 0xBF) {
      textChars++;
    }
    // UTF-8 start bytes
    else if (byte >= 0xC0 && byte <= 0xF7) {
      textChars++;
    }
    // Null bytes or other control characters suggest binary
    else if (byte === 0x00 || (byte < 0x20 && byte !== 0x09 && byte !== 0x0A && byte !== 0x0D)) {
      binaryChars++;
    }
  }

  // If more than 90% are text characters, consider it text
  return textChars > 0 && (textChars / sampleSize) > 0.9 && binaryChars < 5;
}

/**
 * Validate file type using magic bytes
 *
 * @param buffer - File content as Buffer
 * @param claimedMimeType - MIME type claimed by client
 * @param filename - Original filename (for extension check)
 * @returns Validation result
 */
export function validateFileType(
  buffer: Buffer,
  claimedMimeType: string,
  filename: string
): FileTypeResult {
  const extension = filename.toLowerCase().slice(filename.lastIndexOf('.'));

  // Try to detect from magic bytes
  const detected = detectFromMagicBytes(buffer);

  if (detected) {
    // Handle ZIP-based Office documents
    if (detected.mimeType === 'application/zip') {
      // Check for Office document extensions
      if (['.docx', '.xlsx', '.pptx'].includes(extension)) {
        const expectedMime = {
          '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        }[extension];

        return {
          isValid: true,
          detectedMimeType: expectedMime,
          detectedExtension: extension.slice(1),
          claimedMimeType,
          mismatch: claimedMimeType !== expectedMime,
        };
      }
    }

    // RIFF disambiguation (WAV vs WEBP) is now handled in detectFromMagicBytes

    return {
      isValid: true,
      detectedMimeType: detected.mimeType,
      detectedExtension: detected.extension,
      claimedMimeType,
      mismatch: !claimedMimeType.includes(detected.mimeType.split('/')[1]!),
    };
  }

  // Check for text-based files
  const textMime = TEXT_EXTENSIONS[extension];
  if (textMime && isLikelyText(buffer)) {
    return {
      isValid: true,
      detectedMimeType: textMime,
      detectedExtension: extension.slice(1),
      claimedMimeType,
      mismatch: claimedMimeType !== textMime,
    };
  }

  // Handle legacy Office formats (OLE Compound)
  if (buffer.length >= 8) {
    const oleSignature = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
    if (matchesSignature(buffer, { bytes: oleSignature })) {
      const mimeByExt: Record<string, string> = {
        '.doc': 'application/msword',
        '.xls': 'application/vnd.ms-excel',
        '.ppt': 'application/vnd.ms-powerpoint',
      };

      const mime = mimeByExt[extension];
      if (mime) {
        return {
          isValid: true,
          detectedMimeType: mime,
          detectedExtension: extension.slice(1),
          claimedMimeType,
          mismatch: claimedMimeType !== mime,
        };
      }
    }
  }

  // Unknown file type
  return {
    isValid: false,
    claimedMimeType,
    mismatch: true,
    error: `Unbekannter Dateityp. Konnte Datei-Signatur nicht verifizieren.`,
  };
}

/**
 * List of allowed MIME types for uploads
 */
export const ALLOWED_UPLOAD_TYPES = [
  // Documents
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

  // Images
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',

  // Audio
  'audio/mpeg',
  'audio/wav',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'audio/webm',
  'audio/ogg',
  'audio/flac',
  'video/webm',  // MediaRecorder sometimes reports video/webm for audio-only
  'video/ogg',   // Some browsers report video/ogg for audio
];

/**
 * Validate uploaded file
 */
export function validateUpload(
  buffer: Buffer,
  claimedMimeType: string,
  filename: string
): FileTypeResult {
  const result = validateFileType(buffer, claimedMimeType, filename);

  if (!result.isValid) {
    return result;
  }

  // Check if detected type is allowed
  if (result.detectedMimeType && !ALLOWED_UPLOAD_TYPES.includes(result.detectedMimeType)) {
    return {
      ...result,
      isValid: false,
      error: `Dateityp "${result.detectedMimeType}" ist nicht erlaubt.`,
    };
  }

  // Warn about mismatch but still allow
  if (result.mismatch) {
    console.warn(
      `[FileValidator] MIME type mismatch: claimed "${claimedMimeType}", detected "${result.detectedMimeType}" for file "${filename}"`
    );
  }

  return result;
}
