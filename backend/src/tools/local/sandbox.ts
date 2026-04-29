/**
 * Pfad-Sanitizing fuer File-Tools (S3-backed).
 *
 * S3 hat keine echten Pfade, aber wir wollen Path-Traversal verhindern,
 * damit ein User nicht via `../<otheruser>/...` aus seinem Prefix raus kommt.
 */

const TRAVERSAL_PATTERN = /(^|\/)\.\.(\/|$)/;

export function sanitizeRelPath(raw: string): string {
  if (typeof raw !== 'string') throw new Error('Pfad muss ein String sein');
  // Backslashes in Forward-Slashes uebersetzen (Windows-Eingaben), fuehrende Slashes entfernen.
  let p = raw.replace(/\\/g, '/');
  while (p.startsWith('/')) p = p.slice(1);
  // Doppel-Slashes kollabieren — kein "leerer" Path-Component.
  p = p.replace(/\/+/g, '/');
  if (TRAVERSAL_PATTERN.test('/' + p)) {
    throw new Error('Zugriff verweigert: Pfad außerhalb Ihres Verzeichnisses');
  }
  if (!p) throw new Error('Pfad darf nicht leer sein');
  return p;
}
