-- Vorgangsmappe — Settings: Doku-Typen, Incoterms und Pflicht-Mappings.
--
-- Drei Tabellen, alles im neuen Schema `vorgangsmappe`:
--   document_types               — kuratierte Liste der Doku-Typen
--   incoterms                    — Liste der Incoterms (FOB, CIF, ...)
--   required_document_mappings   — Pflicht-Verknuepfung Doc x (Incoterm x Geschaeftsart)
--
-- `geschaeftsart` ist ein einfaches String-Feld mit erwarteten Werten
-- ('lager', 'strecke'); kein DB-Constraint, weil Cofermin spaeter ggf.
-- weitere Auspraegungen pflegen will.

CREATE SCHEMA IF NOT EXISTS "vorgangsmappe";

CREATE TABLE IF NOT EXISTS "vorgangsmappe"."document_types" (
  "id"          text PRIMARY KEY NOT NULL,
  "label"       text NOT NULL,
  "bereich"     text NOT NULL,                  -- 'einkauf' | 'verkauf' | 'produktion' | 'sonstiges'
  "match_any"   jsonb NOT NULL DEFAULT '[]'::jsonb,
  "description" text,
  "sort_order"  integer NOT NULL DEFAULT 0,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"  timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "vm_doctypes_bereich_idx"
  ON "vorgangsmappe"."document_types" ("bereich", "sort_order");

CREATE TABLE IF NOT EXISTS "vorgangsmappe"."incoterms" (
  "code"        text PRIMARY KEY NOT NULL,
  "label"       text NOT NULL,
  "description" text,
  "sort_order"  integer NOT NULL DEFAULT 0,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"  timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "vorgangsmappe"."required_document_mappings" (
  "id"                  serial PRIMARY KEY NOT NULL,
  "incoterm"            text NOT NULL,
  "geschaeftsart"       text NOT NULL,
  "document_type_id"    text NOT NULL,
  "required"            boolean NOT NULL DEFAULT true,
  "created_at"          timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "vm_mapping_unique" UNIQUE ("incoterm", "geschaeftsart", "document_type_id")
);

CREATE INDEX IF NOT EXISTS "vm_mapping_lookup_idx"
  ON "vorgangsmappe"."required_document_mappings" ("incoterm", "geschaeftsart");
