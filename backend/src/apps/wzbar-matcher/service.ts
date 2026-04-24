/**
 * WZ-Branchen-Matcher Service
 * Pipeline: embed(query) → cosine top-K → LLM re-rank → persist
 */

import { generateMatchId, getMatch, listMatches, loadCatalog, loadEmbeddings, saveMatch } from './storage';
import { topK } from './retrieval';
import { classify } from './classifier';
import type { CatalogEntry, MatchRecord, MatchResult } from './types';
import { llmService } from '../../services/llm';
import { getPlatformModel } from '../../config/platformModels';

const TOP_K = 20;

export async function match(inputText: string, userId = 'user_default'): Promise<MatchRecord> {
  const trimmed = inputText.trim();
  if (!trimmed) throw new Error('inputText darf nicht leer sein');

  const started = Date.now();

  const [catalog, index] = await Promise.all([loadCatalog(), loadEmbeddings()]);

  const queryVector = await llmService.embed(trimmed);

  const hits = topK(queryVector, index.entries, TOP_K);

  const byCode = new Map<string, CatalogEntry>();
  for (const entry of catalog) byCode.set(entry.code, entry);
  const candidates: CatalogEntry[] = [];
  for (const hit of hits) {
    const entry = byCode.get(hit.code);
    if (entry) candidates.push(entry);
  }

  const llmModel = await resolveChatModelLabel();
  const result = await classify(trimmed, candidates);

  const sanitized = sanitizeResult(result, candidates);

  const record: MatchRecord = {
    id: generateMatchId(),
    createdAt: new Date().toISOString(),
    userId,
    inputText: trimmed,
    result: sanitized,
    retrievalTopK: hits,
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
