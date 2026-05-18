/**
 * Heavy Extraction Pipeline — Approximative Token-Zaehlung.
 *
 * Wir benutzen die simple 3.5-Chars/Token-Heuristik (Mittelwert ueber
 * deutsch/englisch + strukturiertem JSON). Eine echte Tokenizer-Lib (z.B.
 * `tiktoken`) waere genauer, kostet aber Bundle-Size + Native-Build-Schritt.
 *
 * Die Heuristik liegt ueblicherweise innerhalb +/- 20% des tatsaechlichen
 * Token-Counts — fuer Chunk-Sizing reicht das, weil wir ohnehin mit
 * Sicherheits-Margins arbeiten.
 *
 * Bei strukturierten Tabellen + JSON unterschaetzt die Heuristik systematisch.
 * Konsumenten koennen `safetyMargin` setzen (Default 1.15 = +15%), um das
 * abzufedern.
 */

const CHARS_PER_TOKEN = 3.5;

export function approximateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export interface TokenBudget {
  modelContext: number;
  systemReserve: number;        // System-Prompt + Function-Schema + Overhead
  responseReserve: number;      // Wieviel laesst die Strategy fuer die LLM-Antwort uebrig
  safetyMargin: number;         // Multiplier auf den Approximations-Count
}

export const DEFAULT_TOKEN_BUDGET: TokenBudget = {
  modelContext: 128000,         // Default fuer den aktiven Qwen 3 30B 128k
  systemReserve: 2000,
  responseReserve: 4000,
  safetyMargin: 1.15,
};

/**
 * Wieviele Tokens stehen einem User-Inhalt (Markdown-Text) zur Verfuegung,
 * bevor das Modell-Limit erreicht ist? Konsumenten benutzen das fuer
 * Chunk-Sizing.
 */
export function effectiveInputBudget(budget: Partial<TokenBudget> = {}): number {
  const b = { ...DEFAULT_TOKEN_BUDGET, ...budget };
  return Math.max(0, b.modelContext - b.systemReserve - b.responseReserve);
}

/**
 * Passt der gegebene Text in das Budget? Konservativ — `safetyMargin` ist
 * eingerechnet.
 */
export function fitsInBudget(text: string, budget: Partial<TokenBudget> = {}): boolean {
  const b = { ...DEFAULT_TOKEN_BUDGET, ...budget };
  const required = Math.ceil(approximateTokenCount(text) * b.safetyMargin);
  return required <= effectiveInputBudget(b);
}
