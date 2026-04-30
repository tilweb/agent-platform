-- Gruppen-basierte App-Berechtigungen — Phase 1.
-- Format: { "groups": [{ "groupId": "...", "role": "owner" | "editor" | "viewer" }] }
-- Leer / NULL = "noch nicht konfiguriert".

ALTER TABLE "apps"."registry"
  ADD COLUMN IF NOT EXISTS "permissions" jsonb;
