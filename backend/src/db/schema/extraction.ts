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

export const extractionProjects = extractionSchema.table('projects', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id'),
  profileId: text('profile_id').references(() => extractionProfiles.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  documents: jsonb('documents'),                    // [{name, s3Key, status, extractedAt, ...}]
  result: jsonb('result'),
  status: text('status').notNull().default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  ownerIdx: index('extraction_projects_owner_idx').on(t.ownerId),
  profileIdx: index('extraction_projects_profile_idx').on(t.profileId),
}));
