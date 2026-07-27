-- Audit-Metadaten je Batch-Datei (Welle 2): mit welchem Regel-Stand (guideline_version),
-- Modell und Strategie das Ergebnis erzeugt wurde. Additiv, kein Backfill noetig.
ALTER TABLE "extraction"."batch_run_files" ADD COLUMN IF NOT EXISTS "audit" jsonb;
