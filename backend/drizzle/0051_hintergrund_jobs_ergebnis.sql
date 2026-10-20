-- Hintergrund-Jobs: Ergebnis und Fortschritt (Upload am Vorgang fragt beides ab), bearbeitender Prozess. Fuer Datenbanken, auf denen
-- 0050 vor Ergaenzung dieser Spalten lief; sonst wirkungslos (IF NOT EXISTS).
ALTER TABLE extraction.hintergrund_jobs ADD COLUMN IF NOT EXISTS ergebnis jsonb;--> statement-breakpoint
ALTER TABLE extraction.hintergrund_jobs ADD COLUMN IF NOT EXISTS fortschritt jsonb;--> statement-breakpoint
ALTER TABLE extraction.hintergrund_jobs ADD COLUMN IF NOT EXISTS bearbeiter text;
