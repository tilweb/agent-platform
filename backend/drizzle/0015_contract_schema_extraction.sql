-- Phase D / P2 — Heavy-Extraction-Pipeline-Konfiguration pro ContractSchema.
-- Neue jsonb-Spalte `extraction` an `vertragsmgmt.schemas` — NULL = Default
-- (single-pass mit Defaults aus backend/src/services/extraction/defaults.ts).
-- Idempotent: ADD COLUMN IF NOT EXISTS.

ALTER TABLE "vertragsmgmt"."schemas" ADD COLUMN IF NOT EXISTS "extraction" jsonb;
