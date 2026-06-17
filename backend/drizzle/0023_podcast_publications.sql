-- Podcast-Repurposing — Publishing (Phase 2): Publikations-Tabelle.
-- 1 Zeile je Veröffentlichung einer Episode auf einer Plattform (Podigee/YouTube).
-- Brand-Credentials liegen verschlüsselt in podcast_repurposing.brand_identities (0022).

CREATE TABLE IF NOT EXISTS "podcast_repurposing"."publications" (
  "id"            text PRIMARY KEY NOT NULL,
  "episode_id"    text NOT NULL,
  "platform"      text NOT NULL,                 -- 'podigee' | 'youtube'
  "status"        text NOT NULL DEFAULT 'pending', -- pending|processing|draft|published|failed
  "external_id"   text,
  "external_url"  text,
  "error"         text,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"    timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "pr_pub_ep_idx"
  ON "podcast_repurposing"."publications" ("episode_id", "platform");
