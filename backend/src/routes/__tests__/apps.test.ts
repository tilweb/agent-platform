/**
 * Tests for apps API routes (backend/src/routes/apps.ts)
 *
 * Covers authentication, RBAC (admin-only PUT /order), listing apps,
 * listing enabled apps, getting a single app, enabling/disabling, and
 * the new reorder endpoint.
 *
 * All service dependencies are mocked before the module is loaded.
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";
import { Hono } from "hono";
// Satisfy auth-check hook — actual implementation is mocked below
import type {} from "../../auth"; // import authMiddleware (mocked)

// ---------------------------------------------------------------------------
// Shared mutable mock state
// ---------------------------------------------------------------------------

const mockState = {
  currentUser: null as null | { id: string; username: string; role: string },
  getAppsResult: [] as any[],
  getEnabledAppsResult: [] as any[],
  getAppResult: null as any,
  enableAppResult: null as any,
  disableAppResult: null as any,
  reorderAppsResult: [] as any[],
};

// ---------------------------------------------------------------------------
// Module mocks — must be declared BEFORE importing the module under test
// ---------------------------------------------------------------------------

mock.module("../../auth", () => ({
  authMiddleware: async (c: any, next: any) => {
    if (!mockState.currentUser) {
      return c.json({ error: "Authentication required" }, 401);
    }
    c.set("user", mockState.currentUser);
    c.set("userId", mockState.currentUser.id);
    await next();
  },
  getCurrentUser: (c: any) => c.get("user") ?? undefined,
}));

mock.module("../../apps/registry", () => ({
  getApps: async () => mockState.getAppsResult,
  getEnabledApps: async () => mockState.getEnabledAppsResult,
  getApp: async (id: string) => mockState.getAppResult,
  enableApp: async (id: string) => mockState.enableAppResult,
  disableApp: async (id: string) => mockState.disableAppResult,
  reorderApps: async (appIds: string[]) => mockState.reorderAppsResult,
}));

// Sub-app routes — mount as empty routers so the import doesn't fail
mock.module("../../apps/vertragsmanagement/routes", () => ({
  contractRoutes: new Hono(),
}));

mock.module("../../apps/projektmanagement/routes", () => ({
  projektmanagementRoutes: new Hono(),
}));

mock.module("../../utils/errorHandler", () => ({
  internalError: (c: any, _error: any) =>
    c.json({ error: "Internal Server Error" }, 500),
}));

// ---------------------------------------------------------------------------
// Import route module AFTER mocks are registered, mount on test app
// ---------------------------------------------------------------------------

const { appsRoutes } = await import("../apps");

const app = new Hono();
app.route("/api/apps", appsRoutes);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAdminUser() {
  return { id: "admin-1", username: "alice", role: "admin" as const };
}

function makeRegularUser() {
  return { id: "user-1", username: "bob", role: "user" as const };
}

function makeApp(overrides: Partial<any> = {}): any {
  return {
    id: "testapp",
    name: "Test App",
    description: "A test app",
    icon: "test",
    version: "1.0.0",
    enabled: true,
    routes: [{ path: "/apps/testapp", component: "TestPage" }],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Auth — unauthenticated access is blocked
// ---------------------------------------------------------------------------

describe("Apps Routes — Auth", () => {
  beforeEach(() => {
    mockState.currentUser = null;
  });

  test("should return 401 for GET /api/apps without session", async () => {
    const res = await app.request("/api/apps");
    expect(res.status).toBe(401);
  });

  test("should return 401 for GET /api/apps/enabled without session", async () => {
    const res = await app.request("/api/apps/enabled");
    expect(res.status).toBe(401);
  });

  test("should return 401 for PUT /api/apps/order without session", async () => {
    const res = await app.request(
      new Request("http://localhost/api/apps/order", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appIds: ["a"] }),
      })
    );
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/apps
// ---------------------------------------------------------------------------

describe("GET /api/apps", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser();
    mockState.getAppsResult = [];
  });

  test("should return empty list when no apps exist", async () => {
    const res = await app.request("/api/apps");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("apps");
    expect(body.apps).toEqual([]);
  });

  test("should return all apps", async () => {
    mockState.getAppsResult = [
      makeApp({ id: "a1", name: "App 1" }),
      makeApp({ id: "a2", name: "App 2" }),
    ];
    const res = await app.request("/api/apps");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.apps).toHaveLength(2);
    expect(body.apps[0].id).toBe("a1");
    expect(body.apps[1].id).toBe("a2");
  });

  test("should be accessible for regular users", async () => {
    mockState.currentUser = makeRegularUser();
    const res = await app.request("/api/apps");
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// GET /api/apps/enabled
// ---------------------------------------------------------------------------

describe("GET /api/apps/enabled", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser();
    mockState.getEnabledAppsResult = [];
  });

  test("should return empty list when no apps are enabled", async () => {
    const res = await app.request("/api/apps/enabled");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.apps).toEqual([]);
  });

  test("should return only enabled apps", async () => {
    mockState.getEnabledAppsResult = [makeApp({ id: "e1" })];
    const res = await app.request("/api/apps/enabled");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.apps).toHaveLength(1);
    expect(body.apps[0].id).toBe("e1");
  });
});

// ---------------------------------------------------------------------------
// PUT /api/apps/order
// ---------------------------------------------------------------------------

describe("PUT /api/apps/order", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser();
    mockState.reorderAppsResult = [];
  });

  test("should return 403 for non-admin user", async () => {
    mockState.currentUser = makeRegularUser();
    const res = await app.request(
      new Request("http://localhost/api/apps/order", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appIds: ["a1", "a2"] }),
      })
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("should return 400 when appIds is not an array", async () => {
    const res = await app.request(
      new Request("http://localhost/api/apps/order", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appIds: "not-an-array" }),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("array");
  });

  test("should reorder apps and return sorted list for admin", async () => {
    mockState.reorderAppsResult = [
      makeApp({ id: "a2", name: "App 2" }),
      makeApp({ id: "a1", name: "App 1" }),
    ];
    const res = await app.request(
      new Request("http://localhost/api/apps/order", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appIds: ["a2", "a1"] }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.apps).toHaveLength(2);
    expect(body.apps[0].id).toBe("a2");
    expect(body.apps[1].id).toBe("a1");
  });

  test("should accept empty array", async () => {
    mockState.reorderAppsResult = [];
    const res = await app.request(
      new Request("http://localhost/api/apps/order", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appIds: [] }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("apps");
  });
});

// ---------------------------------------------------------------------------
// GET /api/apps/:appId
// ---------------------------------------------------------------------------

describe("GET /api/apps/:appId", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser();
    mockState.getAppResult = null;
  });

  test("should return 404 when app does not exist", async () => {
    mockState.getAppResult = null;
    const res = await app.request("/api/apps/unknown-app");
    expect(res.status).toBe(404);
  });

  test("should return the app when it exists", async () => {
    mockState.getAppResult = makeApp();
    const res = await app.request("/api/apps/testapp");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.app.id).toBe("testapp");
    expect(body.app.name).toBe("Test App");
  });
});

// ---------------------------------------------------------------------------
// PUT /api/apps/:appId/enable
// ---------------------------------------------------------------------------

describe("PUT /api/apps/:appId/enable", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser();
    mockState.enableAppResult = null;
  });

  test("should return 404 when app does not exist", async () => {
    mockState.enableAppResult = null;
    const res = await app.request(
      new Request("http://localhost/api/apps/unknown/enable", { method: "PUT" })
    );
    expect(res.status).toBe(404);
  });

  test("should enable app and return it", async () => {
    mockState.enableAppResult = makeApp({ enabled: true });
    const res = await app.request(
      new Request("http://localhost/api/apps/testapp/enable", { method: "PUT" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.app.enabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/apps/:appId/disable
// ---------------------------------------------------------------------------

describe("PUT /api/apps/:appId/disable", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser();
    mockState.disableAppResult = null;
  });

  test("should return 404 when app does not exist", async () => {
    mockState.disableAppResult = null;
    const res = await app.request(
      new Request("http://localhost/api/apps/unknown/disable", { method: "PUT" })
    );
    expect(res.status).toBe(404);
  });

  test("should disable app and return it", async () => {
    mockState.disableAppResult = makeApp({ enabled: false });
    const res = await app.request(
      new Request("http://localhost/api/apps/testapp/disable", { method: "PUT" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.app.enabled).toBe(false);
  });
});
