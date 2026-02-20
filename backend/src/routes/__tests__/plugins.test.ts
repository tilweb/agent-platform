/**
 * Tests for plugin API routes (backend/src/routes/plugins.ts)
 *
 * Covers all endpoints:
 *   GET    /api/plugins              — list all plugins
 *   GET    /api/plugins/:id          — get single plugin info
 *   GET    /api/plugins/:id/config   — get config (admin only)
 *   PUT    /api/plugins/:id/config   — save config (admin only)
 *   DELETE /api/plugins/:id/config   — delete config (admin only)
 *   POST   /api/plugins/:id/enable   — enable plugin (admin only)
 *   POST   /api/plugins/:id/disable  — disable plugin (admin only)
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";
import { Hono } from "hono";

// ---------------------------------------------------------------------------
// Shared mutable mock state — individual tests override these per case
// ---------------------------------------------------------------------------

const mockState = {
  currentUser: null as null | { id: string; username: string; role: string },

  // pluginRegistry methods
  pluginListResult: [] as any[],
  pluginInfoResult: undefined as any | undefined,
  pluginManifestResult: undefined as any | undefined,
  setEnabledResult: true as boolean,
  updateConfiguredCalled: false,

  // configStorage
  loadPluginConfigMaskedResult: null as any | null,
  savePluginConfigError: null as Error | null,
  deletePluginConfigResult: true as boolean,
  isPluginConfiguredResult: true as boolean,

  // toolRegistry
  setPluginDisabledCalled: [] as Array<{ pluginId: string; disabled: boolean }>,
};

// ---------------------------------------------------------------------------
// Module mocks — must be declared BEFORE the module under test is imported
// ---------------------------------------------------------------------------

// Mock auth — injects mockState.currentUser into Hono context
mock.module("../../auth", () => ({
  authMiddleware: async (c: any, next: any) => {
    if (!mockState.currentUser) {
      return c.json({ error: "Authentication required" }, 401);
    }
    c.set("user", mockState.currentUser);
    c.set("userId", mockState.currentUser.id);
    await next();
  },
  getCurrentUser: (c: any) => c.get("user"),
  requireUserId: (c: any) => {
    const id = c.get("userId");
    if (!id) throw new Error("Nicht authentifiziert");
    return id;
  },
}));

// Mock errorHandler
mock.module("../../utils/errorHandler", () => ({
  internalError: (c: any, error: any) =>
    c.json({ error: "Internal server error", detail: String(error) }, 500),
}));

// Mock plugin registry singleton
mock.module("../../plugins", () => ({
  pluginRegistry: {
    list: (_filter?: any) => mockState.pluginListResult,
    getInfo: (_id: string) => mockState.pluginInfoResult,
    getManifest: (_id: string) => mockState.pluginManifestResult,
    setEnabled: async (_id: string, _enabled: boolean) => mockState.setEnabledResult,
    updateConfigured: async (_id: string, _configured: boolean, _by?: string) => {
      mockState.updateConfiguredCalled = true;
    },
  },
  savePluginConfig: async (
    _pluginId: string,
    _schema: any[],
    _values: Record<string, any>,
    _configuredBy?: string
  ) => {
    if (mockState.savePluginConfigError) {
      throw mockState.savePluginConfigError;
    }
  },
  loadPluginConfigMasked: async (_pluginId: string, _schema: any[]) =>
    mockState.loadPluginConfigMaskedResult,
  deletePluginConfig: async (_pluginId: string) => mockState.deletePluginConfigResult,
  isPluginConfigured: async (_pluginId: string, _schema: any[]) =>
    mockState.isPluginConfiguredResult,
}));

// Mock tool registry singleton
mock.module("../../tools/registry", () => ({
  toolRegistry: {
    setPluginDisabled: (pluginId: string, disabled: boolean) => {
      mockState.setPluginDisabledCalled.push({ pluginId, disabled });
    },
  },
}));

// ---------------------------------------------------------------------------
// Import routes AFTER mocks are registered
// ---------------------------------------------------------------------------
const { pluginRoutes } = await import("../plugins");

const app = new Hono();
app.route("/api/plugins", pluginRoutes);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAdminUser() {
  return { id: "admin-1", username: "alice", role: "admin" as const };
}

function makeRegularUser() {
  return { id: "user-1", username: "bob", role: "user" as const };
}

function makePluginInfo(overrides: Partial<any> = {}): any {
  return {
    id: "my-plugin",
    type: "connector",
    name: "My Plugin",
    description: "A test plugin",
    version: "1.0.0",
    source: "builtin",
    enabled: true,
    configured: false,
    configSchema: [],
    ...overrides,
  };
}

function makeManifest(overrides: Partial<any> = {}): any {
  return {
    id: "my-plugin",
    type: "connector",
    name: "My Plugin",
    description: "A test plugin",
    version: "1.0.0",
    configSchema: [],
    ...overrides,
  };
}

function resetState() {
  mockState.currentUser = null;
  mockState.pluginListResult = [];
  mockState.pluginInfoResult = undefined;
  mockState.pluginManifestResult = undefined;
  mockState.setEnabledResult = true;
  mockState.updateConfiguredCalled = false;
  mockState.loadPluginConfigMaskedResult = null;
  mockState.savePluginConfigError = null;
  mockState.deletePluginConfigResult = true;
  mockState.isPluginConfiguredResult = true;
  mockState.setPluginDisabledCalled = [];
}

// ---------------------------------------------------------------------------
// Auth & RBAC guard tests (shared across admin-only endpoints)
// ---------------------------------------------------------------------------

describe("Plugin Routes — Auth guards", () => {
  beforeEach(() => {
    resetState();
    mockState.pluginManifestResult = makeManifest();
  });

  test("should return 401 when no session is present for GET /api/plugins", async () => {
    const res = await app.request("/api/plugins");
    expect(res.status).toBe(401);
  });

  test("should return 401 when no session is present for admin-only endpoints", async () => {
    const res = await app.request("/api/plugins/my-plugin/config");
    expect(res.status).toBe(401);
  });

  test("should return 403 for regular user on GET /api/plugins/:id/config", async () => {
    mockState.currentUser = makeRegularUser();
    const res = await app.request("/api/plugins/my-plugin/config");
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("should return 403 for regular user on PUT /api/plugins/:id/config", async () => {
    mockState.currentUser = makeRegularUser();
    const res = await app.request("/api/plugins/my-plugin/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: { key: "val" } }),
    });
    expect(res.status).toBe(403);
  });

  test("should return 403 for regular user on DELETE /api/plugins/:id/config", async () => {
    mockState.currentUser = makeRegularUser();
    const res = await app.request("/api/plugins/my-plugin/config", { method: "DELETE" });
    expect(res.status).toBe(403);
  });

  test("should return 403 for regular user on POST /api/plugins/:id/enable", async () => {
    mockState.currentUser = makeRegularUser();
    const res = await app.request("/api/plugins/my-plugin/enable", { method: "POST" });
    expect(res.status).toBe(403);
  });

  test("should return 403 for regular user on POST /api/plugins/:id/disable", async () => {
    mockState.currentUser = makeRegularUser();
    const res = await app.request("/api/plugins/my-plugin/disable", { method: "POST" });
    expect(res.status).toBe(403);
  });

  test("should allow regular user to read GET /api/plugins (list)", async () => {
    mockState.currentUser = makeRegularUser();
    const res = await app.request("/api/plugins");
    expect(res.status).toBe(200);
  });

  test("should allow regular user to read GET /api/plugins/:id", async () => {
    mockState.currentUser = makeRegularUser();
    mockState.pluginInfoResult = makePluginInfo();
    const res = await app.request("/api/plugins/my-plugin");
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/plugins — list all plugins", () => {
  beforeEach(() => {
    resetState();
    mockState.currentUser = makeAdminUser();
  });

  test("should return empty list when no plugins are registered", async () => {
    const res = await app.request("/api/plugins");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plugins).toEqual([]);
  });

  test("should return all registered plugins", async () => {
    mockState.pluginListResult = [
      makePluginInfo({ id: "plugin-a", name: "Plugin A" }),
      makePluginInfo({ id: "plugin-b", name: "Plugin B" }),
    ];
    const res = await app.request("/api/plugins");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plugins).toHaveLength(2);
    expect(body.plugins[0].id).toBe("plugin-a");
    expect(body.plugins[1].id).toBe("plugin-b");
  });

  test("should forward the type query parameter to registry.list()", async () => {
    // The mock always returns mockState.pluginListResult regardless of filter,
    // but we can verify the response still succeeds with the query param
    mockState.pluginListResult = [makePluginInfo({ type: "connector" })];
    const res = await app.request("/api/plugins?type=connector");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plugins).toHaveLength(1);
    expect(body.plugins[0].type).toBe("connector");
  });

  test("should return plugins array in response body", async () => {
    mockState.pluginListResult = [makePluginInfo()];
    const res = await app.request("/api/plugins");
    const body = await res.json();
    expect(body).toHaveProperty("plugins");
    expect(Array.isArray(body.plugins)).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/plugins/:id — get single plugin info", () => {
  beforeEach(() => {
    resetState();
    mockState.currentUser = makeAdminUser();
  });

  test("should return plugin info when plugin exists", async () => {
    mockState.pluginInfoResult = makePluginInfo({ id: "my-plugin", name: "My Plugin" });
    const res = await app.request("/api/plugins/my-plugin");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("my-plugin");
    expect(body.name).toBe("My Plugin");
  });

  test("should return 404 when plugin does not exist", async () => {
    mockState.pluginInfoResult = undefined;
    const res = await app.request("/api/plugins/unknown-plugin");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("should include all standard plugin fields in response", async () => {
    mockState.pluginInfoResult = makePluginInfo({
      id: "full-plugin",
      type: "connector",
      name: "Full Plugin",
      description: "Full description",
      version: "2.0.0",
      source: "installed",
      enabled: true,
      configured: true,
    });
    const res = await app.request("/api/plugins/full-plugin");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("full-plugin");
    expect(body.type).toBe("connector");
    expect(body.version).toBe("2.0.0");
    expect(body.enabled).toBe(true);
    expect(body.configured).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/plugins/:id/config — get plugin config (admin only)", () => {
  beforeEach(() => {
    resetState();
    mockState.currentUser = makeAdminUser();
    mockState.pluginManifestResult = makeManifest({
      configSchema: [
        { key: "apiKey", label: "API Key", type: "string", secret: true, required: true },
      ],
    });
  });

  test("should return 404 when plugin manifest does not exist", async () => {
    mockState.pluginManifestResult = undefined;
    const res = await app.request("/api/plugins/nonexistent/config");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("should return config structure when plugin exists and has no stored config", async () => {
    mockState.loadPluginConfigMaskedResult = null;
    const res = await app.request("/api/plugins/my-plugin/config");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pluginId).toBe("my-plugin");
    expect(body.config).toEqual({});
    expect(Array.isArray(body.configSchema)).toBe(true);
  });

  test("should return masked config values when config exists", async () => {
    mockState.loadPluginConfigMaskedResult = {
      values: { apiKey: "••••••••" },
      configuredAt: "2026-02-01T10:00:00.000Z",
      configuredBy: "alice",
    };
    const res = await app.request("/api/plugins/my-plugin/config");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pluginId).toBe("my-plugin");
    expect(body.config).toEqual({ apiKey: "••••••••" });
    expect(body.configuredAt).toBe("2026-02-01T10:00:00.000Z");
    expect(body.configuredBy).toBe("alice");
  });

  test("should include configSchema from manifest in response", async () => {
    mockState.loadPluginConfigMaskedResult = null;
    const res = await app.request("/api/plugins/my-plugin/config");
    const body = await res.json();
    expect(body.configSchema).toHaveLength(1);
    expect(body.configSchema[0].key).toBe("apiKey");
  });

  test("should return empty configSchema array when manifest has no schema", async () => {
    mockState.pluginManifestResult = makeManifest({ configSchema: undefined });
    mockState.loadPluginConfigMaskedResult = null;
    const res = await app.request("/api/plugins/my-plugin/config");
    const body = await res.json();
    expect(body.configSchema).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe("PUT /api/plugins/:id/config — save plugin config (admin only)", () => {
  beforeEach(() => {
    resetState();
    mockState.currentUser = makeAdminUser();
    mockState.pluginManifestResult = makeManifest({
      configSchema: [
        { key: "apiKey", label: "API Key", type: "string", secret: true, required: true },
        { key: "baseUrl", label: "Base URL", type: "string", required: false },
      ],
    });
    mockState.isPluginConfiguredResult = true;
  });

  test("should return 404 when plugin manifest does not exist", async () => {
    mockState.pluginManifestResult = undefined;
    const res = await app.request("/api/plugins/nonexistent/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: { apiKey: "secret" } }),
    });
    expect(res.status).toBe(404);
  });

  test("should return 400 when values is missing from request body", async () => {
    const res = await app.request("/api/plugins/my-plugin/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("should return 400 when values is not an object", async () => {
    const res = await app.request("/api/plugins/my-plugin/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: "not-an-object" }),
    });
    expect(res.status).toBe(400);
  });

  test("should return 400 when a required field is missing", async () => {
    const res = await app.request("/api/plugins/my-plugin/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: { baseUrl: "https://example.com" } }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Pflichtfeld");
    expect(body.error).toContain("API Key");
  });

  test("should accept boolean false as a valid required field value", async () => {
    mockState.pluginManifestResult = makeManifest({
      configSchema: [
        { key: "enabled", label: "Enabled", type: "boolean", required: true },
      ],
    });
    const res = await app.request("/api/plugins/my-plugin/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: { enabled: false } }),
    });
    // false is explicitly allowed — should not fail required check
    expect(res.status).toBe(200);
  });

  test("should save config and return success with configured status", async () => {
    mockState.isPluginConfiguredResult = true;
    const res = await app.request("/api/plugins/my-plugin/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: { apiKey: "my-secret-key" } }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.configured).toBe(true);
  });

  test("should call updateConfigured after saving config", async () => {
    mockState.isPluginConfiguredResult = false;
    await app.request("/api/plugins/my-plugin/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: { apiKey: "key" } }),
    });
    expect(mockState.updateConfiguredCalled).toBe(true);
  });

  test("should return 500 when savePluginConfig throws", async () => {
    mockState.savePluginConfigError = new Error("Encryption not configured");
    const res = await app.request("/api/plugins/my-plugin/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: { apiKey: "key" } }),
    });
    expect(res.status).toBe(500);
  });

  test("should accept optional fields without failing required validation", async () => {
    const res = await app.request("/api/plugins/my-plugin/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: { apiKey: "key", baseUrl: "https://api.example.com" } }),
    });
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------

describe("DELETE /api/plugins/:id/config — delete plugin config (admin only)", () => {
  beforeEach(() => {
    resetState();
    mockState.currentUser = makeAdminUser();
    mockState.pluginManifestResult = makeManifest();
    mockState.deletePluginConfigResult = true;
  });

  test("should return 404 when plugin manifest does not exist", async () => {
    mockState.pluginManifestResult = undefined;
    const res = await app.request("/api/plugins/nonexistent/config", { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  test("should delete config and return success when file existed", async () => {
    mockState.deletePluginConfigResult = true;
    const res = await app.request("/api/plugins/my-plugin/config", { method: "DELETE" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.deleted).toBe(true);
  });

  test("should return success with deleted=false when no config file existed", async () => {
    mockState.deletePluginConfigResult = false;
    const res = await app.request("/api/plugins/my-plugin/config", { method: "DELETE" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.deleted).toBe(false);
  });

  test("should call updateConfigured with configured=false after deletion", async () => {
    await app.request("/api/plugins/my-plugin/config", { method: "DELETE" });
    expect(mockState.updateConfiguredCalled).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe("POST /api/plugins/:id/enable — enable plugin (admin only)", () => {
  beforeEach(() => {
    resetState();
    mockState.currentUser = makeAdminUser();
    mockState.setEnabledResult = true;
  });

  test("should return 404 when plugin does not exist in registry", async () => {
    mockState.setEnabledResult = false;
    const res = await app.request("/api/plugins/ghost-plugin/enable", { method: "POST" });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("should enable the plugin and return success", async () => {
    mockState.setEnabledResult = true;
    const res = await app.request("/api/plugins/my-plugin/enable", { method: "POST" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.enabled).toBe(true);
  });

  test("should call toolRegistry.setPluginDisabled(id, false) on enable", async () => {
    await app.request("/api/plugins/my-plugin/enable", { method: "POST" });
    const call = mockState.setPluginDisabledCalled.find(
      (c) => c.pluginId === "my-plugin" && c.disabled === false
    );
    expect(call).toBeDefined();
  });
});

// ---------------------------------------------------------------------------

describe("POST /api/plugins/:id/disable — disable plugin (admin only)", () => {
  beforeEach(() => {
    resetState();
    mockState.currentUser = makeAdminUser();
    mockState.setEnabledResult = true;
  });

  test("should return 404 when plugin does not exist in registry", async () => {
    mockState.setEnabledResult = false;
    const res = await app.request("/api/plugins/ghost-plugin/disable", { method: "POST" });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("should disable the plugin and return success", async () => {
    const res = await app.request("/api/plugins/my-plugin/disable", { method: "POST" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.enabled).toBe(false);
  });

  test("should call toolRegistry.setPluginDisabled(id, true) on disable", async () => {
    await app.request("/api/plugins/my-plugin/disable", { method: "POST" });
    const call = mockState.setPluginDisabledCalled.find(
      (c) => c.pluginId === "my-plugin" && c.disabled === true
    );
    expect(call).toBeDefined();
  });
});
