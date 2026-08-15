-- Kapazitaetsplanung: zentrale (projektuebergreifende) Personen-Stammdaten.
-- Eigenstaendige Entitaet (anders als die eingebetteten organization-TeamMember
-- pro Auftrag/Idee). Projekt-Teammitglieder verlinken per person_id hierauf.
-- Kapazitaets-Felder (role, wochenarbeitszeit_pct, linie_avg_pt, linie_monate)
-- leben im metadata-JSONB und werden im Service angehoben (Muster wie portfolios).
-- Additiv, kein Backfill.

CREATE TABLE IF NOT EXISTS "projektmgmt"."personen" (
  "id" text PRIMARY KEY NOT NULL,
  "owner_id" text,
  "name" text NOT NULL,
  "metadata" jsonb,
  "permissions" jsonb,
  "version" integer NOT NULL DEFAULT 1,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "person_owner_idx" ON "projektmgmt"."personen" ("owner_id");
