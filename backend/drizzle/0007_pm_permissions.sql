-- Phase 2: Auftrags-/Idee-Level Permissions fuer Projektmanagement.
-- Format: { "users": [{ "userId": "...", "role": "owner"|"editor"|"viewer" }],
--           "groups": [{ "groupId": "...", "role": "owner"|"editor"|"viewer" }] }
-- NULL = keine zusaetzlichen Permissions, nur ownerId (Ersteller) ist Owner.
-- Statusberichte erben vom Auftrag — keine eigene Spalte.

ALTER TABLE "projektmgmt"."projektideen"
  ADD COLUMN IF NOT EXISTS "permissions" jsonb;

ALTER TABLE "projektmgmt"."projektauftraege"
  ADD COLUMN IF NOT EXISTS "permissions" jsonb;
