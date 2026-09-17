/**
 * WZ-Branchen-Matcher Service
 * Pipeline:
 *   1. splitActivities(input) → 1–3 Tätigkeitsstrings
 *   2. pro Tätigkeit: embed → cosine top-K → LLM re-rank
 *   3. aggregierter MultiMatchResult, persist
 */

import { createHash } from 'node:crypto';
import { findCachedMatch, generateMatchId, getMatch, listMatches, loadAliasIndex, loadCatalog, loadEmbeddings, saveMatch } from './storage';
import { topKWithAliases } from './retrieval';
import { buildLiftMap } from './level-lift';
import { classify } from './classifier';
import { splitActivities, type SplitActivity } from './splitter';
import type {
  ActivityMatch,
  AliasIndex,
  CatalogEntry,
  EmbeddingsIndex,
  MatchRecord,
  MatchResult,
  MultiMatchResult,
  RetrievalHit,
} from './types';
import { llmService } from '../../services/llm';
import { getPlatformModel } from '../../config/platformModels';
import { getSystemDefaultModel } from '../../services/providers';

const TOP_K = 20;

/**
 * Pipeline-Version fuer den Ergebnis-Cache: Bei JEDER verhaltensrelevanten
 * Aenderung (Prompts, Retrieval, Lift, Aliase, Katalog, Modell-Logik)
 * hochzaehlen — sonst liefert der Cache Ergebnisse der alten Pipeline.
 */
export const PIPELINE_VERSION = '2026-09-16.1';

/**
 * Cache-Schluessel: Whitespace-kollabiert und lowercased — dieselbe fachliche
 * Eingabe soll unabhaengig von Formatierung denselben Treffer ziehen. Der
 * Adacor-Endpoint ist selbst bei temperature 0 nicht deterministisch
 * (vLLM-Batching); der Cache ist der verlaessliche Konsistenz-Hebel.
 */
export function cacheKey(inputText: string): string {
  const normalized = inputText.trim().replace(/\s+/g, ' ').toLowerCase();
  return createHash('sha256').update(normalized).digest('hex');
}

/** Gemeinsam geladene Ressourcen fuer Matching und Eval-Harness. */
export interface MatchDeps {
  byCode: Map<string, CatalogEntry>;
  index: EmbeddingsIndex;
  aliases: AliasIndex | null;
  liftTo: Map<string, string>;
}

export async function buildMatchDeps(): Promise<MatchDeps> {
  const [catalog, index, aliases] = await Promise.all([loadCatalog(), loadEmbeddings(), loadAliasIndex()]);
  const byCode = new Map<string, CatalogEntry>();
  for (const entry of catalog) byCode.set(entry.code, entry);
  // Aliase nur verwenden, wenn sie mit demselben Modell gebaut wurden wie der
  // Katalog-Index — sonst sind die Similarities nicht vergleichbar.
  const usableAliases = aliases && aliases.model === index.model ? aliases : null;
  if (aliases && !usableAliases) {
    console.error(`[wzbar-matcher] Alias-Index-Modell (${aliases.model}) passt nicht zum Embedding-Index (${index.model}) — ignoriere Aliase.`);
  }
  return { byCode, index, aliases: usableAliases, liftTo: buildLiftMap(catalog) };
}

/**
 * Retrieval-Stufe fuer eine einzelne Taetigkeit: embed → top-K → Kandidaten
 * auf die tiefste textgleiche Ebene anheben und deduplizieren. 4311 und 43110
 * ("Abbrucharbeiten") landen sonst beide mit identischer Similarity in den
 * Top-K, und die Ebenen-Wahl bliebe dem LLM ueberlassen.
 *
 * Query-Expansion (M3): Fachsprachliche Suchvarianten aus dem Splitter werden
 * mit-embedded; die Trefferlisten werden per Max-Similarity je Code vereinigt
 * und wieder auf TOP_K gekappt. Eine danebenliegende Variante kann das
 * Retrieval dadurch nur erweitern, nie das Original verdraengen — verdraengt
 * werden nur Original-Hits mit niedrigerer Similarity als die Varianten-Hits.
 */
export async function retrieveCandidates(
  activity: string,
  deps: MatchDeps,
  searchVariants: string[] = [],
): Promise<{ hits: RetrievalHit[]; candidates: CatalogEntry[] }> {
  const activityKey = activity.trim().toLowerCase();
  const queries = [
    activity,
    ...searchVariants.filter(v => v.trim() && v.trim().toLowerCase() !== activityKey),
  ];
  const vectors = await Promise.all(queries.map(q => llmService.embed(q)));
  const hitsPerQuery = vectors.map(vec => topKWithAliases(vec, deps.index.entries, deps.aliases, TOP_K));
  const hits = hitsPerQuery.length === 1 ? hitsPerQuery[0]! : aggregateRetrievalHits(hitsPerQuery);

  const candidates: CatalogEntry[] = [];
  const seenCodes = new Set<string>();
  for (const hit of hits) {
    const entry = deps.byCode.get(deps.liftTo.get(hit.code) ?? hit.code);
    if (entry && !seenCodes.has(entry.code)) {
      seenCodes.add(entry.code);
      candidates.push(entry);
    }
  }
  return { hits, candidates };
}

