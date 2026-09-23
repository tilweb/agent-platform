-- Wohngeld — Persistente Posteingang-Warteschlange (S1–S4).
-- Ein Eintrag = Umschlag/Batch (1..n Dateien). `dateien` (jsonb) hält den
-- Umschlag-Inhalt inkl. Analyseergebnissen; rohe Bytes bleiben im Filestore.
-- Kein FK auf zugeordneter_vorgang_id/zugeordnete_akte_id: der Eingang muss die
-- Löschung des Vorgangs überdauern (wie audit_log).
-- Idempotent (IF NOT EXISTS), wird von migrate() beim Boot angewendet.

CREATE TABLE IF NOT EXISTS "wohngeld"."posteingang" (
  "id"                       text PRIMARY KEY NOT NULL,
  "quelle"                   text NOT NULL DEFAULT 'manuell',
  "eingegangen_am"          timestamp with time zone NOT NULL DEFAULT now(),
  "betreff"                  text,
  "status"                   text NOT NULL DEFAULT 'eingegangen',
  "dateien"                  jsonb NOT NULL DEFAULT '[]'::jsonb,
  "match_vorschlag"          jsonb,
  "zugeordneter_vorgang_id"  text,
  "zugeordnete_akte_id"      text,
  "bearbeiter_id"            text,
  "verworfen_grund"          text,
  "hash"                     text,
  "data"                     jsonb NOT NULL DEFAULT '{}'::jsonb,
  "version"                  integer NOT NULL DEFAULT 1,
  "created_at"               timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"               timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "wg_posteingang_status_idx" ON "wohngeld"."posteingang" ("status");
CREATE INDEX IF NOT EXISTS "wg_posteingang_eingegangen_idx" ON "wohngeld"."posteingang" ("eingegangen_am");
