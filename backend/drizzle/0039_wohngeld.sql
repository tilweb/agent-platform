-- Wohngeld-Antragsassistent — Vollständigkeits-/Plausibilitätsprüfung (Human-in-the-Loop).
-- Alles idempotent (IF NOT EXISTS), wird von migrate() beim Boot angewendet.
-- Hierarchie: akten → vorgaenge → { personen, dokumente, pruefschritte, schreiben, aktivitaeten }

CREATE SCHEMA IF NOT EXISTS "wohngeld";

-- Ebene 1 — Akte (E-Akte)
CREATE TABLE IF NOT EXISTS "wohngeld"."akten" (
  "id"          text PRIMARY KEY NOT NULL,
  "owner_id"    text,
  "name"        text NOT NULL,
  "data"        jsonb NOT NULL DEFAULT '{}'::jsonb,
  "permissions" jsonb,
  "version"     integer NOT NULL DEFAULT 1,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"  timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "wg_akte_owner_idx" ON "wohngeld"."akten" ("owner_id");

-- Ebene 2 — Vorgang (= Antrag)
CREATE TABLE IF NOT EXISTS "wohngeld"."vorgaenge" (
  "id"             text PRIMARY KEY NOT NULL,
  "akte_id"        text NOT NULL REFERENCES "wohngeld"."akten"("id") ON DELETE CASCADE,
  "antrags_id"     text NOT NULL,
  "wohngeldart"    text NOT NULL DEFAULT 'mietzuschuss',
  "antragsart"     text NOT NULL DEFAULT 'erstantrag',
  "status"         text NOT NULL DEFAULT 'posteingang',
  "sachbearbeiter" text,
  "prioritaet"     text NOT NULL DEFAULT 'normal',
  "owner_id"       text,
  "data"           jsonb NOT NULL DEFAULT '{}'::jsonb,
  "permissions"    jsonb,
  "version"        integer NOT NULL DEFAULT 1,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"     timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "wg_vorgang_akte_idx"    ON "wohngeld"."vorgaenge" ("akte_id");
CREATE INDEX IF NOT EXISTS "wg_vorgang_antrags_idx" ON "wohngeld"."vorgaenge" ("antrags_id");
CREATE INDEX IF NOT EXISTS "wg_vorgang_status_idx"  ON "wohngeld"."vorgaenge" ("status");

-- Person
CREATE TABLE IF NOT EXISTS "wohngeld"."personen" (
  "id"         text PRIMARY KEY NOT NULL,
  "vorgang_id" text NOT NULL REFERENCES "wohngeld"."vorgaenge"("id") ON DELETE CASCADE,
  "rolle"      text NOT NULL DEFAULT 'haushaltsmitglied',
  "nachname"   text NOT NULL DEFAULT '',
  "vorname"    text NOT NULL DEFAULT '',
  "data"       jsonb NOT NULL DEFAULT '{}'::jsonb,
  "version"    integer NOT NULL DEFAULT 1,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "wg_person_vorgang_idx" ON "wohngeld"."personen" ("vorgang_id");

-- Dokument / Nachweis
CREATE TABLE IF NOT EXISTS "wohngeld"."dokumente" (
  "id"          text PRIMARY KEY NOT NULL,
  "vorgang_id"  text NOT NULL REFERENCES "wohngeld"."vorgaenge"("id") ON DELETE CASCADE,
  "person_id"   text,
  "typ"         text NOT NULL DEFAULT 'sonstiges',
  "ist_original" boolean NOT NULL DEFAULT false,
  "data"        jsonb NOT NULL DEFAULT '{}'::jsonb,
  "version"     integer NOT NULL DEFAULT 1,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"  timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "wg_dokument_vorgang_idx" ON "wohngeld"."dokumente" ("vorgang_id");
CREATE INDEX IF NOT EXISTS "wg_dokument_typ_idx"     ON "wohngeld"."dokumente" ("typ");

-- Prüfschritt
CREATE TABLE IF NOT EXISTS "wohngeld"."pruefschritte" (
  "id"         text PRIMARY KEY NOT NULL,
  "vorgang_id" text NOT NULL REFERENCES "wohngeld"."vorgaenge"("id") ON DELETE CASCADE,
  "person_id"  text,
  "regel_id"   text NOT NULL DEFAULT '',
  "kategorie"  text NOT NULL DEFAULT 'vollstaendigkeit',
  "typ"        text NOT NULL DEFAULT 'anforderung',
  "status"     text NOT NULL DEFAULT 'offen',
  "titel"      text NOT NULL DEFAULT '',
  "data"       jsonb NOT NULL DEFAULT '{}'::jsonb,
  "version"    integer NOT NULL DEFAULT 1,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "wg_pruef_vorgang_idx" ON "wohngeld"."pruefschritte" ("vorgang_id");
CREATE INDEX IF NOT EXISTS "wg_pruef_status_idx"  ON "wohngeld"."pruefschritte" ("status");

-- Nachforderungsschreiben
CREATE TABLE IF NOT EXISTS "wohngeld"."schreiben" (
  "id"         text PRIMARY KEY NOT NULL,
  "vorgang_id" text NOT NULL REFERENCES "wohngeld"."vorgaenge"("id") ON DELETE CASCADE,
  "art"        text NOT NULL DEFAULT 'erstanforderung',
  "data"       jsonb NOT NULL DEFAULT '{}'::jsonb,
  "version"    integer NOT NULL DEFAULT 1,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "wg_schreiben_vorgang_idx" ON "wohngeld"."schreiben" ("vorgang_id");

-- Aktivität / Audit (append-only)
CREATE TABLE IF NOT EXISTS "wohngeld"."aktivitaeten" (
  "id"         text PRIMARY KEY NOT NULL,
  "vorgang_id" text NOT NULL REFERENCES "wohngeld"."vorgaenge"("id") ON DELETE CASCADE,
  "typ"        text NOT NULL DEFAULT 'info',
  "akteur"     text,
  "data"       jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "wg_aktivitaet_vorgang_idx" ON "wohngeld"."aktivitaeten" ("vorgang_id");
