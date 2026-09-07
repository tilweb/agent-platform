import { providerMetrics, type ProviderMetrics } from './telemetry';
import { jobContext, fencedWrite } from '../../extraction/learning/job-context';
import { withModelSlot } from './model-slots';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import { llmService } from '../llm';
import { extractionModelOverride } from '../../extraction/model';

export type WorkPriority = 'interactive' | 'batch' | 'evaluation';
export interface RuntimeMetrics extends ProviderMetrics { modelCalls: number; modelFailures: number; modelMs: number; queueMs: number; preparationMs: number; preparationHits: number; durationMs: number }
interface Context { priority: WorkPriority; memo: Map<string, Promise<unknown>>; metrics: RuntimeMetrics }
const context = new AsyncLocalStorage<Context>();
export function positiveLimit(value: string | undefined, fallback: number): number {
  const n = Number(value); return Number.isInteger(n) && n > 0 && n <= 64 ? n : fallback;
}

/** Shared by all documents, batches and evaluations in this backend process. Aging prevents starvation. */
export class WorkQueue {
  private active = 0;
  private pending: Array<{ priority: number; at: number; start: () => void }> = [];
  constructor(readonly limit: number) { if (!Number.isInteger(limit) || limit < 1) throw new Error('Invalid queue limit'); }
  run<T>(fn: () => Promise<T>, priority: WorkPriority = 'interactive'): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pending.push({ priority: { interactive: 0, batch: 1, evaluation: 2 }[priority], at: Date.now(), start: () => {
        this.active++;
        Promise.resolve().then(fn).then(resolve, reject).finally(() => { this.active--; this.pump(); });
      } });
      this.pump();
    });
  }
  private pump() {
    while (this.active < this.limit && this.pending.length) {
      const now = Date.now();
      this.pending.sort((a,b) => (a.priority - (now-a.at)/5000) - (b.priority - (now-b.at)/5000) || a.at-b.at);
      this.pending.shift()!.start();
    }
  }
}
const models = new Map<string, WorkQueue>();
const cpu = new WorkQueue(positiveLimit(process.env.EXTRACTION_CPU_CONCURRENCY, 2));
export async function modelWork<T>(key: string, fn: () => Promise<T>): Promise<T> {
  let queue = models.get(key);
  if (!queue) { queue = new WorkQueue(positiveLimit(process.env.EXTRACTION_MODEL_CONCURRENCY, 4)); models.set(key, queue); }
  const ctx = context.getStore(), queued = Date.now();
  return queue.run(() => withModelSlot(key, queue!.limit, async () => {
    const owner=jobContext.getStore();
    if(owner) await fencedWrite(owner.runId, async()=>undefined);
    const start = Date.now();
    if (ctx) { ctx.metrics.queueMs += start-queued; ctx.metrics.modelCalls++; }
    try { return await fn(); } catch (error) { if (ctx) ctx.metrics.modelFailures++; throw error; }
    finally { if (ctx) ctx.metrics.modelMs += Date.now()-start; }
  }), ctx?.priority);
}
export const extractionChat: typeof llmService.chat = (...args) => {
  const model = args[3]?.modelOverride ?? extractionModelOverride();
  return modelWork(`${model.providerId}/${model.modelId}`, () => llmService.chat(args[0], args[1], args[2], { ...args[3], timeoutMs: Math.min(args[3]?.timeoutMs ?? 120_000, 120_000) }));
};
export function withPriority<T>(priority: WorkPriority, fn: () => Promise<T>): Promise<T> {
  const current = context.getStore();
  return context.run(current ? { ...current, priority } : newContext(priority), fn);
}
function newContext(priority: WorkPriority): Context {
  return { priority, memo: new Map(), metrics: { providerAttempts: 0, inputTokens: null, outputTokens: null, tokenReports: 0, modelCalls: 0, modelFailures: 0, modelMs: 0, queueMs: 0, preparationMs: 0, preparationHits: 0, durationMs: 0 } };
}
export async function withDocumentRuntime<T>(fn: () => Promise<T>): Promise<{ value: T; metrics: RuntimeMetrics }> {
  const ctx = newContext(context.getStore()?.priority ?? 'interactive'), start = Date.now();
  const value = await providerMetrics.run(ctx.metrics, () => context.run(ctx, fn)); ctx.metrics.durationMs = Date.now()-start;
  return { value, metrics: ctx.metrics };
}
/** Exact bytes and options only; per-document lifetime, no cross-user cache, failed entries can retry. */
export async function prepared<T>(kind: string, bytes: Buffer, options: unknown, fn: () => Promise<T>): Promise<T> {
  const ctx = context.getStore();
  const key = `${kind}:${createHash('sha256').update(bytes).digest('hex')}:${JSON.stringify(options)}`;
  const existing = ctx?.memo.get(key);
  if (existing) { ctx!.metrics.preparationHits++; return existing as Promise<T>; }
  const promise = cpu.run(async () => { const start=Date.now(); try { return await fn(); } finally { if(ctx) ctx.metrics.preparationMs += Date.now()-start; } }, ctx?.priority);
  ctx?.memo.set(key, promise);
  try { return await promise; } catch(error) { ctx?.memo.delete(key); throw error; }
}
