/**
 * Webhook-Zustellung fuer Batch-Laeufe (Welle 5).
 *
 * Ein per API angestossener Lauf ist fire-and-forget — ohne Rueckkanal muesste
 * der Integrator pollen. Am Ende von `runBatchExtraction` wird deshalb (falls
 * konfiguriert) das Ergebnis an eine Callback-URL geschickt, HMAC-signiert,
 * damit der Empfaenger die Herkunft pruefen kann.
 *
 * Bewusst schlicht: 3 Versuche mit Backoff, danach wird der Fehlschlag am Lauf
 * vermerkt (die Ergebnisse bleiben ueber die API abrufbar — der Webhook ist
 * Komfort, keine einzige Wahrheitsquelle). Keine Redirect-Verfolgung; ein
 * Redirect auf eine andere Host-Adresse waere genau das, was man bei
 * ausgehenden Requests nicht will.
 *
 * Identisch in beiden Worktrees.
 */

import { createHmac } from 'crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/** Zustellversuche insgesamt (inkl. erstem). */
const MAX_ATTEMPTS = 3;
/** Wartezeit vor Versuch n (ms) — 0 / 2s / 8s. */
const BACKOFF_MS = [0, 2000, 8000];
const TIMEOUT_MS = 10_000;

export interface WebhookDeliveryResult {
  delivered: boolean;
  attempts: number;
  status?: number;
  error?: string;
}

/** HMAC-SHA256 ueber den exakten Body, hex-kodiert, mit `sha256=`-Praefix. */
export function signPayload(secret: string, body: string): string {
  return `sha256=${createHmac('sha256', secret).update(body, 'utf8').digest('hex')}`;
}

/** Zufaelliger Signaturschluessel fuer die Projekt-Einstellungen. */
export function generateWebhookSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Prueft eine IP-Literal-Adresse gegen private/interne Bereiche. Faellt bei
 * Unklarheit bewusst "geschlossen" aus (blockiert). Deckt IPv4, IPv6 und
 * IPv4-mapped IPv6 (::ffff:a.b.c.d) ab — inkl. Cloud-Metadaten 169.254.169.254.
 */
export function isPrivateIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts as [number, number, number, number];
    if (a === 0 || a === 127) return true;                 // 0.0.0.0/8, loopback
    if (a === 10) return true;                              // 10/8
    if (a === 172 && b >= 16 && b <= 31) return true;       // 172.16/12
    if (a === 192 && b === 168) return true;                // 192.168/16
    if (a === 169 && b === 254) return true;                // link-local / Metadaten
    if (a === 100 && b >= 64 && b <= 127) return true;      // CGNAT 100.64/10
    if (a >= 224) return true;                              // Multicast/reserviert
    return false;
  }
  if (version === 6) {
    const lc = ip.toLowerCase();
    if (lc === '::1' || lc === '::') return true;           // loopback / unspezifiziert
    if (lc.startsWith('fe80')) return true;                 // link-local
    if (lc.startsWith('fc') || lc.startsWith('fd')) return true; // ULA fc00::/7
    const mapped = lc.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]!);
    return false;
  }
  return true; // kein gueltiges IP-Literal → fail closed
}

/**
 * Bewusstes Opt-in fuer interne Ziele (z. B. Consumer im selben Cluster/Host).
 * Default aus → SSRF-Schutz greift. In Tests gesetzt, die an localhost liefern.
 */
function internalTargetsAllowed(): boolean {
  const v = process.env.WEBHOOK_ALLOW_INTERNAL;
  return v === '1' || v === 'true';
}

/** Offensichtlich interne Hostnamen (localhost, .local, .internal) + IP-Literale. */
function hostnameIsBlocked(host: string): boolean {
  if (internalTargetsAllowed()) return false;
  const h = host.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '');
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (isIP(h)) return isPrivateIp(h);
  return false; // echter Hostname → wird zur Zustell-Zeit per DNS geprueft
}

/**
 * Synchroner Check fuer die Konfiguration (Route): http/https + kein
 * offensichtlich internes Ziel. Der endgueltige Schutz gegen Hostnamen, die
 * auf private IPs aufloesen, sitzt in `deliverWebhook` (DNS-Aufloesung).
 */
export function isDeliverableUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    return !hostnameIsBlocked(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Loest den Hostnamen auf und blockiert, sobald EINE Adresse in einen privaten/
 * internen Bereich faellt (SSRF-Schutz zur Zustell-Zeit). Faellt bei
 * Aufloesungsfehlern geschlossen aus. Rest-Risiko DNS-Rebinding zwischen
 * Aufloesung und fetch bleibt (fetch pinnt die IP nicht) — bewusst akzeptiert.
 */
async function resolvesToInternal(hostname: string): Promise<boolean> {
  if (internalTargetsAllowed()) return false;
  const host = hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) return isPrivateIp(host);
  try {
    const addrs = await lookup(host, { all: true });
    if (addrs.length === 0) return true;
    return addrs.some((a) => isPrivateIp(a.address));
  } catch {
    return true;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Payload zustellen. Wirft nie — der Aufrufer (Hintergrund-Lauf) soll nicht an
 * einem unerreichbaren Empfaenger scheitern.
 */
export async function deliverWebhook(
  url: string,
  secret: string | undefined,
  payload: unknown,
  event = 'batch.completed',
): Promise<WebhookDeliveryResult> {
  if (!isDeliverableUrl(url)) {
    return { delivered: false, attempts: 0, error: 'Ungueltige Webhook-URL (nur http/https, kein internes Ziel)' };
  }
  if (await resolvesToInternal(new URL(url).hostname)) {
    return { delivered: false, attempts: 0, error: 'Webhook-Ziel verweist auf eine interne Adresse' };
  }

  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Workplace-Event': event,
  };
  if (secret) headers['X-Workplace-Signature'] = signPayload(secret, body);

  let lastError = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    if (BACKOFF_MS[attempt - 1]) await sleep(BACKOFF_MS[attempt - 1]!);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (response.ok) {
        return { delivered: true, attempts: attempt, status: response.status };
      }
      lastError = `HTTP ${response.status}`;
      // 4xx (ausser 408/429) sind Empfaenger-Fehler — erneute Versuche bringen nichts.
      if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
        return { delivered: false, attempts: attempt, status: response.status, error: lastError };
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return { delivered: false, attempts: MAX_ATTEMPTS, error: lastError || 'Zustellung fehlgeschlagen' };
}
