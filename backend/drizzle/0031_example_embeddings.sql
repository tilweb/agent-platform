-- Aehnlichkeits-Few-Shot (Welle 5): Embedding des Dokumenttexts je Trainingsbeispiel.
-- Additiv, kein Backfill — fehlende Embeddings werden im Betrieb nachgetragen.
ALTER TABLE "extraction"."examples" ADD COLUMN IF NOT EXISTS "embedding" jsonb;
