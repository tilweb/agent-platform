/**
 * Heavy Extraction Pipeline — Confidence-Scoring per LLM-Self-Reflection.
 *
 * Pro Schema-Feld-Gruppe ein LLM-Roundtrip: gegeben Feld-Definition + alle
 * Kandidaten-Werte pro Chunk + finaler Merge-Wert, bewertet das LLM jedes
 * Feld auf einer 0..1-Skala. Begruendung:
 *   - 1.0  → mehrere Quellen liefern den gleichen Wert
 *   - 0.7  → eine starke Quelle, semantisch eindeutig
 *   - 0.5  → genau eine Quelle, evtl. mehrdeutig
 *   - <0.5 → widerspruechliche Quellen oder leere/unsichere Antwort
 *
 * Cost: ein Call pro Schema-Feld-Gruppe (also fuer mietvertrag mit 4 Gruppen
 * = 4 Calls). Aufschlag akzeptabel bei langen Dokumenten — Confidence ist
 * der einzige Weg, dem User Quality zu signalisieren.
 *
 * Wenn der Confidence-Call scheitert (LLM-Error, Parse-Fehler), faellt die
 * Funktion auf eine simple Heuristik zurueck: 1.0 wenn N ≥ 2 Chunks den
 * gleichen Wert liefern, 0.7 wenn 1 Chunk, 0.0 sonst.
 */

import { llmService, type Message } from '../llm';
import type { UsageContext } from '../usageTracking';
import type { ExtractionProfile } from '../../extraction/types';
import { isArrayGroup } from '../../extraction/types';
import type { ChunkExtraction } from './merger';

interface FieldCandidate {
  fieldPath: string;
  finalValue: unknown;
  perChunk: Array<{ chunkIndex: number; value: unknown }>;
}

/**
 * Sammelt fuer jedes Feld der Profile alle Chunk-Werte + den final-gemergten Wert.
 * Wird vor dem Confidence-Call als Input gebraucht.
 */
function gatherFieldCandidates(
  chunks: ChunkExtraction[],
  merged: Record<string, unknown>,
  profile: ExtractionProfile,
): FieldCandidate[] {
  const out: FieldCandidate[] = [];

  function pickValue(obj: unknown, path: string[]): unknown {
    let cursor: unknown = obj;
    for (const k of path) {
      if (cursor === null || cursor === undefined || typeof cursor !== 'object') return undefined;
      cursor = (cursor as Record<string, unknown>)[k];
    }
    return cursor;
  }

  for (const [groupName, groupSpec] of Object.entries(profile.fields)) {
    if (isArrayGroup(groupSpec)) {
      const finalValue = pickValue(merged, [groupName]);
      const perChunk = chunks
        .map((c) => ({ chunkIndex: c.chunkIndex, value: pickValue(c.data, [groupName]) }))
        .filter((c) => c.value !== undefined && c.value !== null);
      out.push({ fieldPath: groupName, finalValue, perChunk });
      continue;
    }
    for (const fieldName of Object.keys(groupSpec)) {
      const path = [groupName, fieldName];
      const finalValue = pickValue(merged, path);
      const perChunk = chunks
        .map((c) => ({ chunkIndex: c.chunkIndex, value: pickValue(c.data, path) }))
        .filter((c) => c.value !== undefined && c.value !== null && c.value !== '');
      out.push({ fieldPath: path.join('.'), finalValue, perChunk });
    }
  }
  return out;
}

function heuristicConfidence(candidate: FieldCandidate): number {
  if (candidate.finalValue === null || candidate.finalValue === undefined) return 0.0;
  if (candidate.perChunk.length === 0) return 0.0;
  if (candidate.perChunk.length === 1) return 0.7;

  // Mehrere Chunks: wie viele Quellen bestaetigen den finalen Wert?
  const matchingChunks = candidate.perChunk.filter((c) => {
    if (typeof candidate.finalValue === 'object') {
      return JSON.stringify(c.value) === JSON.stringify(candidate.finalValue);
    }
    return String(c.value).trim().toLowerCase() === String(candidate.finalValue).trim().toLowerCase();
  }).length;

  if (matchingChunks >= 2) return 1.0;
  if (matchingChunks === 1) return 0.6;       // andere Chunks lieferten andere Werte
  return 0.5;                                  // final-Wert kommt aus genau einem Chunk
}

