-- Echo-Loop App — RPA-Prozess-Reifegradanalyse (EMMA Studio).
--
-- Vier Tabellen im Schema `echoloop` (Drei-Ebenen-Modell aus der Spec):
--   kunden      — Kunde / Zwilling-Wurzel
--   prozesse    — Prozess-Akte (Arbeitseinheit) je Kunde
--   baustaende  — Reifegrad-Analyse-Staende je Prozess (append-only Historie,
--                 Status entwurf|in_review|freigegeben; D1-D10+D6b, RG/RGQ/SE)
--   artefakte   — hochgeladene EMMA-Export-PDFs (S3-Key + gecachter Textextrakt)
--
-- Alles idempotent (IF NOT EXISTS), wird von migrate() beim Boot angewendet.

CREATE SCHEMA IF NOT EXISTS "echoloop";

CREATE TABLE IF NOT EXISTS "echoloop"."kunden" (
  "id"          text PRIMARY KEY NOT NULL,
  "owner_id"    text,
  "name"        text NOT NULL,
  "data"        jsonb NOT NULL DEFAULT '{}'::jsonb,
  "permissions" jsonb,
  "version"     integer NOT NULL DEFAULT 1,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"  timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "el_kunde_owner_idx" ON "echoloop"."kunden" ("owner_id");

CREATE TABLE IF NOT EXISTS "echoloop"."prozesse" (
  "id"            text PRIMARY KEY NOT NULL,
  "kunde_id"      text NOT NULL REFERENCES "echoloop"."kunden"("id") ON DELETE CASCADE,
  "owner_id"      text,
  "name"          text NOT NULL,
  "emma_plan_nr"  text,
  "data"          jsonb NOT NULL DEFAULT '{}'::jsonb,
  "permissions"   jsonb,
  "version"       integer NOT NULL DEFAULT 1,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"    timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "el_prozess_kunde_idx" ON "echoloop"."prozesse" ("kunde_id");
CREATE INDEX IF NOT EXISTS "el_prozess_owner_idx" ON "echoloop"."prozesse" ("owner_id");

CREATE TABLE IF NOT EXISTS "echoloop"."baustaende" (
  "id"          text PRIMARY KEY NOT NULL,
  "prozess_id"  text NOT NULL REFERENCES "echoloop"."prozesse"("id") ON DELETE CASCADE,
  "datum"       text NOT NULL,
  "status"      text NOT NULL DEFAULT 'entwurf',
  "quelle"      text,
  "data"        jsonb NOT NULL DEFAULT '{}'::jsonb,
  "reviewer_id" text,
  "permissions" jsonb,
  "version"     integer NOT NULL DEFAULT 1,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"  timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "el_baustand_prozess_idx" ON "echoloop"."baustaende" ("prozess_id", "status");

CREATE TABLE IF NOT EXISTS "echoloop"."artefakte" (
  "id"          text PRIMARY KEY NOT NULL,
  "prozess_id"  text NOT NULL REFERENCES "echoloop"."prozesse"("id") ON DELETE CASCADE,
  "baustand_id" text,
  "filename"    text NOT NULL,
  "mime_type"   text,
  "s3_key"      text NOT NULL,
  "data"        jsonb,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "el_artefakt_prozess_idx" ON "echoloop"."artefakte" ("prozess_id");
