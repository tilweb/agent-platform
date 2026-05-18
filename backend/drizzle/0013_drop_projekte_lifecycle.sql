-- TD1 — paProjekte.lifecycle aufraeumen.
--
-- Seit Phase F ist `auftrag.project_status` die UI-Wahrheit fuer die PM-Phase
-- (Initiierung/Planung/Umsetzung/Abschluss/Gestoppt). `paProjekte.lifecycle`
-- wurde dadurch redundant und wird seither nicht mehr UI-gesetzt — der Wert
-- driftete still vom tatsaechlichen Projektstand weg.
--
-- Diese Migration entfernt Spalte + Index. Idempotent (IF EXISTS).
--
-- Siehe auch: docs/projektmanagement-status-felder-2026-05-18.md

DROP INDEX IF EXISTS "projektmgmt"."projekt_lifecycle_idx";
ALTER TABLE "projektmgmt"."projekte" DROP COLUMN IF EXISTS "lifecycle";
