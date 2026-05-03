/**
 * Pfad-Sanitizing fuer File-Tools (S3-backed).
 *
 * S3 hat keine echten Pfade, aber wir wollen Path-Traversal verhindern,
 * damit ein User nicht via `../<otheruser>/...` aus seinem Prefix raus kommt.
 *
 * Geschuetzt gegen:
 * - Literal `..`-Segmente (mit und ohne Backslashes)
 * - URL-encoded Traversal (`%2e%2e`, `%252e%252e`)
 * - Unicode-Composition-Tricks (NFC-normalisiert)
 * - Control-Characters und NUL-Bytes (alte C-style String-Truncation)
 * - Lone-Surrogates die JSON-Parser brechen
 *
 * Siehe security-review M6.
 */

const TRAVERSAL_PATTERN = /(^|\/)\.\.(\/|$)/;
const FORBIDDEN_CHARS = /[\x00-\x1F\x7F]/;
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

export function sanitizeRelPath(raw: string): string {
  if (typeof raw !== 'string') throw new Error('Pfad muss ein String sein');

  // Doppel-Decode loest %252e (= verschluesselte %2e) plus normales %2e auf.
  // Zwei Iterationen reichen — danach ist nichts mehr zu decoden.
  let p = raw;
  for (let i = 0; i < 2; i++) {
    try {
      const decoded = decodeURIComponent(p);
      if (decoded === p) break;
      p = decoded;
    } catch {
      // Invalides URI-Encoding — abweisen statt falsch decodieren
      throw new Error('Pfad enthaelt ungueltige URL-Encoding-Sequenzen');
    }
  }

  // Unicode-Normalize: NFC kollabiert verschiedene Codepoint-Schreibweisen
  // desselben Zeichens. Sonst koennte z.B. `../` als zerlegte Codepoints
  // den Regex-Check umgehen.
  p = p.normalize('NFC');

  if (FORBIDDEN_CHARS.test(p)) {
    throw new Error('Pfad enthaelt unzulaessige Steuerzeichen');
  }
  if (LONE_SURROGATE.test(p)) {
    throw new Error('Pfad enthaelt unvollstaendige Unicode-Surrogates');
  }

  // Backslashes in Forward-Slashes uebersetzen (Windows-Eingaben), fuehrende Slashes entfernen.
  p = p.replace(/\\/g, '/');
  while (p.startsWith('/')) p = p.slice(1);
  // Doppel-Slashes kollabieren — kein "leerer" Path-Component.
  p = p.replace(/\/+/g, '/');
  if (TRAVERSAL_PATTERN.test('/' + p)) {
    throw new Error('Zugriff verweigert: Pfad außerhalb Ihres Verzeichnisses');
  }
  if (!p) throw new Error('Pfad darf nicht leer sein');
  return p;
}
