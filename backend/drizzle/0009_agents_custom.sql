-- Custom-Agents pro Instanz in der DB statt File-System.
-- System-Agenten (supervisor, general, kb-indexer, ...) bleiben weiter
-- als Files unter data/agents/ — die sind code-versioniert und in jedem
-- Build identisch. Custom-Agenten (UI-erstellt, kunden-spezifisch)
-- liegen ab jetzt hier.

CREATE SCHEMA IF NOT EXISTS "agents";

CREATE TABLE IF NOT EXISTS "agents"."custom" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "config_md" text NOT NULL,
  "frontmatter" jsonb NOT NULL,
  "created_by" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "agents_custom_name_idx"
  ON "agents"."custom" ("name");
