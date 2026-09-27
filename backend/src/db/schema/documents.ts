/**
 * Dokumentvorlagen (pgSchema 'documents') — Word-Vorlagen für Exporte aus dem Chat.
 *
 * kind = 'design':    CD-Hülle (Kopf/Fuß, Logo, Formatvorlagen), freier Markdown-Inhalt
 *                     an {{INHALT}}. Nur Admins; genau eine kann Instanz-Default sein.
 * kind = 'structure': feste Felder {{…}} mit Feldkatalog (Phase 2), auch nutzereigen.
 *
 * Das Original liegt unverändert in S3 (s3Paths.docTemplate); `inspection` hält das
 * Prüfergebnis vom Upload (Platzhalter, fehlende Formatvorlagen) für die UI.
 * Konzept: docs/word-vorlagen-2026-09-25.md
 */
import { pgSchema, text, timestamp, integer, jsonb, boolean, index } from 'drizzle-orm/pg-core';

export const documentsSchema = pgSchema('documents');

export const docTemplates = documentsSchema.table('templates', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),                      // design | structure
  name: text('name').notNull(),
  description: text('description'),
  ownerUserId: text('owner_user_id'),
  filename: text('filename').notNull(),
  s3Key: text('s3_key').notNull(),
  sizeBytes: integer('size_bytes'),
  isDefault: boolean('is_default').notNull().default(false),
  inspection: jsonb('inspection'),
  fields: jsonb('fields').notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  kindIdx: index('doc_templates_kind_idx').on(t.kind),
  ownerIdx: index('doc_templates_owner_idx').on(t.ownerUserId),
}));
