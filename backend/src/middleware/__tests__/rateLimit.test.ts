/**
 * Tests for rate limiting middleware (backend/src/middleware/rateLimit.ts)
 *
 * Covers: request pass-through within limit, rate limit headers, 429 on excess,
 * independent keys, window expiry, skip function, custom handler,
 * clearAllRateLimits, and getRateLimitStats.
 */

import { test, expect, describe, beforeEach, mock } from "bun:test";
import { Hono } from "hono";

// ---------------------------------------------------------------------------
// Mock getClientIp BEFORE importing the module under test
// ---------------------------------------------------------------------------

mock.module("../../utils/clientIp", () => ({
  getClientIp: () => "127.0.0.1",
}));

const { rateLimit, clearAllRateLimits, getRateLimitStats, clearRateLimit } =
  await import("../rateLimit");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildApp(middleware: ReturnType<typeof rateLimit>) {
  const app = new Hono();
  app.use("/*", middleware);
  app.get("/test", (c) => c.json({ ok: true }));
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("rateLimit", () => {
  beforeEach(() => {
    clearAllRateLimits();
  });

  describe("Anfragen innerhalb des Limits", () => {
    test("sollte Anfragen unterhalb des Limits mit 200 durchlassen", async () => {
      const app = buildApp(rateLimit({ limit: 3, windowMs: 60_000 }));

      const res1 = await app.request("/test");
      const res2 = await app.request("/test");
      const res3 = await app.request("/test");

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res3.status).toBe(200);
    });

    test("sollte korrekte X-RateLimit-Header setzen", async () => {
      const app = buildApp(rateLimit({ limit: 5, windowMs: 60_000 }));

      const res = await app.request("/test");

      expect(res.headers.get("X-RateLimit-Limit")).toBe("5");
      expect(res.headers.get("X-RateLimit-Remaining")).toBe("4");
      expect(res.headers.get("X-RateLimit-Reset")).toBeTruthy();
    });
  });

  describe("Limit überschritten", () => {
    test("sollte 429 zurückgeben wenn das Limit überschritten wird", async () => {
      const app = buildApp(rateLimit({ limit: 2, windowMs: 60_000 }));

      await app.request("/test");
      await app.request("/test");
      const res = await app.request("/test"); // 3rd request exceeds limit of 2

      expect(res.status).toBe(429);
    });

    test("sollte Retry-After Header bei 429 setzen", async () => {
      const app = buildApp(rateLimit({ limit: 1, windowMs: 60_000 }));

      await app.request("/test");
      const res = await app.request("/test"); // exceeds limit

      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBeTruthy();
      const retryAfter = Number(res.headers.get("Retry-After"));
      expect(retryAfter).toBeGreaterThan(0);
    });

    test("sollte X-RateLimit-Remaining auf 0 setzen wenn Limit erreicht ist", async () => {
      const app = buildApp(rateLimit({ limit: 2, windowMs: 60_000 }));

      await app.request("/test");
      const res = await app.request("/test"); // hits exactly the limit

      expect(res.status).toBe(200);
      expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
    });
  });

  describe("Unabhängige Keys", () => {
    test("sollte unterschiedliche Keys unabhängig voneinander zählen", async () => {
      let currentKey = "key-a";
      const app = buildApp(
        rateLimit({
          limit: 2,
          windowMs: 60_000,
          keyGenerator: () => currentKey,
        })
      );

      // Exhaust key-a
      await app.request("/test");
      await app.request("/test");
      const resA = await app.request("/test"); // should be 429 for key-a

      // Switch to key-b — should still get 200
      currentKey = "key-b";
      const resB = await app.request("/test");

      expect(resA.status).toBe(429);
      expect(resB.status).toBe(200);
    });
  });

  describe("Fenster-Ablauf", () => {
    test("sollte den Zähler nach Ablauf des Zeitfensters zurücksetzen", async () => {
      const app = buildApp(rateLimit({ limit: 1, windowMs: 50 })); // 50ms window

      await app.request("/test"); // count = 1, limit reached
      const resBefore = await app.request("/test"); // should be 429

      // Wait for window to expire
      await Bun.sleep(60);

      const resAfter = await app.request("/test"); // new window, should pass

      expect(resBefore.status).toBe(429);
      expect(resAfter.status).toBe(200);
    });
  });

  describe("skip-Funktion", () => {
    test("sollte Rate Limiting überspringen wenn skip() true zurückgibt", async () => {
      const app = buildApp(
        rateLimit({
          limit: 1,
          windowMs: 60_000,
          skip: () => true,
        })
      );

      // Would exceed limit of 1 if skip didn't work
      await app.request("/test");
      await app.request("/test");
      const res = await app.request("/test");

      expect(res.status).toBe(200);
    });
  });

  describe("Custom Handler", () => {
    test("sollte den custom handler aufrufen wenn das Limit überschritten wird", async () => {
      const app = buildApp(
        rateLimit({
          limit: 1,
          windowMs: 60_000,
          handler: (c) =>
            c.json({ custom: true, code: "RATE_LIMITED" }, 429),
        })
      );

      await app.request("/test");
      const res = await app.request("/test"); // exceeds limit

      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.custom).toBe(true);
      expect(body.code).toBe("RATE_LIMITED");
    });
  });

  describe("clearAllRateLimits", () => {
    test("sollte alle Einträge löschen und Rate Limiting zurücksetzen", async () => {
      const app = buildApp(rateLimit({ limit: 1, windowMs: 60_000 }));

      await app.request("/test");
      const resBefore = await app.request("/test"); // 429
      expect(resBefore.status).toBe(429);

      clearAllRateLimits();

      const resAfter = await app.request("/test"); // should pass again
      expect(resAfter.status).toBe(200);
    });
  });

  describe("getRateLimitStats", () => {
    test("sollte korrekte Statistiken zurückgeben", async () => {
      const customKey = "stats-test-key";
      const app = buildApp(
        rateLimit({
          limit: 5,
          windowMs: 60_000,
          keyGenerator: () => customKey,
        })
      );

      await app.request("/test");

      const stats = getRateLimitStats();
      expect(stats.entries).toBeGreaterThanOrEqual(1);
      expect(stats.keys).toContain(customKey);
    });

    test("sollte leere Stats zurückgeben nach clearAllRateLimits", () => {
      const stats = getRateLimitStats();
      expect(stats.entries).toBe(0);
      expect(stats.keys).toEqual([]);
    });
  });

  describe("clearRateLimit", () => {
    test("sollte einen spezifischen Key löschen ohne andere zu beeinflussen", async () => {
      const appA = buildApp(
        rateLimit({ limit: 1, windowMs: 60_000, keyGenerator: () => "key-x" })
      );
      const appB = buildApp(
        rateLimit({ limit: 1, windowMs: 60_000, keyGenerator: () => "key-y" })
      );

      // Exhaust both keys
      await appA.request("/test");
      await appB.request("/test");

      // Clear only key-x
      clearRateLimit("key-x");

      const resX = await appA.request("/test"); // should pass — key cleared
      const resY = await appB.request("/test"); // should be 429 — key-y still present

      expect(resX.status).toBe(200);
      expect(resY.status).toBe(429);
    });
  });
});
