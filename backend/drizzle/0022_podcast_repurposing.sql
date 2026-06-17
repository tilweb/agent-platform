-- Podcast-Repurposing — App-Schema (Iteration 1: Generierung + Review).
--
-- Fünf Tabellen im Schema `podcast_repurposing`:
--   episodes          — hochgeladene Episode + Pipeline-State
--   outputs           — 1 Zeile je Text-Output (Social/Blog/Mail)
--   visuals           — 1 Zeile je generiertem Bild (-> generated.images)
--   formats           — editierbare Format-Vorlagen (geseedet)
--   brand_identities  — Forward-Compat fürs spätere Publishing (geteilte Identität)
--
-- Alles idempotent (IF NOT EXISTS), wird von migrate() beim Boot angewendet.

CREATE SCHEMA IF NOT EXISTS "podcast_repurposing";

CREATE TABLE IF NOT EXISTS "podcast_repurposing"."episodes" (
  "id"                text PRIMARY KEY NOT NULL,
  "user_id"           text NOT NULL,
  "title"             text NOT NULL DEFAULT 'Untitled Episode',
  "video_s3_key"      text,
  "video_filename"    text,
  "video_size_bytes"  integer,
  "audio_s3_key"      text,
  "transcript"        text,
  "transcript_meta"   jsonb,
  "status"            text NOT NULL DEFAULT 'uploaded',
  "pipeline_steps"    jsonb NOT NULL DEFAULT '[]'::jsonb,
  "error"             text,
  "brand_identity_id" text,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"        timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "pr_ep_user_idx"
  ON "podcast_repurposing"."episodes" ("user_id", "created_at");

CREATE TABLE IF NOT EXISTS "podcast_repurposing"."outputs" (
  "id"          text PRIMARY KEY NOT NULL,
  "episode_id"  text NOT NULL,
  "kind"        text NOT NULL,
  "platform"    text,
  "variant"     integer NOT NULL DEFAULT 0,
  "format_id"   text NOT NULL,
  "title"       text,
  "content"     text NOT NULL DEFAULT '',
  "fields"      jsonb,
  "status"      text NOT NULL DEFAULT 'generated',
  "edited"      boolean NOT NULL DEFAULT false,
  "model_used"  text,
  "error"       text,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"  timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "pr_out_ep_idx"
  ON "podcast_repurposing"."outputs" ("episode_id", "kind");

CREATE TABLE IF NOT EXISTS "podcast_repurposing"."visuals" (
  "id"            text PRIMARY KEY NOT NULL,
  "episode_id"    text NOT NULL,
  "role"          text NOT NULL,
  "aspect_ratio"  text NOT NULL,
  "image_id"      text,
  "prompt"        text,
  "status"        text NOT NULL DEFAULT 'generated',
  "error"         text,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"    timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "pr_vis_ep_idx"
  ON "podcast_repurposing"."visuals" ("episode_id", "role");

CREATE TABLE IF NOT EXISTS "podcast_repurposing"."formats" (
  "id"                    text PRIMARY KEY NOT NULL,
  "kind"                  text NOT NULL,
  "platform"              text,
  "label"                 text NOT NULL,
  "enabled"               boolean NOT NULL DEFAULT true,
  "variants"              integer NOT NULL DEFAULT 1,
  "aspect_ratio"          text,
  "system_prompt"         text NOT NULL,
  "user_prompt_template"  text NOT NULL,
  "sort_order"            integer NOT NULL DEFAULT 0,
  "created_at"            timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"            timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "podcast_repurposing"."brand_identities" (
  "id"          text PRIMARY KEY NOT NULL,
  "label"       text NOT NULL,
  "settings"    jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now()
);
