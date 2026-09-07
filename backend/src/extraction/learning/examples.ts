import { getProject } from './projects';
/**
 * Training Examples — Postgres-backed (Drizzle).
 *
 * Frueher `data/extraction-projects/<id>/examples/<ex-id>.yaml`, jetzt in
 * `extraction.examples`. Few-Shot-Selection bleibt in der App (kein DB-Sort
 * nach Score, weil corrections-first + recency unkompliziert in JS sind).
 */

import { eq, and, desc } from 'drizzle-orm';
import { getDb } from '../../db';
import { createHash } from 'crypto';
import { extractionExamples, extractionProjects } from '../../db/schema/extraction';
import { blendSelection, rankBySimilarity } from './similarity';
import { embedDocument, isSimilarityEnabled } from './embeddings';
import { exampleContext } from './example-context';
import { sameDocument, documentKeys } from './snapshot';
import type { TrainingExample, ExampleDataset } from './types';

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 7);
  return `ex_${ts}_${rand}`;
}

function rowToExample(row: typeof extractionExamples.$inferSelect): TrainingExample {
  return {
    id: row.id,
    dataset: (row.dataset as ExampleDataset | null) ?? undefined,
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
    dataset?: ExampleDataset;
    source_filename: string;
    document_text: string;
    initial_extraction: Record<string, unknown>;
    corrected_extraction: Record<string, unknown>;
  },
): Promise<TrainingExample> {
  if (data.dataset && !['train', 'test'].includes(data.dataset.purpose)) throw new Error('Ungültiger Beispielzweck');
  if (data.dataset?.original) {
    const hash = createHash('sha256').update(Buffer.from(data.dataset.original.base64, 'base64')).digest('hex');
    if (hash !== data.dataset.original.sha256) throw new Error('Original-Prüfsumme stimmt nicht');
  }
  const corrections: TrainingExample['corrections'] = [];
  let confirmedCorrect = true;
  for (const [field, correctedValue] of Object.entries(data.corrected_extraction)) {
    const initialValue = data.initial_extraction[field];
    if (JSON.stringify(initialValue) !== JSON.stringify(correctedValue)) {
      corrections.push({ field, was: initialValue, corrected_to: correctedValue });
      confirmedCorrect = false;
    }
  }

  const existing = await getExamples(projectId);
  const candidate = { ...data, dataset: data.dataset ?? { purpose: 'train' } } as TrainingExample;
  const duplicate = existing.find(e => sameDocument(e, candidate));
  if (duplicate) throw new Error('Dieses Dokument ist bereits im Lern- oder Testbestand. Doppelte Dokumente dürfen die Messung nicht beeinflussen.');
  if (candidate.dataset?.purpose === 'test' && !candidate.dataset.original) throw new Error('Ein Testbeispiel benötigt das gespeicherte Original. Bitte neu verarbeiten.');

  // Embedding fuer die Aehnlichkeits-Auswahl (Welle 5) — best effort.
  const embedding = candidate.dataset?.purpose === 'test' ? null : await embedDocument(data.document_text);

  const id = generateId();
  const now = new Date().toISOString();
  const example: TrainingExample = {
    id,
    dataset: candidate.dataset,
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
  await db.transaction(async tx => {
    const [project] = await tx.select().from(extractionProjects).where(eq(extractionProjects.id, projectId)).for('update');
    if (!project) throw new Error('Profil nicht gefunden');
    const rows = await tx.select().from(extractionExamples).where(eq(extractionExamples.projectId, projectId));
    if (rows.map(rowToExample).some(e => sameDocument(e, example))) throw new Error('Dieses Dokument ist bereits im Lern- oder Testbestand.');
    const learning = project.learning as import('./types').LearningMetadata;
    const roles = { ...learning.document_roles };
    // Backfill roles for existing examples before any deletion can erase provenance.
    for (const e of rows.map(rowToExample)) for (const key of documentKeys(e)) roles[key] = e.dataset?.purpose ?? 'train';
    const purpose = example.dataset?.purpose ?? 'train';
    const keys = documentKeys(example);
    if (keys.some(key => roles[key] && roles[key] !== purpose)) throw new Error('Dieses Dokument wurde bereits für einen anderen Zweck verwendet und kann nicht zwischen Lernen und Test wechseln.');
    for (const key of keys) roles[key] = purpose;
    await tx.insert(extractionExamples).values({
      id,
      projectId,
      sourceFilename: example.source_filename,
      dataset: example.dataset as never,
      documentText: example.document_text,
      initialExtraction: example.initial_extraction as never,
      correctedExtraction: example.corrected_extraction as never,
      corrections: example.corrections as never,
      confirmedCorrect: confirmedCorrect ? 'true' : 'false',
      embedding: (embedding ?? null) as never,
      createdAt: now,
    });
    await tx.update(extractionProjects).set({ learning: { ...learning, document_roles: roles, dataset_version: (learning.dataset_version ?? 0) + 1,
      accuracy_estimate: (() => {
        const training = [...rows.map(rowToExample), example].filter(e => e.dataset?.purpose !== 'test');
        return training.length ? Math.round(training.filter(e => e.confirmed_correct).length / training.length * 100) : 0;
      })(),
      total_examples: rows.filter(r => (r.dataset as ExampleDataset | null)?.purpose !== 'test').length + (purpose === 'train' ? 1 : 0),
    } as never }).where(eq(extractionProjects.id, projectId));
  });
  return example;
}

export async function deleteExample(projectId: string, exampleId: string): Promise<boolean> {
  return getDb().transaction(async tx => {
    const [project] = await tx.select().from(extractionProjects).where(eq(extractionProjects.id, projectId)).for('update');
    if (!project) return false;
    const rows = await tx.select().from(extractionExamples).where(eq(extractionExamples.projectId, projectId));
    const learning = project.learning as import('./types').LearningMetadata;
    const roles = { ...learning.document_roles };
    for (const e of rows.map(rowToExample)) for (const key of documentKeys(e)) roles[key] = e.dataset?.purpose ?? 'train';
    const res = await tx.delete(extractionExamples).where(and(eq(extractionExamples.projectId, projectId), eq(extractionExamples.id, exampleId))).returning({ id: extractionExamples.id });
    const remaining = rows.filter(r => r.id !== exampleId && (r.dataset as ExampleDataset | null)?.purpose !== 'test');
    await tx.update(extractionProjects).set({ learning: { ...learning, document_roles: roles, dataset_version: (learning.dataset_version ?? 0) + 1, total_examples: remaining.length,
      accuracy_estimate: remaining.length ? Math.round(remaining.filter(r => r.confirmedCorrect === 'true').length / remaining.length * 100) : 0,
      eval: { ...learning.eval, status: 'idle', champion: undefined },
    } as never }).where(eq(extractionProjects.id, projectId));
    return res.length > 0;
  });
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
  frozenExamples?: TrainingExample[],
): Promise<TrainingExample[]> {
  const approved = frozenExamples ? [] : (await getProject(projectId))?.learning.approved_example_ids ?? [];
  const all = (frozenExamples ?? await getExamples(projectId)).filter(e => e.dataset?.purpose !== 'test' && (frozenExamples || e.dataset?.activation !== 'candidate' || approved.includes(e.id)));
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
      if (!frozenExamples) void backfillEmbeddings(projectId, all);
    }
  }

  const seenGroups = new Set<string>();
  const diverse: TrainingExample[] = [], remainder: TrainingExample[] = [];
  for (const example of sorted) {
    const group = example.dataset?.group ?? '';
    if (seenGroups.has(group)) remainder.push(example);
    else { seenGroups.add(group); diverse.push(example); }
  }
  sorted = [...diverse, ...remainder];
  const selected: TrainingExample[] = [];
  let estimatedTokens = 0;
  for (const example of sorted) {
    if (selected.length >= maxExamples) break;
    const context = exampleContext(example);
    if (!context && !example.dataset?.visual?.length) continue;
    const tokenEstimate = Math.ceil(context.length / 3);
    if (estimatedTokens + tokenEstimate > maxTokenBudget) continue;
    selected.push(example);
    estimatedTokens += tokenEstimate;
  }
  return selected;
}
