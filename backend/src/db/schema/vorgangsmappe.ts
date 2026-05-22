import {
  pgSchema,
  text,
  integer,
  jsonb,
  timestamp,
  boolean,
  serial,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const vorgangsmappeSchema = pgSchema('vorgangsmappe');

export const vmDocumentTypes = vorgangsmappeSchema.table('document_types', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  bereich: text('bereich').notNull(),  // 'einkauf' | 'verkauf' | 'produktion' | 'sonstiges'
  matchAny: jsonb('match_any').notNull().default([]),  // string[] zum Match gegen DocuWare DOCUMENT_TYPE
  description: text('description'),
  statusgebend: boolean('statusgebend').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  bereichIdx: index('vm_doctypes_bereich_idx').on(t.bereich, t.sortOrder),
}));

export const vmIncoterms = vorgangsmappeSchema.table('incoterms', {
  code: text('code').primaryKey(),
  label: text('label').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});

export const vmRequiredDocumentMappings = vorgangsmappeSchema.table('required_document_mappings', {
  id: serial('id').primaryKey(),
  incoterm: text('incoterm').notNull(),
  geschaeftsart: text('geschaeftsart').notNull(),   // 'lager' | 'strecke'
  documentTypeId: text('document_type_id').notNull(),
  required: boolean('required').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  uniq: uniqueIndex('vm_mapping_unique').on(t.incoterm, t.geschaeftsart, t.documentTypeId),
  lookupIdx: index('vm_mapping_lookup_idx').on(t.incoterm, t.geschaeftsart),
}));
