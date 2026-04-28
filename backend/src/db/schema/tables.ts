import { pgSchema, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

export const tablesSchema = pgSchema('tables');

export const userTables = tablesSchema.table('tables', {
  id: text('id').primaryKey(),                      // table-name slug
  ownerId: text('owner_id'),
  name: text('name').notNull(),
  description: text('description'),
  schema: jsonb('schema').notNull(),                // {fields: [...]} aus dem alten YAML
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  ownerIdx: index('user_tables_owner_idx').on(t.ownerId),
}));

export const userTableRows = tablesSchema.table('rows', {
  id: text('id').primaryKey(),
  tableId: text('table_id').notNull().references(() => userTables.id, { onDelete: 'cascade' }),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  tableIdx: index('user_table_rows_table_idx').on(t.tableId),
  // GIN-Index auf JSONB-Daten — wertvoll fuer Filter, manuell anlegbar in einer Folge-Migration.
}));
