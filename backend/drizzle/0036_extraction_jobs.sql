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
CREATE INDEX IF NOT EXISTS extraction_jobs_ready_idx ON extraction.jobs(state, lease_until, created_at);

CREATE TABLE IF NOT EXISTS extraction.model_slots (
  model_key text NOT NULL,
  slot integer NOT NULL,
  token text NOT NULL,
  lease_until timestamptz NOT NULL,
  PRIMARY KEY(model_key, slot)
);
