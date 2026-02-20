/**
 * Tests for CSRF protection middleware (backend/src/middleware/csrf.ts)
 *
 * Tests the csrfProtection() factory and the pre-built csrf / csrfWithSkip instances.
 * All tests use a dedicated Hono app so no external services need to be mocked.
 *
 * NOTE: The middleware's isOriginAllowed() helper grants every localhost origin
 * when NODE_ENV !== 'production'. To keep the tests environment-independent,
 * each describe block builds its own Hono app with an explicit allowedOrigins list
 * that contains only the origins intentionally allowed for that scenario.
 */

import { test, expect, describe, beforeEach } from "bun:test";
import { Hono } from "hono";
import { csrfProtection, csrf, csrfWithSkip } from "../csrf";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Build a minimal Hono app that applies the given middleware and exposes one
 *  route per mutation method plus a GET for the pass-through check. */
function buildApp(middleware: ReturnType<typeof csrfProtection>) {
  const app = new Hono();
  app.use("*", middleware);
  app.get("/api/test", (c) => c.json({ ok: true }));
  app.post("/api/test", (c) => c.json({ ok: true }));
  app.put("/api/test", (c) => c.json({ ok: true }));
  app.delete("/api/test", (c) => c.json({ ok: true }));
  app.patch("/api/test", (c) => c.json({ ok: true }));
  return app;
}

/** POST request with application/json body — the canonical valid request. */
function jsonPost(extraHeaders: Record<string, string> = {}) {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body: "{}",
  };
}

// Restrict to a single known origin so "localhost dev bypass" cannot interfere.
const ALLOWED_ORIGIN = "https://app.example.com";
const OTHER_ORIGIN = "https://evil.example.com";

// ---------------------------------------------------------------------------
// 1. GET requests durchlaufen ohne Prüfung
// ---------------------------------------------------------------------------

