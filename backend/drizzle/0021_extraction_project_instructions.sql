-- Stabile, hand-gepflegte Domaenen-Anweisungen pro Extraktions-Projekt.
-- Anders als `guidelines` wird `instructions` vom Lern-Loop NICHT ueberschrieben.
-- Idempotent: ADD COLUMN IF NOT EXISTS.

ALTER TABLE "extraction"."projects" ADD COLUMN IF NOT EXISTS "instructions" text;
