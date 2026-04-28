import { pgSchema, text, timestamp, jsonb, integer, index } from 'drizzle-orm/pg-core';

export const liefermgmtSchema = pgSchema('liefermgmt');

export const suppliers = liefermgmtSchema.table('suppliers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  data: jsonb('data').notNull(),                    // alle Stammdaten + Bewertung
  status: text('status'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  nameIdx: index('suppliers_name_idx').on(t.name),
  statusIdx: index('suppliers_status_idx').on(t.status),
}));

export const supplierDocuments = liefermgmtSchema.table('documents', {
  id: text('id').primaryKey(),
  supplierId: text('supplier_id').notNull().references(() => suppliers.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  contentType: text('content_type'),
  sizeBytes: integer('size_bytes'),
  s3Key: text('s3_key').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  supplierIdx: index('supplier_documents_supplier_idx').on(t.supplierId),
}));

export const audits = liefermgmtSchema.table('audits', {
  id: text('id').primaryKey(),
  supplierId: text('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
  data: jsonb('data').notNull(),
  status: text('status'),
  scheduledFor: timestamp('scheduled_for', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  supplierIdx: index('audits_supplier_idx').on(t.supplierId),
}));

export const auditPlans = liefermgmtSchema.table('audit_plans', {
  jahr: integer('jahr').primaryKey(),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});

export const supplierChangelog = liefermgmtSchema.table('changelog', {
  id: text('id').primaryKey(),
  supplierId: text('supplier_id').references(() => suppliers.id, { onDelete: 'cascade' }),
  userId: text('user_id'),
  action: text('action').notNull(),
  diff: jsonb('diff'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  supplierIdx: index('lief_changelog_supplier_idx').on(t.supplierId, t.createdAt),
}));
