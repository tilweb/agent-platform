import { pgSchema, text, timestamp, boolean, jsonb, index } from 'drizzle-orm/pg-core';

export const customSkillsSchema = pgSchema('custom_skills');

export const customSkills = customSkillsSchema.table('skills', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  enabled: boolean('enabled').notNull().default(true),
  config: jsonb('config').notNull(),                // YAML-Frontmatter + Markdown body
  body: text('body'),                                // optional markdown body separat
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  enabledIdx: index('custom_skills_enabled_idx').on(t.enabled),
}));
