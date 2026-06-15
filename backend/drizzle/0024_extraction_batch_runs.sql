-- Manuelle Batch-Extraktion ("Verarbeiten"-Tab): Lauf-Historie pro Projekt.
-- batch_runs = 1 Zeile je Stapel-Lauf; batch_run_files = 1 Zeile je Dokument.
-- detail (boxes + pageImages) ist schwer und wird nur on-demand gelesen.

CREATE TABLE IF NOT EXISTS "extraction"."batch_runs" (
  "id"            text PRIMARY KEY NOT NULL,
  "project_id"    text NOT NULL,
  "status"        text NOT NULL DEFAULT 'pending',   -- pending|processing|completed|failed
  "file_count"    integer NOT NULL DEFAULT 0,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"    timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "extraction_batch_runs_project_idx"
  ON "extraction"."batch_runs" ("project_id");

CREATE TABLE IF NOT EXISTS "extraction"."batch_run_files" (
  "id"                text PRIMARY KEY NOT NULL,
  "batch_run_id"      text NOT NULL,
  "filename"          text NOT NULL,
  "status"            text NOT NULL DEFAULT 'pending', -- pending|processing|completed|failed
  "extracted_data"    jsonb,
  "field_confidences" jsonb,
  "strategy"          text,
  "error"             text,
  "detail"            jsonb,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"        timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "extraction_batch_run_files_batch_idx"
  ON "extraction"."batch_run_files" ("batch_run_id");
