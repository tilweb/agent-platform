import { pgSchema, text, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core';

export const kbSchema = pgSchema('kb');

export const kbCollections = kbSchema.table('collections', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  activateWhen: jsonb('activate_when'),
  neverActivateWhen: jsonb('never_activate_when'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});

export const kbDocuments = kbSchema.table('documents', {
  id: text('id').primaryKey(),
  collectionId: text('collection_id').notNull().references(() => kbCollections.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  title: text('title'),
  contentType: text('content_type'),
  sizeBytes: integer('size_bytes'),
  s3KeyContent: text('s3_key_content'),             // content.md im Bucket
  s3KeyIndex: text('s3_key_index'),                  // INDEX.md (optional, fuer grosse Docs)
  metaMd: text('meta_md'),                           // DOCUMENT_META.md (klein, in DB)
  keywords: jsonb('keywords'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  collectionIdx: index('kb_documents_collection_idx').on(t.collectionId),
}));

export const kbIndexerState = kbSchema.table('indexer_state', {
  id: text('id').primaryKey(),                       // upload-id or task-id
  status: text('status').notNull(),                  // queued | converting | analyzing | done | failed
  collectionId: text('collection_id'),
  filename: text('filename'),
  progress: integer('progress').notNull().default(0),
  error: text('error'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  statusIdx: index('kb_indexer_state_status_idx').on(t.status),
}));
