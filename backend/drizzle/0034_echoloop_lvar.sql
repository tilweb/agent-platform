-- Echo-Loop · PAKET_2 L-VAR-Datenspine (Phase 0, additiv).
--
-- Erweitert das echoloop-Schema um die Familie→Einzelprozess→Variable/CFG-Ebenen
-- (Entscheidungspunkt D-A: `prozesse` = Familie; Zusatzfelder familienkuerzel/
-- namenskonvention/token_prefix leben in `prozesse.data`, daher KEINE Spalten-
-- Migration an Bestandstabellen). Zusätzlich die append-only Telemetrie-Senke.
--
-- Alles additiv + idempotent (IF NOT EXISTS). Bestandsdaten unberührt.
-- Der Baustand bleibt das querverdrahtende Objekt.

-- Einzelprozess-Steckbrief (Extraktions-Ergebnis je Lauf) ---------------------
CREATE TABLE IF NOT EXISTS "echoloop"."prozess_items" (
  "id"          text PRIMARY KEY NOT NULL,
  "prozess_id"  text NOT NULL REFERENCES "echoloop"."prozesse"("id") ON DELETE CASCADE,
  "baustand_id" text,
  "nr"          text NOT NULL,
  "name_export" text,
  "typ"         text,
  "data"        jsonb NOT NULL DEFAULT '{}'::jsonb,
  "version"     integer NOT NULL DEFAULT 1,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"  timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "el_pitem_prozess_nr_idx" ON "echoloop"."prozess_items" ("prozess_id", "nr");

-- Variable (Zeile der EMMA-„Variable Informationen"-Tabelle) -------------------
CREATE TABLE IF NOT EXISTS "echoloop"."variablen" (
  "id"              text PRIMARY KEY NOT NULL,
  "prozess_item_id" text NOT NULL REFERENCES "echoloop"."prozess_items"("id") ON DELETE CASCADE,
  "prozess_id"      text NOT NULL,
  "p"               text NOT NULL,
  "var_id"          text NOT NULL,
  "name"            text NOT NULL,
  "typ"             text,
  "schnitt"         text,
  "rolle"           text,
  "data"            jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "el_var_item_idx" ON "echoloop"."variablen" ("prozess_item_id");
CREATE INDEX IF NOT EXISTS "el_var_familie_name_idx" ON "echoloop"."variablen" ("prozess_id", "name");

-- Konfigurations-Schlüssel einer Familie (CFG-Generator, 7 Diff-Klassen) -------
CREATE TABLE IF NOT EXISTS "echoloop"."cfg" (
  "id"          text PRIMARY KEY NOT NULL,
  "prozess_id"  text NOT NULL REFERENCES "echoloop"."prozesse"("id") ON DELETE CASCADE,
  "schluessel"  text NOT NULL,
  "data"        jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "el_cfg_prozess_schluessel_idx" ON "echoloop"."cfg" ("prozess_id", "schluessel");

-- Append-only Telemetrie-Senke (Gold-Läufe, Tresor-Sweeps, Verbrauch) ---------
-- Bewusst OHNE FK: der Audit-Log überlebt das Löschen der referenzierten Entität.
CREATE TABLE IF NOT EXISTS "echoloop"."telemetrie" (
  "id"          text PRIMARY KEY NOT NULL,
  "prozess_id"  text,
  "baustand_id" text,
  "verfahren"   text NOT NULL,
  "event"       text NOT NULL,
  "data"        jsonb,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "el_tel_prozess_idx" ON "echoloop"."telemetrie" ("prozess_id");
CREATE INDEX IF NOT EXISTS "el_tel_verfahren_idx" ON "echoloop"."telemetrie" ("verfahren", "created_at");
