-- Phase F: Abschlussbericht — 1:1 Sub-Resource am Projektauftrag (= Projekt-ID).
-- Vorbefuellt aus letztem Statusbericht + Projektauftrag-Feldern, ergaenzt
-- um Abschluss-spezifische Felder (Stakeholder-Akzeptanz, Uebergabe, Abnahme).
-- UNIQUE(pa_id) erzwingt 1:1. Status-Wechsel draft→final setzt finalized_at.

CREATE TABLE IF NOT EXISTS "projektmgmt"."abschlussberichte" (
  "id" text PRIMARY KEY NOT NULL,
  "pa_id" text NOT NULL,
  "data" jsonb NOT NULL,
  "status" text NOT NULL DEFAULT 'draft',
  "finalized_at" timestamp with time zone,
  "version" integer NOT NULL DEFAULT 1,
  "created_by" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "abschlussberichte_pa_id_fkey" FOREIGN KEY ("pa_id")
    REFERENCES "projektmgmt"."projektauftraege"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "pa_abschlussberichte_pa_unique" ON "projektmgmt"."abschlussberichte" ("pa_id");
CREATE INDEX IF NOT EXISTS "pa_abschlussberichte_status_idx" ON "projektmgmt"."abschlussberichte" ("status");
