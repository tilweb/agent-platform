import { pgSchema, text, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core';

export const vertragsmgmtSchema = pgSchema('vertragsmgmt');

export const contractSchemas = vertragsmgmtSchema.table('schemas', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  icon: text('icon'),
  fields: jsonb('fields').notNull(),
  mapping: jsonb('mapping').notNull(),
  isSystem: text('is_system').notNull().default('false'),  // 'true' fuer im-Code-Schemas
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});

export const contracts = vertragsmgmtSchema.table('contracts', {
  id: text('id').primaryKey(),
  contractType: text('contract_type'),
  uploadFilename: text('upload_filename').notNull(),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true, mode: 'string' }).notNull(),
  uploadedBy: text('uploaded_by').notNull(),
  s3KeyDocument: text('s3_key_document'),           // konvertierter Markdown-Text
  s3KeyOriginal: text('s3_key_original'),           // Original PDF/DOCX
  originalSizeBytes: integer('original_size_bytes'),
  extracted: jsonb('extracted'),
  computed: jsonb('computed'),                      // {party_a, party_b, dates, status, ...}
  obligations: jsonb('obligations'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  uploadedByIdx: index('contracts_uploaded_by_idx').on(t.uploadedBy),
  typeIdx: index('contracts_type_idx').on(t.contractType),
}));
