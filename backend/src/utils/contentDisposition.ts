/**
 * Content-Disposition Header-Helfer fuer User-Uploads.
 *
 * Default ist `attachment` — Browser laedt herunter statt zu rendern. Inline
 * ist nur fuer eine kurze Whitelist nicht-ausfuehrbarer Mimetypes erlaubt
 * (PDF, Raster-Bilder). Niemals fuer text/html, image/svg+xml etc., da
 * eingebettetes Skript sonst Stored-XSS waere.
 *
 * Filename wird sicher escaped: ASCII-Fallback + RFC-5987 utf-8-Variante.
 */

const INLINE_SAFE_MIME = new Set<string>([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

export function contentDispositionHeader(filename: string, mimeType: string): string {
  const baseMime = (mimeType || '').split(';')[0]!.trim().toLowerCase();
  const disposition = INLINE_SAFE_MIME.has(baseMime) ? 'inline' : 'attachment';
  // ASCII-Fallback fuer alte Clients: alle Non-ASCII durch _ ersetzen,
  // doppelte Quotes und Backslashes ebenfalls. RFC 5987 filename* mit UTF-8
  // gibt modernen Browsern das vollstaendige Original.
  const safeAscii = (filename || 'download')
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\]/g, '_');
  const utf8 = encodeURIComponent(filename || 'download');
  return `${disposition}; filename="${safeAscii}"; filename*=UTF-8''${utf8}`;
}
