import { pgSchema, text, timestamp, jsonb, index, integer } from 'drizzle-orm/pg-core';

export const extractionSchema = pgSchema('extraction');

export const extractionProfiles = extractionSchema.table('profiles', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id'),
  name: text('name').notNull(),
  fields: jsonb('fields').notNull(),                // Field-Definitions
  guidelines: text('guidelines'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  ownerIdx: index('extraction_profiles_owner_idx').on(t.ownerId),
}));

/**
 * Extraction-Projekte aus dem `learning/`-Modul:
 * Flat, intent-based Extraction mit Few-Shot-Examples + Guidelines.
 * Ersetzt die YAML-Files unter `data/extraction-projects/<id>/project.yaml`.
 */
export const extractionProjects = extractionSchema.table('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  fields: jsonb('fields').notNull(),                 // Record<string, ProjectField>
  instructions: text('instructions'),               // Stabile Domaenen-Anweisungen (vom Lern-Loop unberuehrt)
  guidelines: text('guidelines').notNull().default(''),
  learning: jsonb('learning').notNull(),             // LearningMetadata
  extraction: jsonb('extraction'),                   // ExtractionConfig (Heavy-Pipeline-Strategie); NULL = Default hybrid
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});

/**
 * Training-Examples aus `learning/examples.ts` —
 * frueher `data/extraction-projects/<id>/examples/<ex-id>.yaml`.
 */
export const extractionExamples = extractionSchema.table('examples', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => extractionProjects.id, { onDelete: 'cascade' }),
  sourceFilename: text('source_filename').notNull(),
  documentText: text('document_text').notNull(),
  initialExtraction: jsonb('initial_extraction').notNull(),
  correctedExtraction: jsonb('corrected_extraction').notNull(),
  corrections: jsonb('corrections').notNull(),       // Array<{field, was, corrected_to}>
  confirmedCorrect: text('confirmed_correct').notNull().default('false'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  projectIdx: index('extraction_examples_project_idx').on(t.projectId),
}));

/**
 * Batch-Läufe der manuellen Verarbeitungs-UI ("Verarbeiten"-Tab):
 * 1 Zeile je Stapel-Extraktion eines Projekts. Die Pro-Datei-Ergebnisse liegen
 * in `extraction.batch_run_files`.
 */
export const extractionBatchRuns = extractionSchema.table('batch_runs', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => extractionProjects.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'),  // pending|processing|completed|failed
  fileCount: integer('file_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  projectIdx: index('extraction_batch_runs_project_idx').on(t.projectId),
}));

/**
 * Pro-Datei-Ergebnis eines Batch-Laufs. `detail` (boxes + pageImages) ist schwer
 * (base64-PNGs) und wird im Summary-Select bewusst ausgelassen — nur der Detail-
 * Endpoint liest es.
 */
export const extractionBatchRunFiles = extractionSchema.table('batch_run_files', {
  id: text('id').primaryKey(),
  batchRunId: text('batch_run_id').notNull().references(() => extractionBatchRuns.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  status: text('status').notNull().default('pending'),  // pending|processing|completed|failed
  extractedData: jsonb('extracted_data'),               // Record<fieldId, value>
  fieldConfidences: jsonb('field_confidences'),         // Record<fieldId, number>
  strategy: text('strategy'),                           // strategyUsed
  error: text('error'),
  detail: jsonb('detail'),                              // { boxes, pageImages } — nur on-demand
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  batchIdx: index('extraction_batch_run_files_batch_idx').on(t.batchRunId),
}));
