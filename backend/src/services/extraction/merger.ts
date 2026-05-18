/**
 * Heavy Extraction Pipeline — Feld-Merger.
 *
 * Konsolidiert N partielle Extractions (eine pro Chunk/Page) zu einer
 * finalen Antwort + Provenance. Die Wahl welcher Wert „wins" steuert die
 * `merge_strategy` aus dem Schema-Config.
 *
 * Drei Merge-Strategien:
 *   - first-non-null     → erster Chunk mit Wert wins
 *   - majority-vote      → haeufigster Wert wins; bei Tie der erste
 *   - priority-by-section → bevorzugt Chunk dessen Heading zum Feld-Namen passt
 *   - union              → fuer Array-Felder: alle Werte konkatenieren
 *
 * Provenance: pro Feld notiert wir aus welchem Chunk der finale Wert kam
 * (`c:<index>`). Bei union werden alle beitragenden Chunks als `c:0+1+3` notiert.
 */

import type { ExtractionProfile, FieldGroup, FieldDefinition } from '../../extraction/types';
import { isArrayGroup } from '../../extraction/types';
import type { FieldProvenance, MergeStrategyId } from './types';

export interface ChunkExtraction {
  /** Chunk-Index aus dem chunker. */
  chunkIndex: number;
  /** Optional: Heading-Text des Chunks (fuer priority-by-section). */
  heading?: string;
  /** Extrahierte Daten aus diesem Chunk. */
  data: Record<string, unknown>;
}

export interface MergeResult {
  merged: Record<string, unknown>;
  provenance: FieldProvenance[];
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

/**
 * Sammelt alle nicht-leeren Kandidaten fuer ein bestimmtes Feld aus allen Chunks.
 */
function collectCandidates(
  chunks: ChunkExtraction[],
  path: string[],
): Array<{ chunkIndex: number; heading?: string; value: unknown }> {
  const out: Array<{ chunkIndex: number; heading?: string; value: unknown }> = [];
  for (const chunk of chunks) {
    let cursor: unknown = chunk.data;
    for (const key of path) {
      if (cursor === null || cursor === undefined || typeof cursor !== 'object') {
        cursor = undefined;
        break;
      }
      cursor = (cursor as Record<string, unknown>)[key];
    }
    if (!isEmptyValue(cursor)) {
      out.push({ chunkIndex: chunk.chunkIndex, heading: chunk.heading, value: cursor });
    }
  }
  return out;
}

/**
 * Normalisiert einen Wert fuer Vote-Vergleich (Trim, Lowercase, Number-Parse).
 * Vermeidet, dass "10" vs "10 " als unterschiedlich gezaehlt werden.
 */
function normalizeForVote(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim().toLowerCase();
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function pickFirstNonNull(
  candidates: Array<{ chunkIndex: number; heading?: string; value: unknown }>,
): { value: unknown; chunkIndices: number[] } {
  const first = candidates[0];
  if (!first) return { value: null, chunkIndices: [] };
  return { value: first.value, chunkIndices: [first.chunkIndex] };
}

function pickMajorityVote(
  candidates: Array<{ chunkIndex: number; heading?: string; value: unknown }>,
): { value: unknown; chunkIndices: number[] } {
  const counts = new Map<string, { value: unknown; chunkIndices: number[]; count: number }>();
  for (const c of candidates) {
    const key = normalizeForVote(c.value);
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
      existing.chunkIndices.push(c.chunkIndex);
    } else {
      counts.set(key, { value: c.value, chunkIndices: [c.chunkIndex], count: 1 });
    }
  }
  let winner: { value: unknown; chunkIndices: number[]; count: number } | null = null;
  for (const entry of counts.values()) {
    if (!winner || entry.count > winner.count) winner = entry;
  }
  return winner ?? pickFirstNonNull(candidates);
}

function pickPriorityBySection(
  candidates: Array<{ chunkIndex: number; heading?: string; value: unknown }>,
  groupName: string,
): { value: unknown; chunkIndices: number[] } {
  const lowerGroup = groupName.toLowerCase();
  // Erst Heading-Match (auch Substring)
  const matched = candidates.find((c) => (c.heading || '').toLowerCase().includes(lowerGroup));
  if (matched) return { value: matched.value, chunkIndices: [matched.chunkIndex] };
  return pickFirstNonNull(candidates);
}

function pickUnion(
  candidates: Array<{ chunkIndex: number; heading?: string; value: unknown }>,
): { value: unknown; chunkIndices: number[] } {
  // Union macht nur Sinn fuer Arrays — fuer Skalare faellt auf first-non-null zurueck.
  const arrays = candidates.filter((c) => Array.isArray(c.value));
  if (arrays.length === 0) return pickFirstNonNull(candidates);
  const concatenated = arrays.flatMap((c) => c.value as unknown[]);
  return { value: concatenated, chunkIndices: arrays.map((c) => c.chunkIndex) };
}

function mergeField(
  strategy: MergeStrategyId,
  candidates: Array<{ chunkIndex: number; heading?: string; value: unknown }>,
  groupName: string,
  fieldDef?: FieldDefinition,
): { value: unknown; chunkIndices: number[] } {
  if (candidates.length === 0) return { value: null, chunkIndices: [] };

  // Auto-Union fuer Array-Felder unabhaengig von strategy, wenn `_array`-Gruppe.
  // Skalare Felder werden mit `strategy` gemergt.
  void fieldDef;

  switch (strategy) {
    case 'first-non-null':
      return pickFirstNonNull(candidates);
    case 'majority-vote':
      return pickMajorityVote(candidates);
    case 'priority-by-section':
      return pickPriorityBySection(candidates, groupName);
    case 'union':
      return pickUnion(candidates);
    default:
      return pickFirstNonNull(candidates);
  }
}

function setDeep(target: Record<string, unknown>, path: string[], value: unknown): void {
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i]!;
    if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[path[path.length - 1]!] = value;
}

/**
 * Top-Level Merge — iteriert ueber das ExtractionProfile + sammelt pro Feld
 * die Kandidaten, mergt nach Strategy, baut das finale Result auf.
 */
export function mergeChunks(
  chunks: ChunkExtraction[],
  profile: ExtractionProfile,
  strategy: MergeStrategyId,
): MergeResult {
  const merged: Record<string, unknown> = {};
  const provenance: FieldProvenance[] = [];

  for (const [groupName, groupSpec] of Object.entries(profile.fields)) {
    if (isArrayGroup(groupSpec)) {
      // Array-Gruppe: Union-Concat aller Chunk-Arrays.
      const candidates = collectCandidates(chunks, [groupName]);
      const result = pickUnion(candidates);
      if (!isEmptyValue(result.value)) {
        setDeep(merged, [groupName], result.value);
        provenance.push({
          field: groupName,
          value: result.value,
          source: `c:${result.chunkIndices.join('+')}`,
        });
      }
      continue;
    }

    // Object-Gruppe mit benannten Feldern
    const group = groupSpec as Record<string, FieldDefinition>;
    for (const [fieldName, fieldDef] of Object.entries(group)) {
      const path = [groupName, fieldName];
      const candidates = collectCandidates(chunks, path);
      const result = mergeField(strategy, candidates, groupName, fieldDef);
      if (!isEmptyValue(result.value)) {
        setDeep(merged, path, result.value);
        provenance.push({
          field: path.join('.'),
          value: result.value,
          source: `c:${result.chunkIndices.join('+')}`,
        });
      }
    }
  }

  return { merged, provenance };
}
