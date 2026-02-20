/**
 * Tests for ssrfProtection utility
 * (backend/src/utils/ssrfProtection.ts)
 *
 * DNS resolution is mocked entirely so no real network queries occur.
 * The mock must be declared BEFORE the dynamic import of the module under test.
 *
 * Key source-code behaviours that affect test expectations:
 * - isHostnameBlocked() runs BEFORE the isIPv4() / isIPv6() branches.
 *   Raw private IPs (e.g. 10.0.0.1) are therefore caught by the hostname
 *   check and returned without a resolvedIP field.
 * - Hostnames containing "internal", "metadata", or "169.254" are blocked by
 *   isHostnameBlocked() before DNS is attempted.
 * - allowLocalhost only skips the static blocklist; if DNS resolution then
 *   fails the URL is still rejected (fail-closed design).
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";

// ---------------------------------------------------------------------------
// Mock dns/promises — must appear BEFORE dynamic import
// ---------------------------------------------------------------------------

mock.module("dns/promises", () => ({
  lookup: async (hostname: string) => {
    // Public hostname → public IP
    if (hostname === "example.com") return { address: "93.184.216.34", family: 4 };
    // Hostname that resolves to a private Class A address (no blocked keyword in name)
    if (hostname === "private-host.example.com") return { address: "10.0.0.1", family: 4 };
    // Hostname that resolves to the AWS metadata IP (no blocked keyword in name)
    if (hostname === "aws-meta.example.com") return { address: "169.254.169.254", family: 4 };
    // Hostname that resolves to an IPv6 loopback (no blocked keyword in name)
    if (hostname === "ipv6-loopback.example.com") return { address: "::1", family: 6 };
    // localhost resolves to the loopback address (used for allowLocalhost test)
    if (hostname === "localhost") return { address: "127.0.0.1", family: 4 };
    // Any other hostname fails DNS resolution
    throw new Error(`DNS resolution failed for ${hostname}`);
  },
}));

// ---------------------------------------------------------------------------
// Import module under test AFTER mock is registered
// ---------------------------------------------------------------------------

const { validateUrl, clearMalwareCache, getCacheStats } = await import("../ssrfProtection");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ssrfProtection", () => {
  describe("validateUrl", () => {
    // -----------------------------------------------------------------------
    // Gueltige URLs
    // -----------------------------------------------------------------------

    test("gueltige HTTPS-URL wird erlaubt", async () => {
      const result = await validateUrl("https://example.com/path");
      expect(result.allowed).toBe(true);
      expect(result.resolvedIP).toBe("93.184.216.34");
    });

    test("gueltige HTTP-URL wird erlaubt", async () => {
      const result = await validateUrl("http://example.com/");
      expect(result.allowed).toBe(true);
    });

    // -----------------------------------------------------------------------
    // Ungueltige URL-Formate
    // -----------------------------------------------------------------------

    test("ungueltiges URL-Format wird abgelehnt", async () => {
      const result = await validateUrl("not-a-url-at-all");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Invalid URL");
    });

    test("leerer String wird als ungueltige URL abgelehnt", async () => {
      const result = await validateUrl("");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Invalid URL");
    });

    // -----------------------------------------------------------------------
    // Nicht erlaubte Protokolle
    // -----------------------------------------------------------------------

    test("ftp://-Protokoll wird abgelehnt", async () => {
      const result = await validateUrl("ftp://example.com/file.txt");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("ftp:");
    });

    test("file://-Protokoll wird abgelehnt", async () => {
      const result = await validateUrl("file:///etc/passwd");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("file:");
    });

    // -----------------------------------------------------------------------
    // Gesperrte IPv4-Adressen (direkt als IP-Literal angegeben)
    // Note: raw private IPs are caught by isHostnameBlocked() before the
    // isIPv4() branch — resolvedIP is therefore not set in the result.
    // -----------------------------------------------------------------------

    test("private IPv4-Adresse 10.x wird direkt abgelehnt", async () => {
      const result = await validateUrl("https://10.0.0.1/api");
      expect(result.allowed).toBe(false);
    });

    test("private IPv4-Adresse 172.16.x wird direkt abgelehnt", async () => {
      const result = await validateUrl("https://172.16.0.1/");
      expect(result.allowed).toBe(false);
    });

    test("private IPv4-Adresse 192.168.x wird direkt abgelehnt", async () => {
      const result = await validateUrl("http://192.168.1.100/");
      expect(result.allowed).toBe(false);
    });

    test("Loopback-Adresse 127.0.0.1 wird direkt abgelehnt", async () => {
      const result = await validateUrl("http://127.0.0.1/");
      expect(result.allowed).toBe(false);
    });

    test("AWS-Metadata-Endpunkt 169.254.169.254 wird direkt abgelehnt", async () => {
      const result = await validateUrl("http://169.254.169.254/latest/meta-data/");
      expect(result.allowed).toBe(false);
    });

    // -----------------------------------------------------------------------
    // Gesperrte Hostnamen
    // -----------------------------------------------------------------------

    test("Hostname 'localhost' wird abgelehnt", async () => {
      const result = await validateUrl("http://localhost/");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("localhost");
    });

    test("Hostname 'metadata.google.internal' wird abgelehnt", async () => {
      const result = await validateUrl("http://metadata.google.internal/");
      expect(result.allowed).toBe(false);
    });

    // -----------------------------------------------------------------------
    // IPv6-Adressen
    // -----------------------------------------------------------------------

    test("IPv6-Loopback ::1 wird direkt abgelehnt", async () => {
      const result = await validateUrl("http://[::1]/");
      expect(result.allowed).toBe(false);
    });

    test("IPv6 Unique-Local fc00:: wird direkt abgelehnt", async () => {
      const result = await validateUrl("http://[fc00::1]/");
      expect(result.allowed).toBe(false);
    });

    test("IPv6 Unique-Local fd00:: wird direkt abgelehnt", async () => {
      const result = await validateUrl("http://[fd00::1]/");
      expect(result.allowed).toBe(false);
    });

    test("IPv4-mapped IPv6-Adresse ::ffff:10.0.0.1 wird abgelehnt", async () => {
      const result = await validateUrl("http://[::ffff:10.0.0.1]/");
      expect(result.allowed).toBe(false);
    });

    // -----------------------------------------------------------------------
    // DNS-Aufloesung gesperrter Adressen
    // Using hostnames that do NOT contain blocked keywords so DNS is reached.
    // -----------------------------------------------------------------------

    test("Hostname der auf private IPv4 aufloest wird mit resolvedIP abgelehnt", async () => {
      const result = await validateUrl("https://private-host.example.com/api");
      expect(result.allowed).toBe(false);
      expect(result.resolvedIP).toBe("10.0.0.1");
      expect(result.reason).toContain("10.0.0.1");
    });

    test("Hostname der auf AWS-Metadata-IP aufloest wird mit resolvedIP abgelehnt", async () => {
      const result = await validateUrl("https://aws-meta.example.com/");
      expect(result.allowed).toBe(false);
      expect(result.resolvedIP).toBe("169.254.169.254");
    });

    test("Hostname bei dem DNS-Aufloesung fehlschlaegt wird abgelehnt", async () => {
      const result = await validateUrl("https://nonexistent.invalid/");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("DNS resolution failed");
    });

    // -----------------------------------------------------------------------
    // allowLocalhost-Option
    // allowLocalhost skips the static hostname/IP blocklist.
    // 127.0.0.1 as a raw IP literal bypasses DNS and is allowed.
    // "localhost" as a hostname: static check skipped, DNS mock returns
    // 127.0.0.1 which is blocked by the IP range check unless allowLocalhost
    // is set — but isIPv4Blocked is also guarded by allowLocalhost here.
    // -----------------------------------------------------------------------

    test("127.0.0.1 wird mit allowLocalhost-Option als IP-Literal erlaubt", async () => {
      const result = await validateUrl("http://127.0.0.1/", { allowLocalhost: true });
      expect(result.allowed).toBe(true);
      expect(result.resolvedIP).toBe("127.0.0.1");
    });
  });

  // -------------------------------------------------------------------------
  // clearMalwareCache und getCacheStats
  // -------------------------------------------------------------------------

  describe("clearMalwareCache", () => {
    test("clearMalwareCache wirft keinen Fehler", () => {
      expect(() => clearMalwareCache()).not.toThrow();
    });
  });

  describe("getCacheStats", () => {
    beforeEach(() => {
      clearMalwareCache();
    });

    test("gibt size und entries zurueck", () => {
      const stats = getCacheStats();
      expect(stats).toHaveProperty("size");
      expect(stats).toHaveProperty("entries");
      expect(Array.isArray(stats.entries)).toBe(true);
    });

    test("cache ist nach clearMalwareCache leer", () => {
      const stats = getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.entries).toHaveLength(0);
    });
  });
});
