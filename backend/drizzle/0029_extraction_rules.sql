-- Fachliche Pruefregeln (Welle 5): Summen-Check (Positionen ↔ Zielfeld) und
-- Stammdaten-Abgleich (Tables) je Projekt; Befunde je Batch-Datei.
-- Additiv, kein Backfill — Projekte ohne Regeln verhalten sich wie bisher.
ALTER TABLE "extraction"."projects" ADD COLUMN IF NOT EXISTS "rules" jsonb;
ALTER TABLE "extraction"."batch_run_files" ADD COLUMN IF NOT EXISTS "validations" jsonb;
