import { pgSchema, text, timestamp, boolean, jsonb, index } from 'drizzle-orm/pg-core';

export const notificationsSchema = pgSchema('notifications');

export const notifications = notificationsSchema.table('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  kind: text('kind').notNull(),                     // task_done | mention | system | ...
  title: text('title').notNull(),
  body: text('body'),
  payload: jsonb('payload'),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index('notifications_user_idx').on(t.userId, t.isRead, t.createdAt),
}));
