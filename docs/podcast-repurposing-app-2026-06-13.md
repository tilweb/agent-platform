# App „Podcast-Repurposing" — Iteration 1 (Generierung + Review)

**Stand:** 2026-06-13 · **Worktree:** main (Scalingo/Postgres) · **Status:** implementiert, lokal kompiliert/geboot-verifiziert; Browser-E2E + Railway-Spiegelung offen.

## Kontext
Ein Podcast-Video soll automatisch in viele Formate überführt werden: Social-Posts (Facebook,
LinkedIn, TikTok, Instagram), ein Blogpost, eine Danke-Mail an die Gäste, plus Visuals.
**Iteration 1** liefert nur **Generierung + Review** (kein echtes Publishing). Publishing
(geteiltes Marken-Konto/Service-Identität auf YouTube/„Prodigy"/Social) und **Analytics** sind
bewusst spätere Phasen.

## Entscheidungen
- **Eigene App mit UI** (nicht chat-only) — Episode hochladen → Outputs verwalten/freigeben.
- **App-eigene, deterministische Pipeline** statt Agent-Loop: pro Output 1 LLM-Call gegen eine
  editierbare Format-Vorlage → 1 DB-Zeile → 1 UI-Card mit Edit/Copy/Regenerate. Der
  `taskExecutor` ist agenten-/freitext-orientiert und für strukturierte Felder ungeeignet.
  (Spätere Evolution zu einem Agent+Skills-Setup ist ein reiner Generator-Austausch hinter
  `generateOutput()`.)
- **Reuse-first:** `llmService.chat`, Whisper-Transkription, `generate_image`/`imageStorage`, S3,
  Settings-Seed-Pattern, App-Gerüst.
- **Input:** Video-Upload. Publishing-Identität (später): geteiltes Marken-Konto → Datenmodell
  via `episodes.brand_identity_id` + Tabelle `brand_identities` vorbereitet, nicht gebaut.

## Architektur / Dateien (MAIN)
**Datenmodell** — `backend/src/db/schema/podcast-repurposing.ts` (Schema `podcast_repurposing`),
Migration `backend/drizzle/0022_podcast_repurposing.sql` (+ Journal-Eintrag idx 22):
- `episodes` (Video/Audio-S3-Keys, transcript, status, pipeline_steps, brand_identity_id)
- `outputs` (1 Zeile je Text: kind/platform/variant/format_id/title/content/fields/status/edited)
- `visuals` (role/aspect_ratio/image_id → `generated.images`)
- `formats` (editierbare Vorlagen: system_prompt + user_prompt_template, enabled, variants)
- `brand_identities` (Forward-Compat, leer)

**Pipeline** — `backend/src/apps/podcast-repurposing/pipeline.ts` (fire-and-forget aus der Upload-Route):
1. Audio extrahieren (`services/audioExtraction.ts`: ffmpeg `-vn -ar 16000 -ac 1 -b:a 64k`)
2. Transkribieren (`services/transcriptionService.ts` — aus `routes/transcription.ts` extrahierter
   Whisper-Kern; > 24 MB via ffmpeg `-f segment` chunken, sequenziell, zusammenfügen)
3. Texte generieren (`llmService.chat`, JSON-Antwort tolerant parsen → `outputs`)
4. Visuals (Bild-Prompt via LLM → `imageGenerationService.generate` + `saveGeneratedImage` → `visuals`)
   Fail-soft: ein fehlgeschlagener Schritt/Record bricht die Episode nicht ab; Status/Steps in der DB.

**App-Wiring** — `apps/podcast-repurposing/{index,types,service,storage,seed-formats,routes}.ts`;
registriert in `apps/registry.ts` (`BUILT_IN_APPS`) + `routes/apps.ts` (Mount + Sub-Route-Skip-Liste);
Format-Seed in `index.ts` neben dem Vorgangsmappe-Seed. App `enabled:false` (Admin schaltet frei).

**Frontend** — `frontend/src/apps/podcast-repurposing/`: `EpisodesListPage`, `UploadPage`,
`EpisodeDetailPage` (Pipeline-Progress gepollt + Output-/Visual-Cards), `SettingsPage`,
`components/{OutputCard,VisualCard}.jsx`. Routen in `App.jsx` (`RequireAppPermission`).

## Format-Katalog (geseedet, in Settings editierbar)
`facebook_post · linkedin_post · tiktok_caption · instagram_caption` (social) · `blog_post` ·
`guest_thankyou_email` · `youtube_thumbnail` 16:9 · `quote_card` 1:1 · `vertical_story` 9:16.

## Verifikation
- Backend `tsc --noEmit`: 0 Fehler. Frontend `npm run build`: grün.
- Boot: `migrations applied` (0022), `[seed-podcast-repurposing] formats added=…`, App in Built-in-Sync,
  Health 200; DB-Gegenprobe `formats=9`.
- **Offen (manuell, Browser):** App in Apps-Admin freischalten + Gruppe berechtigen → kurzes MP4
  hochladen → Pipeline-Progress → 4 Social + Blog + Mail + 3 Visuals → einen Output editieren/neu
  generieren. STT + Bildmodell müssen konfiguriert sein.

## Offene Punkte / nächste Phasen
- **Railway-Spiegelung:** Storage-Modell klären (Postgres+Drizzle vs. YAML laut Railway-CLAUDE.md),
  dann spiegeln bzw. YAML-Variante bauen.
- **Streaming-Upload** statt `arrayBuffer()` für sehr große Videos; Restart-Recovery für hängende Episoden.
- **Phase 2a — Podigee-Publishing: GEBAUT** (Entwurf/Review-Modus). `publishing/podigee.ts`, Tabelle
  `pr_publications` (Migration 0023), verschlüsselte Marken-Credentials in `pr_brand_identities`
  (app-eigen, kein volles Service-Identity-Framework). HQ-Audio (44,1 kHz) aus dem Video extrahiert.
  UI: Settings (Podigee-Token/Show) + Episode-Detail (Veröffentlichen). Echter Lauf braucht Podigee-Account/Token.
- **Phase 2b — YouTube:** offen (OAuth-Marken-Channel + resumable Upload + sensibler Scope `youtube.upload`,
  Testing-Mode für Pilot; Quota ~6 Uploads/Tag).
- **Phase 3:** Analytics.
