/**
 * Hilfsfunktionen rund um LLM-Aufrufe im Projektmanagement.
 *
 * Aktuell nur ein Timeout-Wrapper. `llmService.chat()` selbst kennt kein
 * AbortSignal — wir wickeln das Versprechen in `Promise.race` mit einem
 * `setTimeout`-Rejection. Das beendet den Hintergrund-Request nicht (das
 * LLM-Backend bekommt davon nichts mit), schuetzt aber den Hono-Handler
 * vor unbegrenzt langen Wartezeiten und damit den Connection-Pool.
 *
 * Default 30s — passt fuer typische Suggest-Aufrufe (Qwen3-30B liefert in
 * 2–10s). Wenn das LLM einen Output braucht, der bewusst laenger laeuft,
 * kann der Aufrufer den Timeout hochsetzen.
 */

export class LlmTimeoutError extends Error {
  constructor(public readonly label: string, public readonly timeoutMs: number) {
    super(`LLM-Aufruf "${label}" hat ${timeoutMs}ms überschritten`);
    this.name = 'LlmTimeoutError';
  }
}

export function withLlmTimeout<T>(
  promise: Promise<T>,
  label: string,
  timeoutMs: number = 30_000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new LlmTimeoutError(label, timeoutMs));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
