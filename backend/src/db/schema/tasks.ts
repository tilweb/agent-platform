import { pgSchema, text, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core';

export const tasksSchema = pgSchema('tasks');

export const tasks = tasksSchema.table('tasks', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  status: text('status').notNull(),                 // queued | running | done | failed | cancelled
  kind: text('kind').notNull(),
  payload: jsonb('payload').notNull(),
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(3),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true, mode: 'string' }),
  startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' }),
  finishedAt: timestamp('finished_at', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  statusIdx: index('tasks_status_idx').on(t.status),
  userIdx: index('tasks_user_idx').on(t.userId),
  scheduledIdx: index('tasks_scheduled_idx').on(t.scheduledAt),
}));

export const taskResults = tasksSchema.table('task_results', {
  taskId: text('task_id').primaryKey().references(() => tasks.id, { onDelete: 'cascade' }),
  result: jsonb('result'),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});
