/**
 * Podcast-Repurposing — DB-Schema (Postgres-Schema `podcast_repurposing`).
 *
 * Eine hochgeladene Episode (Video) wird transkribiert und in viele Formate
 * überführt (Social-Posts, Blog, Mail, Visuals). 1 Output = 1 Zeile → 1 UI-Card.
 * Publishing (späteres geteiltes Marken-Konto) ist über `brandIdentityId` +
 * `brand_identities` vorbereitet, aber in Iteration 1 NICHT gebaut.
 */

import {
  pgSchema,
  text,
  integer,
  jsonb,
  timestamp,
  boolean,
  index,
} from 'drizzle-orm/pg-core';

export const podcastRepurposingSchema = pgSchema('podcast_repurposing');

/** Eine hochgeladene Episode = ein Pipeline-Lauf. */
export const prEpisodes = podcastRepurposingSchema.table('episodes', {
  id: text('id').primaryKey(),                       // pr_ep_<rand>
  userId: text('user_id').notNull(),                 // Owner (Uploader)
  title: text('title').notNull().default('Untitled Episode'),
  // Quelle
  videoS3Key: text('video_s3_key'),
  videoFilename: text('video_filename'),
  videoSizeBytes: integer('video_size_bytes'),
  audioS3Key: text('audio_s3_key'),                  // extrahiertes Audio (mp3)
  transcript: text('transcript'),
  transcriptMeta: jsonb('transcript_meta'),          // { chunks, durationSec?, language }
  // Pipeline-State
  status: text('status').notNull().default('uploaded'),
  // uploaded | extracting_audio | transcribing | generating | done | failed
  pipelineSteps: jsonb('pipeline_steps').notNull().default([]), // [{id,name,status,error?}]
  error: text('error'),
  // Forward-Compat für späteres Publishing unter GETEILTER Identität (nicht per-User).
  brandIdentityId: text('brand_identity_id'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index('pr_ep_user_idx').on(t.userId, t.createdAt),
}));

/** 1 Zeile je Text-Output (Social-Post / Blog / Mail). */
export const prOutputs = podcastRepurposingSchema.table('outputs', {
  id: text('id').primaryKey(),                        // pr_out_<rand>
  episodeId: text('episode_id').notNull(),
  kind: text('kind').notNull(),                       // 'social' | 'blog' | 'email'
  platform: text('platform'),                         // 'facebook'|'linkedin'|'tiktok'|'instagram'|null
  variant: integer('variant').notNull().default(0),
  formatId: text('format_id').notNull(),              // -> pr_formats.id
  title: text('title'),
  content: text('content').notNull().default(''),
  fields: jsonb('fields'),                            // { hashtags?, cta?, subject? }
  status: text('status').notNull().default('generated'), // generating|generated|edited|failed
  edited: boolean('edited').notNull().default(false),
  modelUsed: text('model_used'),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  // PUBLISHING-HOOK (später, eigene Migration): publish_status / published_at / external_ref.
}, (t) => ({
  epIdx: index('pr_out_ep_idx').on(t.episodeId, t.kind),
}));

/** 1 Zeile je Visual; verweist auf die bestehende generated.images-Tabelle. */
export const prVisuals = podcastRepurposingSchema.table('visuals', {
  id: text('id').primaryKey(),                        // pr_vis_<rand>
  episodeId: text('episode_id').notNull(),
  role: text('role').notNull(),                       // 'youtube_thumbnail'|'quote_card'|'vertical_story'
  aspectRatio: text('aspect_ratio').notNull(),        // '16:9'|'1:1'|'9:16'
  imageId: text('image_id'),                          // generated.images.id
  prompt: text('prompt'),
  status: text('status').notNull().default('generated'),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  epIdx: index('pr_vis_ep_idx').on(t.episodeId, t.role),
}));

/** Editierbare Format-Vorlagen — geseedet, in den App-Settings pflegbar. */
export const prFormats = podcastRepurposingSchema.table('formats', {
  id: text('id').primaryKey(),                        // 'linkedin_post', 'blog_post', ...
  kind: text('kind').notNull(),                       // 'social'|'blog'|'email'|'visual'
  platform: text('platform'),
  label: text('label').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  variants: integer('variants').notNull().default(1),
  aspectRatio: text('aspect_ratio'),                  // für visual-Formate
  systemPrompt: text('system_prompt').notNull(),
  userPromptTemplate: text('user_prompt_template').notNull(), // {{transcript}} {{title}}
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});

/**
 * Geteilte Marken-Identität fürs Publishing (Service-Identität, nicht per-User).
 * `settings` hält die verschlüsselten Provider-Credentials, z. B.
 *   { podigee: { podcastId: string, token: <EncryptedTokenSet> },
 *     youtube: { ... } }
 * Verschlüsselung via CONNECTION_ENCRYPTION_KEY (connections/crypto).
 */
export const prBrandIdentities = podcastRepurposingSchema.table('brand_identities', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  settings: jsonb('settings').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});

/** 1 Zeile je Veröffentlichung einer Episode auf einer Plattform. */
export const prPublications = podcastRepurposingSchema.table('publications', {
  id: text('id').primaryKey(),                        // pr_pub_<rand>
  episodeId: text('episode_id').notNull(),
  platform: text('platform').notNull(),               // 'podigee' | 'youtube'
  status: text('status').notNull().default('pending'), // pending|processing|draft|published|failed
  externalId: text('external_id'),                    // Podigee episode_id / YouTube videoId
  externalUrl: text('external_url'),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  epIdx: index('pr_pub_ep_idx').on(t.episodeId, t.platform),
}));
