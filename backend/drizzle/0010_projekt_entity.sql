-- Phase A der PM-Restruktur: neue Top-Level-Entity "Projekt".
-- Identitaet + Lifecycle + Hierarchie-Referenzen leben hier.
-- Existierende Projektauftraege werden via scripts/migrate-projekte.ts
-- 1:1 (gleiche ID) als Projekte angelegt.
--
-- Sub-Resources (Statusberichte, kuenftige Lessons Learned / Abschluss)
-- bleiben in dieser Phase noch via paProjektauftraege.id verknuepft —
-- spaetere Phasen ziehen die FKs auf paProjekte.id um.

CREATE TABLE IF NOT EXISTS "projektmgmt"."projekte" (
  "id" text PRIMARY KEY NOT NULL,
  "owner_id" text,
  "name" text NOT NULL,
  "lifecycle" text NOT NULL DEFAULT 'planning',
  "portfolio_id" text,
  "idee_id" text,
  "metadata" jsonb,
  "permissions" jsonb,
  "version" integer NOT NULL DEFAULT 1,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "projekt_owner_idx" ON "projektmgmt"."projekte" ("owner_id");
CREATE INDEX IF NOT EXISTS "projekt_lifecycle_idx" ON "projektmgmt"."projekte" ("lifecycle");
CREATE INDEX IF NOT EXISTS "projekt_portfolio_idx" ON "projektmgmt"."projekte" ("portfolio_id");
CREATE INDEX IF NOT EXISTS "projekt_idee_idx" ON "projektmgmt"."projekte" ("idee_id");
