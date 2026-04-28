import { pgSchema, text, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core';

export const wzbarSchema = pgSchema('wzbar');

export const wzbarMatches = wzbarSchema.table('matches', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  inputText: text('input_text').notNull(),
  result: jsonb('result').notNull(),                // {primary, alternatives}
  retrievalTopK: jsonb('retrieval_top_k'),
  llmModel: text('llm_model'),
  embeddingModel: text('embedding_model'),
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index('wzbar_matches_user_idx').on(t.userId, t.createdAt),
  createdIdx: index('wzbar_matches_created_idx').on(t.createdAt),
}));
