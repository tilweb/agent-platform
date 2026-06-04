-- Connections — Provider-Settings: globaler Admin-Schalter pro Provider.
--
-- `enabled_for_users` steuert, ob ein Connection-Provider in der User-Ansicht
-- ("Meine Verbindungen") erscheint und von Nutzern verbunden werden darf.
-- Default false (opt-in) — der Admin schaltet pro Provider frei.

CREATE SCHEMA IF NOT EXISTS "connections";

CREATE TABLE IF NOT EXISTS "connections"."provider_settings" (
  "provider"          text PRIMARY KEY NOT NULL,
  "enabled_for_users" boolean NOT NULL DEFAULT false,
  "updated_at"        timestamp with time zone NOT NULL DEFAULT now()
);
