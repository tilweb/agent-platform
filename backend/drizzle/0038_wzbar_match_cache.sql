-- Ergebnis-Cache fuer den WZ-Branchen-Matcher: identische (normalisierte)
-- Eingabe + gleiche Pipeline-Version -> gespeichertes Ergebnis wiederverwenden
-- statt neu rechnen. Additiv und replay-sicher.
ALTER TABLE wzbar.matches ADD COLUMN IF NOT EXISTS input_hash text;
--> statement-breakpoint
ALTER TABLE wzbar.matches ADD COLUMN IF NOT EXISTS pipeline_version text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS wzbar_matches_cache_idx ON wzbar.matches USING btree (input_hash, pipeline_version, created_at);
