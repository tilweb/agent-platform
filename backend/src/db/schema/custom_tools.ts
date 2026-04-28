import { pgSchema, text, timestamp, boolean, jsonb, index } from 'drizzle-orm/pg-core';

export const customToolsSchema = pgSchema('custom_tools');

export const customTools = customToolsSchema.table('tools', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  config: jsonb('config').notNull(),                // Method, URL, headers, parameters, auth, etc.
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  enabledIdx: index('custom_tools_enabled_idx').on(t.enabled),
}));
