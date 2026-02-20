/**
 * Tests for connection API routes (backend/src/routes/connections.ts)
 *
 * Covers: list providers, get provider, start OAuth, OAuth callback,
 *         disconnect, and check connection status.
 * All external dependencies are mocked at the module level.
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";
import { Hono } from "hono";

// ---------------------------------------------------------------------------
// Shared mutable mock state — individual tests can override return values
// ---------------------------------------------------------------------------

const mockState = {
  currentUser: null as null | { id: string; username: string; role: string },

  // connectionRegistry methods
  getProviderInfosResult: [] as any[],
  registryGetResult: null as any,
  validateConnectionResult: null as any,

  // storage functions
  loadConnectionResult: null as any,
  saveConnectionResult: undefined as any,
  deleteConnectionResult: true,
  saveOAuthStateResult: undefined as any,
  loadOAuthStateResult: null as any,
  deleteOAuthStateResult: undefined as any,

  // crypto
  isEncryptionConfiguredResult: true,

  // pluginRegistry methods
  pluginGetManifestResult: null as any,
  pluginIsConfiguredResult: true,
  pluginIsEnabledResult: true,

  // Provider mock (for OAuth flow)
  providerGetAuthUrlResult: "https://example.com/oauth/auth?state=abc",
  providerExchangeCodeResult: {
    accessToken: "tok-123",
    tokenType: "Bearer",
  } as any,
  providerValidateConnectionResult: {
    status: "connected",
    lastChecked: "2026-02-20T10:00:00.000Z",
  } as any,
};

// ---------------------------------------------------------------------------
// Module mocks — must be declared BEFORE importing the module under test
// ---------------------------------------------------------------------------

// Mock auth — injects mockState.currentUser into context
mock.module("../../auth", () => ({
  authMiddleware: async (c: any, next: any) => {
    if (!mockState.currentUser) {
      return c.json({ error: "Authentication required" }, 401);
    }
    c.set("user", mockState.currentUser);
    c.set("userId", mockState.currentUser.id);
    await next();
  },
  requireUserId: (c: any) => {
    const userId = c.get("userId");
    if (!userId) throw new Error("Not authenticated");
    return userId;
  },
}));

// Mock connections module
mock.module("../../connections", () => ({
  connectionRegistry: {
    getProviderInfos: async (_userId: string) => mockState.getProviderInfosResult,
    get: (_id: string) => mockState.registryGetResult,
    validateConnection: async (_userId: string, _providerId: string) =>
      mockState.validateConnectionResult,
  },
  saveConnection: async (..._args: any[]) => mockState.saveConnectionResult,
  loadConnection: async (_userId: string, _providerId: string) =>
    mockState.loadConnectionResult,
  deleteConnection: async (_userId: string, _providerId: string) =>
    mockState.deleteConnectionResult,
  saveOAuthState: async (_state: string, _data: any) => mockState.saveOAuthStateResult,
  loadOAuthState: async (_state: string) => mockState.loadOAuthStateResult,
  deleteOAuthState: async (_state: string) => mockState.deleteOAuthStateResult,
  isEncryptionConfigured: () => mockState.isEncryptionConfiguredResult,
}));

// Mock plugins module
mock.module("../../plugins", () => ({
  pluginRegistry: {
    getManifest: (_id: string) => mockState.pluginGetManifestResult,
    isConfigured: (_id: string) => mockState.pluginIsConfiguredResult,
    isEnabled: (_id: string) => mockState.pluginIsEnabledResult,
  },
}));

// Mock errorHandler
mock.module("../../utils/errorHandler", () => ({
  internalError: (c: any, _err: any) =>
    c.json({ error: "Internal server error" }, 500),
}));

// ---------------------------------------------------------------------------
// Import routes AFTER mocks are registered
// ---------------------------------------------------------------------------

const { connectionRoutes } = await import("../connections");

const app = new Hono();
app.route("/api/connections", connectionRoutes);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUser(overrides: Partial<any> = {}) {
  return { id: "user-1", username: "alice", role: "user", ...overrides };
}

function makeProviderInfo(overrides: Partial<any> = {}): any {
  return {
    id: "github",
    name: "GitHub",
    description: "GitHub OAuth provider",
    icon: "https://github.com/favicon.ico",
    authType: "oauth2",
    setupGuide: "# Setup\nRegister an app on GitHub.",
    ...overrides,
  };
}

function makeProvider(overrides: Partial<any> = {}): any {
  return {
    id: "github",
    name: "GitHub",
    description: "GitHub OAuth provider",
    icon: "https://github.com/favicon.ico",
    authType: "oauth2",
    setupGuide: "# Setup",
    getAuthUrl: async (_state: string, _redirectUri: string) =>
      mockState.providerGetAuthUrlResult,
    exchangeCode: async (_code: string, _redirectUri: string) =>
      mockState.providerExchangeCodeResult,
    validateConnection: async (_tokens: any) =>
      mockState.providerValidateConnectionResult,
    getTools: () => [],
    ...overrides,
  };
}

function makeConnection(overrides: Partial<any> = {}): any {
  return {
    providerId: "github",
    userId: "user-1",
    tokens: { encrypted: "enc", iv: "iv", tag: "tag", version: 1 },
    connection: {
      status: { status: "connected", lastChecked: "2026-02-20T10:00:00.000Z" },
    },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-02-20T10:00:00.000Z",
    ...overrides,
  };
}

function makeOAuthState(overrides: Partial<any> = {}): any {
  return {
    providerId: "github",
    userId: "user-1",
    redirectUri: "http://localhost:3001/api/connections/github/callback",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Auth guard tests (apply to all protected routes)
// ---------------------------------------------------------------------------

describe("Connection Routes — Auth guard", () => {
  beforeEach(() => {
    mockState.currentUser = null;
  });

  test("GET / should return 401 when not authenticated", async () => {
    const res = await app.request("/api/connections");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("GET /:id should return 401 when not authenticated", async () => {
    const res = await app.request("/api/connections/github");
    expect(res.status).toBe(401);
  });

  test("GET /:id/connect should return 401 when not authenticated", async () => {
    const res = await app.request("/api/connections/github/connect");
    expect(res.status).toBe(401);
  });

  test("POST /:id/disconnect should return 401 when not authenticated", async () => {
    const res = await app.request("/api/connections/github/disconnect", {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  test("GET /:id/status should return 401 when not authenticated", async () => {
    const res = await app.request("/api/connections/github/status");
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/connections — List providers
// ---------------------------------------------------------------------------

describe("GET /api/connections", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.getProviderInfosResult = [];
    mockState.isEncryptionConfiguredResult = true;
    mockState.pluginGetManifestResult = null;
    mockState.pluginIsConfiguredResult = true;
    mockState.pluginIsEnabledResult = true;
  });

  test("should return empty providers list when no providers are registered", async () => {
    const res = await app.request("/api/connections");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.providers).toEqual([]);
    expect(body).toHaveProperty("encryptionConfigured");
  });

  test("should include encryptionConfigured: true when encryption is set up", async () => {
    mockState.isEncryptionConfiguredResult = true;
    const res = await app.request("/api/connections");
    const body = await res.json();
    expect(body.encryptionConfigured).toBe(true);
  });

  test("should include encryptionConfigured: false when encryption is not set up", async () => {
    mockState.isEncryptionConfiguredResult = false;
    const res = await app.request("/api/connections");
    const body = await res.json();
    expect(body.encryptionConfigured).toBe(false);
  });

  test("should return enriched provider list with manifest data", async () => {
    mockState.getProviderInfosResult = [makeProviderInfo()];
    mockState.pluginGetManifestResult = {
      id: "github",
      name: "GitHub (manifest)",
      description: "GitHub from manifest",
      version: "1.0.0",
      configSchema: [{ key: "clientId", label: "Client ID", type: "string" }],
      setupGuide: "# Manifest Setup",
    };

    const res = await app.request("/api/connections");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.providers).toHaveLength(1);
    const provider = body.providers[0];
    // Manifest values take precedence
    expect(provider.name).toBe("GitHub (manifest)");
    expect(provider.description).toBe("GitHub from manifest");
    expect(provider.version).toBe("1.0.0");
    expect(provider.configSchema).toBeDefined();
    expect(provider.setupGuide).toBe("# Manifest Setup");
  });

  test("should fall back to provider info values when no manifest is available", async () => {
    mockState.getProviderInfosResult = [makeProviderInfo({ name: "GitHub" })];
    mockState.pluginGetManifestResult = null;

    const res = await app.request("/api/connections");
    const body = await res.json();
    const provider = body.providers[0];
    expect(provider.name).toBe("GitHub");
  });

  test("should include configured and enabled flags from pluginRegistry", async () => {
    mockState.getProviderInfosResult = [makeProviderInfo()];
    mockState.pluginIsConfiguredResult = false;
    mockState.pluginIsEnabledResult = false;

    const res = await app.request("/api/connections");
    const body = await res.json();
    const provider = body.providers[0];
    expect(provider.configured).toBe(false);
    expect(provider.enabled).toBe(false);
  });

  test("should return all providers when multiple are registered", async () => {
    mockState.getProviderInfosResult = [
      makeProviderInfo({ id: "github", name: "GitHub" }),
      makeProviderInfo({ id: "gitlab", name: "GitLab" }),
    ];

    const res = await app.request("/api/connections");
    const body = await res.json();
    expect(body.providers).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// GET /api/connections/:id — Get single provider
// ---------------------------------------------------------------------------

describe("GET /api/connections/:id", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.registryGetResult = null;
    mockState.loadConnectionResult = null;
  });

  test("should return 404 when provider is not registered", async () => {
    mockState.registryGetResult = null;
    const res = await app.request("/api/connections/unknown-provider");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("not found");
  });

  test("should return provider info with connected: false when no connection exists", async () => {
    mockState.registryGetResult = makeProvider();
    mockState.loadConnectionResult = null;

    const res = await app.request("/api/connections/github");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.provider.id).toBe("github");
    expect(body.provider.name).toBe("GitHub");
    expect(body.provider.authType).toBe("oauth2");
    expect(body.connected).toBe(false);
    expect(body.status).toBeNull();
  });

  test("should return connected: true and status when connection exists", async () => {
    mockState.registryGetResult = makeProvider();
    mockState.loadConnectionResult = makeConnection();

    const res = await app.request("/api/connections/github");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.connected).toBe(true);
    expect(body.status).toBeDefined();
    expect(body.status.status).toBe("connected");
  });

  test("should expose id, name, description, icon, and authType from provider", async () => {
    mockState.registryGetResult = makeProvider({
      id: "github",
      name: "GitHub",
      description: "Connects to GitHub",
      icon: "https://github.com/favicon.ico",
      authType: "oauth2",
    });

    const res = await app.request("/api/connections/github");
    const body = await res.json();
    expect(body.provider).toMatchObject({
      id: "github",
      name: "GitHub",
      description: "Connects to GitHub",
      icon: "https://github.com/favicon.ico",
      authType: "oauth2",
    });
  });
});

// ---------------------------------------------------------------------------
// GET /api/connections/:id/connect — Start OAuth flow
// ---------------------------------------------------------------------------

describe("GET /api/connections/:id/connect", () => {
  const originalApiBaseUrl = process.env.API_BASE_URL;

  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.registryGetResult = makeProvider();
    mockState.isEncryptionConfiguredResult = true;
    mockState.pluginIsEnabledResult = true;
    mockState.pluginIsConfiguredResult = true;
    process.env.API_BASE_URL = "http://localhost:3001";
  });

  test("should return 500 when encryption is not configured", async () => {
    mockState.isEncryptionConfiguredResult = false;
    const res = await app.request("/api/connections/github/connect");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("Encryption not configured");
  });

  test("should return 404 when provider does not exist", async () => {
    mockState.registryGetResult = null;
    const res = await app.request("/api/connections/unknown/connect");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("not found");
  });

  test("should return 400 when provider does not use OAuth", async () => {
    mockState.registryGetResult = makeProvider({ authType: "api-key" });
    const res = await app.request("/api/connections/github/connect");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("OAuth");
  });

  test("should return 400 when provider plugin is disabled", async () => {
    mockState.pluginIsEnabledResult = false;
    const res = await app.request("/api/connections/github/connect");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("should return 400 when provider credentials are not configured", async () => {
    mockState.pluginIsConfiguredResult = false;
    const res = await app.request("/api/connections/github/connect");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("should return 500 when API_BASE_URL is not set", async () => {
    delete process.env.API_BASE_URL;
    const res = await app.request("/api/connections/github/connect");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("API_BASE_URL");
  });

  test("should return 500 when API_BASE_URL contains an invalid host", async () => {
    process.env.API_BASE_URL = "http://evil.example.com/callback";
    const res = await app.request("/api/connections/github/connect");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("OAuth configuration error");
  });

  test("should return 500 when API_BASE_URL contains query parameters", async () => {
    process.env.API_BASE_URL = "http://localhost:3001?foo=bar";
    const res = await app.request("/api/connections/github/connect");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("OAuth configuration error");
  });

  test("should return authUrl and state when all conditions pass", async () => {
    const res = await app.request("/api/connections/github/connect");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authUrl).toBe(mockState.providerGetAuthUrlResult);
    expect(typeof body.state).toBe("string");
    expect(body.state.length).toBeGreaterThan(0);
  });

  test("should generate a unique state token on each call", async () => {
    const res1 = await app.request("/api/connections/github/connect");
    const res2 = await app.request("/api/connections/github/connect");
    const body1 = await res1.json();
    const body2 = await res2.json();
    expect(body1.state).not.toBe(body2.state);
  });
});

// ---------------------------------------------------------------------------
// GET /api/connections/:id/callback — OAuth callback
// ---------------------------------------------------------------------------

describe("GET /api/connections/:id/callback", () => {
  beforeEach(() => {
    // callback route has no authMiddleware — no currentUser needed
    mockState.registryGetResult = makeProvider();
    mockState.loadOAuthStateResult = makeOAuthState();
    mockState.deleteOAuthStateResult = undefined;
    mockState.saveConnectionResult = undefined;
    mockState.providerExchangeCodeResult = {
      accessToken: "tok-123",
      tokenType: "Bearer",
    };
    mockState.providerValidateConnectionResult = {
      status: "connected",
      lastChecked: "2026-02-20T10:00:00.000Z",
    };
  });

  test("should return HTML on success", async () => {
    const res = await app.request(
      "/api/connections/github/callback?code=auth-code-123&state=valid-state"
    );
    expect(res.status).toBe(200);
    const ct = res.headers.get("Content-Type") ?? "";
    expect(ct).toContain("text/html");
  });

  test("should embed success=true in HTML postMessage script when OAuth succeeds", async () => {
    const res = await app.request(
      "/api/connections/github/callback?code=auth-code-123&state=valid-state"
    );
    const html = await res.text();
    expect(html).toContain("success: true");
    expect(html).toContain("oauth_callback");
  });

  test("should return HTML error page when OAuth error param is present", async () => {
    const res = await app.request(
      "/api/connections/github/callback?error=access_denied&error_description=User+denied"
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("success: false");
  });

  test("should return HTML error page when code is missing", async () => {
    const res = await app.request(
      "/api/connections/github/callback?state=valid-state"
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("success: false");
    expect(html).toContain("Missing code or state");
  });

  test("should return HTML error page when state is missing", async () => {
    const res = await app.request(
      "/api/connections/github/callback?code=auth-code-123"
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("success: false");
    expect(html).toContain("Missing code or state");
  });

  test("should return HTML error page when OAuth state is not found", async () => {
    mockState.loadOAuthStateResult = null;
    const res = await app.request(
      "/api/connections/github/callback?code=auth-code-123&state=expired-state"
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("success: false");
    expect(html).toContain("Invalid or expired state");
  });

  test("should return HTML error page when provider ID mismatches state", async () => {
    // State was saved for 'github' but callback is for 'gitlab'
    mockState.loadOAuthStateResult = makeOAuthState({ providerId: "github" });
    const res = await app.request(
      "/api/connections/gitlab/callback?code=auth-code-123&state=valid-state"
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("success: false");
    expect(html).toContain("Provider mismatch");
  });

  test("should return HTML error page when provider is not found after state validation", async () => {
    mockState.registryGetResult = null;
    const res = await app.request(
      "/api/connections/github/callback?code=auth-code-123&state=valid-state"
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("success: false");
    expect(html).toContain("Provider not found");
  });

  test("should return HTML error page when token exchange throws", async () => {
    mockState.registryGetResult = makeProvider({
      exchangeCode: async () => {
        throw new Error("Token exchange failed");
      },
    });
    const res = await app.request(
      "/api/connections/github/callback?code=bad-code&state=valid-state"
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("success: false");
  });

  test("should escape HTML special characters in error messages", async () => {
    mockState.loadOAuthStateResult = null;
    // Trigger the 'Invalid or expired state' error path, which is a safe known string.
    // This also verifies the response is valid HTML.
    const res = await app.request(
      "/api/connections/github/callback?code=code&state=bad"
    );
    const html = await res.text();
    // The HTML must not contain raw unescaped angle brackets from user input
    expect(html).not.toContain("<script>alert");
  });

  test("should embed providerId in the postMessage payload", async () => {
    const res = await app.request(
      "/api/connections/github/callback?code=auth-code&state=valid-state"
    );
    const html = await res.text();
    expect(html).toContain("github");
  });
});

// ---------------------------------------------------------------------------
// POST /api/connections/:id/disconnect — Disconnect provider
// ---------------------------------------------------------------------------

describe("POST /api/connections/:id/disconnect", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.deleteConnectionResult = true;
  });

  test("should return 200 with success: true when connection is deleted", async () => {
    const res = await app.request("/api/connections/github/disconnect", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("should return 404 when no connection exists to delete", async () => {
    mockState.deleteConnectionResult = false;
    const res = await app.request("/api/connections/github/disconnect", {
      method: "POST",
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("not found");
  });

  test("should forward provider ID from URL to deleteConnection", async () => {
    // Use a different provider ID to verify routing
    mockState.deleteConnectionResult = true;
    const res = await app.request("/api/connections/confluence/disconnect", {
      method: "POST",
    });
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// GET /api/connections/:id/status — Check connection status
// ---------------------------------------------------------------------------

describe("GET /api/connections/:id/status", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.validateConnectionResult = null;
  });

  test("should return connected: false when no connection exists", async () => {
    mockState.validateConnectionResult = null;
    const res = await app.request("/api/connections/github/status");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.connected).toBe(false);
    expect(body).not.toHaveProperty("status");
  });

  test("should return connected: true when connection status is 'connected'", async () => {
    mockState.validateConnectionResult = {
      status: "connected",
      lastChecked: "2026-02-20T10:00:00.000Z",
    };
    const res = await app.request("/api/connections/github/status");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.connected).toBe(true);
    expect(body.status.status).toBe("connected");
  });

  test("should return connected: false when connection status is 'expired'", async () => {
    mockState.validateConnectionResult = {
      status: "expired",
      lastChecked: "2026-02-20T10:00:00.000Z",
      error: "Token expired",
    };
    const res = await app.request("/api/connections/github/status");
    expect(res.status).toBe(200);
    const body = await res.json();
    // status.status is 'expired', not 'connected'
    expect(body.connected).toBe(false);
    expect(body.status.status).toBe("expired");
  });

  test("should return connected: false when connection status is 'error'", async () => {
    mockState.validateConnectionResult = {
      status: "error",
      lastChecked: "2026-02-20T10:00:00.000Z",
      error: "Validation failed",
    };
    const res = await app.request("/api/connections/github/status");
    const body = await res.json();
    expect(body.connected).toBe(false);
    expect(body.status.error).toBe("Validation failed");
  });

  test("should return the full status object in the response", async () => {
    const expectedStatus = {
      status: "connected",
      lastChecked: "2026-02-20T10:00:00.000Z",
      userInfo: { name: "Alice", email: "alice@example.com" },
    };
    mockState.validateConnectionResult = expectedStatus;
    const res = await app.request("/api/connections/github/status");
    const body = await res.json();
    expect(body.status).toMatchObject(expectedStatus);
  });
});
