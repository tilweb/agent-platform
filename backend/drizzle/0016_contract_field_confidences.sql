-- Phase D / P4 — Heavy-Extraction-Pipeline-Output persistieren.
-- Drei zusaetzliche jsonb-/text-Spalten auf `vertragsmgmt.contracts`:
--   field_confidences      Map dotted-path → [0..1]
--   extraction_provenance  Liste an FieldProvenance-Eintraegen
--   extraction_strategy    text — welche Strategy zuletzt lief
-- Idempotent (ADD COLUMN IF NOT EXISTS).

ALTER TABLE "vertragsmgmt"."contracts" ADD COLUMN IF NOT EXISTS "field_confidences" jsonb;
ALTER TABLE "vertragsmgmt"."contracts" ADD COLUMN IF NOT EXISTS "extraction_provenance" jsonb;
ALTER TABLE "vertragsmgmt"."contracts" ADD COLUMN IF NOT EXISTS "extraction_strategy" text;
