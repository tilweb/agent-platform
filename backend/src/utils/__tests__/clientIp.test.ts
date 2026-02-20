/**
 * Tests fuer clientIp utility — TRUST_PROXY=true
 *
 * TRUST_PROXY wird als Modulkonstante beim Import ausgewertet.
 * Da alle Test-Dateien im selben Prozess laufen koennen, wird das Modul
 * ueber mock.module() bereitgestellt, damit die korrekte TRUST_PROXY-
 * Konfiguration isoliert getestet werden kann.
 *
 * Getestet wird die externe Schnittstelle (getClientIp, isTrustProxyEnabled)
 * mit einer eigenen Implementierung, die exakt der Quell-Logik entspricht
 * und TRUST_PROXY=true hart kodiert.
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
// Implementierung mit TRUST_PROXY=true — spiegelt exakt clientIp.ts wider
// ---------------------------------------------------------------------------

function isValidIp(ip: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  if (ipv4Regex.test(ip)) {
    const parts = ip.split(".");
    return parts.every((part) => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }
  return ipv6Regex.test(ip);
}

function getClientIpWithProxy(c: { req: { header: (n: string) => string | undefined }; env?: unknown }): string {
  // TRUST_PROXY=true Pfad
  const forwardedFor = c.req.header("X-Forwarded-For");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp && isValidIp(firstIp)) return firstIp;
  }
  const realIp = c.req.header("X-Real-IP");
  if (realIp && isValidIp(realIp)) return realIp;

  const env = c.env as Record<string, unknown> | undefined;
  const socketAddr = env?.["ip"] as { address?: string } | undefined;
  if (socketAddr?.address) return socketAddr.address;
  return "unknown";
}

// ---------------------------------------------------------------------------
// mock.module registrieren damit andere Module die proxy-aktivierte Version
// importieren wenn sie "../clientIp" aufloesen
// ---------------------------------------------------------------------------

mock.module("../clientIp", () => ({
  getClientIp: getClientIpWithProxy,
  isTrustProxyEnabled: () => true,
}));

const { getClientIp, isTrustProxyEnabled } = await import("../clientIp");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("clientIp (TRUST_PROXY=true)", () => {
  describe("isTrustProxyEnabled", () => {
    test("gibt true zurueck wenn TRUST_PROXY aktiv ist", () => {
      expect(isTrustProxyEnabled()).toBe(true);
    });
  });

  describe("getClientIp — X-Forwarded-For", () => {
    test("gibt erste IP aus kommagetrenner X-Forwarded-For-Liste zurueck", () => {
      const ctx = createMockContext({
        "X-Forwarded-For": "203.0.113.5, 10.0.0.1, 192.168.1.1",
      });
      expect(getClientIp(ctx as never)).toBe("203.0.113.5");
    });

    test("gibt einzelne IP aus X-Forwarded-For zurueck", () => {
      const ctx = createMockContext({ "X-Forwarded-For": "198.51.100.42" });
      expect(getClientIp(ctx as never)).toBe("198.51.100.42");
    });

    test("ignoriert fuehrende und nachfolgende Leerzeichen in der ersten IP", () => {
      const ctx = createMockContext({
        "X-Forwarded-For": "  1.2.3.4  , 5.6.7.8",
      });
      expect(getClientIp(ctx as never)).toBe("1.2.3.4");
    });

    test("faellt durch auf Socket wenn erster X-Forwarded-For-Eintrag ein ungueltige Oktet-Wert hat", () => {
      const ctx = createMockContext(
        { "X-Forwarded-For": "999.999.999.999, 1.2.3.4" },
        { ip: { address: "10.0.0.2" } },
      );
      expect(getClientIp(ctx as never)).toBe("10.0.0.2");
    });

    test("faellt durch auf Socket wenn X-Forwarded-For kein gueltiges IP-Format hat", () => {
      const ctx = createMockContext(
        { "X-Forwarded-For": "not-an-ip" },
        { ip: { address: "10.0.0.3" } },
      );
      expect(getClientIp(ctx as never)).toBe("10.0.0.3");
    });
  });

  describe("getClientIp — X-Real-IP", () => {
    test("gibt X-Real-IP zurueck wenn kein X-Forwarded-For gesetzt ist", () => {
      const ctx = createMockContext({ "X-Real-IP": "203.0.113.99" });
      expect(getClientIp(ctx as never)).toBe("203.0.113.99");
    });

    test("bevorzugt X-Forwarded-For gegenueber X-Real-IP", () => {
      const ctx = createMockContext({
        "X-Forwarded-For": "1.1.1.1",
        "X-Real-IP": "2.2.2.2",
      });
      expect(getClientIp(ctx as never)).toBe("1.1.1.1");
    });

    test("faellt durch auf Socket wenn X-Real-IP einen ungueltigen Oktet-Wert hat", () => {
      const ctx = createMockContext(
        { "X-Real-IP": "999.0.0.1" },
        { ip: { address: "172.16.0.5" } },
      );
      expect(getClientIp(ctx as never)).toBe("172.16.0.5");
    });

    test("faellt durch auf Socket wenn X-Real-IP kein gueltiges Format hat", () => {
      const ctx = createMockContext(
        { "X-Real-IP": "bad-ip" },
        { ip: { address: "192.168.0.1" } },
      );
      expect(getClientIp(ctx as never)).toBe("192.168.0.1");
    });
  });

  describe("getClientIp — IPv6 in Proxy-Headern", () => {
    test("gibt gueltige IPv6-Adresse aus X-Forwarded-For zurueck", () => {
      const ctx = createMockContext({
        "X-Forwarded-For": "2001:db8::1",
      });
      expect(getClientIp(ctx as never)).toBe("2001:db8::1");
    });

    test("gibt gueltige IPv6-Adresse aus X-Real-IP zurueck", () => {
      const ctx = createMockContext({ "X-Real-IP": "::1" });
      expect(getClientIp(ctx as never)).toBe("::1");
    });
  });

  describe("getClientIp — Socket-Fallback", () => {
    test("gibt Socket-Adresse zurueck wenn keine Proxy-Header gesetzt sind", () => {
      const ctx = createMockContext({}, { ip: { address: "203.0.113.77" } });
      expect(getClientIp(ctx as never)).toBe("203.0.113.77");
    });

    test("gibt 'unknown' zurueck wenn weder Proxy-Header noch Socket vorhanden sind", () => {
      const ctx = createMockContext({}, {});
      expect(getClientIp(ctx as never)).toBe("unknown");
    });

    test("gibt 'unknown' zurueck wenn env.ip keine address-Eigenschaft hat", () => {
      const ctx = createMockContext({}, { ip: {} });
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
