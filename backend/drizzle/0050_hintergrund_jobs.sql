-- Document Processing S1 — generische Hintergrund-Jobs (Posteingang, Vorgang-Upload, Evaluation) und
-- Lebenszeichen des Worker-Prozesses. Konzept docs/konzept-document-processing-dienst-2026-09-25.md §11.
-- Batch-Laeufe bleiben in extraction.jobs. Idempotent (IF NOT EXISTS), wird von migrate() beim Boot angewendet.

CREATE TABLE IF NOT EXISTS extraction.hintergrund_jobs (
  id text PRIMARY KEY,
  art text NOT NULL,
  schluessel text NOT NULL,
  nutzlast jsonb NOT NULL DEFAULT '{}'::jsonb,
  state text NOT NULL DEFAULT 'pending',
  prioritaet integer NOT NULL DEFAULT 1,
  user_id text,
  token text,
  lease_until timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  error text,
  ergebnis jsonb,
  fortschritt jsonb,
  bearbeiter text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS extraction_hintergrund_jobs_ready_idx ON extraction.hintergrund_jobs(state, prioritaet, created_at);--> statement-breakpoint
-- Hoechstens ein offener Job je Schluessel (z. B. „inbox:<uploadId>"); abgeschlossene duerfen erneut eingestellt werden.
CREATE UNIQUE INDEX IF NOT EXISTS extraction_hintergrund_jobs_offen_uq ON extraction.hintergrund_jobs(schluessel) WHERE state IN ('pending', 'running');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS extraction.worker_status (
  prozess text PRIMARY KEY,
  zuletzt timestamptz NOT NULL DEFAULT now(),
  info jsonb NOT NULL DEFAULT '{}'::jsonb
);
