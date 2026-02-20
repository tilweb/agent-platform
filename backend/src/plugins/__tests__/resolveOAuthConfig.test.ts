/**
 * Tests for resolveOAuthConfig (backend/src/plugins/resolveOAuthConfig.ts)
 *
 * All external dependencies (pluginRegistry, resolvePluginConfig) are mocked
 * via mock.module() so no real disk I/O or registry state is involved.
 */

import { test, expect, describe, beforeEach, mock } from "bun:test";

// ---------------------------------------------------------------------------
// Shared mutable mock state
// ---------------------------------------------------------------------------

const mockState = {
  manifest: undefined as any | undefined,
  pluginConfig: null as Record<string, any> | null,
  resolvePluginConfigCallCount: 0,
};

// ---------------------------------------------------------------------------
// Module mocks — must be declared BEFORE importing the module under test.
// ---------------------------------------------------------------------------

mock.module("../registry", () => ({
  pluginRegistry: {
    getManifest: (_pluginId: string) => mockState.manifest,
  },
}));

mock.module("../configStorage", () => ({
  resolvePluginConfig: async (_pluginId: string, _configSchema: any[]) => {
    mockState.resolvePluginConfigCallCount++;
    return mockState.pluginConfig;
  },
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

const { resolveOAuthConfig } = await import("../resolveOAuthConfig");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createManifest(overrides: Record<string, any> = {}): any {
  return {
    id: "test-plugin",
    type: "connector",
    name: "Test Plugin",
    description: "A test plugin",
    version: "1.0.0",
    configSchema: [
      { key: "clientId", label: "Client ID", type: "string", required: true },
      { key: "clientSecret", label: "Client Secret", type: "string", required: true, secret: true },
    ],
    connector: {
      authType: "oauth2",
      oauth: {
        authorizationUrl: "https://example.com/oauth/authorize",
        tokenUrl: "https://example.com/oauth/token",
        scopes: ["read", "write"],
      },
    },
    ...overrides,
  };
}

function createConfig(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    clientId: "my-client-id",
    clientSecret: "my-client-secret",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("resolveOAuthConfig", () => {
  beforeEach(() => {
    mockState.manifest = undefined;
    mockState.pluginConfig = null;
    mockState.resolvePluginConfigCallCount = 0;
  });

  // -------------------------------------------------------------------------

  describe("Erfolgsfall", () => {
    test("sollte vollständige OAuth2Config mit allen Pflichtfeldern zurückgeben", async () => {
      mockState.manifest = createManifest();
      mockState.pluginConfig = createConfig();

      const result = await resolveOAuthConfig("test-plugin");

      expect(result.authorizationUrl).toBe("https://example.com/oauth/authorize");
      expect(result.tokenUrl).toBe("https://example.com/oauth/token");
      expect(result.clientId).toBe("my-client-id");
      expect(result.clientSecret).toBe("my-client-secret");
      expect(result.scopes).toEqual(["read", "write"]);
    });

    test("sollte additionalAuthParams aus dem Manifest durchreichen", async () => {
      mockState.manifest = createManifest({
        connector: {
          authType: "oauth2",
          oauth: {
            authorizationUrl: "https://example.com/oauth/authorize",
            tokenUrl: "https://example.com/oauth/token",
            scopes: ["read"],
            additionalAuthParams: { prompt: "consent", access_type: "offline" },
          },
        },
      });
      mockState.pluginConfig = createConfig();

      const result = await resolveOAuthConfig("test-plugin");

      expect(result.additionalAuthParams).toEqual({ prompt: "consent", access_type: "offline" });
    });

    test("sollte additionalTokenParams aus dem Manifest durchreichen", async () => {
      mockState.manifest = createManifest({
        connector: {
          authType: "oauth2",
          oauth: {
            authorizationUrl: "https://example.com/oauth/authorize",
            tokenUrl: "https://example.com/oauth/token",
            scopes: ["read"],
            additionalTokenParams: { grant_type: "authorization_code" },
          },
        },
      });
      mockState.pluginConfig = createConfig();

      const result = await resolveOAuthConfig("test-plugin");

      expect(result.additionalTokenParams).toEqual({ grant_type: "authorization_code" });
    });

    test("sollte additionalAuthParams und additionalTokenParams gleichzeitig durchreichen", async () => {
      mockState.manifest = createManifest({
        connector: {
          authType: "oauth2",
          oauth: {
            authorizationUrl: "https://example.com/oauth/authorize",
            tokenUrl: "https://example.com/oauth/token",
            scopes: ["scope1"],
            additionalAuthParams: { foo: "bar" },
            additionalTokenParams: { baz: "qux" },
          },
        },
      });
      mockState.pluginConfig = createConfig();

      const result = await resolveOAuthConfig("test-plugin");

      expect(result.additionalAuthParams).toEqual({ foo: "bar" });
      expect(result.additionalTokenParams).toEqual({ baz: "qux" });
    });

    test("sollte undefined für optionale Parameter zurückgeben wenn nicht gesetzt", async () => {
      mockState.manifest = createManifest();
      mockState.pluginConfig = createConfig();

      const result = await resolveOAuthConfig("test-plugin");

      expect(result.additionalAuthParams).toBeUndefined();
      expect(result.additionalTokenParams).toBeUndefined();
    });

    test("sollte scopes korrekt aus dem Manifest übernehmen", async () => {
      mockState.manifest = createManifest({
        connector: {
          authType: "oauth2",
          oauth: {
            authorizationUrl: "https://example.com/oauth/authorize",
            tokenUrl: "https://example.com/oauth/token",
            scopes: ["scope:read", "scope:write", "scope:admin"],
          },
        },
      });
      mockState.pluginConfig = createConfig();

      const result = await resolveOAuthConfig("test-plugin");

      expect(result.scopes).toHaveLength(3);
      expect(result.scopes).toContain("scope:read");
      expect(result.scopes).toContain("scope:write");
      expect(result.scopes).toContain("scope:admin");
    });
  });

  // -------------------------------------------------------------------------

  describe("Manifest-Fehler", () => {
    test("sollte werfen wenn getManifest undefined zurückgibt (Plugin nicht gefunden)", async () => {
      mockState.manifest = undefined;

      await expect(resolveOAuthConfig("unknown-plugin")).rejects.toThrow(
        `Plugin "unknown-plugin": manifest not loaded or missing connector.oauth section`
      );
    });

    test("sollte die Plugin-ID in der Fehlermeldung enthalten wenn Manifest fehlt", async () => {
      mockState.manifest = undefined;

      await expect(resolveOAuthConfig("my-special-plugin")).rejects.toThrow(
        `Plugin "my-special-plugin"`
      );
    });

    test("sollte werfen wenn Manifest keinen connector-Abschnitt hat", async () => {
      mockState.manifest = {
        id: "no-connector",
        type: "agent",
        name: "No Connector",
        description: "Plugin without connector",
        version: "1.0.0",
        // connector property is absent
      };

      await expect(resolveOAuthConfig("no-connector")).rejects.toThrow(
        `Plugin "no-connector": manifest not loaded or missing connector.oauth section`
      );
    });

    test("sollte werfen wenn connector.oauth fehlt (z.B. api-key Connector)", async () => {
      mockState.manifest = {
        id: "api-key-plugin",
        type: "connector",
        name: "API Key Plugin",
        description: "Uses API key auth",
        version: "1.0.0",
        connector: {
          authType: "api-key",
          // oauth section is absent
        },
      };

      await expect(resolveOAuthConfig("api-key-plugin")).rejects.toThrow(
        `Plugin "api-key-plugin": manifest not loaded or missing connector.oauth section`
      );
    });

    test("sollte werfen wenn connector.oauth null ist", async () => {
      mockState.manifest = createManifest({
        connector: {
          authType: "oauth2",
          oauth: null,
        },
      });

      await expect(resolveOAuthConfig("test-plugin")).rejects.toThrow(
        `Plugin "test-plugin": manifest not loaded or missing connector.oauth section`
      );
    });
  });

  // -------------------------------------------------------------------------

  describe("Credential-Fehler", () => {
    test("sollte werfen wenn resolvePluginConfig null zurückgibt (kein configSchema vorhanden)", async () => {
      // Manifest ohne configSchema → resolvePluginConfig wird nicht aufgerufen → config bleibt null
      mockState.manifest = {
        id: "no-schema-plugin",
        type: "connector",
        name: "No Schema Plugin",
        description: "Plugin without configSchema",
        version: "1.0.0",
        connector: {
          authType: "oauth2",
          oauth: {
            authorizationUrl: "https://example.com/oauth/authorize",
            tokenUrl: "https://example.com/oauth/token",
            scopes: ["read"],
          },
        },
      };
      // pluginConfig bleibt null (Standardwert aus beforeEach)

      await expect(resolveOAuthConfig("no-schema-plugin")).rejects.toThrow(
        `Plugin "no-schema-plugin": OAuth credentials not configured. Configure via Admin-UI under Connections.`
      );
    });

    test("sollte werfen wenn clientId fehlt", async () => {
      mockState.manifest = createManifest();
      mockState.pluginConfig = { clientSecret: "secret-only" };

      await expect(resolveOAuthConfig("test-plugin")).rejects.toThrow(
        `Plugin "test-plugin": OAuth credentials not configured. Configure via Admin-UI under Connections.`
      );
    });

    test("sollte werfen wenn clientSecret fehlt", async () => {
      mockState.manifest = createManifest();
      mockState.pluginConfig = { clientId: "id-only" };

      await expect(resolveOAuthConfig("test-plugin")).rejects.toThrow(
        `Plugin "test-plugin": OAuth credentials not configured. Configure via Admin-UI under Connections.`
      );
    });

    test("sollte werfen wenn clientId ein leerer String ist", async () => {
      mockState.manifest = createManifest();
      mockState.pluginConfig = createConfig({ clientId: "" });

      await expect(resolveOAuthConfig("test-plugin")).rejects.toThrow(
        `Plugin "test-plugin": OAuth credentials not configured. Configure via Admin-UI under Connections.`
      );
    });

    test("sollte werfen wenn clientSecret ein leerer String ist", async () => {
      mockState.manifest = createManifest();
      mockState.pluginConfig = createConfig({ clientSecret: "" });

      await expect(resolveOAuthConfig("test-plugin")).rejects.toThrow(
        `Plugin "test-plugin": OAuth credentials not configured. Configure via Admin-UI under Connections.`
      );
    });

    test("sollte Plugin-ID in der Credential-Fehlermeldung enthalten", async () => {
      mockState.manifest = createManifest({ id: "confluence-plugin" });
      mockState.pluginConfig = { clientId: "id-only" };

      await expect(resolveOAuthConfig("confluence-plugin")).rejects.toThrow(
        `Plugin "confluence-plugin"`
      );
    });
  });

  // -------------------------------------------------------------------------

  describe("configSchema-Verhalten", () => {
    test("sollte resolvePluginConfig nicht aufrufen wenn configSchema fehlt", async () => {
      mockState.manifest = {
        id: "no-schema",
        type: "connector",
        name: "No Schema",
        description: "Plugin without configSchema",
        version: "1.0.0",
        // configSchema is absent
        connector: {
          authType: "oauth2",
          oauth: {
            authorizationUrl: "https://example.com/oauth/authorize",
            tokenUrl: "https://example.com/oauth/token",
            scopes: [],
          },
        },
      };
      // pluginConfig bleibt null

      // Fehler wird wegen fehlender Credentials erwartet
      await expect(resolveOAuthConfig("no-schema")).rejects.toThrow(
        "OAuth credentials not configured"
      );

      // resolvePluginConfig darf nicht aufgerufen worden sein
      expect(mockState.resolvePluginConfigCallCount).toBe(0);
    });

    test("sollte resolvePluginConfig genau einmal aufrufen wenn configSchema vorhanden ist", async () => {
      mockState.manifest = createManifest();
      mockState.pluginConfig = createConfig();

      await resolveOAuthConfig("test-plugin");

      expect(mockState.resolvePluginConfigCallCount).toBe(1);
    });

    test("sollte clientId und clientSecret aus dem Ergebnis von resolvePluginConfig verwenden", async () => {
      mockState.manifest = createManifest();
      mockState.pluginConfig = createConfig({
        clientId: "resolved-client-id",
        clientSecret: "resolved-client-secret",
      });

      const result = await resolveOAuthConfig("test-plugin");

      expect(result.clientId).toBe("resolved-client-id");
      expect(result.clientSecret).toBe("resolved-client-secret");
    });
  });
});
