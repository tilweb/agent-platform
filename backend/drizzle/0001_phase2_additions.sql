-- Phase 2 additive migration:
--  * `auth.oauth_states.code_verifier` Spalte (PKCE-Support)
--  * `auth.resource_access` Tabelle (RBAC -> ersetzt access.yaml)
--  * `extraction.projects` neu strukturiert (vorher Document-Extraction-Projekte;
--    jetzt Learning-Projekte aus extraction/learning/)
--  * `extraction.examples` Tabelle (Training-Examples fuer Few-Shot-Prompts)

ALTER TABLE "auth"."oauth_states" ADD COLUMN IF NOT EXISTS "code_verifier" text;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "auth"."resource_access" (
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"principal_type" text NOT NULL,
	"principal_id" text NOT NULL,
	"role" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"granted_by" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resource_access_resource_idx" ON "auth"."resource_access" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resource_access_principal_idx" ON "auth"."resource_access" USING btree ("principal_type","principal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resource_access_pk_idx" ON "auth"."resource_access" USING btree ("resource_type","resource_id","principal_type","principal_id");--> statement-breakpoint

-- extraction.projects: alte Spalten weg, neue Spalten rein.
-- (kein Production-Datenbestand auf dem alten Format -> hard reset ist OK)
DROP INDEX IF EXISTS "extraction_projects_owner_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "extraction_projects_profile_idx";--> statement-breakpoint
ALTER TABLE "extraction"."projects" DROP COLUMN IF EXISTS "owner_id";--> statement-breakpoint
ALTER TABLE "extraction"."projects" DROP COLUMN IF EXISTS "profile_id";--> statement-breakpoint
ALTER TABLE "extraction"."projects" DROP COLUMN IF EXISTS "documents";--> statement-breakpoint
ALTER TABLE "extraction"."projects" DROP COLUMN IF EXISTS "result";--> statement-breakpoint
ALTER TABLE "extraction"."projects" DROP COLUMN IF EXISTS "status";--> statement-breakpoint
ALTER TABLE "extraction"."projects" ADD COLUMN IF NOT EXISTS "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "extraction"."projects" ADD COLUMN IF NOT EXISTS "fields" jsonb NOT NULL DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "extraction"."projects" ADD COLUMN IF NOT EXISTS "guidelines" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "extraction"."projects" ADD COLUMN IF NOT EXISTS "learning" jsonb NOT NULL DEFAULT '{}'::jsonb;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "extraction"."examples" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"source_filename" text NOT NULL,
	"document_text" text NOT NULL,
	"initial_extraction" jsonb NOT NULL,
	"corrected_extraction" jsonb NOT NULL,
	"corrections" jsonb NOT NULL,
	"confirmed_correct" text DEFAULT 'false' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "extraction"."examples" ADD CONSTRAINT "extraction_examples_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "extraction"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "extraction_examples_project_idx" ON "extraction"."examples" USING btree ("project_id");
