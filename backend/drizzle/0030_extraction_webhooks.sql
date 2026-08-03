-- API & Integration (Welle 5): Webhook-Ziel je Projekt ({url, secret}) und
-- Zustell-Status je Batch-Lauf. Additiv, kein Backfill — Laeufe ohne Webhook
-- verhalten sich wie bisher.
ALTER TABLE "extraction"."projects" ADD COLUMN IF NOT EXISTS "webhook" jsonb;
ALTER TABLE "extraction"."batch_runs" ADD COLUMN IF NOT EXISTS "webhook_url" text;
ALTER TABLE "extraction"."batch_runs" ADD COLUMN IF NOT EXISTS "webhook_status" text;
ALTER TABLE "extraction"."batch_runs" ADD COLUMN IF NOT EXISTS "webhook_attempts" integer;
ALTER TABLE "extraction"."batch_runs" ADD COLUMN IF NOT EXISTS "webhook_error" text;
