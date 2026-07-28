-- Review-Workflow im Batch (Welle 3): document_text als Trainings-Grundlage fuer
-- "Uebernehmen & lernen" + Review-Triage-Status je Datei. Additiv, kein Backfill.
ALTER TABLE "extraction"."batch_run_files" ADD COLUMN IF NOT EXISTS "document_text" text;
ALTER TABLE "extraction"."batch_run_files" ADD COLUMN IF NOT EXISTS "review_status" text;
