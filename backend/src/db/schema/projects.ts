import { pgSchema, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

export const projectsSchema = pgSchema('projects');

export const projects = projectsSchema.table('projects', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  ownerIdx: index('projects_owner_idx').on(t.ownerId),
}));

export const projectMembers = projectsSchema.table('project_members', {
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  role: text('role').notNull().default('member'),
  addedAt: timestamp('added_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  pk: index('project_members_pk_idx').on(t.projectId, t.userId),
  userIdx: index('project_members_user_idx').on(t.userId),
}));
