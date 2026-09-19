-- Wohngeld Fall-Chat — grounded Fall-Q&A (Stufe C1).
-- Append-only Nachrichten-Verlauf pro Vorgang. Alles idempotent (IF NOT EXISTS),
-- wird von migrate() beim Boot angewendet.

CREATE TABLE IF NOT EXISTS "wohngeld"."chat_messages" (
  "id"         text PRIMARY KEY NOT NULL,
  "vorgang_id" text NOT NULL REFERENCES "wohngeld"."vorgaenge"("id") ON DELETE CASCADE,
  "rolle"      text NOT NULL DEFAULT 'user',
  "data"       jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "wg_chat_vorgang_idx" ON "wohngeld"."chat_messages" ("vorgang_id");
