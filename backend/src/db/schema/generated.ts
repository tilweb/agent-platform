import { pgSchema, text, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core';

export const generatedSchema = pgSchema('generated');

export const generatedImages = generatedSchema.table('images', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  prompt: text('prompt'),
  providerId: text('provider_id'),
  modelId: text('model_id'),
  s3Key: text('s3_key').notNull(),
  contentType: text('content_type').notNull().default('image/png'),
  sizeBytes: integer('size_bytes'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index('generated_images_user_idx').on(t.userId, t.createdAt),
}));

export const exports = generatedSchema.table('exports', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  kind: text('kind').notNull(),                     // pdf | docx | xlsx | ...
  filename: text('filename'),
  s3Key: text('s3_key').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index('exports_user_idx').on(t.userId, t.createdAt),
  expiresIdx: index('exports_expires_idx').on(t.expiresAt),
}));
