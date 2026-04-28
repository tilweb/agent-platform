import { pgSchema, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

export const vsmSchema = pgSchema('vsm');

export const vsmProjekte = vsmSchema.table('projekte', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id'),
  name: text('name').notNull(),
  data: jsonb('data').notNull(),                    // komplette VSM-Diagramm-Struktur
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  ownerIdx: index('vsm_projekte_owner_idx').on(t.ownerId),
}));