describe("GET-Anfragen werden ohne CSRF-Prüfung durchgelassen", () => {
  const app = buildApp(csrfProtection({ allowedOrigins: [ALLOWED_ORIGIN] }));

  test("GET ohne Origin-Header liefert 200", async () => {
    const res = await app.request("/api/test");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test("GET mit fremdem Origin-Header liefert dennoch 200", async () => {
    const res = await app.request("/api/test", {
      headers: { Origin: OTHER_ORIGIN },
    });
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// 2. POST/PUT/DELETE/PATCH werden geprüft
// ---------------------------------------------------------------------------

describe("Zustandsändernde Methoden werden auf CSRF geprüft", () => {
  const app = buildApp(csrfProtection({ allowedOrigins: [ALLOWED_ORIGIN] }));

  test("POST ohne Origin und ohne Referer mit application/json wird zugelassen (200)", async () => {
    // No origin, no referer, but json content-type → allowed
    const res = await app.request("/api/test", jsonPost());
    expect(res.status).toBe(200);
  });

  test("DELETE ohne Origin und ohne Referer liefert 403", async () => {
    // DELETE has no content-type body convention; no origin/referer → blocked
    const res = await app.request("/api/test", { method: "DELETE" });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// 3. Gültiger Origin-Header → 200
// ---------------------------------------------------------------------------

describe("Gültiger Origin-Header wird akzeptiert", () => {
  const app = buildApp(csrfProtection({ allowedOrigins: [ALLOWED_ORIGIN] }));

  test("POST mit erlaubtem Origin liefert 200", async () => {
    const res = await app.request("/api/test", jsonPost({ Origin: ALLOWED_ORIGIN }));
    expect(res.status).toBe(200);
  });

  test("PUT mit erlaubtem Origin liefert 200", async () => {
    const res = await app.request("/api/test", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Origin: ALLOWED_ORIGIN },
      body: "{}",
    });
    expect(res.status).toBe(200);
  });

  test("PATCH mit erlaubtem Origin liefert 200", async () => {
    const res = await app.request("/api/test", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Origin: ALLOWED_ORIGIN },
      body: "{}",
    });
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// 4. Ungültiger Origin-Header → 403 "Invalid origin"
// ---------------------------------------------------------------------------

describe("Ungültiger Origin-Header wird blockiert", () => {
  const app = buildApp(csrfProtection({ allowedOrigins: [ALLOWED_ORIGIN] }));

  test("POST mit fremdem Origin liefert 403 mit Meldung 'Invalid origin'", async () => {
    const res = await app.request("/api/test", jsonPost({ Origin: OTHER_ORIGIN }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toBe("Invalid origin");
  });

  test("DELETE mit fremdem Origin liefert 403", async () => {
    const res = await app.request("/api/test", {
      method: "DELETE",
      headers: { Origin: OTHER_ORIGIN },
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toBe("Invalid origin");
  });
});

// ---------------------------------------------------------------------------
// 5. Kein Origin, aber gültiger Referer → 200
// ---------------------------------------------------------------------------

describe("Kein Origin, aber gültiger Referer wird akzeptiert", () => {
  const app = buildApp(csrfProtection({ allowedOrigins: [ALLOWED_ORIGIN] }));

  test("POST ohne Origin, aber mit erlaubtem Referer liefert 200", async () => {
    const res = await app.request("/api/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Referer: `${ALLOWED_ORIGIN}/some/page`,
      },
      body: "{}",
    });
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// 6. Kein Origin, ungültiger Referer → 403
// ---------------------------------------------------------------------------

describe("Kein Origin, ungültiger Referer wird blockiert", () => {
  const app = buildApp(csrfProtection({ allowedOrigins: [ALLOWED_ORIGIN] }));

  test("POST ohne Origin, mit fremdem Referer liefert 403", async () => {
    const res = await app.request("/api/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Referer: `${OTHER_ORIGIN}/attack`,
      },
      body: "{}",
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toBe("Invalid referer");
  });
});

// ---------------------------------------------------------------------------
// 7. Kein Origin, kein Referer, Content-Type application/json → 200
// ---------------------------------------------------------------------------

describe("Kein Origin, kein Referer, application/json wird zugelassen", () => {
  const app = buildApp(csrfProtection({ allowedOrigins: [ALLOWED_ORIGIN] }));

  test("POST mit application/json ohne Header-Kontext liefert 200", async () => {
    const res = await app.request("/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// 8. Kein Origin, kein Referer, Content-Type text/html → 403
// ---------------------------------------------------------------------------

describe("Kein Origin, kein Referer, nicht-JSON Content-Type wird blockiert", () => {
  const app = buildApp(csrfProtection({ allowedOrigins: [ALLOWED_ORIGIN] }));

  test("POST mit text/html ohne Origin liefert 403 'Missing origin header'", async () => {
    const res = await app.request("/api/test", {
      method: "POST",
      headers: { "Content-Type": "text/html" },
      body: "<form/>",
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toBe("Missing origin header");
  });

  test("PUT ohne jegliche Header liefert 403", async () => {
    const res = await app.request("/api/test", { method: "PUT" });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// 9. skipPaths-Konfiguration
// ---------------------------------------------------------------------------

describe("skipPaths überspringt die CSRF-Prüfung für bestimmte Pfade", () => {
  const app = new Hono();
  const middleware = csrfProtection({
    allowedOrigins: [ALLOWED_ORIGIN],
    skipPaths: ["/api/public/"],
  });
  app.use("*", middleware);
  app.post("/api/public/webhook", (c) => c.json({ ok: true }));
  app.post("/api/protected", (c) => c.json({ ok: true }));

  test("POST auf übersprungenen Pfad ohne Origin liefert 200", async () => {
    const res = await app.request("/api/public/webhook", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "payload",
    });
    expect(res.status).toBe(200);
  });

  test("POST auf geschützten Pfad ohne Origin und mit text/plain liefert 403", async () => {
    const res = await app.request("/api/protected", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "payload",
    });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// 10. skip-Funktion als Konfigurationsparameter
// ---------------------------------------------------------------------------

describe("skip-Funktion überspringt die CSRF-Prüfung dynamisch", () => {
  const app = new Hono();
  const middleware = csrfProtection({
    allowedOrigins: [ALLOWED_ORIGIN],
    skip: (c) => c.req.header("x-internal-token") === "secret",
  });
  app.use("*", middleware);
  app.post("/api/internal", (c) => c.json({ ok: true }));

  test("POST mit internem Token-Header überspringt die Prüfung (200)", async () => {
    const res = await app.request("/api/internal", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "x-internal-token": "secret",
      },
      body: "data",
    });
    expect(res.status).toBe(200);
  });

  test("POST ohne internen Token-Header wird blockiert (403)", async () => {
    const res = await app.request("/api/internal", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "data",
    });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// 11. multipart/form-data und application/x-www-form-urlencoded mit Origin
// ---------------------------------------------------------------------------

describe("Formular-Content-Types sind mit gültigem Origin erlaubt", () => {
  const app = buildApp(csrfProtection({ allowedOrigins: [ALLOWED_ORIGIN] }));

  test("POST mit multipart/form-data und erlaubtem Origin liefert 200", async () => {
    const res = await app.request("/api/test", {
      method: "POST",
      headers: {
        // Boundary is required for multipart; origin is present
        "Content-Type": "multipart/form-data; boundary=----boundary",
        Origin: ALLOWED_ORIGIN,
      },
      body: "------boundary--",
    });
    expect(res.status).toBe(200);
  });

  test("POST mit application/x-www-form-urlencoded und erlaubtem Origin liefert 200", async () => {
    const res = await app.request("/api/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: ALLOWED_ORIGIN,
      },
      body: "key=value",
    });
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// 12. Content-Type-Validierung für POST/PUT/PATCH ohne Origin
// ---------------------------------------------------------------------------

describe("Content-Type-Validierung bei POST/PUT/PATCH ohne Origin-Header", () => {
  const app = buildApp(csrfProtection({ allowedOrigins: [ALLOWED_ORIGIN] }));

  test("POST mit ungültigem Content-Type ohne Origin liefert 403", async () => {
    // text/xml has no origin → blocked at the no-origin/no-referer branch
    const res = await app.request("/api/test", {
      method: "POST",
      headers: { "Content-Type": "text/xml" },
      body: "<data/>",
    });
    expect(res.status).toBe(403);
  });

  test("PUT mit application/json ohne Origin liefert 200", async () => {
    const res = await app.request("/api/test", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// 13. Vorinstanz csrf — verwendet Standard-Konfiguration (Development-Modus)
// ---------------------------------------------------------------------------

describe("Vorinstanz 'csrf' akzeptiert localhost-Anfragen in der Entwicklung", () => {
  const app = new Hono();
  app.use("*", csrf);
  app.post("/api/test", (c) => c.json({ ok: true }));

  test("POST von http://localhost:5173 liefert 200", async () => {
    const res = await app.request("/api/test", jsonPost({ Origin: "http://localhost:5173" }));
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// 14. Vorinstanz csrfWithSkip — skipPaths für /api/shared/ und /api/auth/status
// ---------------------------------------------------------------------------

describe("Vorinstanz 'csrfWithSkip' überspringt konfigurierte Pfade", () => {
  const app = new Hono();
  app.use("*", csrfWithSkip);
  app.post("/api/shared/chat", (c) => c.json({ ok: true }));
  app.post("/api/auth/status", (c) => c.json({ ok: true }));
  app.post("/api/protected", (c) => c.json({ ok: true }));

  test("POST auf /api/shared/ ohne Origin liefert 200", async () => {
    const res = await app.request("/api/shared/chat", {
      method: "POST",
      headers: { "Content-Type": "text/html" },
      body: "payload",
    });
    expect(res.status).toBe(200);
  });

  test("POST auf /api/auth/status ohne Origin liefert 200", async () => {
    const res = await app.request("/api/auth/status", {
      method: "POST",
      headers: { "Content-Type": "text/html" },
      body: "payload",
    });
    expect(res.status).toBe(200);
  });

  test("POST auf nicht übersprungenen Pfad ohne gültigen Kontext liefert 403", async () => {
    const res = await app.request("/api/protected", {
      method: "POST",
      headers: { "Content-Type": "text/html" },
      body: "payload",
    });
    expect(res.status).toBe(403);
  });
});
