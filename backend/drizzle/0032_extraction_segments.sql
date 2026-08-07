-- Segmentierung (Welle 10): typisierte Segmente INNERHALB eines Vorgangs.
-- `segments` am Profil = Record<string, SegmentTypeDef> (Prosa-Beschreibung +
-- Feldsatz je Typ); `segments` an der Batch-Datei = SegmentInstance[] des
-- Laufs. Additiv, kein Backfill — Profile ohne Segmente verhalten sich wie
-- bisher (ein impliziter Segmenttyp ueber alle Seiten).
ALTER TABLE "extraction"."projects" ADD COLUMN IF NOT EXISTS "segments" jsonb;
ALTER TABLE "extraction"."batch_run_files" ADD COLUMN IF NOT EXISTS "segments" jsonb;
