-- Optimistic Concurrency Control: version-Spalten zu allen drei PM-Entitaeten.
-- Default 1, NOT NULL — bei jedem Update wird der Counter atomar via
-- compare-and-swap inkrementiert (UPDATE ... WHERE id AND version = expected).

ALTER TABLE "projektmgmt"."projektideen"
  ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint

ALTER TABLE "projektmgmt"."projektauftraege"
  ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint

ALTER TABLE "projektmgmt"."statusberichte"
  ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;
