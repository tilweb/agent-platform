-- Phase D: Portfolio-Entity — Gruppierung von Projekten fuer PMO-Sicht.
-- 0..1-Kardinalitaet ueber paProjekte.portfolioId (existiert seit 0010).
-- Kein FK-Constraint zur paPortfolios — bewusst: Loeschen eines Portfolios
-- soll die Projekte nicht kaskadierend mitloeschen. Application-level cleanup
-- setzt portfolio_id im Service auf NULL.

CREATE TABLE IF NOT EXISTS "projektmgmt"."portfolios" (
  "id" text PRIMARY KEY NOT NULL,
  "owner_id" text,
  "name" text NOT NULL,
  "description" text,
  "strategy" text,
  "status" text NOT NULL DEFAULT 'active',
  "metadata" jsonb,
  "permissions" jsonb,
  "version" integer NOT NULL DEFAULT 1,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "portfolio_owner_idx" ON "projektmgmt"."portfolios" ("owner_id");
CREATE INDEX IF NOT EXISTS "portfolio_status_idx" ON "projektmgmt"."portfolios" ("status");
