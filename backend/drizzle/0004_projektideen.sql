-- Phase 3-Projektideen: separate Entitaet fuer Projektideen.
-- Verknuepfung zu Auftraegen ueber projektauftraege.idee_id (FK, nullable).

CREATE TABLE IF NOT EXISTS "projektmgmt"."projektideen" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text,
	"name" text NOT NULL,
	"status" text NOT NULL DEFAULT 'draft',
	"data" jsonb NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idee_owner_idx" ON "projektmgmt"."projektideen" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idee_status_idx" ON "projektmgmt"."projektideen" USING btree ("status");--> statement-breakpoint

ALTER TABLE "projektmgmt"."projektauftraege" ADD COLUMN IF NOT EXISTS "idee_id" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pa_idee_idx" ON "projektmgmt"."projektauftraege" USING btree ("idee_id");
