/**
 * Tests for the security headers middleware (backend/src/middleware/securityHeaders.ts)
 *
 * Verifies that all expected HTTP security headers are set on responses,
 * that CSP is built correctly for different configurations, and that
 * Cache-Control is added only for API routes.
 */

import { test, expect, describe } from "bun:test";
import { Hono } from "hono";
import { securityHeaders, apiSecurityHeaders, strictSecurityHeaders } from "../securityHeaders";

// ---------------------------------------------------------------------------
// Helper: create a minimal Hono app with the given middleware
// ---------------------------------------------------------------------------

function makeApp(middleware: ReturnType<typeof securityHeaders>) {
  const app = new Hono();
  app.use("*", middleware);
  app.get("/api/test", (c) => c.json({ ok: true }));
  app.get("/other", (c) => c.json({ ok: true }));
  return app;
}

// ---------------------------------------------------------------------------
// Standard security headers
// ---------------------------------------------------------------------------

describe("securityHeaders — Basisheader", () => {
  const app = makeApp(securityHeaders());

  test("X-Frame-Options wird auf DENY gesetzt", async () => {
    const res = await app.request("/other");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
  });

  test("X-Content-Type-Options wird auf nosniff gesetzt", async () => {
    const res = await app.request("/other");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  test("X-XSS-Protection wird korrekt gesetzt", async () => {
    const res = await app.request("/other");
    expect(res.headers.get("X-XSS-Protection")).toBe("1; mode=block");
  });

  test("Referrer-Policy wird auf strict-origin-when-cross-origin gesetzt", async () => {
    const res = await app.request("/other");
    expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  test("Permissions-Policy deaktiviert geolocation und camera", async () => {
    const res = await app.request("/other");
    const policy = res.headers.get("Permissions-Policy") ?? "";
    expect(policy).toContain("geolocation=()");
    expect(policy).toContain("camera=()");
  });
});

// ---------------------------------------------------------------------------
// Content-Security-Policy directives
// ---------------------------------------------------------------------------

describe("securityHeaders — Content-Security-Policy", () => {
  const app = makeApp(securityHeaders());

  test("CSP enthält default-src, script-src, style-src und img-src Direktiven", async () => {
    const res = await app.request("/other");
    const csp = res.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("default-src");
    expect(csp).toContain("script-src");
    expect(csp).toContain("style-src");
    expect(csp).toContain("img-src");
  });

  test("CSP enthält 'unsafe-inline' für Styles wenn allowInlineStyles nicht deaktiviert ist", async () => {
    const res = await app.request("/other");
    const csp = res.headers.get("Content-Security-Policy") ?? "";
    // style-src directive should contain 'unsafe-inline'
    const styleSrcMatch = csp.match(/style-src ([^;]+)/);
    expect(styleSrcMatch).not.toBeNull();
    expect(styleSrcMatch![1]).toContain("'unsafe-inline'");
  });

  test("CSP enthält kein 'unsafe-inline' für Scripts standardmäßig", async () => {
    const res = await app.request("/other");
    const csp = res.headers.get("Content-Security-Policy") ?? "";
    const scriptSrcMatch = csp.match(/script-src ([^;]+)/);
    expect(scriptSrcMatch).not.toBeNull();
    expect(scriptSrcMatch![1]).not.toContain("'unsafe-inline'");
  });

  test("CSP enthält kein 'unsafe-inline' für Styles wenn allowInlineStyles auf false gesetzt ist", async () => {
    const strictApp = makeApp(securityHeaders({ allowInlineStyles: false }));
    const res = await strictApp.request("/other");
    const csp = res.headers.get("Content-Security-Policy") ?? "";
    const styleSrcMatch = csp.match(/style-src ([^;]+)/);
    expect(styleSrcMatch).not.toBeNull();
    expect(styleSrcMatch![1]).not.toContain("'unsafe-inline'");
  });

  test("Benutzerdefinierte scriptSrc, connectSrc und imgSrc werden in die CSP aufgenommen", async () => {
    const customApp = makeApp(securityHeaders({
      scriptSrc: ["https://cdn.example.com"],
      connectSrc: ["https://api.example.com"],
      imgSrc: ["https://images.example.com"],
    }));
    const res = await customApp.request("/other");
    const csp = res.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("https://cdn.example.com");
    expect(csp).toContain("https://api.example.com");
    expect(csp).toContain("https://images.example.com");
  });
});

// ---------------------------------------------------------------------------
// Cache-Control for API vs. non-API routes
// ---------------------------------------------------------------------------

describe("securityHeaders — Cache-Control", () => {
  const app = makeApp(securityHeaders());

  test("API-Pfade erhalten Cache-Control: no-store", async () => {
    const res = await app.request("/api/test");
    const cacheControl = res.headers.get("Cache-Control") ?? "";
    expect(cacheControl).toContain("no-store");
  });

  test("Nicht-API-Pfade erhalten keinen Cache-Control-Header", async () => {
    const res = await app.request("/other");
    expect(res.headers.get("Cache-Control")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Report-Only mode
// ---------------------------------------------------------------------------

describe("securityHeaders — reportOnly-Modus", () => {
  test("reportOnly-Modus verwendet Content-Security-Policy-Report-Only statt Content-Security-Policy", async () => {
    const reportOnlyApp = makeApp(securityHeaders({ reportOnly: true }));
    const res = await reportOnlyApp.request("/other");
    expect(res.headers.get("Content-Security-Policy-Report-Only")).not.toBeNull();
    expect(res.headers.get("Content-Security-Policy")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Pre-built instances
// ---------------------------------------------------------------------------

describe("apiSecurityHeaders — vorkonfigurierte Instanz", () => {
  test("setzt X-Frame-Options und gibt CSP zurück", async () => {
    const app = new Hono();
    app.use("*", apiSecurityHeaders);
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("Content-Security-Policy")).not.toBeNull();
  });
});

describe("strictSecurityHeaders — vorkonfigurierte Instanz", () => {
  test("setzt X-Frame-Options und enthält Adacor-API in connect-src", async () => {
    const app = new Hono();
    app.use("*", strictSecurityHeaders);
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    const csp = res.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("https://api.adacor.ai");
  });
});
