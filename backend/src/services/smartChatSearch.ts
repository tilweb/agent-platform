/**
 * Smart Chat Search Service
 *
 * Implements intelligent LLM-based re-ranking for chat search results.
 * Uses a two-stage approach:
 * 1. Fast substring/keyword search (Stage 1) - handled by memory.ts
 * 2. Smart LLM re-ranking (Stage 2) - this service
 *
 * The LLM only receives the top candidates from Stage 1, ensuring
 * constant-time processing regardless of total chat count.
 */

import { llmService } from './llm';
import type { ChatSearchResultWithScore } from './memory';
import type { UsageContext } from './usageTracking';

export interface SmartChatSearchResult extends ChatSearchResultWithScore {
  smartScore?: number;
  isSmartResult?: boolean;
}

export interface SmartChatSearchResponse {
  results: SmartChatSearchResult[];
  isSmartRanked: boolean;
  reasoning?: string;
}

/**
 * Perform intelligent re-ranking of chat search results using LLM
 *
 * @param query - The search query
 * @param fastResults - Results from Stage 1 fast search
 * @param triggeringUserId - User who triggered the search
 * @returns Re-ranked results with smart scores
 */
export async function smartChatSearch(
  query: string,
  fastResults: ChatSearchResultWithScore[],
  triggeringUserId?: string
): Promise<SmartChatSearchResponse> {
  // If not enough results, skip LLM re-ranking
  if (fastResults.length < 3) {
    return {
      results: fastResults,
      isSmartRanked: false,
    };
  }

  try {
    // Take top 30 candidates for LLM analysis (constant time!)
    const candidates = fastResults.slice(0, 30);

    // Build candidate list for LLM with rich metadata (summary, keywords)
    const candidateList = candidates
      .map((chat, idx) => {
        let entry = `[${idx}] "${chat.title}"`;

        // Add summary if available (most valuable for semantic understanding)
        if (chat.summary) {
          entry += `\n    Zusammenfassung: ${chat.summary}`;
        }

        // Add keywords if available
        if (chat.keywords && chat.keywords.length > 0) {
          entry += `\n    Keywords: ${chat.keywords.join(', ')}`;
        }

        // Add snippet as fallback context
        if (!chat.summary && chat.snippet) {
          entry += `\n    Auszug: "${chat.snippet.slice(0, 100)}..."`;
        }

        return entry;
      })
      .join('\n\n');

    const usageContext: UsageContext = {
      triggeringUserId,
      source: 'search',
      operation: 'smart_chat_search',
    };

    const response = await llmService.chat([
      {
        role: 'user',
        content: `Finde die relevantesten Chat-Konversationen für die Suchanfrage: "${query}"

KANDIDATEN:
${candidateList}

WICHTIG:
- Verstehe Synonyme und verwandte Begriffe (z.B. "Incidents" = "Vorfälle" = "Sicherheitsvorfälle")
- Berücksichtige deutsche UND englische Begriffe
- Die Zusammenfassung und Keywords sind am wichtigsten für die Relevanz
- Sortiere nach semantischer Relevanz zur Suchanfrage

Antworte NUR mit einem JSON-Array der Indizes, sortiert nach Relevanz (max 15):
[5, 2, 8, ...]`,
      },
    ], undefined, usageContext);

    // Parse LLM response
    const text = response.content || '';
    const match = text.match(/\[[\d,\s]*\]/);

    if (!match) {
      console.warn('Smart chat search: Could not parse LLM response');
      return {
        results: fastResults,
        isSmartRanked: false,
      };
    }

    const indices: number[] = JSON.parse(match[0]);
    const smartResults: SmartChatSearchResult[] = [];
    const seen = new Set<number>();

    // Add LLM-ranked results first with smart scores
    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i];
      if (idx !== undefined && idx >= 0 && idx < candidates.length && !seen.has(idx)) {
        const candidate = candidates[idx];
        if (candidate) {
          smartResults.push({
            ...candidate,
            smartScore: 100 - i * 5, // Descending score based on rank
            isSmartResult: true,
          });
          seen.add(idx);
        }
      }
    }

    // Append remaining candidates not selected by LLM
    for (let i = 0; i < candidates.length; i++) {
      if (!seen.has(i)) {
        const candidate = candidates[i];
        if (candidate) {
          smartResults.push(candidate);
        }
      }
    }

    // Append any results beyond the top 30 candidates
    for (let i = 30; i < fastResults.length; i++) {
      const result = fastResults[i];
      if (result) {
        smartResults.push(result);
      }
    }

    return {
      results: smartResults,
      isSmartRanked: true,
    };
  } catch (error) {
    console.error('Smart chat search error:', error);
    // Fallback to fast results on error
    return {
      results: fastResults,
      isSmartRanked: false,
    };
  }
}