/**
 * Volle Pipeline fuer eine einzelne Taetigkeit (Retrieval + LLM-Re-Ranking).
 * retrievalTopK im Audit-Record ist der rohe (bei Expansion: vereinigte)
 * Retrieval-Stand vor Lift/Dedupe.
 */
export async function matchActivity(
  activity: string,
  deps: MatchDeps,
  searchVariants: string[] = [],
  originalContext?: string,
): Promise<ActivityMatch> {
  const { hits, candidates } = await retrieveCandidates(activity, deps, searchVariants);
  const result = await classify(activity, candidates, searchVariants, originalContext);
  return {
    activity,
    ...(searchVariants.length > 0 ? { queryVariants: searchVariants } : {}),
    result: sanitizeResult(result, candidates),
    retrievalTopK: hits,
  } satisfies ActivityMatch;
}

/**
 * @param onActivities Progress-Hook fuer die UX-Zwischenanzeige: wird nach dem
 *   Splitter mit den erkannten Taetigkeiten aufgerufen, waehrend die
 *   Klassifikation noch laeuft. Bei Cache-Treffern nicht aufgerufen.
 * @param bypassCache "Neu ermitteln": Cache-Lookup ueberspringen und frisch
 *   rechnen. Der neue Record ist danach automatisch der juengste Treffer fuer
 *   diesen Input-Hash — die Neuberechnung ERSETZT damit den alten
 *   Cache-Eintrag, ohne dass geloescht werden muss.
 */
export async function match(
  inputText: string,
  userId = 'user_default',
  onActivities?: (activities: SplitActivity[]) => void,
  bypassCache = false,
): Promise<MatchRecord> {
  const trimmed = inputText.trim();
  if (!trimmed) throw new Error('inputText darf nicht leer sein');

  const started = Date.now();
  const inputHash = cacheKey(trimmed);

  if (!bypassCache && process.env.WZBAR_MATCH_CACHE !== 'off') {
    try {
      const cached = await findCachedMatch(inputHash, PIPELINE_VERSION);
      if (cached) return { ...cached, cached: true };
    } catch (error) {
      console.error('[wzbar-matcher] Cache-Lookup fehlgeschlagen — rechne neu:', error);
    }
  }

  const deps = await buildMatchDeps();

  const activities = await splitActivities(trimmed);
  if (activities.length === 0) activities.push({ text: trimmed, searchVariants: [] });
  try {
    onActivities?.(activities);
  } catch {
    /* Progress-Fehler duerfen den Match nicht stoppen */
  }

  const activityMatches: ActivityMatch[] = await Promise.all(
    activities.map(activity => matchActivity(activity.text, deps, activity.searchVariants, trimmed)),
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
    embeddingModel: deps.index.model,
    durationMs: Date.now() - started,
    inputHash,
    pipelineVersion: PIPELINE_VERSION,
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
  // Muss dieselbe Aufloesung nutzen wie die tatsaechlichen LLM-Calls
  // (appsModelOverride im Classifier/Splitter): Platform-Apps-Modell wenn
  // gepinnt, sonst der System-Chat-Default — nie ein Modell anzeigen, das
  // nicht auch wirklich verwendet wird.
  try {
    const m = await getPlatformModel('apps');
    if (m) return `${m.provider.id}/${m.model.id}`;
  } catch {
    /* ignore */
  }
  try {
    const fallback = await getSystemDefaultModel('chat');
    if (fallback) return `${fallback.provider.id}/${fallback.model.id}`;
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

  // Das LLM liefert trotz Schema gelegentlich fehlende/falsch getypte Felder
  // (primary kein Objekt, alternatives kein Array) — hart absichern statt
  // crashen; Fallback ist wie beim Whitelist-Verstoss der Top-1-Kandidat.
  const rawPrimary = result?.primary && typeof result.primary === 'object' ? result.primary : { code: '', confidence: 0, reasoning: '' };
  const rawAlternatives = Array.isArray(result?.alternatives) ? result.alternatives : [];

  const primaryEntry = byCode.get(rawPrimary.code) ?? candidates[0]!;
  const primary = {
    code: primaryEntry.code,
    kurztext: primaryEntry.kurztext,
    langtext: primaryEntry.langtext,
    confidence: clamp(rawPrimary.confidence ?? 0),
    reasoning: (rawPrimary.reasoning ?? '').trim(),
  };

  const usedCodes = new Set([primary.code]);
  const alternatives = rawAlternatives
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
