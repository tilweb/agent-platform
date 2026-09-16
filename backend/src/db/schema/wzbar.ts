import { pgSchema, text, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core';

export const wzbarSchema = pgSchema('wzbar');

export const wzbarMatches = wzbarSchema.table('matches', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  inputText: text('input_text').notNull(),
  result: jsonb('result').notNull(),                // {activities: [{activity, result: {primary, alternatives}, retrievalTopK}]}
  retrievalTopK: jsonb('retrieval_top_k'),
  llmModel: text('llm_model'),
  embeddingModel: text('embedding_model'),
  durationMs: integer('duration_ms'),
  inputHash: text('input_hash'),                    // sha256 des normalisierten inputText (Ergebnis-Cache)
  pipelineVersion: text('pipeline_version'),        // Cache nur bei identischer Pipeline-Version
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index('wzbar_matches_user_idx').on(t.userId, t.createdAt),
  createdIdx: index('wzbar_matches_created_idx').on(t.createdAt),
  cacheIdx: index('wzbar_matches_cache_idx').on(t.inputHash, t.pipelineVersion, t.createdAt),
}));
