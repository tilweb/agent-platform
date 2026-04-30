import { pgSchema, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

export const projektmgmtSchema = pgSchema('projektmgmt');

/**
 * Projektideen: leichtgewichtige Vorstufe zum Projektauftrag.
 * Eine Idee kann 0..n Projektauftraege auslösen (verlinkt via paProjektauftraege.ideeId).
 * Die Idee bleibt persistent — selbst wenn alle daraus abgeleiteten Auftraege entfernt
 * werden, bleibt sie als historische Vision-Spur erhalten.
 */
export const paProjektideen = projektmgmtSchema.table('projektideen', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id'),
  name: text('name').notNull(),
  status: text('status').notNull().default('draft'),  // draft | review | approved | rejected | archived
  data: jsonb('data').notNull(),                    // komplette Projektidee-Struktur
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  ownerIdx: index('idee_owner_idx').on(t.ownerId),
  statusIdx: index('idee_status_idx').on(t.status),
}));

export const paProjektauftraege = projektmgmtSchema.table('projektauftraege', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id'),
  name: text('name').notNull(),
  status: text('status').notNull().default('draft'),
  ideeId: text('idee_id'),                          // FK auf projektideen.id (nullable — Auftrag muss nicht aus Idee kommen)
  data: jsonb('data').notNull(),                    // komplette Projektauftrag-Struktur
  metadata: jsonb('metadata'),                      // erstellt/geaendert datums, version, ...
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  ownerIdx: index('pa_owner_idx').on(t.ownerId),
  statusIdx: index('pa_status_idx').on(t.status),
  ideeIdx: index('pa_idee_idx').on(t.ideeId),
}));

export const paStatusberichte = projektmgmtSchema.table('statusberichte', {
  id: text('id').primaryKey(),
  paId: text('pa_id').notNull().references(() => paProjektauftraege.id, { onDelete: 'cascade' }),
  reportDate: timestamp('report_date', { withTimezone: true, mode: 'string' }).notNull(),
  data: jsonb('data').notNull(),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  paIdx: index('pa_statusberichte_pa_idx').on(t.paId, t.reportDate),
}));

export const paVorlagen = projektmgmtSchema.table('vorlagen', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  data: jsonb('data').notNull(),
  isSystem: text('is_system').notNull().default('false'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});

export const paAttachments = projektmgmtSchema.table('attachments', {
  id: text('id').primaryKey(),
  paId: text('pa_id').notNull().references(() => paProjektauftraege.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  contentType: text('content_type'),
  s3Key: text('s3_key').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  paIdx: index('pa_attachments_pa_idx').on(t.paId),
}));
