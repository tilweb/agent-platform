-- Phase 2 fuer Vertragsmanagement: Multi-File pro Vertrag, Type-Detection,
-- Provenance, Re-Extraktions-Historie. Bestehende Single-File-Spalten bleiben
-- (Backwards-Compat) — neue Vertraege fuellen contract_attachments + die
-- jsonb-Felder unten, alte Vertraege werden nicht migriert (lazy).

-- 1. contracts: neue jsonb/text Spalten
ALTER TABLE "vertragsmgmt"."contracts"
  ADD COLUMN IF NOT EXISTS "primary_attachment_id" text,
  ADD COLUMN IF NOT EXISTS "type_detection" jsonb,
  ADD COLUMN IF NOT EXISTS "provenance" jsonb,
  ADD COLUMN IF NOT EXISTS "extracted_history" jsonb;

-- 2. contract_attachments: neue Tabelle
CREATE TABLE IF NOT EXISTS "vertragsmgmt"."contract_attachments" (
  "id" text PRIMARY KEY NOT NULL,
  "contract_id" text NOT NULL REFERENCES "vertragsmgmt"."contracts"("id") ON DELETE CASCADE,
  "filename" text NOT NULL,
  "content_type" text,
  "s3_key_original" text NOT NULL,
  "s3_key_markdown" text,
  "size_bytes" integer,
  "document_role" text NOT NULL DEFAULT 'sonstiges',
  "uploaded_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "contract_attachments_contract_idx"
  ON "vertragsmgmt"."contract_attachments" ("contract_id");
