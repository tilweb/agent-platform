/**
 * WZ-Branchen-Matcher Service
 * Pipeline:
 *   1. splitActivities(input) → 1–3 Tätigkeitsstrings
 *   2. pro Tätigkeit: embed → cosine top-K → LLM re-rank
 *   3. aggregierter MultiMatchResult, persist
 */

import { generateMatchId, getMatch, listMatches, loadCatalog, loadEmbeddings, saveMatch } from './storage';
import { topK } from './retrieval';
import { classify } from './classifier';
import { splitActivities } from './splitter';
import type {
  ActivityMatch,
  CatalogEntry,
  MatchRecord,
  MatchResult,
  MultiMatchResult,
  RetrievalHit,
} from './types';
import { llmService } from '../../services/llm';
import { getPlatformModel } from '../../config/platformModels';

const TOP_K = 20;

export async function match(inputText: string, userId = 'user_default'): Promise<MatchRecord> {
  const trimmed = inputText.trim();
  if (!trimmed) throw new Error('inputText darf nicht leer sein');

  const started = Date.now();

  const [catalog, index] = await Promise.all([loadCatalog(), loadEmbeddings()]);
  const byCode = new Map<string, CatalogEntry>();
  for (const entry of catalog) byCode.set(entry.code, entry);

  const activities = await splitActivities(trimmed);
  if (activities.length === 0) activities.push(trimmed);

  const activityMatches: ActivityMatch[] = await Promise.all(
    activities.map(async (activity) => {
      const queryVector = await llmService.embed(activity);
      const hits = topK(queryVector, index.entries, TOP_K);
      const candidates: CatalogEntry[] = [];
      for (const hit of hits) {
        const entry = byCode.get(hit.code);
        if (entry) candidates.push(entry);
      }
      const result = await classify(activity, candidates);
      return {
        activity,
        result: sanitizeResult(result, candidates),
        retrievalTopK: hits,
      } satisfies ActivityMatch;
    }),
  );

  const llmModel = await resolveChatModelLabel();
  const multiResult: MultiMatchResult = { activities: activityMatches };

  // Aggregierte topK fuer das Audit-Log: union der Hits ueber alle Activities,
  // dedupliziert nach Code, sortiert nach hoechster Similarity je Code.
  const aggregatedTopK = aggregateRetrievalHits(activityMatches.map(a => a.retrievalTopK));

  const record: MatchRecord = {
    id: generateMatchId(),
    createdAt: new Date().toISOString(),
    userId,
    inputText: trimmed,
    result: multiResult,
    retrievalTopK: aggregatedTopK,
    llmModel,
    embeddingModel: index.model,
    durationMs: Date.now() - started,
  };

  await saveMatch(record);
  return record;
}

export async function history(limit = 50): Promise<MatchRecord[]> {
  return listMatches(limit);
}

export async function detail(id: string): Promise<MatchRecord | null> {
  return getMatch(id);
}

async function resolveChatModelLabel(): Promise<string> {
  try {
    const m = await getPlatformModel('apps');
    if (m) return `${m.provider.id}/${m.model.id}`;
  } catch {
    /* ignore */
  }
  return 'default-chat';
}

function aggregateRetrievalHits(hitsList: RetrievalHit[][]): RetrievalHit[] {
  const best = new Map<string, number>();
  for (const hits of hitsList) {
    for (const h of hits) {
      const prev = best.get(h.code);
      if (prev === undefined || h.similarity > prev) best.set(h.code, h.similarity);
    }
  }
  return [...best.entries()]
    .map(([code, similarity]) => ({ code, similarity }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, TOP_K);
}

function sanitizeResult(result: MatchResult, candidates: CatalogEntry[]): MatchResult {
  const byCode = new Map(candidates.map(c => [c.code, c]));

  const clamp = (n: number) => Math.max(0, Math.min(1, n));

  const resolveCandidate = (code: string, fallback: CatalogEntry) => byCode.get(code) ?? fallback;

  const primaryEntry = byCode.get(result.primary.code) ?? candidates[0]!;
  const primary = {
    code: primaryEntry.code,
    kurztext: primaryEntry.kurztext,
    langtext: primaryEntry.langtext,
    confidence: clamp(result.primary.confidence ?? 0),
    reasoning: (result.primary.reasoning ?? '').trim(),
  };

  const usedCodes = new Set([primary.code]);
  const alternatives = (result.alternatives ?? [])
    .filter(a => a && typeof a.code === 'string' && byCode.has(a.code) && !usedCodes.has(a.code))
    .slice(0, 3)
    .map(a => {
      const entry = resolveCandidate(a.code, primaryEntry);
      usedCodes.add(entry.code);
      return {
        code: entry.code,
        kurztext: entry.kurztext,
        langtext: entry.langtext,
        confidence: clamp(a.confidence ?? 0),
        reasoning: (a.reasoning ?? '').trim(),
      };
    })
    .sort((a, b) => b.confidence - a.confidence);

  return { primary, alternatives };
}
