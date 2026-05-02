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
  // Phase-1-Felder (single-file, behaltet wir fuer Backwards-Compat — neue
  // Multi-File-Vertraege fuellen primaryAttachmentId statt dieser Felder).
  uploadFilename: text('upload_filename').notNull(),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true, mode: 'string' }).notNull(),
  uploadedBy: text('uploaded_by').notNull(),
  s3KeyDocument: text('s3_key_document'),
  s3KeyOriginal: text('s3_key_original'),
  originalSizeBytes: integer('original_size_bytes'),
  extracted: jsonb('extracted'),
  computed: jsonb('computed'),
  obligations: jsonb('obligations'),
  metadata: jsonb('metadata'),
  // Multi-File / Auto-Detection / Provenance — Phase 2.
  primaryAttachmentId: text('primary_attachment_id'),       // Hauptvertrag-FK in contract_attachments
  typeDetection: jsonb('type_detection'),                   // { detected, confidence, alternatives, user_corrected, corrected_at }
  provenance: jsonb('provenance'),                          // { fieldKey: [attachmentId, ...] } — woraus stammt jeder Wert
  extractedHistory: jsonb('extracted_history'),             // [{ extracted, contract_type, mapped_at }] — bei Re-Extraktion archiviert
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  uploadedByIdx: index('contracts_uploaded_by_idx').on(t.uploadedBy),
  typeIdx: index('contracts_type_idx').on(t.contractType),
}));

/**
 * Mehrere Anhaenge pro Vertrag (Hauptvertrag + Anlagen + Toolbox + …).
 * Phase 2 — bei single-file-Vertraegen aus Phase 1 bleibt diese Tabelle leer
 * und der Vertrag nutzt weiterhin contracts.uploadFilename + s3KeyOriginal.
 */
export const contractAttachments = vertragsmgmtSchema.table('contract_attachments', {
  id: text('id').primaryKey(),
  contractId: text('contract_id').notNull(),                // FK auf contracts.id (Cascade-Delete via Migration)
  filename: text('filename').notNull(),
  contentType: text('content_type'),
  s3KeyOriginal: text('s3_key_original').notNull(),         // Original-Upload
  s3KeyMarkdown: text('s3_key_markdown'),                   // Markitdown-Output (fuer schnelle Re-Extraktion ohne neuen LLM-Call)
  sizeBytes: integer('size_bytes'),
  /** 'hauptvertrag' | 'anhang' | 'toolbox' | 'korrespondenz' | 'sonstiges' — vom Klassifikator vorgeschlagen, vom User korrigierbar. */
  documentRole: text('document_role').notNull().default('sonstiges'),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  contractIdx: index('contract_attachments_contract_idx').on(t.contractId),
}));
