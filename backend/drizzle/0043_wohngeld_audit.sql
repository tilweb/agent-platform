-- Wohngeld GOV-1 — Audit-/Protokoll-Kern (G-A/B/C/D/E/F).
-- Einheitliches, append-only Protokoll aller fachlich relevanten Aktionen
-- (inkl. Lesezugriff auf einen Fall + Downloads/Exporte). KEINE Hash-Kette
-- (bewusst später — Nicht-Ziel für GOV-1).
-- Idempotent (IF NOT EXISTS), wird von migrate() beim Boot angewendet.
-- Kein FK auf vorgang_id: der Eintrag muss die Löschung des Vorgangs überdauern.

CREATE TABLE IF NOT EXISTS "wohngeld"."audit_log" (
  "id"           text PRIMARY KEY NOT NULL,
  "timestamp"    timestamp with time zone NOT NULL DEFAULT now(),
  "akteur_id"    text,
  "akteur_name"  text,
  "akteur_rolle" text,
  "aktion"       text NOT NULL,
  "objekt_typ"   text NOT NULL,
  "objekt_id"    text,
  "vorgang_id"   text,
  "ergebnis"     text NOT NULL DEFAULT 'ok',
  "vorher"       jsonb,
  "nachher"      jsonb,
  "detail"       text,
  "ip"           text
);
CREATE INDEX IF NOT EXISTS "wg_audit_vorgang_idx" ON "wohngeld"."audit_log" ("vorgang_id");
CREATE INDEX IF NOT EXISTS "wg_audit_timestamp_idx" ON "wohngeld"."audit_log" ("timestamp");
