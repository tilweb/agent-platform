/**
 * Training Examples — Postgres-backed (Drizzle).
 *
 * Frueher `data/extraction-projects/<id>/examples/<ex-id>.yaml`, jetzt in
 * `extraction.examples`. Few-Shot-Selection bleibt in der App (kein DB-Sort
 * nach Score, weil corrections-first + recency unkompliziert in JS sind).
 */

import { eq, and, desc } from 'drizzle-orm';
import { getDb } from '../../db';
import { extractionExamples } from '../../db/schema/extraction';
import { blendSelection, rankBySimilarity } from './similarity';
import { embedDocument, isSimilarityEnabled } from './embeddings';
import type { TrainingExample } from './types';

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 7);
  return `ex_${ts}_${rand}`;
}

function rowToExample(row: typeof extractionExamples.$inferSelect): TrainingExample {
  return {
    id: row.id,
    created: row.createdAt,
    source_filename: row.sourceFilename,
    document_text: row.documentText,
    initial_extraction: row.initialExtraction as Record<string, unknown>,
    corrected_extraction: row.correctedExtraction as Record<string, unknown>,
    corrections: row.corrections as TrainingExample['corrections'],
    confirmed_correct: row.confirmedCorrect === 'true',
    embedding: (row.embedding as number[] | null) ?? null,
  };
}

export async function getExamples(projectId: string): Promise<TrainingExample[]> {
  const db = getDb();
  const rows = await db.select().from(extractionExamples)
    .where(eq(extractionExamples.projectId, projectId))
    .orderBy(desc(extractionExamples.createdAt));
  return rows.map(rowToExample);
}

export async function saveExample(
  projectId: string,
  data: {
    source_filename: string;
    document_text: string;
    initial_extraction: Record<string, unknown>;
    corrected_extraction: Record<string, unknown>;
  },
): Promise<TrainingExample> {
  const corrections: TrainingExample['corrections'] = [];
  let confirmedCorrect = true;
  for (const [field, correctedValue] of Object.entries(data.corrected_extraction)) {
    const initialValue = data.initial_extraction[field];
    if (JSON.stringify(initialValue) !== JSON.stringify(correctedValue)) {
      corrections.push({ field, was: initialValue, corrected_to: correctedValue });
      confirmedCorrect = false;
    }
  }

  // Embedding fuer die Aehnlichkeits-Auswahl (Welle 5) — best effort.
  const embedding = await embedDocument(data.document_text);

  const id = generateId();
  const now = new Date().toISOString();
  const example: TrainingExample = {
    id,
    created: now,
    source_filename: data.source_filename,
    document_text: data.document_text,
    initial_extraction: data.initial_extraction,
    corrected_extraction: data.corrected_extraction,
    corrections,
    confirmed_correct: confirmedCorrect,
    embedding,
  };

  const db = getDb();
  await db.insert(extractionExamples).values({
    id,
    projectId,
    sourceFilename: example.source_filename,
    documentText: example.document_text,
    initialExtraction: example.initial_extraction as never,
    correctedExtraction: example.corrected_extraction as never,
    corrections: example.corrections as never,
    confirmedCorrect: confirmedCorrect ? 'true' : 'false',
    embedding: (embedding ?? null) as never,
    createdAt: now,
  });
  return example;
}

export async function deleteExample(projectId: string, exampleId: string): Promise<boolean> {
  const db = getDb();
  const res = await db.delete(extractionExamples)
    .where(and(eq(extractionExamples.projectId, projectId), eq(extractionExamples.id, exampleId)))
    .returning({ id: extractionExamples.id });
  return res.length > 0;
}

/**
 * Embeddings fuer Beispiele nachtragen, die noch keins haben (Hintergrund,
 * gedeckelt). Passiert einmalig nach dem Einbau von Welle 5 bzw. wenn das
 * Embedding-Modell zwischenzeitlich nicht erreichbar war.
 */
const backfillLocks = new Set<string>();

async function backfillEmbeddings(projectId: string, examples: TrainingExample[], cap = 20): Promise<void> {
  if (backfillLocks.has(projectId)) return;
  const missing = examples.filter((e) => !e.embedding && e.document_text?.trim()).slice(0, cap);
  if (missing.length === 0) return;

  backfillLocks.add(projectId);
  try {
    const db = getDb();
    let done = 0;
    for (const example of missing) {
      const embedding = await embedDocument(example.document_text);
      if (!embedding) break; // Dienst nicht verfuegbar — spaeter neu versuchen
      await db.update(extractionExamples)
        .set({ embedding: embedding as never })
        .where(eq(extractionExamples.id, example.id));
      done += 1;
    }
    if (done > 0) console.log(`[Extraction] ${done} Beispiel-Embedding(s) fuer ${projectId} nachgetragen`);
  } catch (err) {
    console.warn('[Extraction] Embedding-Backfill fehlgeschlagen:', err instanceof Error ? err.message : err);
  } finally {
    backfillLocks.delete(projectId);
  }
}

/**
 * Few-Shot-Selection — corrections-first, dann recency, max 5 / 4000 tokens.
 *
 * Mit `queryText` (Welle 5): die aehnlichsten Beispiele kommen zuerst, der Rest
 * folgt der bisherigen Ordnung. Ohne Embeddings bleibt es exakt beim Alten.
 */
export async function selectFewShotExamples(
  projectId: string,
  queryText?: string,
  maxExamples: number = 5,
  maxTokenBudget: number = 4000,
): Promise<TrainingExample[]> {
  const all = await getExamples(projectId);
  if (all.length === 0) return [];

  let sorted = [...all].sort((a, b) => {
    if (a.corrections.length > 0 && b.corrections.length === 0) return -1;
    if (a.corrections.length === 0 && b.corrections.length > 0) return 1;
    return b.created.localeCompare(a.created);
  });

  if (queryText && isSimilarityEnabled() && all.length > maxExamples) {
    const queryEmbedding = await embedDocument(queryText);
    if (queryEmbedding) {
      const ranked = rankBySimilarity(queryEmbedding, all);
      if (ranked.length > 0) {
        sorted = blendSelection(ranked, sorted, all.length);
      }
      // Fehlende Embeddings im Hintergrund nachtragen (blockiert die Extraktion nicht).
      void backfillEmbeddings(projectId, all);
    }
  }

  const selected: TrainingExample[] = [];
  let estimatedTokens = 0;
  for (const example of sorted) {
    if (selected.length >= maxExamples) break;
    const docSnippet = example.document_text.substring(0, 500);
    const correctedJson = JSON.stringify(example.corrected_extraction);
    const tokenEstimate = Math.ceil((docSnippet.length + correctedJson.length) / 4);
    if (estimatedTokens + tokenEstimate > maxTokenBudget) break;
    selected.push(example);
    estimatedTokens += tokenEstimate;
  }
  return selected;
}
