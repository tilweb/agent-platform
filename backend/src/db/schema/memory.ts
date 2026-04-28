import { pgSchema, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

export const memorySchema = pgSchema('memory');

export const userMemory = memorySchema.table('user', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  key: text('key').notNull(),
  value: jsonb('value').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  userKeyIdx: index('user_memory_user_key_idx').on(t.userId, t.key),
}));

export const sessionMemory = memorySchema.table('session', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  key: text('key').notNull(),
  value: jsonb('value').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  sessionKeyIdx: index('session_memory_key_idx').on(t.sessionId, t.key),
}));
