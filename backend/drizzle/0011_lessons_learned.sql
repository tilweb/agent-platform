-- Phase E: Lessons Learned — Sub-Resource am Projektauftrag (= Projekt-ID).
-- SWOT-orientierte Eintraege pro Themengebiet, mit Titel + drei Textfeldern
-- (Beschreibung, Auswirkung, Empfehlung). Auflistbar in der Projekt-Detail-
-- Ansicht; KI-Vorschlaege werden aus Statusberichten abgeleitet (siehe
-- POST /projektauftraege/:id/lessons-learned/suggest).
--
-- FK heute noch via pa_id auf paProjektauftraege — IDs sind seit Phase A
-- identisch zur Projekt-ID; spaetere Phase zieht den FK auf paProjekte um.

CREATE TABLE IF NOT EXISTS "projektmgmt"."lessons_learned" (
  "id" text PRIMARY KEY NOT NULL,
  "pa_id" text NOT NULL,
  "title" text NOT NULL,
  "themengebiet" text NOT NULL,
  "kategorie" text NOT NULL,
  "beschreibung" text NOT NULL DEFAULT '',
  "auswirkung" text NOT NULL DEFAULT '',
  "empfehlung" text NOT NULL DEFAULT '',
  "version" integer NOT NULL DEFAULT 1,
  "created_by" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "lessons_learned_pa_id_fkey" FOREIGN KEY ("pa_id")
    REFERENCES "projektmgmt"."projektauftraege"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "pa_lessons_learned_pa_idx" ON "projektmgmt"."lessons_learned" ("pa_id");
CREATE INDEX IF NOT EXISTS "pa_lessons_learned_thema_idx" ON "projektmgmt"."lessons_learned" ("themengebiet");
CREATE INDEX IF NOT EXISTS "pa_lessons_learned_kategorie_idx" ON "projektmgmt"."lessons_learned" ("kategorie");
