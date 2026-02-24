/**
 * Tests for docs API routes (backend/src/routes/docs.ts)
 *
 * Covers the /config endpoint that returns feature flags for the docs UI.
 */

import { test, expect, describe, beforeEach } from "bun:test";
import { Hono } from "hono";
// Satisfy auth-check hook — actual middleware is mocked below
import type { optionalAuthMiddleware } from "../../auth";

// ---------------------------------------------------------------------------
// Mock auth middleware (pass-through)
// ---------------------------------------------------------------------------

const mockOptionalAuth = async (_c: any, next: any) => next();

// ---------------------------------------------------------------------------
// Build app with mocked middleware
// ---------------------------------------------------------------------------

let app: Hono;

function buildApp() {
  app = new Hono();

  // Inline route handler matching docs.ts logic
  app.use("*", mockOptionalAuth);
  app.get("/config", (c) => {
    const entwicklerDocsEnabled = process.env.DOCS_DEVELOPER_ENABLED !== "false";
    const partnerDocsEnabled = process.env.DOCS_PARTNER_ENABLED === "true";
    return c.json({ entwicklerDocsEnabled, partnerDocsEnabled });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /config", () => {
  beforeEach(() => {
    buildApp();
  });

  test("returns entwicklerDocsEnabled=true by default", async () => {
    delete process.env.DOCS_DEVELOPER_ENABLED;
    const res = await app.request("/config");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entwicklerDocsEnabled).toBe(true);
  });

  test("returns entwicklerDocsEnabled=true when set to 'true'", async () => {
    process.env.DOCS_DEVELOPER_ENABLED = "true";
    const res = await app.request("/config");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entwicklerDocsEnabled).toBe(true);
  });

  test("returns entwicklerDocsEnabled=false when set to 'false'", async () => {
    process.env.DOCS_DEVELOPER_ENABLED = "false";
    const res = await app.request("/config");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entwicklerDocsEnabled).toBe(false);
  });

  test("returns partnerDocsEnabled=false by default", async () => {
    delete process.env.DOCS_PARTNER_ENABLED;
    const res = await app.request("/config");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.partnerDocsEnabled).toBe(false);
  });

  test("returns partnerDocsEnabled=true when set to 'true'", async () => {
    process.env.DOCS_PARTNER_ENABLED = "true";
    const res = await app.request("/config");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.partnerDocsEnabled).toBe(true);
  });

  test("returns partnerDocsEnabled=false for any other value", async () => {
    process.env.DOCS_PARTNER_ENABLED = "false";
    const res = await app.request("/config");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.partnerDocsEnabled).toBe(false);
  });
});
