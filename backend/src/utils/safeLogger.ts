/**
 * safeLogger — log-helper der sensible Felder maskiert bevor sie in stdout/stderr
 * landen. Verhindert dass Authorization-Header, API-Keys oder Bearer-Tokens
 * versehentlich in die Konsole oder einen Log-Aggregator geraten.
 *
 * Anwendungsbereich:
 * - LLM-Adapter-Logging (Provider-Fehler enthalten oft Echo-Header)
 * - Custom-API-Tools (User-konfigurierte URLs/Headers)
 * - MCP-Client-Logs
 *
 * Usage:
 *   safeLog.info('LLM request', { url, headers, model });   // headers werden maskiert
 *   safeLog.error('Adapter failed', { error });             // String-Inhalte werden gescrubbed
 *
 * Siehe security-review M3.
 */

const SECRET_KEY_PATTERN =
  /^(authorization|api[-_]?key|x-api-key|password|secret|token|bearer|cookie|set-cookie|client[-_]?secret|encryption[-_]?key)$/i;

/**
 * Strip Bearer-Tokens, api_key=...-Querystrings, und Basic-Auth aus Strings.
 * Greift auch wenn der String aus einem error.message kommt.
 */
function scrubString(value: string): string {
  return value
    // Bearer <token>
    .replace(/Bearer\s+[A-Za-z0-9._\-+/=]+/gi, 'Bearer ***')
    // ?api_key=... oder &api_key=...
    .replace(/([?&](?:api[-_]?key|apikey|token|access[-_]?token)=)[^&\s"]+/gi, '$1***')
    // user:password@host (Basic-Auth in URLs)
    .replace(/(\b\w+:)\/\/([^:/@\s]+):([^@\s]+)@/g, '$1//$2:***@')
    // Authorization: Basic <base64>
    .replace(/(Authorization:\s*Basic\s+)[A-Za-z0-9+/=]+/gi, '$1***')
    // ai_token_<hex> — Adacor-Pattern (gelegentlich in Error-Bodies)
    .replace(/ai_token_[A-Fa-f0-9]{16,}/g, 'ai_token_***');
}

/**
 * Rekursiv durch ein Object/Array — Felder mit sensiblen Namen werden zu '***',
 * String-Werte gescrubbed. Funktionen/Symbols werden ignoriert.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[max-depth]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return scrubString(value);
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return value;
  }
  if (value instanceof Error) {
    return { name: value.name, message: scrubString(value.message) };
  }
  if (Array.isArray(value)) {
    return value.map((v) => redact(v, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY_PATTERN.test(k)) {
        out[k] = v ? '***' : v;
      } else {
        out[k] = redact(v, depth + 1);
      }
    }
    return out;
  }
  return '[non-serializable]';
}

type Meta = Record<string, unknown> | undefined;

function emit(level: 'log' | 'warn' | 'error', message: string, meta?: Meta): void {
  const safeMessage = scrubString(message);
  if (meta === undefined) {
    console[level](safeMessage);
  } else {
    console[level](safeMessage, redact(meta));
  }
}

export const safeLog = {
  info: (message: string, meta?: Meta) => emit('log', message, meta),
  warn: (message: string, meta?: Meta) => emit('warn', message, meta),
  error: (message: string, meta?: Meta) => emit('error', message, meta),
};
