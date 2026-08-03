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

/** Nur http/https zulassen — file:, data: & Co. haben hier nichts verloren. */
export function isDeliverableUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
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
    return { delivered: false, attempts: 0, error: 'Ungueltige Webhook-URL (nur http/https)' };
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
