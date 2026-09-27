-- Dokumentvorlagen (Word) — Design- und Strukturvorlagen für Exporte aus dem Chat.
-- Original-.docx liegt in S3 unter doc-templates/<id>/original.docx.
-- Höchstens eine Designvorlage ist Instanz-Default (partieller Unique-Index).
-- Idempotent (IF NOT EXISTS), wird von migrate() beim Boot angewendet.

CREATE SCHEMA IF NOT EXISTS "documents";

CREATE TABLE IF NOT EXISTS "documents"."templates" (
  "id"             text PRIMARY KEY NOT NULL,
  "kind"           text NOT NULL,
  "name"           text NOT NULL,
  "description"    text,
  "owner_user_id"  text,
  "filename"       text NOT NULL,
  "s3_key"         text NOT NULL,
  "size_bytes"     integer,
  "is_default"     boolean NOT NULL DEFAULT false,
  "inspection"     jsonb,
  "fields"         jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"     timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "doc_templates_kind_idx" ON "documents"."templates" ("kind");
CREATE INDEX IF NOT EXISTS "doc_templates_owner_idx" ON "documents"."templates" ("owner_user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "doc_templates_one_default_idx" ON "documents"."templates" ("kind") WHERE "is_default";
