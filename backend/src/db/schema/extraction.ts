import { pgSchema, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

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
