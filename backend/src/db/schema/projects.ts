import { pgSchema, text, timestamp, jsonb, boolean, index } from 'drizzle-orm/pg-core';

export const projectsSchema = pgSchema('projects');

/**
 * Projekt-Stammdaten. Members + Settings als jsonb-Felder direkt in der Row.
 * Member-Liste ist UI-First-Class (zeigt Avatare etc.); kanonische Access-Checks
 * laufen ueber `auth.resource_access` (RBAC), die parallel synchron gehalten wird.
 */
export const projects = projectsSchema.table('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon'),
  color: text('color'),
  createdBy: text('created_by').notNull(),
  archived: boolean('archived').notNull().default(false),
  members: jsonb('members').notNull().default([] as never),     // ProjectMember[]
  settings: jsonb('settings').notNull(),                          // ProjectSettings
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  archivedIdx: index('projects_archived_idx').on(t.archived),
}));

/**
 * Projekt-Memory: about/instructions/context als jsonb-Listen pro Projekt.
 * 1:1 mit projects.projects via PK = projectId.
 */
export const projectMemory = projectsSchema.table('memory', {
  projectId: text('project_id').primaryKey().references(() => projects.id, { onDelete: 'cascade' }),
  about: jsonb('about').notNull().default([] as never),
  instructions: jsonb('instructions').notNull().default([] as never),
  context: jsonb('context').notNull().default([] as never),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});

/**
 * KB-Links: Liste verlinkter Knowledge-Base-Collections pro Projekt.
 */
export const projectKbLinks = projectsSchema.table('kb_links', {
  projectId: text('project_id').primaryKey().references(() => projects.id, { onDelete: 'cascade' }),
  collections: jsonb('collections').notNull().default([] as never),  // KBCollectionLink[]
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});
