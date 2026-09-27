-- Wohngeld — KI-Verbrauch (Tokens) je fachlicher Aktion.
-- Spec: docs/wohngeld-token-verbrauch-spec-2026-09-27.md
-- Kein FK auf vorgang_id/posteingang_id (überdauert Löschung, wie audit_log).
-- Idempotent (IF NOT EXISTS), wird von migrate() beim Boot angewendet.

CREATE TABLE IF NOT EXISTS "wohngeld"."ki_verbrauch" (
  "id"                 text PRIMARY KEY NOT NULL,
  "zeitpunkt"          timestamp with time zone NOT NULL DEFAULT now(),
  "vorgang_id"         text,
  "posteingang_id"     text,
  "aktion"             text NOT NULL,
  "phase"              text NOT NULL DEFAULT 'bearbeitung',
  "akteur_id"          text,
  "aufrufe"            integer NOT NULL DEFAULT 0,
  "prompt_tokens"      integer NOT NULL DEFAULT 0,
  "completion_tokens"  integer NOT NULL DEFAULT 0,
  "ohne_angabe"        integer NOT NULL DEFAULT 0,
  "modelle"            jsonb NOT NULL DEFAULT '{}'::jsonb,
  "dauer_ms"           integer,
  "detail"             text
);
CREATE INDEX IF NOT EXISTS "wg_ki_verbrauch_vorgang_idx" ON "wohngeld"."ki_verbrauch" ("vorgang_id");
CREATE INDEX IF NOT EXISTS "wg_ki_verbrauch_posteingang_idx" ON "wohngeld"."ki_verbrauch" ("posteingang_id");
