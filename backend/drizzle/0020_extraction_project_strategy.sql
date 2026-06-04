-- P1 — Heavy-Pipeline-Strategie pro Extraktions-Projekt.
-- Neue jsonb-Spalte `extraction` an `extraction.projects` — NULL = Default
-- (hybrid, aufgeloest im Adapter backend/src/extraction/learning/pipeline-adapter.ts).
-- Idempotent: ADD COLUMN IF NOT EXISTS.

ALTER TABLE "extraction"."projects" ADD COLUMN IF NOT EXISTS "extraction" jsonb;
