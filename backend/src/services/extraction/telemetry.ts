import { AsyncLocalStorage } from 'node:async_hooks';
export interface ProviderMetrics { providerAttempts: number; inputTokens: number | null; outputTokens: number | null; tokenReports: number }
export const providerMetrics = new AsyncLocalStorage<ProviderMetrics>();
export function recordProviderAttempt() { const metrics=providerMetrics.getStore(); if(metrics) metrics.providerAttempts++; }
export function recordProviderUsage(usage?: { prompt_tokens?: number; completion_tokens?: number }) {
  const metrics=providerMetrics.getStore(); if(!metrics || !usage) return;
  if(typeof usage.prompt_tokens==='number' && typeof usage.completion_tokens==='number') {
    metrics.inputTokens=(metrics.inputTokens ?? 0)+usage.prompt_tokens;
    metrics.outputTokens=(metrics.outputTokens ?? 0)+usage.completion_tokens; metrics.tokenReports++;
  }
}