/**
 * Fuehrt Confidence-Scoring fuer eine Liste von Feldern durch.
 * Verwendet die Heuristik als Fallback und LLM-Self-Reflection wenn moeglich.
 *
 * userId wird fuer Usage-Tracking durchgereicht.
 *
 * `useLLM = false` schaltet den LLM-Pfad aus (z.B. Tests). Dann wird nur die
 * Heuristik gerechnet — preiswert + deterministisch.
 */
export async function scoreConfidences(
  chunks: ChunkExtraction[],
  merged: Record<string, unknown>,
  profile: ExtractionProfile,
  userId: string,
  options: { useLLM?: boolean } = {},
): Promise<{ confidences: Record<string, number>; llmCalls: number }> {
  const candidates = gatherFieldCandidates(chunks, merged, profile);
  const confidences: Record<string, number> = {};
  let llmCalls = 0;

  // Default-Pfad: Heuristik fuer ALLE Felder (preiswert)
  for (const c of candidates) {
    confidences[c.fieldPath] = heuristicConfidence(c);
  }

  if (options.useLLM === false) {
    return { confidences, llmCalls: 0 };
  }

  // LLM-Verfeinerung: pro Feld-Gruppe ein Roundtrip mit Top-Kandidaten.
  // Wenn die Heuristik bereits 1.0 sagt, lassen wir den LLM-Call weg (Cost-Spar).
  const groups = Array.from(new Set(candidates.map((c) => c.fieldPath.split('.')[0]!)));

  for (const groupName of groups) {
    const groupCandidates = candidates.filter((c) => c.fieldPath.startsWith(`${groupName}.`) || c.fieldPath === groupName);
    // Skip wenn alle Felder bereits 1.0 oder 0.0 sind (keine Mehrdeutigkeit).
    const ambiguous = groupCandidates.filter((c) => {
      const score = confidences[c.fieldPath] ?? 0;
      return score > 0 && score < 1;
    });
    if (ambiguous.length === 0) continue;

    const fieldDescriptions = ambiguous.map((c) => {
      const variants = c.perChunk.map((pc) => `  - Chunk ${pc.chunkIndex}: ${JSON.stringify(pc.value)}`).join('\n');
      return `Feld "${c.fieldPath}":\n  Final-Wert: ${JSON.stringify(c.finalValue)}\n  Quellen:\n${variants}`;
    }).join('\n\n');

    const messages: Message[] = [
      {
        role: 'system',
        content: `Du bist Data-Quality-Reviewer fuer eine Extraktions-Pipeline. Bewerte fuer jedes vorgelegte Feld die Verlaesslichkeit des Final-Werts.

Skala:
- 1.0  → mehrere Quellen liefern exakt den gleichen Wert
- 0.7  → eine starke, eindeutige Quelle
- 0.5  → eine Quelle, semantisch mehrdeutig oder generisch
- 0.3  → widerspruechliche Quellen, der Final-Wert ist nur eine Variante
- 0.0  → keine verlaessliche Grundlage

Antworte AUSSCHLIESSLICH mit gueltigem JSON (keine Markdown-Fences):
{"feld.pfad": <score>, ...}

Nutze die Feld-Pfade, die ich dir gebe — keine zusaetzlichen Schluessel.`,
      },
      {
        role: 'user',
        content: `Bewerte folgende Felder:\n\n${fieldDescriptions}`,
      },
    ];

    const usageContext: UsageContext = {
      userId,
      source: 'extraction',
      operation: 'confidence_score',
    };

    try {
      const response = await llmService.chat(messages, undefined, usageContext, { userId });
      llmCalls += 1;
      const content = response.content || '{}';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, number>;
      for (const c of ambiguous) {
        const llmScore = parsed[c.fieldPath];
        if (typeof llmScore === 'number' && llmScore >= 0 && llmScore <= 1) {
          confidences[c.fieldPath] = llmScore;
        }
      }
    } catch (err) {
      // LLM-Confidence ist Best-Effort — Heuristik bleibt erhalten.
      console.warn(`[extraction] Confidence-Scoring fuer Gruppe "${groupName}" fehlgeschlagen, behalte Heuristik:`, err instanceof Error ? err.message : err);
    }
  }

  return { confidences, llmCalls };
}
