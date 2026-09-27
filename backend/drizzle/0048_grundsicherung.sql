-- Grundsicherung (SGB XII, 4. Kapitel) — Antragsprüfung (Vollständigkeit/Plausibilität, Human-in-the-Loop).
-- Spec: docs/grundsicherung-app-spec-2026-09-27.md (Welle G1). Tabellen-Präfix für Indizes: gs.
-- Alles idempotent (IF NOT EXISTS / ON CONFLICT DO NOTHING), wird von migrate() beim Boot angewendet.
-- Hierarchie: akten → vorgaenge → { personen, dokumente, pruefschritte, schreiben, chat_messages,
--             aktivitaeten, feld_status, notizen }; audit_log, ki_verbrauch, posteingang ohne FK.

CREATE SCHEMA IF NOT EXISTS "grundsicherung";

-- Ebene 1 — Akte (E-Akte)
CREATE TABLE IF NOT EXISTS "grundsicherung"."akten" (
  "id"          text PRIMARY KEY NOT NULL,
  "owner_id"    text,
  "name"        text NOT NULL,
  "data"        jsonb NOT NULL DEFAULT '{}'::jsonb,
  "permissions" jsonb,
  "version"     integer NOT NULL DEFAULT 1,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"  timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "gs_akte_owner_idx" ON "grundsicherung"."akten" ("owner_id");

-- Ebene 2 — Vorgang (= Antrag)
CREATE TABLE IF NOT EXISTS "grundsicherung"."vorgaenge" (
  "id"             text PRIMARY KEY NOT NULL,
  "akte_id"        text NOT NULL REFERENCES "grundsicherung"."akten"("id") ON DELETE CASCADE,
  "vorgangsnummer" text NOT NULL,
  "antragsart"     text NOT NULL DEFAULT 'erstantrag',
  "anspruchsgrund" text,
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
CREATE INDEX IF NOT EXISTS "gs_vorgang_akte_idx"   ON "grundsicherung"."vorgaenge" ("akte_id");
CREATE INDEX IF NOT EXISTS "gs_vorgang_nummer_idx" ON "grundsicherung"."vorgaenge" ("vorgangsnummer");
CREATE INDEX IF NOT EXISTS "gs_vorgang_status_idx" ON "grundsicherung"."vorgaenge" ("status");

-- Person (Einsatzgemeinschaft + Haushaltsangehörige)
CREATE TABLE IF NOT EXISTS "grundsicherung"."personen" (
  "id"         text PRIMARY KEY NOT NULL,
  "vorgang_id" text NOT NULL REFERENCES "grundsicherung"."vorgaenge"("id") ON DELETE CASCADE,
  "rolle"      text NOT NULL DEFAULT 'haushaltsangehoerig',
  "nachname"   text NOT NULL DEFAULT '',
  "vorname"    text NOT NULL DEFAULT '',
  "data"       jsonb NOT NULL DEFAULT '{}'::jsonb,
  "version"    integer NOT NULL DEFAULT 1,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "gs_person_vorgang_idx" ON "grundsicherung"."personen" ("vorgang_id");

-- Dokument / Nachweis
CREATE TABLE IF NOT EXISTS "grundsicherung"."dokumente" (
  "id"           text PRIMARY KEY NOT NULL,
  "vorgang_id"   text NOT NULL REFERENCES "grundsicherung"."vorgaenge"("id") ON DELETE CASCADE,
  "person_id"    text,
  "typ"          text NOT NULL DEFAULT 'sonstiges',
  "ist_original" boolean NOT NULL DEFAULT false,
  "data"         jsonb NOT NULL DEFAULT '{}'::jsonb,
  "version"      integer NOT NULL DEFAULT 1,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"   timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "gs_dokument_vorgang_idx" ON "grundsicherung"."dokumente" ("vorgang_id");
CREATE INDEX IF NOT EXISTS "gs_dokument_typ_idx"     ON "grundsicherung"."dokumente" ("typ");

-- Prüfschritt
CREATE TABLE IF NOT EXISTS "grundsicherung"."pruefschritte" (
  "id"         text PRIMARY KEY NOT NULL,
  "vorgang_id" text NOT NULL REFERENCES "grundsicherung"."vorgaenge"("id") ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS "gs_pruef_vorgang_idx" ON "grundsicherung"."pruefschritte" ("vorgang_id");
CREATE INDEX IF NOT EXISTS "gs_pruef_status_idx"  ON "grundsicherung"."pruefschritte" ("status");

-- Nachforderungsschreiben
CREATE TABLE IF NOT EXISTS "grundsicherung"."schreiben" (
  "id"         text PRIMARY KEY NOT NULL,
  "vorgang_id" text NOT NULL REFERENCES "grundsicherung"."vorgaenge"("id") ON DELETE CASCADE,
  "art"        text NOT NULL DEFAULT 'erstanforderung',
  "data"       jsonb NOT NULL DEFAULT '{}'::jsonb,
  "version"    integer NOT NULL DEFAULT 1,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "gs_schreiben_vorgang_idx" ON "grundsicherung"."schreiben" ("vorgang_id");

-- Fall-Chat (append-only, für später)
CREATE TABLE IF NOT EXISTS "grundsicherung"."chat_messages" (
  "id"         text PRIMARY KEY NOT NULL,
  "vorgang_id" text NOT NULL REFERENCES "grundsicherung"."vorgaenge"("id") ON DELETE CASCADE,
  "rolle"      text NOT NULL DEFAULT 'user',
  "data"       jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "gs_chat_vorgang_idx" ON "grundsicherung"."chat_messages" ("vorgang_id");

-- Textbausteine
CREATE TABLE IF NOT EXISTS "grundsicherung"."textbausteine" (
  "id"         text PRIMARY KEY NOT NULL,
  "kategorie"  text NOT NULL DEFAULT 'Allgemein',
  "titel"      text NOT NULL DEFAULT '',
  "text"       text NOT NULL DEFAULT '',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "gs_textbaustein_kategorie_idx" ON "grundsicherung"."textbausteine" ("kategorie");

-- Aktivität / Verlauf (append-only)
CREATE TABLE IF NOT EXISTS "grundsicherung"."aktivitaeten" (
  "id"         text PRIMARY KEY NOT NULL,
  "vorgang_id" text NOT NULL REFERENCES "grundsicherung"."vorgaenge"("id") ON DELETE CASCADE,
  "typ"        text NOT NULL DEFAULT 'info',
  "akteur"     text,
  "data"       jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "gs_aktivitaet_vorgang_idx" ON "grundsicherung"."aktivitaeten" ("vorgang_id");

-- Antrag-Kern: Feld-Provenienz
CREATE TABLE IF NOT EXISTS "grundsicherung"."feld_status" (
  "id"                text PRIMARY KEY NOT NULL,
  "vorgang_id"        text NOT NULL REFERENCES "grundsicherung"."vorgaenge"("id") ON DELETE CASCADE,
  "ziel_typ"          text NOT NULL DEFAULT 'vorgang',
  "ziel_id"           text NOT NULL,
  "feld_pfad"         text NOT NULL,
  "quelle"            text NOT NULL DEFAULT 'llm',
  "bestaetigt"        boolean NOT NULL DEFAULT false,
  "quell_dokument_id" text,
  "confidence"        real,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"        timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "gs_feldstatus_vorgang_idx" ON "grundsicherung"."feld_status" ("vorgang_id");

-- Antrag-Kern: Notizen je Sektion/Person (append-only)
CREATE TABLE IF NOT EXISTS "grundsicherung"."notizen" (
  "id"         text PRIMARY KEY NOT NULL,
  "vorgang_id" text NOT NULL REFERENCES "grundsicherung"."vorgaenge"("id") ON DELETE CASCADE,
  "anker"      text NOT NULL,
  "autor"      text,
  "text"       text NOT NULL DEFAULT '',
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "gs_notizen_vorgang_idx" ON "grundsicherung"."notizen" ("vorgang_id");

-- Antrag-Kern: Posteingang-Warteschlange (kein FK, überdauert Löschung)
CREATE TABLE IF NOT EXISTS "grundsicherung"."posteingang" (
  "id"                      text PRIMARY KEY NOT NULL,
  "quelle"                  text NOT NULL DEFAULT 'manuell',
  "eingegangen_am"          timestamp with time zone NOT NULL DEFAULT now(),
  "betreff"                 text,
  "status"                  text NOT NULL DEFAULT 'eingegangen',
  "dateien"                 jsonb NOT NULL DEFAULT '[]'::jsonb,
  "match_vorschlag"         jsonb,
  "zugeordneter_vorgang_id" text,
  "zugeordnete_akte_id"     text,
  "bearbeiter_id"           text,
  "verworfen_grund"         text,
  "hash"                    text,
  "data"                    jsonb NOT NULL DEFAULT '{}'::jsonb,
  "version"                 integer NOT NULL DEFAULT 1,
  "created_at"              timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"              timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "gs_posteingang_status_idx"      ON "grundsicherung"."posteingang" ("status");
CREATE INDEX IF NOT EXISTS "gs_posteingang_eingegangen_idx" ON "grundsicherung"."posteingang" ("eingegangen_am");

-- Antrag-Kern: Audit-/Protokoll-Log (append-only, kein FK)
CREATE TABLE IF NOT EXISTS "grundsicherung"."audit_log" (
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
CREATE INDEX IF NOT EXISTS "gs_audit_vorgang_idx"   ON "grundsicherung"."audit_log" ("vorgang_id");
CREATE INDEX IF NOT EXISTS "gs_audit_timestamp_idx" ON "grundsicherung"."audit_log" ("timestamp");

-- Antrag-Kern: KI-Verbrauch (Tokens) je fachlicher Aktion (kein FK, nur Zahlen)
CREATE TABLE IF NOT EXISTS "grundsicherung"."ki_verbrauch" (
  "id"                text PRIMARY KEY NOT NULL,
  "zeitpunkt"         timestamp with time zone NOT NULL DEFAULT now(),
  "vorgang_id"        text,
  "posteingang_id"    text,
  "aktion"            text NOT NULL,
  "phase"             text NOT NULL DEFAULT 'bearbeitung',
  "akteur_id"         text,
  "aufrufe"           integer NOT NULL DEFAULT 0,
  "prompt_tokens"     integer NOT NULL DEFAULT 0,
  "completion_tokens" integer NOT NULL DEFAULT 0,
  "ohne_angabe"       integer NOT NULL DEFAULT 0,
  "modelle"           jsonb NOT NULL DEFAULT '{}'::jsonb,
  "dauer_ms"          integer,
  "detail"            text
);
CREATE INDEX IF NOT EXISTS "gs_ki_verbrauch_vorgang_idx"     ON "grundsicherung"."ki_verbrauch" ("vorgang_id");
CREATE INDEX IF NOT EXISTS "gs_ki_verbrauch_posteingang_idx" ON "grundsicherung"."ki_verbrauch" ("posteingang_id");

-- Transparenz (AI Act Art. 50 / Art. 13, 14 DSGVO): KI-Transparenzhinweis als Default-Textbaustein.
INSERT INTO "grundsicherung"."textbausteine" ("id", "kategorie", "titel", "text") VALUES
  ('tb-seed-ki-transparenz', 'Allgemein', 'KI-Transparenzhinweis',
   'Bei der Bearbeitung Ihres Antrags auf Grundsicherung im Alter und bei Erwerbsminderung wurde ein KI-gestützter Assistent eingesetzt, der die eingereichten Unterlagen auf Vollständigkeit und Plausibilität prüft. Es findet keine automatisierte Einzelentscheidung statt; über Ihren Antrag entscheidet eine Sachbearbeiterin bzw. ein Sachbearbeiter.')
ON CONFLICT ("id") DO NOTHING;
