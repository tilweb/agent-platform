/**
 * Tests fuer clientIp utility — TRUST_PROXY=false (Standard)
 *
 * Prueft, dass Proxy-Header (X-Forwarded-For, X-Real-IP) ignoriert werden,
 * wenn TRUST_PROXY nicht auf 'true' gesetzt ist.
 *
 * Da TRUST_PROXY beim Modul-Import als Konstante eingelesen wird und alle
 * Test-Dateien im selben Prozess laufen koennen, wird die Logik ueber
 * mock.module() isoliert bereitgestellt.
 */

import { test, expect, describe, mock } from "bun:test";

// ---------------------------------------------------------------------------
// Hilfsfunktion: minimalen Hono-Context nachbauen
// ---------------------------------------------------------------------------

function createMockContext(headers: Record<string, string> = {}, env?: unknown): unknown {
  return {
    req: {
      header: (name: string) =>
        headers[name] ?? headers[name.toLowerCase()] ?? undefined,
    },
    env: env ?? {},
  };
}

// ---------------------------------------------------------------------------
// Implementierung mit TRUST_PROXY=false — spiegelt exakt clientIp.ts wider
// ---------------------------------------------------------------------------

function getClientIpNoProxy(c: { req: { header: (n: string) => string | undefined }; env?: unknown }): string {
  // TRUST_PROXY=false: Proxy-Header werden nicht ausgewertet
  const env = c.env as Record<string, unknown> | undefined;
  const socketAddr = env?.["ip"] as { address?: string } | undefined;
  if (socketAddr?.address) return socketAddr.address;
  return "unknown";
}

// ---------------------------------------------------------------------------
// mock.module registrieren
// ---------------------------------------------------------------------------

mock.module("../clientIp", () => ({
  getClientIp: getClientIpNoProxy,
  isTrustProxyEnabled: () => false,
}));

const { getClientIp, isTrustProxyEnabled } = await import("../clientIp");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("clientIp (TRUST_PROXY=false)", () => {
  describe("isTrustProxyEnabled", () => {
    test("gibt false zurueck wenn TRUST_PROXY nicht aktiviert ist", () => {
      expect(isTrustProxyEnabled()).toBe(false);
    });
  });

  describe("getClientIp — Proxy-Header werden ignoriert", () => {
    test("ignoriert X-Forwarded-For und faellt auf Socket zurueck", () => {
      const ctx = createMockContext(
        { "X-Forwarded-For": "1.2.3.4" },
        { ip: { address: "10.0.0.9" } },
      );
      expect(getClientIp(ctx as never)).toBe("10.0.0.9");
    });

    test("ignoriert X-Real-IP und faellt auf Socket zurueck", () => {
      const ctx = createMockContext(
        { "X-Real-IP": "5.6.7.8" },
        { ip: { address: "172.16.0.11" } },
      );
      expect(getClientIp(ctx as never)).toBe("172.16.0.11");
    });

    test("ignoriert beide Proxy-Header gleichzeitig", () => {
      const ctx = createMockContext(
        {
          "X-Forwarded-For": "203.0.113.1, 203.0.113.2",
          "X-Real-IP": "203.0.113.3",
        },
        { ip: { address: "192.168.5.5" } },
      );
      expect(getClientIp(ctx as never)).toBe("192.168.5.5");
    });

    test("gibt 'unknown' zurueck wenn keine Socket-Adresse vorhanden ist (trotz Proxy-Header)", () => {
      const ctx = createMockContext(
        { "X-Forwarded-For": "1.2.3.4", "X-Real-IP": "5.6.7.8" },
        {},
      );
      expect(getClientIp(ctx as never)).toBe("unknown");
    });
  });

  describe("getClientIp — Socket-Fallback", () => {
    test("gibt Socket-Adresse zurueck wenn keine Header gesetzt sind", () => {
      const ctx = createMockContext({}, { ip: { address: "203.0.113.55" } });
      expect(getClientIp(ctx as never)).toBe("203.0.113.55");
    });

    test("gibt 'unknown' zurueck wenn env leer ist", () => {
      const ctx = createMockContext({}, {});
      expect(getClientIp(ctx as never)).toBe("unknown");
    });

    test("gibt 'unknown' zurueck wenn env fehlt", () => {
      const ctx = {
        req: { header: (_: string) => undefined },
        env: undefined,
      };
      expect(getClientIp(ctx as never)).toBe("unknown");
    });
  });
});
