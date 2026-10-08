-- Document Processing — Eingangsmodell und Umschlag je Upload (Konzept DP-Produktmodell §3/§5).
-- Spec: docs/dp-produktmodell-umsetzung-spec-2026-10-09.md
-- Idempotent (IF NOT EXISTS), wird von migrate() beim Boot angewendet.

ALTER TABLE "extraction"."inbox_uploads" ADD COLUMN IF NOT EXISTS "modus" text NOT NULL DEFAULT 'stapel';--> statement-breakpoint
ALTER TABLE "extraction"."inbox_uploads" ADD COLUMN IF NOT EXISTS "profil_id" text;--> statement-breakpoint
ALTER TABLE "extraction"."inbox_uploads" ADD COLUMN IF NOT EXISTS "quelle" text NOT NULL DEFAULT 'oberflaeche';--> statement-breakpoint
ALTER TABLE "extraction"."inbox_uploads" ADD COLUMN IF NOT EXISTS "callback_url" text;--> statement-breakpoint
ALTER TABLE "extraction"."inbox_uploads" ADD COLUMN IF NOT EXISTS "webhook_status" text;--> statement-breakpoint
ALTER TABLE "extraction"."inbox_uploads" ADD COLUMN IF NOT EXISTS "webhook_error" text;--> statement-breakpoint
ALTER TABLE "extraction"."inbox_uploads" ADD COLUMN IF NOT EXISTS "abrechnung" jsonb;
