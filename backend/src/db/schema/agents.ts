import { pgSchema, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

/**
 * Custom-Agents je Instanz — pro Postgres-DB getrennt.
 *
 * System-Agenten (supervisor, general, kb-indexer, ...) bleiben als Files
 * unter `data/agents/`, weil Code-versioniert. Alles was zur Runtime in
 * der UI angelegt wird oder kunden-/instanz-spezifisch ist, lebt hier.
 *
 * `configMd` enthaelt das komplette Agent-File mit Frontmatter + System-
 * Prompt — gleiche Format wie die File-Variante, damit der Loader
 * unveraenderbare Logik haben kann (parseFrontmatter laeuft auf beiden).
 */
export const agentsSchema = pgSchema('agents');

export const customAgents = agentsSchema.table('custom', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  configMd: text('config_md').notNull(),
  // Cached frontmatter fuer schnelle Listen-Queries ohne YAML-Parse.
  // Wird beim Save aus configMd extrahiert.
  frontmatter: jsonb('frontmatter').notNull(),
  // Optional: User-ID des Erstellers fuer Audit. Nicht mit RBAC-Owner
  // zu verwechseln — Permissions liegen in auth.resource_access.
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  nameIdx: index('agents_custom_name_idx').on(t.name),
}));
