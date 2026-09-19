-- Wohngeld Welle 2 — Feld-Provenienz (WP3) + Sektions-Notizen (WP4).
-- Alles idempotent (IF NOT EXISTS), wird von migrate() beim Boot angewendet.

-- WP3: Feld-Status (KI-Vorschlag-Bestätigung auf Feldebene).
CREATE TABLE IF NOT EXISTS "wohngeld"."feld_status" (
  "id"                text PRIMARY KEY NOT NULL,
  "vorgang_id"        text NOT NULL REFERENCES "wohngeld"."vorgaenge"("id") ON DELETE CASCADE,
  "ziel_typ"          text NOT NULL DEFAULT 'vorgang',
  "ziel_id"           text NOT NULL,
  "feld_pfad"         text NOT NULL,
  "quelle"            text NOT NULL DEFAULT 'llm',
  "bestaetigt"        boolean NOT NULL DEFAULT false,
  "quell_dokument_id" text,
  "confidence"        real,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"        timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "wg_feldstatus_vorgang_idx" ON "wohngeld"."feld_status" ("vorgang_id");

-- WP4: Notizen je Sektion/Person (append-only).
CREATE TABLE IF NOT EXISTS "wohngeld"."notizen" (
  "id"         text PRIMARY KEY NOT NULL,
  "vorgang_id" text NOT NULL REFERENCES "wohngeld"."vorgaenge"("id") ON DELETE CASCADE,
  "anker"      text NOT NULL,
  "autor"      text,
  "text"       text NOT NULL DEFAULT '',
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "wg_notizen_vorgang_idx" ON "wohngeld"."notizen" ("vorgang_id");
