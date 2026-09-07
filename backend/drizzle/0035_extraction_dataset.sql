ALTER TABLE "extraction"."examples" ADD COLUMN "dataset" jsonb;
--> statement-breakpoint
ALTER TABLE "extraction"."batch_runs" ADD COLUMN "snapshot" jsonb;
--> statement-breakpoint
CREATE TABLE "extraction"."evaluations" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "extraction"."projects"("id") ON DELETE CASCADE,
  "artifact" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "extraction_evaluations_project_idx" ON "extraction"."evaluations" ("project_id");
--> statement-breakpoint
