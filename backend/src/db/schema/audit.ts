import { pgSchema, text, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core';

export const auditSchema = pgSchema('audit');

export const auditPublicApi = auditSchema.table('public_api', {
  id: text('id').primaryKey(),                       // requestId
  timestamp: timestamp('timestamp', { withTimezone: true, mode: 'string' }).notNull(),
  apiKeyId: text('api_key_id'),
  scopeType: text('scope_type'),
  scopeId: text('scope_id'),
  method: text('method').notNull(),
  path: text('path').notNull(),
  appId: text('app_id'),
  functionId: text('function_id'),
  status: integer('status').notNull(),
  errorCode: text('error_code'),
  durationMs: integer('duration_ms').notNull(),
}, (t) => ({
  timestampIdx: index('audit_public_api_timestamp_idx').on(t.timestamp),
  keyIdx: index('audit_public_api_key_idx').on(t.apiKeyId),
  appFnIdx: index('audit_public_api_app_fn_idx').on(t.appId, t.functionId),
}));

export const usageLog = auditSchema.table('usage_log', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  source: text('source'),                            // chat, agent, public_api, ...
  providerId: text('provider_id'),
  modelId: text('model_id'),
  promptTokens: integer('prompt_tokens'),
  completionTokens: integer('completion_tokens'),
  totalTokens: integer('total_tokens'),
  metadata: jsonb('metadata'),
  timestamp: timestamp('timestamp', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index('usage_log_user_idx').on(t.userId),
  timestampIdx: index('usage_log_timestamp_idx').on(t.timestamp),
  modelIdx: index('usage_log_model_idx').on(t.providerId, t.modelId),
}));
