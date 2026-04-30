import { pgSchema, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';

export const appsSchema = pgSchema('apps');

/**
 * Persistierte App-Registrierung. Built-in apps werden via syncBuiltInApps()
 * idempotent eingespielt; admin enable/disable wird hier persistiert. Der
 * ENABLED_APPS-ENV-Filter wirkt zur Laufzeit, nicht in dieser Tabelle.
 */
export const appsRegistry = appsSchema.table('registry', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon'),
  version: text('version'),
  enabled: boolean('enabled').notNull().default(true),
  routes: jsonb('routes').notNull(),                // [{path, component}]
  // Gruppen-basierte Berechtigungen: { groups: [{ groupId, role }] }.
  // Leer = "noch nicht konfiguriert" — User die nicht admin sind sehen
  // beim Aufruf "Wartet auf Konfiguration".
  permissions: jsonb('permissions'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});
