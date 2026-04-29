-- Phase 2-Projects: projects.projects-Schema umgebaut + memory + kb_links Tabellen.
DROP INDEX IF EXISTS "projects_owner_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "project_members_pk_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "project_members_user_idx";--> statement-breakpoint
DROP TABLE IF EXISTS "projects"."project_members";--> statement-breakpoint
ALTER TABLE "projects"."projects" DROP COLUMN IF EXISTS "owner_id";--> statement-breakpoint
ALTER TABLE "projects"."projects" DROP COLUMN IF EXISTS "metadata";--> statement-breakpoint
ALTER TABLE "projects"."projects" ADD COLUMN IF NOT EXISTS "icon" text;--> statement-breakpoint
ALTER TABLE "projects"."projects" ADD COLUMN IF NOT EXISTS "color" text;--> statement-breakpoint
ALTER TABLE "projects"."projects" ADD COLUMN IF NOT EXISTS "created_by" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "projects"."projects" ADD COLUMN IF NOT EXISTS "archived" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "projects"."projects" ADD COLUMN IF NOT EXISTS "members" jsonb NOT NULL DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "projects"."projects" ADD COLUMN IF NOT EXISTS "settings" jsonb NOT NULL DEFAULT '{}'::jsonb;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_archived_idx" ON "projects"."projects" USING btree ("archived");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "projects"."memory" (
	"project_id" text PRIMARY KEY NOT NULL,
	"about" jsonb NOT NULL DEFAULT '[]'::jsonb,
	"instructions" jsonb NOT NULL DEFAULT '[]'::jsonb,
	"context" jsonb NOT NULL DEFAULT '[]'::jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projects"."memory" ADD CONSTRAINT "projects_memory_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "projects"."kb_links" (
	"project_id" text PRIMARY KEY NOT NULL,
	"collections" jsonb NOT NULL DEFAULT '[]'::jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projects"."kb_links" ADD CONSTRAINT "projects_kb_links_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
