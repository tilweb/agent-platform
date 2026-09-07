-- Reconcile installations that recorded earlier versions of 0035/0036.
-- Additive and replay-safe; existing examples, results and jobs are preserved.
ALTER TABLE extraction.examples ADD COLUMN IF NOT EXISTS dataset jsonb;
--> statement-breakpoint
ALTER TABLE extraction.batch_runs ADD COLUMN IF NOT EXISTS snapshot jsonb;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS extraction.evaluations (
  id text PRIMARY KEY NOT NULL,
  project_id text NOT NULL REFERENCES extraction.projects(id) ON DELETE CASCADE,
  artifact jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS extraction_evaluations_project_idx ON extraction.evaluations(project_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS extraction.jobs (
  run_id text PRIMARY KEY REFERENCES extraction.batch_runs(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'pending',
  user_id text,
  token text,
  lease_until timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  generation integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE extraction.jobs ADD COLUMN IF NOT EXISTS generation integer NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS extraction_jobs_ready_idx ON extraction.jobs(state, lease_until, created_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS extraction.model_slots (
  model_key text NOT NULL,
  slot integer NOT NULL,
  token text NOT NULL,
  lease_until timestamptz NOT NULL,
  PRIMARY KEY(model_key, slot)
);
